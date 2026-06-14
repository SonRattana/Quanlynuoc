const router = require("express").Router();
const db = require("../db");
const { verifyToken, checkRole, requireAdmin } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");

// 💡 ĐỘNG CƠ FIFO TỰ ĐỘNG 100%: Quét và trừ lùi lô cũ nhất, tính toán giá vốn chính xác
const deductStockFIFO = async (connection, productId, quantityToDeduct) => {
    let remainingQty = Number(quantityToDeduct);
    let totalCostOfGoodsSold = 0;

    // Lấy các lô còn tồn kho, sắp xếp từ cũ tới mới (ORDER BY created_at ASC)
    // Dùng FOR UPDATE để khóa dòng, tránh trường hợp 2 nhân viên cùng xuất 1 lúc bị lệch số
    const [batches] = await connection.query(
        `SELECT id, quantity_remaining, cost_price 
         FROM inventory_batches 
         WHERE product_id = ? AND quantity_remaining > 0 
         ORDER BY created_at ASC FOR UPDATE`,
        [productId]
    );

    const totalAvailable = batches.reduce((sum, b) => sum + Number(b.quantity_remaining), 0);
    if (totalAvailable < remainingQty) {
        throw new Error(`Hệ thống Lô không đủ số lượng! Cần xuất ${remainingQty}, nhưng tổng các lô chỉ còn ${totalAvailable}.`);
    }

    for (let batch of batches) {
        if (remainingQty <= 0) break;

        let currentBatchQty = Number(batch.quantity_remaining);

        if (currentBatchQty >= remainingQty) {
            // Lô này đủ trừ
            await connection.query(
                `UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?`,
                [remainingQty, batch.id]
            );
            totalCostOfGoodsSold += remainingQty * Number(batch.cost_price);
            remainingQty = 0;
        } else {
            // Lô này không đủ trừ -> Vét sạch về 0 và qua lô tiếp theo
            await connection.query(
                `UPDATE inventory_batches SET quantity_remaining = 0 WHERE id = ?`,
                [batch.id]
            );
            totalCostOfGoodsSold += currentBatchQty * Number(batch.cost_price);
            remainingQty -= currentBatchQty;
        }
    }

    return totalCostOfGoodsSold; // Trả về tổng giá vốn thực tế theo đúng các lô đã bị trừ
};

// ================= LẤY DANH SÁCH KHO (MỚI) =================
router.get("/warehouses", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, name FROM warehouses ORDER BY id ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách kho" });
    }
});

// ================= GET STOCK HISTORY =================
router.get("/", verifyToken, async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const type = req.query.type;
        const offset = (page - 1) * limit;

        let whereClause = "";
        let params = [];

        if (type && (type === "import" || type === "export")) {
            whereClause = "WHERE st.type = ?";
            params.push(type);
        }

        const [rows] = await db.query(
            `SELECT 
                st.id, st.type, st.quantity, st.reason, 
                CONCAT(DATE_FORMAT(st.created_at, '%Y-%m-%dT%H:%i:%s'), 'Z') as created_at,
                p.name AS product_name,
                w1.name AS warehouse_name,
                w2.name AS target_warehouse_name
             FROM stock_transactions st
             JOIN products p ON st.product_id = p.id
             LEFT JOIN warehouses w1 ON st.warehouse_id = w1.id
             LEFT JOIN warehouses w2 ON st.target_warehouse_id = w2.id
             ${whereClause}
             ORDER BY st.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countRows] = await db.query(`SELECT COUNT(*) as total FROM stock_transactions st ${whereClause}`, params);

        res.json({ data: rows, totalPages: Math.ceil(countRows[0].total / limit) });
    } catch (err) {
        console.error("Lỗi lấy lịch sử kho:", err);
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ================= IMPORT (NHẬP KHO VÀ TẠO LÔ FIFO) =================
router.post("/import", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { product_id, quantity, reason, warehouse_id } = req.body;

        if (!product_id || !quantity || !warehouse_id)
            return res.status(400).json({ message: "Thiếu dữ liệu (Sản phẩm, Số lượng hoặc Kho)" });

        if (quantity <= 0) return res.status(400).json({ message: "Số lượng phải > 0" });

        await connection.beginTransaction();

        const [prodRows] = await connection.query("SELECT cost_price FROM products WHERE id = ?", [product_id]);
        const costPrice = prodRows.length > 0 ? prodRows[0].cost_price : 0;

        // 1. Cập nhật tồn kho TỔNG
        await connection.query(
            "UPDATE products SET quantity = quantity + ? WHERE id = ?",
            [quantity, product_id]
        );

        // 2. Cập nhật tồn kho CHI TIẾT
        const [whRows] = await connection.query(
            "SELECT quantity FROM warehouse_products WHERE warehouse_id = ? AND product_id = ?",
            [warehouse_id, product_id]
        );

        if (whRows.length > 0) {
            await connection.query(
                "UPDATE warehouse_products SET quantity = quantity + ? WHERE warehouse_id = ? AND product_id = ?",
                [quantity, warehouse_id, product_id]
            );
        } else {
            await connection.query(
                "INSERT INTO warehouse_products (warehouse_id, product_id, quantity) VALUES (?, ?, ?)",
                [warehouse_id, product_id, quantity]
            );
        }

        // 3. TẠO LÔ MỚI VÀO BẢNG inventory_batches
        await connection.query(
            "INSERT INTO inventory_batches (product_id, quantity_imported, quantity_remaining, cost_price, created_at) VALUES (?, ?, ?, ?, NOW())",
            [product_id, quantity, quantity, costPrice]
        );

        // 4. Ghi log có gắn ID kho
        await connection.query(
            "INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason) VALUES (?, ?, 'import', ?, ?)",
            [product_id, warehouse_id, quantity, reason || "Nhập kho"]
        );

        // 5. Ghi log vào bảng logs
        await logAction(req, "IMPORT_STOCK", "stock_transactions", null, null, req.body, "Nhập kho: " + reason);

        await connection.commit();
        res.json({ message: "Nhập kho và tạo lô FIFO thành công" });
    } catch (err) {
        await connection.rollback();
        console.error("🚨 LỖI IMPORT:", err.message);
        res.status(500).json({ message: "Lỗi Server: " + err.message });
    } finally {
        connection.release();
    }
});

// ================= TỔNG HỢP TỒN KHO =================
router.get("/inventory", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT 
                wp.product_id, 
                p.name AS product_name, 
                wp.warehouse_id, 
                w.name AS warehouse_name, 
                wp.quantity 
            FROM warehouse_products wp
            JOIN products p ON wp.product_id = p.id
            JOIN warehouses w ON wp.warehouse_id = w.id
            WHERE p.is_active = 1
            ORDER BY w.id ASC, p.name ASC`
        );
        res.json({ data: rows });
    } catch (err) {
        console.error("Lỗi truy vấn tồn kho:", err);
        res.status(500).json({ message: "Lỗi Server khi lấy dữ liệu tồn kho!" });
    }
});

// ================= TRANSFER / EXPORT =================
router.post("/export", verifyToken, checkRole(['admin', 'ketoan', 'sanxuat']), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { product_id, quantity, reason, warehouse_id, target_warehouse_id } = req.body;

        if (!product_id || !quantity || !warehouse_id)
            return res.status(400).json({ message: "Thiếu dữ liệu giao dịch" });

        await connection.beginTransaction();

        // 1. Kiểm tra tồn kho tại kho NGUỒN
        const [sourceRows] = await connection.query(
            "SELECT quantity FROM warehouse_products WHERE warehouse_id = ? AND product_id = ? FOR UPDATE",
            [warehouse_id, product_id]
        );

        if (!sourceRows.length || sourceRows[0].quantity < quantity) {
            throw new Error("Kho nguồn không đủ số lượng để chuyển!");
        }

        // 💡 2. GỌI ĐỘNG CƠ FIFO TỰ ĐỘNG XỬ LÝ LÔ HÀNG
        await deductStockFIFO(connection, product_id, quantity);

        // 3. Trừ kho NGUỒN
        await connection.query(
            "UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?",
            [quantity, warehouse_id, product_id]
        );

        // 4. Nếu có Kho Đích -> Cộng vào Kho ĐÍCH
        if (target_warehouse_id) {
            const [targetRows] = await connection.query(
                "SELECT quantity FROM warehouse_products WHERE warehouse_id = ? AND product_id = ?",
                [target_warehouse_id, product_id]
            );

            if (targetRows.length > 0) {
                await connection.query(
                    "UPDATE warehouse_products SET quantity = quantity + ? WHERE warehouse_id = ? AND product_id = ?",
                    [quantity, target_warehouse_id, product_id]
                );
            } else {
                await connection.query(
                    "INSERT INTO warehouse_products (warehouse_id, product_id, quantity) VALUES (?, ?, ?)",
                    [target_warehouse_id, product_id, quantity]
                );
            }
        } else {
            // Xuất hủy -> Trừ kho tổng
            await connection.query(
                "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                [quantity, product_id]
            );
        }

        const transType = target_warehouse_id ? 'transfer' : 'damaged';

        await connection.query(
            `INSERT INTO stock_transactions 
            (product_id, warehouse_id, target_warehouse_id, type, quantity, reason, transaction_type) 
            VALUES (?, ?, ?, 'export', ?, ?, ?)`,
            [product_id, warehouse_id, target_warehouse_id || null, quantity, reason || "Chuyển kho", transType]
        );

        await logAction(req, "EXPORT_STOCK", "stock_transactions", null, null, req.body, "Xuất/Chuyển kho: " + reason);

        await connection.commit();
        res.json({ message: "Thao tác kho thành công" });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// ================= THÊM KHO MỚI =================
router.post("/warehouses", verifyToken, verifyToken, checkRole(['admin', 'sanxuat']), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === "") {
            return res.status(400).json({ message: "Vui lòng nhập tên kho!" });
        }

        const [existing] = await db.query("SELECT id FROM warehouses WHERE name = ?", [name.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Tên kho này đã có trên hệ thống rồi bạn ơi!" });
        }

        const [result] = await db.query("INSERT INTO warehouses (name) VALUES (?)", [name.trim()]);
        await logAction(req, "CREATE_WAREHOUSE", "warehouses", null, null, req.body, "Thêm kho mới: " + name);
        res.json({ message: `Đã mở thành công: ${name.trim()}`, id: result.insertId });
    } catch (err) {
        console.error("Lỗi tạo kho mới:", err);
        res.status(500).json({ message: "Lỗi Server khi tạo kho!" });
    }
});

// ================= SỬA TÊN KHO =================
router.put("/warehouses/:id", verifyToken, checkRole(['admin', 'sanxuat']), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === "") return res.status(400).json({ message: "Tên kho không được bỏ trống!" });

        await db.query("UPDATE warehouses SET name = ? WHERE id = ?", [name.trim(), req.params.id]);
        res.json({ message: "Đã đổi tên kho thành công!" });
    } catch (err) {
        console.error("Lỗi sửa tên kho:", err);
        res.status(500).json({ message: "Lỗi Server!" });
    }
});

// ================= XÓA KHO =================
router.delete("/warehouses/:id", verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const warehouseId = req.params.id;

        const [checkStock] = await db.query(
            "SELECT product_id FROM warehouse_products WHERE warehouse_id = ? AND quantity > 0 LIMIT 1",
            [warehouseId]
        );

        if (checkStock.length > 0) {
            return res.status(400).json({ message: "⛔ Kho này đang chứa hàng! Bạn phải xuất hết hàng đi nơi khác mới được xóa." });
        }

        await db.query("DELETE FROM warehouse_products WHERE warehouse_id = ? AND quantity <= 0", [warehouseId]);
        await db.query("DELETE FROM warehouses WHERE id = ?", [warehouseId]);
        res.json({ message: "Đã xóa kho thành công!" });

    } catch (err) {
        if (err.code && err.code.includes('ER_ROW_IS_REFERENCED')) {
            return res.status(400).json({ message: "⛔ Kho này đã có lịch sử giao dịch, không thể xóa để bảo toàn dữ liệu đối soát!" });
        }
        console.error("Lỗi xóa kho:", err);
        res.status(500).json({ message: "Lỗi Server: Không thể xóa kho!" });
    }
});

// ================= CẤP PHÁT NỘI BỘ (GHI CHI PHÍ THEO FIFO) =================
router.post("/internal-issue", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { warehouse_id, product_id, quantity, department_name, reason } = req.body;
        const issueQty = Number(quantity);

        if (!warehouse_id || !product_id || issueQty <= 0 || !department_name) {
            return res.status(400).json({ message: "Vui lòng nhập đủ thông tin và số lượng!" });
        }

        await connection.beginTransaction();

        // 1. Kiểm tra tồn kho tổng tại kho Nguồn
        const [sourceRows] = await connection.query(
            `SELECT wp.quantity, p.name 
             FROM warehouse_products wp 
             JOIN products p ON wp.product_id = p.id 
             WHERE wp.warehouse_id = ? AND wp.product_id = ? FOR UPDATE`,
            [warehouse_id, product_id]
        );

        if (!sourceRows.length || sourceRows[0].quantity < issueQty) {
            throw new Error("Kho không đủ số lượng để xuất cấp phát!");
        }

        const productName = sourceRows[0].name;

        // 💡 2. GỌI ĐỘNG CƠ FIFO VÀ TÍNH TOÁN GIÁ VỐN CHÍNH XÁC
        const totalExpenseValue = await deductStockFIFO(connection, product_id, issueQty);

        // 3. Trừ kho CHI TIẾT
        await connection.query(
            "UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?",
            [issueQty, warehouse_id, product_id]
        );

        // 4. Trừ kho TỔNG
        await connection.query(
            "UPDATE products SET quantity = quantity - ? WHERE id = ?",
            [issueQty, product_id]
        );

        // 5. Ghi sổ Chi phí (Lấy giá trị thực tế của các lô cũ)
        const expenseDescription = `Cấp phát ${issueQty} ${productName} cho ${department_name}. Ghi chú: ${reason || ''}`;
        const expenseDate = new Date().toISOString().split('T')[0];

        await connection.query(
            "INSERT INTO expenses (title, category, amount, note, expense_date) VALUES (?, ?, ?, ?, ?)",
            ['Cấp nước nội bộ', 'Tiêu dùng nội bộ', totalExpenseValue, expenseDescription, expenseDate]
        );

        // 6. Ghi log lịch sử Kho
        await connection.query(
            `INSERT INTO stock_transactions 
            (product_id, warehouse_id, type, quantity, reason, transaction_type) 
            VALUES (?, ?, 'export', ?, ?, ?)`,
            [product_id, warehouse_id, issueQty, `Cấp nội bộ: ${department_name} - ${reason || ''}`, 'internal_use']
        );

        await logAction(req, "INTERNAL_ISSUE", "stock_transactions", null, null, req.body, "Cấp phát nội bộ cho: " + department_name);

        await connection.commit();
        res.json({ message: `Đã cấp phát! Ghi nhận ${new Intl.NumberFormat('vi-VN').format(totalExpenseValue)}đ vào Chi phí.`, expense_recorded: totalExpenseValue });
    } catch (err) {
        await connection.rollback();
        console.error("LỖI XUẤT NỘI BỘ:", err);
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// ================= BÁO CÁO NHẬP XUẤT TỒN =================
router.get("/report-nxt", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.id, 
                p.name, 
                p.item_type,
                p.unit,
                p.quantity AS ton_sl,
                p.cost_price,
                (p.quantity * p.cost_price) AS ton_tt,
                IFNULL(SUM(CASE WHEN st.type = 'import' THEN st.quantity ELSE 0 END), 0) AS nhap_sl,
                IFNULL(SUM(CASE WHEN st.type = 'import' THEN st.quantity * p.cost_price ELSE 0 END), 0) AS nhap_tt,
                IFNULL(SUM(CASE WHEN st.type = 'export' THEN st.quantity ELSE 0 END), 0) AS xuat_sl,
                IFNULL(SUM(CASE WHEN st.type = 'export' THEN st.quantity * p.cost_price ELSE 0 END), 0) AS xuat_tt
            FROM products p
            LEFT JOIN stock_transactions st ON p.id = st.product_id
            WHERE p.is_active = 1
            GROUP BY p.id
            ORDER BY p.item_type ASC, p.name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi báo cáo NXT:", err);
        res.status(500).json({ message: "Lỗi lấy báo cáo Nhập Xuất Tồn" });
    }
});

// ================= LẤY LỊCH SỬ CẤP PHÁT NỘI BỘ =================
router.get("/internal-issues/history", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                st.id,
                CONCAT(DATE_FORMAT(st.created_at, '%d/%m/%Y %H:%i:%s')) as created_at,
                p.name AS product_name,
                w.name AS warehouse_name,
                st.quantity,
                p.cost_price,
                (st.quantity * p.cost_price) AS total_cost,
                st.reason
            FROM stock_transactions st
            JOIN products p ON st.product_id = p.id
            LEFT JOIN warehouses w ON st.warehouse_id = w.id
            WHERE st.transaction_type = 'internal_use' OR st.reason LIKE 'Cấp nội bộ%'
            ORDER BY st.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi lấy lịch sử cấp phát:", err);
        res.status(500).json({ message: "Lỗi lấy dữ liệu cấp phát" });
    }
});

module.exports = router;