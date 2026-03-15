const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// ================= GET ALL INVOICES (LẤY DANH SÁCH HÓA ĐƠN) =================
router.get("/", verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lấy danh sách hóa đơn, tính luôn tổng tiền hàng của từng hóa đơn
    const [rows] = await db.query(`
      SELECT 
        i.id, 
        i.created_at, 
        c.name AS customer_name,
        (SELECT SUM(quantity * sell_price) FROM invoice_items WHERE invoice_id = i.id) as total_amount,
        i.deposit_amount
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Lấy tổng số đếm để làm phân trang
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM invoices");

    res.json({
      data: rows,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách hóa đơn:", err);
    res.status(500).json({ message: "Lỗi load danh sách hóa đơn" });
  }
});

// Tạo hóa đơn
// Tạo hóa đơn
router.post("/", verifyToken, async (req, res) => {
  const { customer_id, items } = req.body;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1 Tạo invoice
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices (customer_id, created_at)
       VALUES (?, NOW())`,
      [customer_id]
    );

    const invoiceId = invoiceResult.insertId;

    let totalDeposit = 0;
    
    // 2 Insert invoice_items
    for (const item of items) {
      
      // Lấy giá cọc mặc định từ Database để biết sản phẩm này có phải là Vỏ bình không
      const [productRows] = await connection.query(
        `SELECT deposit_price FROM products WHERE id = ?`,
        [item.product_id]
      );
      const defaultDepositPrice = productRows[0]?.deposit_price || 0;

      // Lưu tiền bán nước bình thường
      await connection.query(
        `INSERT INTO invoice_items 
         (invoice_id, product_id, quantity, sell_price)
         VALUES (?, ?, ?, ?)`,
        [invoiceId, item.product_id, item.quantity, item.sell_price]
      );

      // SỬA LỖI Ở ĐÂY: Lấy đúng số lượng nợ vỏ (missing_bottles) và tiền cọc (deposit_fee) do anh tự gõ ở màn hình truyền xuống
      const missing_bottles = item.missing_bottles !== undefined ? item.missing_bottles : item.quantity;
      const depositFee = item.deposit_fee !== undefined ? item.deposit_fee : (missing_bottles * defaultDepositPrice);

      // Chỉ ghi nhận nợ vỏ nếu SP đó là vỏ bình (có giá cọc) VÀ khách có ôm vỏ về (missing_bottles > 0)
      if (defaultDepositPrice > 0 && missing_bottles > 0) {
        
        totalDeposit += depositFee; 

        await connection.query(`
          INSERT INTO bottle_deposits
          (customer_id, product_id, quantity, deposit_amount, type, invoice_id, created_at)
          VALUES (?, ?, ?, ?, 'deposit', ?, NOW())
        `, [customer_id, item.product_id, missing_bottles, depositFee, invoiceId]);

      }
    }

    // Cập nhật tổng tiền cọc vỏ thực tế vào hóa đơn
    await connection.query(
      `UPDATE invoices SET deposit_amount = ? WHERE id = ?`,
      [totalDeposit, invoiceId]
    );
    
    await connection.commit();

    res.json({
      message: "Tạo hóa đơn thành công",
      invoice_id: invoiceId,
    });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: "Lỗi tạo hóa đơn" });
  } finally {
    connection.release();
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  const invoiceId = req.params.id;

  try {

    const [rows] = await db.query(`
SELECT 
  invoices.id,
  invoices.created_at,
  COALESCE(SUM(bottle_deposits.deposit_amount),0) as deposit_amount,
  customers.id as customer_code,
  customers.name as customer_name,
  customers.phone,
  products.name as product_name,
  invoice_items.quantity,
  invoice_items.sell_price
FROM invoices
LEFT JOIN customers ON invoices.customer_id = customers.id
JOIN invoice_items ON invoices.id = invoice_items.invoice_id
JOIN products ON invoice_items.product_id = products.id
LEFT JOIN bottle_deposits 
       ON bottle_deposits.invoice_id = invoices.id
WHERE invoices.id = ?
GROUP BY invoice_items.id
`, [invoiceId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    }

    const invoice = {
      id: rows[0].id,
      created_at: rows[0].created_at,
      deposit_amount: rows[0].deposit_amount || 0,
      customer_code: rows[0].customer_code || "",
      customer_name: rows[0].customer_name || "Khách lẻ",
      phone: rows[0].phone || "",
      items: rows.map(r => ({
        product_name: r.product_name,
        quantity: r.quantity,
        sell_price: r.sell_price
      }))
    };

    res.json(invoice);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi load hóa đơn" });
  }
});

router.post("/return-bottle", verifyToken, async (req, res) => {

  try {

    const { customer_id, product_id, quantity } = req.body;

    const [rows] = await db.query(
      "SELECT deposit_price FROM products WHERE id = ?",
      [product_id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const depositPrice = rows[0].deposit_price || 0;

    const amount = quantity * depositPrice;

    await db.query(`
      INSERT INTO bottle_deposits
      (customer_id, product_id, quantity, deposit_amount, status, type, created_at)
      VALUES (?, ?, ?, ?, 'da_tra', 'refund', NOW())
    `, [customer_id, product_id, quantity, amount]);

    res.json({ message: "Đã trả vỏ thành công" });

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: "Lỗi trả vỏ" });

  }

});


module.exports = router;
