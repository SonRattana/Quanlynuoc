const router = require("express").Router();
const db = require("../db");


// IMPORT
router.post("/import", async (req, res) => {
  const connection = await db.getConnection();
  if (!req.body.product_id || !req.body.quantity) {
    return res.status(400).json({ message: "ID sản phẩm và số lượng là bắt buộc" });
  }
  if (typeof req.body.product_id !== 'number' || typeof req.body.quantity !== 'number') {
    return res.status(400).json({ message: "ID sản phẩm và số lượng phải là số" });
  }
  if (req.body.product_id <= 0 || req.body.quantity <= 0) {
    return res.status(400).json({ message: "ID sản phẩm và số lượng không được âm" });
  }
  try {
    const { product_id, quantity } = req.body;

    await connection.beginTransaction();

    await connection.query(
      "UPDATE products SET quantity = quantity + ? WHERE id = ?",
      [quantity, product_id]
    );

    await connection.query(
      "INSERT INTO stock_transactions (product_id, type, quantity) VALUES (?, 'import', ?)",
      [product_id, quantity]
    );

    await connection.commit();
    res.json({ message: "Nhập kho thành công" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json(err);
  } finally {
    connection.release();
  }
});


// EXPORT
router.post("/export", async (req, res) => {
  const connection = await db.getConnection();

  if (!req.body.product_id || !req.body.quantity) {
    return res.status(400).json({ message: "ID sản phẩm và số lượng là bắt buộc" });
  }
  if (typeof req.body.product_id !== 'number' || typeof req.body.quantity !== 'number') {
    return res.status(400).json({ message: "ID sản phẩm và số lượng phải là số" });
  }
  if (req.body.product_id <= 0 || req.body.quantity <= 0) {
    return res.status(400).json({ message: "ID sản phẩm và số lượng không được âm" });
  }
  try {
    const { product_id, quantity } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT quantity FROM products WHERE id = ?",
      [product_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    if (rows[0].quantity < quantity)
      return res.status(400).json({ message: "Không đủ hàng trong kho" });

    await connection.query(
      "UPDATE products SET quantity = quantity - ? WHERE id = ?",
      [quantity, product_id]
    );

    await connection.query(
      "INSERT INTO stock_transactions (product_id, type, quantity) VALUES (?, 'export', ?)",
      [product_id, quantity]
    );

    await connection.commit();
    res.json({ message: "Xuất kho thành công" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json(err);
  } finally {
    connection.release();
  }
});

module.exports = router;