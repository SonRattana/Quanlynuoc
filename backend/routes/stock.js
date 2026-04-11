const router = require("express").Router();
const db = require("../db");
const { verifyToken, checkRole, requireAdmin } = require("../middleware/authMiddleware");

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

        await connection.commit();
        res.json({ message: "Thao tác kho thành công" });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;