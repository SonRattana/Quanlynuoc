const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const { logAction } = require("../utils/logger");

// 1. LẤY TẤT CẢ KHÁCH ĐANG ACTIVE (Thêm verifyToken)
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countRows] = await db.query(
      'SELECT COUNT(*) as total FROM customers WHERE is_active = 1'
    );
    const total = countRows[0].total;

    const [rows] = await db.query(
      'SELECT * FROM customers WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    res.json({ rows, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. THÊM KHÁCH HÀNG (Giữ nguyên logic khôi phục rất hay của anh)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, phone, address, type } = req.body;

    const [existing] = await db.query(
      'SELECT * FROM customers WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (existing.length > 0) {
      const customer = existing[0];
      if (customer.is_active === 0) {
        await db.query(`UPDATE customers SET name=?, address=?, type=?, is_active=1 WHERE id=?`, [name, address, type || 'le', customer.id]);

        // [CAMERA] Log khôi phục khách cũ
        await logAction(req, "RESTORE", "customers", customer.id, null, req.body, `Khôi phục khách hàng cũ: ${name}`);

        return res.json({ message: 'Khôi phục khách hàng cũ thành công', code: customer.customer_code });
      }
      return res.status(400).json({ message: 'Số điện thoại này đã tồn tại' });
    }

    const [result] = await db.query(`INSERT INTO customers (name, phone, address, type) VALUES (?, ?, ?, ?)`, [name, phone, address, type || 'le']);
    const newId = result.insertId;
    const code = 'KH' + newId;
    await db.query('UPDATE customers SET customer_code = ? WHERE id = ?', [code, newId]);

    // [CAMERA] Log tạo mới
    await logAction(req, "CREATE", "customers", newId, null, req.body, `Tạo khách hàng mới: ${name}`);

    res.json({ message: 'Tạo khách hàng thành công', code });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. SỬA KHÁCH HÀNG (MỚI: Chặn trùng SĐT khi sửa)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, phone, address, type } = req.body;
    const { id } = req.params;

    // Kiểm tra xem SĐT mới có bị trùng với ai khác không (trừ chính nó)
    const [checkDup] = await db.query(
      'SELECT id FROM customers WHERE phone = ? AND id != ? AND is_active = 1',
      [phone, id]
    );

    if (checkDup.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại này đã được người khác sử dụng' });
    }

    await db.query(
      `UPDATE customers SET name=?, phone=?, address=?, type=? WHERE id=?`,
      [name, phone, address, type, id]
    );

    // [CAMERA] Log cập nhật
    await logAction(req, "UPDATE", "customers", id, oldData[0], req.body, `Cập nhật khách hàng: ${name}`);

    res.json({ message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. XOÁ MỀM
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const [oldData] = await db.query("SELECT name FROM customers WHERE id = ?", [req.params.id]);
    await db.query('UPDATE customers SET is_active = 0 WHERE id = ?', [req.params.id]);

    // [CAMERA] Log xóa
    await logAction(req, "DELETE", "customers", req.params.id, null, null, `Xóa khách hàng: ${oldData[0]?.name}`);

    res.json({ message: 'Đã xoá khách hàng' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 5. THỐNG KÊ TỔNG HỢP (Dùng chung 1 route cho Dashboard để tối ưu tốc độ)
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        COUNT(*) as total_customers,
        SUM(CASE 
              WHEN created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
              THEN 1 ELSE 0 
            END) as new_this_month,
        SUM(CASE 
              WHEN created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
              THEN 1 ELSE 0 
            END) as old_customers
      FROM customers
      WHERE is_active = 1
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. LẤY TIỀN CỌC (Giữ nguyên)
router.get("/:id/deposit", verifyToken, async (req, res) => {
  try {
    const customerId = req.params.id;
    const [rows] = await db.query(`
      SELECT p.id AS product_id, p.name,
      SUM(CASE WHEN bd.type = 'deposit' THEN bd.quantity WHEN bd.type = 'refund' THEN -bd.quantity END) AS bottles,
      SUM(CASE WHEN bd.type = 'deposit' THEN bd.deposit_amount WHEN bd.type = 'refund' THEN -bd.deposit_amount END) AS deposit_money
      FROM bottle_deposits bd
      LEFT JOIN products p ON bd.product_id = p.id
      WHERE bd.customer_id = ?
      GROUP BY bd.product_id, p.name
      HAVING bottles > 0 AND deposit_money > 0
    `, [customerId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;