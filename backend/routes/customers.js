const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const { logAction } = require("../utils/logger");

// 1. LẤY TẤT CẢ KHÁCH ĐANG ACTIVE (CÓ LỌC & TÍNH TOÁN VỎ TRỰC TIẾP)
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { search, address, type, delivery_method } = req.query;

    let baseQuery = ' FROM customers c WHERE c.is_active = 1';
    let queryParams = [];

    if (search) {
      baseQuery += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    if (address) {
      baseQuery += ' AND c.address LIKE ?';
      queryParams.push(`%${address}%`);
    }
    if (type) {
      baseQuery += ' AND c.type = ?';
      queryParams.push(type);
    }
    if (delivery_method) {
      baseQuery += ' AND c.delivery_method = ?';
      queryParams.push(delivery_method);
    }

    const [countRows] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
    const total = countRows[0].total;

    // 💡 ĐÃ SỬA CHỖ NÀY: Dùng Sub-Query để tự động đếm "Vỏ còn nợ" và "Tiền cọc giữ"
    const sql = `
      SELECT 
        c.*,
        COALESCE((
          SELECT SUM(CASE WHEN type = 'deposit' THEN quantity ELSE -quantity END)
          FROM bottle_deposits 
          WHERE customer_id = c.id
        ), 0) AS remaining_bottles,
        COALESCE((
          SELECT SUM(CASE WHEN type = 'deposit' THEN deposit_amount ELSE -deposit_amount END)
          FROM bottle_deposits 
          WHERE customer_id = c.id
        ), 0) AS deposit_balance
      ${baseQuery} 
      ORDER BY c.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const finalParams = [...queryParams, limit, offset];

    const [rows] = await db.query(sql, finalParams);

    res.json({ rows, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. THÊM KHÁCH HÀNG (Cập nhật lưu delivery_method)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, phone, email, address, type, delivery_method } = req.body;

    const [existing] = await db.query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [phone]);

    if (existing.length > 0) {
      const customer = existing[0];
      if (customer.is_active === 0) {
        await db.query(`UPDATE customers SET name=?, address=?, email=?, type=?, delivery_method=?, is_active=1 WHERE id=?`,
          [name, address, email || null, type || 'le', delivery_method || 'giao_hang', customer.id]);
        await logAction(req, "RESTORE", "customers", customer.id, null, req.body, `Khôi phục khách hàng cũ: ${name}`);
        return res.json({ message: 'Khôi phục khách hàng cũ thành công', code: customer.customer_code });
      }
      return res.status(400).json({ message: 'Số điện thoại này đã tồn tại' });
    }

    const [result] = await db.query(
      `INSERT INTO customers (name, phone, email, address, type, delivery_method) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, address, type || 'le', delivery_method || 'giao_hang']
    );
    const newId = result.insertId;
    const code = 'KH' + newId;
    await db.query('UPDATE customers SET customer_code = ? WHERE id = ?', [code, newId]);

    await logAction(req, "CREATE", "customers", newId, null, req.body, `Tạo khách hàng mới: ${name}`);
    res.json({ message: 'Tạo khách hàng thành công', code });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. SỬA KHÁCH HÀNG (Cập nhật lưu delivery_method)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, phone, email, address, type, delivery_method } = req.body;
    const { id } = req.params;

    const [oldData] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    const [checkDup] = await db.query('SELECT id FROM customers WHERE phone = ? AND id != ? AND is_active = 1', [phone, id]);

    if (checkDup.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại này đã được người khác sử dụng' });
    }

    await db.query(
      `UPDATE customers SET name=?, phone=?, email=?, address=?, type=?, delivery_method=? WHERE id=?`,
      [name, phone, email || null, address, type, delivery_method, id]
    );

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
    await logAction(req, "DELETE", "customers", req.params.id, null, null, `Xóa khách hàng: ${oldData[0]?.name}`);
    res.json({ message: 'Đã xoá khách hàng' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 5. THỐNG KÊ TỔNG HỢP
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(*) as total_customers,
        SUM(CASE WHEN created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 ELSE 0 END) as new_this_month,
        SUM(CASE WHEN created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 ELSE 0 END) as old_customers
      FROM customers WHERE is_active = 1
    `);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 6. LẤY TIỀN CỌC
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
      -- BỎ ĐI CÁI HAVING bottles > 0 NẾU SẾP MUỐN XEM CẢ LỊCH SỬ VỎ ĐÃ TRẢ HẾT
      -- HOẶC CHỈ ĐỂ LẠI HÀNG ĐANG GIỮ:
    `, [customerId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ================= API THU NỢ THÔNG MINH (TỰ ĐỘNG GẠCH NỢ BILL CŨ) =================
router.post("/pay-debt", verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { customer_id, amount, note } = req.body;
    const payAmount = Number(amount);

    if (!customer_id || !payAmount || payAmount <= 0) {
      return res.status(400).json({ message: "Số tiền thu nợ không hợp lệ" });
    }

    await connection.beginTransaction();

    // 1. Kiểm tra nợ hiện tại của khách
    const [customers] = await connection.query("SELECT name, debt_balance FROM customers WHERE id = ? FOR UPDATE", [customer_id]);
    if (customers.length === 0) throw new Error("Không tìm thấy khách hàng");

    const currentDebt = Number(customers[0].debt_balance);
    if (currentDebt <= 0) throw new Error("Khách hàng này hiện không có nợ");
    if (payAmount > currentDebt) throw new Error(`Khách chỉ nợ ${currentDebt.toLocaleString('vi-VN')}đ, không thể thu dư!`);

    // 2. Trừ nợ tổng trong hồ sơ Khách hàng
    await connection.query("UPDATE customers SET debt_balance = debt_balance - ? WHERE id = ?", [payAmount, customer_id]);

    // 💡 3. TỰ ĐỘNG CUỐN CHIẾU: Tìm các hóa đơn đang nợ từ CŨ NHẤT đến MỚI NHẤT để gạch nợ
    let remainingPay = payAmount;
    const [unpaidInvoices] = await connection.query(
      "SELECT id, total_amount, paid_amount FROM invoices WHERE customer_id = ? AND payment_status IN ('unpaid', 'partial') ORDER BY created_at ASC",
      [customer_id]
    );

    for (let inv of unpaidInvoices) {
      if (remainingPay <= 0) break;

      let invoiceDebt = Number(inv.total_amount) - Number(inv.paid_amount);
      if (invoiceDebt <= 0) continue;

      if (remainingPay >= invoiceDebt) {
        // Trả đủ tiền cho cái hóa đơn này
        await connection.query(
          "UPDATE invoices SET paid_amount = total_amount, payment_status = 'paid' WHERE id = ?",
          [inv.id]
        );
        remainingPay -= invoiceDebt;
      } else {
        // Chỉ đủ trả một phần của hóa đơn này
        await connection.query(
          "UPDATE invoices SET paid_amount = paid_amount + ?, payment_status = 'partial' WHERE id = ?",
          [remainingPay, inv.id]
        );
        remainingPay = 0;
      }
    }

    // 4. Ghi vào Sổ lịch sử giao dịch công nợ
    const transactionNote = note || `Thu nợ khách hàng ${customers[0].name}`;
    await connection.query(
      "INSERT INTO customer_payments (customer_id, amount, transaction_type, note, created_at) VALUES (?, ?, 'pay_debt', ?, NOW())",
      [customer_id, payAmount, transactionNote]
    );

    await connection.commit();
    res.json({ message: "Thu nợ thành công!", remaining_debt: currentDebt - payAmount });
  } catch (err) {
    await connection.rollback();
    console.error("Lỗi thu nợ:", err);
    res.status(400).json({ message: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;