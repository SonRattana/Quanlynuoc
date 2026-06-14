const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// 1. Lấy danh sách chi phí
router.get("/", verifyToken, async (req, res) => {
    try {
        // 💡 TUYỆT CHIÊU: Đổi tên cột lúc lấy lên (category -> expense_type, note -> description) để Frontend hiểu
        const [rows] = await db.query(`
            SELECT 
                id, 
                category AS expense_type, 
                amount, 
                note AS description, 
                expense_date 
            FROM expenses 
            ORDER BY expense_date DESC, id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi lấy chi phí:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi tải chi phí" });
    }
});

// 2. Thêm phiếu chi mới
router.post("/", verifyToken, async (req, res) => {
    try {
        const { expense_type, amount, description, expense_date } = req.body;
        
        if (!expense_type || !amount) {
            return res.status(400).json({ message: "Vui lòng nhập loại chi phí và số tiền" });
        }

        const dateToSave = expense_date || new Date().toISOString().split('T')[0];

        // 💡 BẮT BỆNH: Map đúng biến vào các cột (title, category, note) của bảng expenses
        await db.query(
            "INSERT INTO expenses (title, category, amount, note, expense_date) VALUES (?, ?, ?, ?, ?)",
            [expense_type, expense_type, Number(amount), description || "", dateToSave]
        );
        
        res.status(201).json({ message: "Đã ghi nhận phiếu chi thành công!" });
    } catch (err) {
        console.error("Lỗi thêm chi phí:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi lưu phiếu chi" });
    }
});

// 3. Xóa phiếu chi
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
        res.json({ message: "Đã xóa phiếu chi thành công" });
    } catch (err) {
        console.error("Lỗi xóa chi phí:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi xóa phiếu chi" });
    }
});

module.exports = router;