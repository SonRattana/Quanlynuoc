const router = require("express").Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/authMiddleware").requireAdmin;


// ================= GET STOCK HISTORY =================
router.get("/", auth, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const type = req.query.type;

    const offset = (page - 1) * limit;

    let where = "";
    let params = [];

    if (type && (type === "import" || type === "export")) {
      where = "WHERE st.type = ?";
      params.push(type);
    }

    const [rows] = await db.query(
      `
      SELECT 
        st.id,
        st.type,
        st.quantity,
        st.created_at,
        p.name AS product_name
      FROM stock_transactions st
      JOIN products p ON st.product_id = p.id
      ${where}
      ORDER BY st.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});


// ================= IMPORT =================
router.post("/import", auth, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity)
      return res.status(400).json({ message: "Thiếu dữ liệu" });

    if (typeof product_id !== "number" || typeof quantity !== "number")
      return res.status(400).json({ message: "Dữ liệu phải là số" });

    if (product_id <= 0 || quantity <= 0)
      return res.status(400).json({ message: "Không được âm hoặc bằng 0" });

    await connection.beginTransaction();

    const [result] = await connection.query(
      "UPDATE products SET quantity = quantity + ? WHERE id = ?",
      [quantity, product_id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    await connection.query(
      "INSERT INTO stock_transactions (product_id, type, quantity) VALUES (?, 'import', ?)",
      [product_id, quantity]
    );

    await connection.query(
      "INSERT INTO audit_logs (user_id, action) VALUES (?, ?)",
      [req.user.id, `Import sản phẩm ID ${product_id} (+${quantity})`]
    );

    await connection.commit();

    res.json({ message: "Nhập kho thành công" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    connection.release();
  }
});


// ================= EXPORT =================
router.post("/export", auth, requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity)
      return res.status(400).json({ message: "Thiếu dữ liệu" });

    if (typeof product_id !== "number" || typeof quantity !== "number")
      return res.status(400).json({ message: "Dữ liệu phải là số" });

    if (product_id <= 0 || quantity <= 0)
      return res.status(400).json({ message: "Không được âm hoặc bằng 0" });

    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT quantity FROM products WHERE id = ?",
      [product_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    if (rows[0].quantity < quantity) {
      await connection.rollback();
      return res.status(400).json({ message: "Không đủ hàng trong kho" });
    }

    await connection.query(
      "UPDATE products SET quantity = quantity - ? WHERE id = ?",
      [quantity, product_id]
    );

    await connection.query(
      "INSERT INTO stock_transactions (product_id, type, quantity) VALUES (?, 'export', ?)",
      [product_id, quantity]
    );

    await connection.query(
      "INSERT INTO audit_logs (user_id, action) VALUES (?, ?)",
      [req.user.id, `Export sản phẩm ID ${product_id} (-${quantity})`]
    );

    await connection.commit();

    res.json({ message: "Xuất kho thành công" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    connection.release();
  }
});

module.exports = router;