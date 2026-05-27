const router = require("express").Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const { logAction } = require("../utils/logger");
const { verifyToken } = require("../middleware/authMiddleware");

// ================= CẤU HÌNH MULTER ĐỂ LƯU ẢNH =================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Lưu vào thư mục uploads
  },
  filename: function (req, file, cb) {
    // Đổi tên file để không bị trùng (vd: 1689234234.jpg)
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });
// ================= GET ALL PRODUCTS (Nâng cấp Đa Kho) =================
router.get("/", async (req, res) => {
  try {
    const { warehouse_id } = req.query; // Nhận ID kho từ Frontend truyền lên

    if (warehouse_id) {
      // DÀNH CHO MÀN HÌNH BÁN HÀNG POS: Lấy đúng tồn kho của kho chỉ định
      const [rows] = await db.query(
        `SELECT 
                p.id, p.name, p.volume, p.unit, p.cost_price, p.sell_price, p.deposit_price, p.image,
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
    console.error("Lỗi GET API Products:", err); // Gắn thêm log để mốt lỡ lỗi còn biết đường mò
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

/// ================= ADD PRODUCT (CÓ ẢNH) =================
// Dùng upload.single('image') để hứng cái file gửi lên
router.post("/", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { name, volume, unit, cost_price, sell_price, deposit_price } = req.body;

    // Lấy đường dẫn ảnh nếu có up
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const volumeNumber = Number(volume);
    const costPrice = Number(cost_price ?? 0);
    const sellPrice = Number(sell_price ?? 0);
    const depositPrice = Number(deposit_price ?? 0);

    if (!name?.trim()) {
      return res.status(400).json({ message: "Tên sản phẩm bắt buộc" });
    }
    if (!Number.isInteger(volumeNumber) || volumeNumber <= 0) {
      return res.status(400).json({ message: "Thể tích phải là số nguyên dương" });
    }

    const [result] = await db.query(
      `INSERT INTO products (name, volume, unit, cost_price, sell_price, deposit_price, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), volumeNumber, unit, costPrice, sellPrice, depositPrice, imagePath]
    );
    // [CAMERA] Ghi log thêm mới
    await logAction(req, "CREATE", "products", result.insertId, null, req.body, `Thêm sản phẩm mới: ${name}`);

    return res.status(201).json({ message: "Thêm sản phẩm thành công", productId: result.insertId });


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ================= UPDATE PRODUCT (CÓ ẢNH) =================
router.put("/:id", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. LẤY DATA CŨ TRƯỚC (Để so sánh và ghi log)
    const [oldRows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ message: "Không thấy sản phẩm" });
    }

    const { name, volume, unit, cost_price, sell_price, deposit_price } = req.body;
    const newImagePath = req.file ? `/uploads/${req.file.filename}` : null;

    // Kiểm tra đầu vào
    if (!name || !volume || !unit || !cost_price || !sell_price) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    // 2. XÂY DỰNG CÂU QUERY CẬP NHẬT
    let query = `UPDATE products SET name=?, volume=?, unit=?, cost_price=?, sell_price=?, deposit_price=?`;
    let params = [name, volume, unit, cost_price, sell_price, deposit_price];

    if (newImagePath) {
      query += `, image=?`;
      params.push(newImagePath);
    }

    query += ` WHERE id=?`;
    params.push(id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    // 3. [CAMERA] Ghi log cập nhật (Sử dụng hàm chuẩn mới)
    // Phải gọi await trước khi gửi res.json
    await logAction(
      req,
      "UPDATE",
      "products",
      id,
      oldRows[0],
      req.body,
      `Cập nhật thông tin sản phẩm: ${name}`
    );

    // 4. PHẢN HỒI CUỐI CÙNG (Dùng return để kết thúc hàm tại đây)
    return res.json({ message: "Cập nhật thành công" });


  } catch (err) {
    console.error("Lỗi cập nhật sản phẩm:", err);
    // Nếu chưa gửi bất kỳ phản hồi nào thì mới gửi lỗi 500
    if (!res.headersSent) {
      return res.status(500).json({ message: "Lỗi hệ thống khi cập nhật" });
    }
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

    // [CAMERA] Ghi log xóa
    if (product.length > 0) {
      await logAction(req, "DELETE", "products", id, product[0], null, `Xóa sản phẩm: ${product[0].name}`);
    }

    await connection.commit();
    return res.json({ message: "Xoá sản phẩm thành công" });

  } catch (err) {
    await connection.rollback();
    return res.status(500).json(err);
  } finally {
    connection.release();
  }
});

module.exports = router;