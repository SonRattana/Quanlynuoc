const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// ================= 1. Lấy danh sách NGƯÊN LIỆU (Để sếp chọn đưa vào công thức) =================
router.get("/materials", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, unit, cost_price FROM products WHERE item_type = 'nguyen_lieu' AND is_active = 1"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách nguyên vật liệu" });
    }
});

// ================= 2. Lấy danh sách THÀNH PHẨM (Để sếp chọn cài đặt định mức) =================
router.get("/products", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, volume, unit FROM products WHERE item_type = 'thanh_pham' AND is_active = 1"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách thành phẩm" });
    }
});

// ================= 3. Lấy CÔNG THỨC hiện tại của 1 sản phẩm =================
router.get("/:productId", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.id, b.material_id, p.name as material_name, p.unit, b.quantity, p.cost_price 
            FROM product_bom b
            JOIN products p ON b.material_id = p.id
            WHERE b.product_id = ?
        `, [req.params.productId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải công thức" });
    }
});

// ================= 4. LƯU CÔNG THỨC (Xóa sạch cái cũ, Lưu lại list mới) =================
router.post("/:productId", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { productId } = req.params;
        const { materials } = req.body; // Frontend sẽ gửi lên mảng [{ material_id: 1, quantity: 1 }, ...]

        await connection.beginTransaction();

        // Bước 1: Xóa trắng công thức cũ của sản phẩm này (để ghi đè)
        await connection.query("DELETE FROM product_bom WHERE product_id = ?", [productId]);

        // Bước 2: Thêm list công thức mới vào
        if (materials && materials.length > 0) {
            // Chuyển mảng object thành mảng 2 chiều để INSERT 1 lần cho lẹ
            const values = materials.map(m => [productId, m.material_id, m.quantity]);
            await connection.query(
                "INSERT INTO product_bom (product_id, material_id, quantity) VALUES ?", 
                [values]
            );
        }

        await connection.commit();
        res.json({ message: "Lưu định mức thành công!" });

    } catch (err) {
        await connection.rollback();
        console.error("Lỗi lưu BOM:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi lưu định mức" });
    } finally {
        connection.release();
    }
});

// ================= API LẤY NGUYÊN LIỆU ĐƯỢC PHÉP DÙNG CHO 1 THÀNH PHẨM =================
router.get("/materials-for/:productId", verifyToken, async (req, res) => {
    try {
        const productId = req.params.productId;

        // 1. Soi xem Thành phẩm đang chọn thuộc size nào (VD: '20L', '5L'...)
        const [tpRows] = await db.query("SELECT size_group FROM products WHERE id = ?", [productId]);
        if (tpRows.length === 0) return res.status(404).json({ message: "Không tìm thấy sản phẩm!" });
        
        const targetSize = tpRows[0].size_group;

        // 2. Chui vào kho lấy nguyên liệu: Chỉ lấy loại CÙNG SIZE hoặc loại CHUNG
        const [materials] = await db.query(`
            SELECT id, name, unit 
            FROM products 
            WHERE item_type = 'nguyen_lieu' 
            AND is_active = 1 
            AND (size_group = ? OR size_group = 'chung' OR size_group IS NULL)
            ORDER BY name ASC
        `, [targetSize]);

        res.json(materials);
    } catch (err) {
        console.error("Lỗi lọc nguyên vật liệu BOM:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi lọc nguyên vật liệu" });
    }
});

module.exports = router;