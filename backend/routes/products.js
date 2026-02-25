const router = require("express").Router();
const db = require("../db");


// GET ALL PRODUCTS
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET PRODUCT BY ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});


// ADD PRODUCT
router.post("/", async (req, res) => {
  const { name, volume, unit, cost_price, sell_price } = req.body;

  // ===== Validate =====
  if (!name?.trim()) {
    return res.status(400).json({ message: "Tên sản phẩm là bắt buộc" });
  }

  if (!Number.isInteger(volume) || volume <= 0) {
    return res.status(400).json({ message: "Thể tích phải là số nguyên dương" });
  }

  const allowedUnits = ["chai", "thung", "binh", "lon"];
  if (!allowedUnits.includes(unit)) {
    return res.status(400).json({ message: "loại không hợp lệ (chai, thung, binh, lon" });
  }

  if (cost_price != null && cost_price < 0) {
    return res.status(400).json({ message: "Giá vốn không được âm" });
  }

  if (sell_price != null && sell_price < 0) {
    return res.status(400).json({ message: "Giá bán không được âm" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO products 
       (name, volume, unit, cost_price, sell_price) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        name.trim(),
        volume,
        unit,
        cost_price ?? 0,
        sell_price ?? 0
      ]
    );

    return res.status(201).json({
      message: "Thêm sản phẩm thành công",
      productId: result.insertId
    });

  } catch (err) {

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Sản phẩm đã tồn tại"
      });
    }

    console.error("Create product error:", err);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
});


// UPDATE PRODUCT
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, volume, unit, cost_price, sell_price } = req.body;

    if (!name || !volume || !unit || !cost_price || !sell_price) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    const [result] = await db.query(
      `UPDATE products 
       SET name=?, volume=?, unit=?, cost_price=?, sell_price=? 
       WHERE id=?`,
      [name, volume, unit, cost_price, sell_price, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    res.json({ message: "Cập nhật thành công" });

  } catch (err) {
    res.status(500).json(err);
  }
});


// DELETE PRODUCT
router.delete("/:id", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM stock_transactions WHERE product_id = ?",
      [id]
    );

    const [result] = await connection.query(
      "DELETE FROM products WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    await connection.commit();
    res.json({ message: "Xoá sản phẩm thành công" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json(err);
  } finally {
    connection.release();
  }
});

module.exports = router;