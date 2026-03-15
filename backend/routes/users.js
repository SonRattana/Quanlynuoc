const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

// 1. LẤY DANH SÁCH TÀI KHOẢN (Đã tích hợp Phân trang)
router.get("/", verifyToken, requireAdmin, async (req, res) => {
    try {
        // Nhận tham số trang từ Frontend (mặc định trang 1, mỗi trang 10 người)
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Đếm tổng số lượng user để tính số trang
        const [countResult] = await db.query("SELECT COUNT(*) as total FROM users");
        const totalUsers = countResult[0].total;
        const totalPages = Math.ceil(totalUsers / limit);

        // Lấy dữ liệu của trang hiện tại
        const [users] = await db.query(
            "SELECT id, username, email, role FROM users ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        // Trả về dạng object chứa data và tổng số trang cho Component Pagination hoạt động
        res.json({
            data: users,
            totalPages: totalPages
        });
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy danh sách tài khoản" });
    }
});

// 2. TẠO TÀI KHOẢN MỚI (Đã thêm biến email)
router.post("/", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        if (!username || !password) 
            return res.status(400).json({ message: "Vui lòng nhập tên đăng nhập và mật khẩu" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Bổ sung email vào câu lệnh INSERT
        await db.query(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)", 
            [username, email || '', hashedPassword, role || 'user']
        );
        res.status(201).json({ message: "Tạo tài khoản thành công!" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "Tên đăng nhập hoặc Email này đã tồn tại!" });
        }
        res.status(500).json({ message: "Lỗi server DB" });
    }
});

// 3. CẬP NHẬT TÀI KHOẢN
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, role, password } = req.body;
        const userId = req.params.id;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await db.query(
                "UPDATE users SET username = ?, email = ?, role = ?, password = ? WHERE id = ?", 
                [username, email || '', role, hashedPassword, userId]
            );
        } else {
            await db.query(
                "UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?", 
                [username, email || '', role, userId]
            );
        }
        res.json({ message: "Cập nhật thành công" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi cập nhật tài khoản" });
    }
});

// 4. XÓA TÀI KHOẢN
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
    try {
        if (req.user.id == req.params.id) {
            return res.status(400).json({ message: "Không thể tự xóa tài khoản của chính mình!" });
        }
        await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ message: "Đã xóa tài khoản" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi xóa tài khoản" });
    }
});

module.exports = router;