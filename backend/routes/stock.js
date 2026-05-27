const router = require("express").Router();
const db = require("../db");
const { verifyToken, checkRole, requireAdmin } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");

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
                w.name AS warehouse_name
             FROM stock_transactions st
             JOIN products p ON st.product_id = p.id
             LEFT JOIN warehouses w ON st.warehouse_id = w.id
             ${whereClause}
             ORDER BY st.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countRows] = await db.query(`SELECT COUNT(*) as total FROM stock_transactions st ${whereClause}`, params);

        res.json({ data: rows, totalPages: Math.ceil(countRows[0].total / limit) });
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ================= IMPORT (NHẬP KHO) =================
router.post("/import", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { product_id, quantity, reason, warehouse_id } = req.body;

        if (!product_id || !quantity || !warehouse_id)
            return res.status(400).json({ message: "Thiếu dữ liệu (Sản phẩm, Số lượng hoặc Kho)" });

        if (quantity <= 0) return res.status(400).json({ message: "Số lượng phải > 0" });

        await connection.beginTransaction();

        // 1. Cập nhật tồn kho TỔNG (bảng products)
        await connection.query(
            "UPDATE products SET quantity = quantity + ? WHERE id = ?",
            [quantity, product_id]
        );

        // 2. Cập nhật tồn kho CHI TIẾT (bảng warehouse_products)
        // [ĐÃ SỬA]: Thay vì SELECT id, ta SELECT quantity (vì bảng của anh không có cột id)
        const [whRows] = await connection.query(
            "SELECT quantity FROM warehouse_products WHERE warehouse_id = ? AND product_id = ?",
            [warehouse_id, product_id]
        );

        if (whRows.length > 0) {
            // Nếu sản phẩm đã có trong kho này -> Cộng thêm
            await connection.query(
                "UPDATE warehouse_products SET quantity = quantity + ? WHERE warehouse_id = ? AND product_id = ?",
                [quantity, warehouse_id, product_id]
            );
        } else {
            // Nếu chưa có -> Tạo mới
            await connection.query(
                "INSERT INTO warehouse_products (warehouse_id, product_id, quantity) VALUES (?, ?, ?)",
                [warehouse_id, product_id, quantity]
            );
        }

        // 3. Ghi log có gắn ID kho
        await connection.query(
            "INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason) VALUES (?, ?, 'import', ?, ?)",
            [product_id, warehouse_id, quantity, reason || "Nhập kho"]
        );

        // 4. Ghi log vào bảng logs
        await logAction(connection, req.user.id, "import", "Nhập kho", { product_id, warehouse_id, quantity, reason });

        await connection.commit();
        res.json({ message: "Nhập kho thành công" });
    } catch (err) {
        await connection.rollback();
        // In log ra màn hình console của Backend để biết chính xác MySQL đang chửi cái gì
        console.error("🚨 LỖI IMPORT:", err.message);
        res.status(500).json({ message: "Lỗi Server: " + err.message });
    } finally {
        connection.release();
    }
});
// ==========================================
// TỔNG HỢP TỒN KHO HIỆN TẠI TỪ TẤT CẢ CÁC KHO
// (Hàm này Frontend dùng để vẽ bảng Mắt Thần)
// ==========================================
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
            ORDER BY w.id ASC, p.name ASC`
        );

        res.json({ data: rows });
    } catch (err) {
        console.error("Lỗi truy vấn tồn kho:", err);
        res.status(500).json({ message: "Lỗi Server khi lấy dữ liệu tồn kho!" });
    }
});

// ================= TRANSFER / EXPORT (CHUYỂN KHO CHUẨN POS) =================
router.post("/export", verifyToken, requireAdmin, async (req, res) => {
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

        // 2. Trừ kho NGUỒN
        await connection.query(
            "UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?",
            [quantity, warehouse_id, product_id]
        );

        // 3. Nếu có Kho Đích -> Cộng vào Kho ĐÍCH (Logistics nội bộ)
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
            // Nếu KHÔNG có kho đích (Xuất hủy/Hết hạn) -> Trừ luôn vào kho tổng công ty
            await connection.query(
                "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                [quantity, product_id]
            );
        }

        // 4. Ghi log lịch sử (Sử dụng target_warehouse_id từ ERD của anh)
        await connection.query(
            `INSERT INTO stock_transactions 
            (product_id, warehouse_id, target_warehouse_id, type, quantity, reason) 
            VALUES (?, ?, ?, 'export', ?, ?)`,
            [product_id, warehouse_id, target_warehouse_id || null, quantity, reason || "Chuyển kho"]
        );

        // 5. Ghi log vào bảng logs
        await logAction(connection, req.user.id, "export", "Chuyển kho", { product_id, warehouse_id, target_warehouse_id, quantity, reason });

        await connection.commit();
        res.json({ message: "Thao tác kho thành công" });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// ================= THÊM KHO MỚI (CHỈ ADMIN MỚI CÓ QUYỀN) =================
router.post("/warehouses", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === "") {
            return res.status(400).json({ message: "Vui lòng nhập tên kho!" });
        }

        // Kiểm tra xem tên kho này đã tồn tại chưa để tránh trùng lặp
        const [existing] = await db.query("SELECT id FROM warehouses WHERE name = ?", [name.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Tên kho này đã có trên hệ thống rồi bạn ơi!" });
        }

        // Nhét vào Database
        const [result] = await db.query("INSERT INTO warehouses (name) VALUES (?)", [name.trim()]);

        // Ghi log
        await logAction(db, req.user.id, "create_warehouse", "Thêm kho mới", { name: name.trim() });

        res.json({ message: `Đã mở thành công: ${name.trim()}`, id: result.insertId });
    } catch (err) {
        console.error("Lỗi tạo kho mới:", err);
        res.status(500).json({ message: "Lỗi Server khi tạo kho!" });
    }
});

// ================= SỬA TÊN KHO (CHỈ ADMIN) =================
router.put("/warehouses/:id", verifyToken, requireAdmin, async (req, res) => {
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

// ================= XÓA KHO CÓ BẢO VỆ (CHỈ ADMIN) =================
router.delete("/warehouses/:id", verifyToken, requireAdmin, async (req, res) => {
    try {
        const warehouseId = req.params.id;

        // 1. CẦU DAO AN TOÀN: Kiểm tra xem kho này có đang chứa hàng không?
        // SỬA LỖI Ở ĐÂY: Dùng product_id thay vì id vì bảng này không có cột id
        const [checkStock] = await db.query(
            "SELECT product_id FROM warehouse_products WHERE warehouse_id = ? AND quantity > 0 LIMIT 1",
            [warehouseId]
        );

        if (checkStock.length > 0) {
            return res.status(400).json({ message: "⛔ Kho này đang chứa hàng! Bạn phải xuất hết hàng đi nơi khác mới được xóa." });
        }

        // 2. DỌN DẸP RÁC: Xóa các dòng dữ liệu ảo (số lượng <= 0) của kho này trong warehouse_products để tránh vướng khóa ngoại
        await db.query("DELETE FROM warehouse_products WHERE warehouse_id = ? AND quantity <= 0", [warehouseId]);

        // 3. Thực hiện Xóa Kho chính
        await db.query("DELETE FROM warehouses WHERE id = ?", [warehouseId]);
        res.json({ message: "Đã xóa kho thành công!" });

    } catch (err) {
        // Nếu DB báo lỗi Ràng buộc khóa ngoại (Foreign Key) do đã có lịch sử xuất/nhập
        if (err.code && err.code.includes('ER_ROW_IS_REFERENCED')) {
            return res.status(400).json({ message: "⛔ Kho này đã có lịch sử giao dịch, không thể xóa để bảo toàn dữ liệu đối soát!" });
        }
        console.error("Lỗi xóa kho:", err);
        res.status(500).json({ message: "Lỗi Server: Không thể xóa kho!" });
    }
});


module.exports = router;