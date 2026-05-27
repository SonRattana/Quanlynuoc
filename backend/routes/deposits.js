const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");
// Hoàn tiền
router.post("/refund", verifyToken, async (req, res) => {
    // 1. Nhận thêm biến 'note' từ Frontend gửi lên
    const { customer_id, product_id, quantity, amount_per_unit, note } = req.body;

    // 2. SỬA LỖI Ở ĐÂY: Chỉ chặn số âm (< 0), cho phép số 0
    if (!customer_id || quantity <= 0 || amount_per_unit === undefined || amount_per_unit < 0) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
    }

    const totalRefund = quantity * amount_per_unit;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Check khách tồn tại
        const [customerRows] = await connection.query(
            `SELECT id FROM customers WHERE id = ? FOR UPDATE`,
            [customer_id]
        );

        if (customerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Không tìm thấy khách hàng" });
        }

        // TÍNH BALANCE TỪ bottle_deposits
        const [balanceRows] = await connection.query(
            `
            SELECT 
              COALESCE(SUM(
                CASE 
                  WHEN type = 'deposit' THEN deposit_amount
                  WHEN type = 'refund' THEN -deposit_amount
                  ELSE 0
                END
              ), 0) AS balance
            FROM bottle_deposits
            WHERE customer_id = ?
            FOR UPDATE
            `,
            [customer_id]
        );

        const currentBalance = balanceRows[0].balance || 0;

        // update vỏ khách đã trả
        await connection.query(
            `UPDATE bottle_deposits
             SET status = 'da_tra'
             WHERE customer_id = ?
             AND status = 'dang_giu'
             LIMIT ?`,
            [customer_id, quantity]
        );

        // 3. SỬA LỖI Ở ĐÂY: Lưu thêm cột 'note' vào Database
        await connection.query(
            `INSERT INTO bottle_deposits
             (customer_id, product_id, quantity, deposit_amount, status, type, note, created_at)
             VALUES (?, ?, ?, ?, 'da_tra', 'refund', ?, NOW())`,
            [customer_id, product_id, quantity, totalRefund, note || '']
        );

        await connection.commit();
        
       // [CAMERA] Ghi log hoàn tiền
        await logAction(req, "REFUND_MONEY", "bottle_deposits", result.insertId, null, req.body, `Hoàn tiền cọc: ${totalRefund.toLocaleString()}đ cho khách ID: ${customer_id}`);


        res.json({
            message: "Hoàn tiền thành công",
            remaining_balance: currentBalance - totalRefund
        });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Lỗi hoàn tiền" });
    } finally {
        connection.release();
    }
});

// Lấy số dư hiện tại của khách
router.get("/balance/:customerId", verifyToken, async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const [rows] = await db.query(`
      SELECT 
        COALESCE(SUM(
          CASE
            WHEN type = 'deposit' THEN deposit_amount
            WHEN type = 'refund' THEN -deposit_amount
          END
        ),0) AS balance
      FROM bottle_deposits
      WHERE customer_id = ?
    `, [customerId]);
    res.json({ balance: rows[0].balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy lịch sử hoàn tiền
router.get('/history/:customer_id', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT *
       FROM bottle_deposits
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
            [req.params.customer_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;