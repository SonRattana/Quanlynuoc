const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// Middleware chặn cửa, chỉ cho Admin vào
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Cảnh báo: Chỉ Admin mới có quyền xem nhật ký hệ thống!" });
    }
};

// API lấy danh sách log có phân trang
router.get("/", verifyToken, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;

        // Lấy tổng số dòng
        const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM system_logs");

        // Lấy dữ liệu sắp xếp mới nhất lên đầu
        const [rows] = await db.query(`
            SELECT * FROM system_logs 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            data: rows,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        console.error("Lỗi lấy logs:", err);
        res.status(500).json({ message: "Lỗi Server khi tải nhật ký" });
    }
});

module.exports = router;