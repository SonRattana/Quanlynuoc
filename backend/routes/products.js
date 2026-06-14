const router = require("express").Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const { logAction } = require("../utils/logger");
const { verifyToken } = require("../middleware/authMiddleware");

// ================= CẤU HÌNH MULTER ĐỂ LƯU ẢNH =================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// ================= GET ALL PRODUCTS (ĐÃ TỐI ƯU & THÊM TÊN KHO) =================
router.get("/", verifyToken, async (req, res) => {
  try {
    const { warehouse_id } = req.query;

    let query = `
      SELECT 
        p.id, p.name, p.volume, p.unit, p.cost_price, p.sell_price, 
        p.deposit_price, p.image, p.wholesale_price, p.wholesale_min_quantity, 
        p.requires_deposit, p.item_type,
        IFNULL(wp.quantity, 0) AS quantity,
        IFNULL(w.name, 'Kho Tổng') AS warehouse_name /* 💡 ĐIỂM ĂN TIỀN 1: Lấy tên kho */
      FROM products p
      LEFT JOIN warehouse_products wp ON p.id = wp.product_id ${warehouse_id ? 'AND wp.warehouse_id = ?' : ''}
      LEFT JOIN warehouses w ON wp.warehouse_id = w.id /* 💡 ĐIỂM ĂN TIỀN 2: Kết nối với bảng kho */
      WHERE p.is_active = 1
    `;

    const params = warehouse_id ? [warehouse_id] : [];
    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error("Lỗi GET API Products:", err);
    res.status(500).json({ message: "Lỗi lấy danh sách sản phẩm" });
  }
});

// ================= GET TRASH LIST =================
router.get("/trash/list", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products WHERE is_active = 0 ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi hệ thống" });
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

// ================= GET PRODUCT BATCHES (LÔ TỒN KHO FIFO) =================
router.get("/:id/batches", async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy tất cả các lô của sản phẩm này mà vẫn còn hàng (quantity_remaining > 0)
    // Sắp xếp theo created_at ASC (Cũ nhất lên đầu để xuất FIFO)
    const [rows] = await db.query(
      `SELECT * FROM inventory_batches 
       WHERE product_id = ? AND quantity_remaining > 0 
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Lỗi GET API Batches:", err);
    res.status(500).json({ message: "Lỗi hệ thống khi lấy chi tiết lô" });
  }
});

// ================= ADD PRODUCT =================
router.post("/", verifyToken, upload.single('image'), async (req, res) => {
  try {
    // 💡 BỔ SUNG: Nhận giá sỉ và mốc số lượng từ giao diện
    const { name, volume, unit, cost_price, sell_price, deposit_price, item_type, size_group, wholesale_price, wholesale_min_quantity, requires_deposit } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    let volumeNumber = Number(volume);
    let costPrice = Number(cost_price ?? 0);
    let sellPrice = Number(sell_price ?? 0);
    let depositPrice = Number(deposit_price ?? 0);
    let wsPrice = Number(wholesale_price ?? 0);
    let wsMinQty = Number(wholesale_min_quantity ?? 0);

    if (item_type === 'nguyen_lieu') {
      costPrice = 0; sellPrice = 0; depositPrice = 0; volumeNumber = 1; wsPrice = 0; wsMinQty = 0;
    }

    if (!name?.trim()) return res.status(400).json({ message: "Tên sản phẩm bắt buộc" });

    // 💡 BỔ SUNG: Đẩy vào Database
    const [result] = await db.query(
      `INSERT INTO products (name, volume, unit, cost_price, sell_price, deposit_price, image, item_type, size_group, wholesale_price, wholesale_min_quantity, requires_deposit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), volumeNumber, unit, costPrice, sellPrice, depositPrice, imagePath, item_type || 'thanh_pham', size_group, wsPrice, wsMinQty, Number(requires_deposit) === 1 ? 1 : 0]
    );

    await logAction(req, "CREATE", "products", result.insertId, null, req.body, `Thêm sản phẩm mới: ${name}`);
    return res.status(201).json({ message: "Thêm sản phẩm thành công", productId: result.insertId });

  } catch (err) {
    console.error("LỖI THÊM SẢN PHẨM CHI TIẾT:", err);
    res.status(500).json({ message: "Lỗi thật là: " + err.message });
  }
});

// ================= UPDATE PRODUCT =================
router.put("/:id", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const [oldRows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (oldRows.length === 0) return res.status(404).json({ message: "Không thấy sản phẩm" });

    // 💡 BỔ SUNG: Nhận giá sỉ và mốc số lượng từ giao diện
    const { name, volume, unit, cost_price, sell_price, deposit_price, item_type, size_group, wholesale_price, wholesale_min_quantity, requires_deposit } = req.body;
    const newImagePath = req.file ? `/uploads/${req.file.filename}` : null;

    let volumeNumber = Number(volume);
    let costPrice = Number(cost_price ?? 0);
    let sellPrice = Number(sell_price ?? 0);
    let depositPrice = Number(deposit_price ?? 0);
    let wsPrice = Number(wholesale_price ?? 0);
    let wsMinQty = Number(wholesale_min_quantity ?? 0);

    if (item_type === 'nguyen_lieu') {
      costPrice = 0; sellPrice = 0; depositPrice = 0; volumeNumber = 1; wsPrice = 0; wsMinQty = 0;
    }

    // 💡 BỔ SUNG: Cập nhật vào Database
    let query = `UPDATE products SET name=?, volume=?, unit=?, cost_price=?, sell_price=?, deposit_price=?, item_type=?, size_group=?, wholesale_price=?, wholesale_min_quantity=?, requires_deposit=?`;
    let params = [name, volumeNumber, unit, costPrice, sellPrice, depositPrice, item_type || 'thanh_pham', size_group, wsPrice, wsMinQty, Number(requires_deposit) === 1 ? 1 : 0];

    if (newImagePath) {
      query += `, image=?`;
      params.push(newImagePath);
    }

    query += ` WHERE id=?`;
    params.push(id);

    await db.query(query, params);
    await logAction(req, "UPDATE", "products", id, oldRows[0], req.body, `Cập nhật thông tin sản phẩm: ${name}`);

    return res.json({ message: "Cập nhật thành công" });

  } catch (err) {
    console.error("LỖI CẬP NHẬT SẢN PHẨM:", err);
    if (!res.headersSent) return res.status(500).json({ message: "Lỗi hệ thống khi cập nhật" });
  }
});

// ================= DELETE PRODUCT =================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [stockRows] = await db.query("SELECT SUM(quantity) as total_stock FROM warehouse_products WHERE product_id = ?", [id]);
    const totalStock = Number(stockRows[0]?.total_stock || 0);

    if (totalStock !== 0) {
      return res.status(400).json({ message: `Không thể xóa! Sản phẩm này vẫn còn tồn kho (${totalStock} sản phẩm). Sếp phải làm phiếu xuất hủy hoặc chuyển kho hết về số 0 trước khi ẩn.` });
    }

    const [depositRows] = await db.query("SELECT COUNT(*) as active_deposits FROM bottle_deposits WHERE product_id = ? AND status = 'dang_giu'", [id]);
    const activeDeposits = Number(depositRows[0]?.active_deposits || 0);

    if (activeDeposits > 0) {
      return res.status(400).json({ message: `Không thể xóa! Vẫn còn khách hàng đang giữ vỏ của loại sản phẩm này. Sếp phải xử lý thu hồi/hoàn tiền cọc vỏ hết đã.` });
    }

    const [product] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (product.length === 0) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    await db.query("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
    await logAction(req, "DELETE", "products", id, product[0], null, `Xóa (Ngừng kinh doanh) sản phẩm: ${product[0].name}`);

    return res.json({ message: "Đã xóa (ẩn) sản phẩm thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi xóa sản phẩm" });
  }
});

// ================= RESTORE PRODUCT =================
router.put("/:id/restore", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("UPDATE products SET is_active = 1 WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Không tìm thấy sản phẩm để khôi phục" });

    await logAction(req, "RESTORE", "products", id, null, null, `Khôi phục (Bán lại) sản phẩm ID: ${id}`);
    return res.json({ message: "Đã khôi phục sản phẩm thành công!" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi khôi phục" });
  }
});

// ================= FORCE DELETE PRODUCT =================
router.delete("/:id/force", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // BƯỚC 1: Kiểm tra xem sản phẩm có đang được dùng ở đâu không
    const [checkStock] = await db.query("SELECT COUNT(*) as count FROM warehouse_products WHERE product_id = ?", [id]);
    const [checkOrders] = await db.query("SELECT COUNT(*) as count FROM order_items WHERE product_id = ?", [id]);

    if (checkStock[0].count > 0 || checkOrders[0].count > 0) {
      return res.status(400).json({
        message: "Không thể xóa vĩnh viễn! Sản phẩm này đã có lịch sử nhập/xuất hoặc đã từng bán. Sếp chỉ nên 'Ẩn' sản phẩm để bảo toàn dữ liệu lịch sử."
      });
    }

    // BƯỚC 2: Nếu không có lịch sử gì thì mới cho xóa
    const [result] = await db.query("DELETE FROM products WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    await logAction(req, "FORCE_DELETE", "products", id, null, null, `Xóa vĩnh viễn sản phẩm ID: ${id}`);
    return res.json({ message: "Đã xóa vĩnh viễn sản phẩm khỏi Database!" });

  } catch (err) {
    console.error("Lỗi xóa vĩnh viễn:", err);
    res.status(500).json({ message: "Lỗi server khi xóa vĩnh viễn" });
  }
});

module.exports = router;