const router = require("express").Router();
const db = require("../db");

// ================= GET ALL PRODUCTS (Nâng cấp Đa Kho) =================
router.get("/", async (req, res) => {
  try {
    const { warehouse_id } = req.query; // Nhận ID kho từ Frontend truyền lên

    if (warehouse_id) {
        // DÀNH CHO MÀN HÌNH BÁN HÀNG POS: Lấy đúng tồn kho của kho chỉ định
        // Dùng LEFT JOIN để lỡ kho đó chưa nhập sản phẩm này bao giờ thì báo số lượng là 0
        const [rows] = await db.query(
            `SELECT 
                p.id, p.name, p.volume, p.unit, p.cost_price, p.sell_price, p.deposit_price,
                IFNULL(wp.quantity, 0) AS quantity
             FROM products p
             LEFT JOIN warehouse_products wp 
                ON p.id = wp.product_id AND wp.warehouse_id = ?`,
            [warehouse_id]
        );
        return res.json(rows);
    }

    // DÀNH CHO QUẢN LÝ TỔNG: Không truyền kho thì lấy Tồn kho tổng của công ty
    const [rows] = await db.query("SELECT * FROM products");
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ================= GET PRODUCT BY ID =================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ================= ADD PRODUCT =================
router.post("/", async (req, res) => {
  try {
    const { name, volume, unit, cost_price, sell_price, deposit_price } = req.body;

    const volumeNumber = Number(volume);
    const costPrice = Number(cost_price ?? 0);
    const sellPrice = Number(sell_price ?? 0);
    const depositPrice = Number(deposit_price ?? 0);

    if (!name?.trim())
      return res.status(400).json({ message: "Tên sản phẩm bắt buộc" });

    if (!Number.isInteger(volumeNumber) || volumeNumber <= 0)
      return res.status(400).json({ message: "Thể tích phải là số nguyên dương" });

    const allowedUnits = ["chai", "thung", "binh", "lon"];
    if (!allowedUnits.includes(unit))
      return res.status(400).json({ message: "Loại không hợp lệ" });

    if (costPrice < 0 || sellPrice < 0)
      return res.status(400).json({ message: "Giá không được âm" });

    const [result] = await db.query(
      `INSERT INTO products (name, volume, unit, cost_price, sell_price, deposit_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), volumeNumber, unit, costPrice, sellPrice, depositPrice]
    );

    res.status(201).json({
      message: "Thêm sản phẩm thành công",
      productId: result.insertId
    });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Sản phẩm đã tồn tại" });
    }
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ================= UPDATE PRODUCT =================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, volume, unit, cost_price, sell_price, deposit_price } = req.body;

    if (!name || !volume || !unit || !cost_price || !sell_price) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    const [result] = await db.query(
      `UPDATE products 
       SET name=?, volume=?, unit=?, cost_price=?, sell_price=?, deposit_price=?
       WHERE id=?`,
      [name, volume, unit, cost_price, sell_price, deposit_price, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    res.json({ message: "Cập nhật thành công" });

  } catch (err) {
    res.status(500).json(err);
  }
});

// ================= DELETE PRODUCT (Đã dọn dẹp rác kho) =================
router.delete("/:id", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // 1. Xóa lịch sử giao dịch kho
    await connection.query("DELETE FROM stock_transactions WHERE product_id = ?", [id]);
    
    // 2. MỚI: Xóa sạch tồn kho rải rác ở các kho (Cửa hàng, Kho tổng...)
    await connection.query("DELETE FROM warehouse_products WHERE product_id = ?", [id]);

    // 3. Xóa sản phẩm gốc
    const [result] = await connection.query("DELETE FROM products WHERE id = ?", [id]);

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