const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// 1. API Lấy danh sách nguyên vật liệu để nhập kho
router.get("/products", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, name, unit, cost_price 
            FROM products 
            WHERE is_active = 1 
            AND id NOT IN (SELECT DISTINCT product_id FROM product_bom)
            ORDER BY name ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách nguyên vật liệu" });
    }
});

// 2. API Lưu phiếu nhập kho (ĐÃ GÁN CỨNG KHO NGUYÊN VẬT LIỆU VÀ CỘNG VAT VÀO GIÁ VỐN)
router.post("/", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { supplier_name, invoice_code, total_fee_amount, note, items, vat_rate } = req.body;

        if (!items || items.length === 0) return res.status(400).json({ message: "Chưa chọn hàng hóa nào!" });

        // 💡 ĐÃ FIX: Chặn đứng ở phía Server nếu cố tình bypass Frontend
        if (!invoice_code || invoice_code.trim() === "") {
            return res.status(400).json({ message: "Bắt buộc phải nhập Mã hóa đơn / Số chứng từ để đối soát!" });
        }

        // 💡 GÁN CỨNG: Tự động tìm ID của "Kho Nguyên Vật Liệu"
        const [whRows] = await connection.query("SELECT id FROM warehouses WHERE name LIKE ? LIMIT 1", ['%Nguyên Vật Liệu%']);
        if (whRows.length === 0) {
            return res.status(400).json({ message: "Hệ thống chưa tìm thấy 'Kho Nguyên Vật Liệu'. Vui lòng kiểm tra lại tên kho trong cài đặt!" });
        }
        const targetWarehouseId = whRows[0].id;

        await connection.beginTransaction();

        let totalGoodsAmount = 0;
        items.forEach(item => {
            totalGoodsAmount += (Number(item.quantity) * Number(item.unit_price));
        });

        const totalFee = Number(total_fee_amount) || 0;
        const vatRateNum = Number(vat_rate) || 0;
        const vatAmount = (totalGoodsAmount * vatRateNum) / 100;
        const totalPayment = totalGoodsAmount + totalFee + vatAmount;

        const [poResult] = await connection.query(
            `INSERT INTO purchase_orders (supplier_name, invoice_code, total_goods_amount, total_fee_amount, vat_rate, vat_amount, total_payment, note) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [supplier_name || "Nhà cung cấp lẻ", invoice_code || null, totalGoodsAmount, totalFee, vatRateNum, vatAmount, totalPayment, note || ""]
        );
        const poId = poResult.insertId;

        for (const item of items) {
            const qty = Number(item.quantity);
            const price = Number(item.unit_price);

            let allocatedFeePerUnit = 0;
            if (totalGoodsAmount > 0 && totalFee > 0) {
                const itemValueRatio = (qty * price) / totalGoodsAmount;
                const totalFeeForItem = totalFee * itemValueRatio;
                allocatedFeePerUnit = totalFeeForItem / qty;
            }

            // 💡 TÍNH TOÁN VAT CHO TỪNG SẢN PHẨM
            const vatPerUnit = price * (vatRateNum / 100);

            // 💡 CỘNG VAT VÀO GIÁ VỐN (Cost Price = Giá gốc + Phí Ship + VAT)
            const finalCostPrice = price + allocatedFeePerUnit + vatPerUnit;

            // A. Lưu bảng Lô Hàng (inventory_batches)
            await connection.query(
                `INSERT INTO inventory_batches (po_id, product_id, quantity_initial, quantity_remaining, unit_price, allocated_fee, cost_price) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [poId, item.product_id, qty, qty, price, allocatedFeePerUnit, finalCostPrice]
            );

            // 💡 [THÊM ĐOẠN NÀY VÀO]: Lưu chi tiết vào bảng purchase_order_details
            await connection.query(
                `INSERT INTO purchase_order_details (purchase_order_id, product_id, quantity, unit_price) 
                 VALUES (?, ?, ?, ?)`,
                [poId, item.product_id, qty, price]
            );

            // B. Cộng số lượng kho tổng & Cập nhật giá vốn
            await connection.query(
                `UPDATE products SET quantity = quantity + ?, cost_price = ? WHERE id = ?`,
                [qty, finalCostPrice, item.product_id]
            );

            // C. Nhập hàng vào Kho Nguyên Vật Liệu
            const [whProductRows] = await connection.query(
                "SELECT quantity FROM warehouse_products WHERE warehouse_id = ? AND product_id = ?",
                [targetWarehouseId, item.product_id]
            );

            if (whProductRows.length > 0) {
                await connection.query(
                    "UPDATE warehouse_products SET quantity = quantity + ? WHERE warehouse_id = ? AND product_id = ?",
                    [qty, targetWarehouseId, item.product_id]
                );
            } else {
                await connection.query(
                    "INSERT INTO warehouse_products (warehouse_id, product_id, quantity) VALUES (?, ?, ?)",
                    [targetWarehouseId, item.product_id, qty]
                );
            }

            // D. Ghi lịch sử thẻ kho
            await connection.query(
                "INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason) VALUES (?, ?, 'import', ?, ?)",
                [item.product_id, targetWarehouseId, qty, `Nhập hàng mua (PN#${poId}${invoice_code ? ` - HĐ: ${invoice_code}` : ''})`]
            );
        }

        await connection.commit();
        res.json({ message: "Nhập kho thành công!", po_id: poId });

    } catch (err) {
        await connection.rollback();
        console.error("Lỗi nhập mua hàng:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi nhập kho" });
    } finally {
        connection.release();
    }
});

router.get("/raw-materials", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, name, unit, cost_price 
            FROM products 
            WHERE is_active = 1 AND item_type = 'nguyen_lieu' 
            ORDER BY name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi:", err);
        res.status(500).json([]);
    }
});
// API lấy chi tiết phiếu nhập để sửa
// Thay đoạn API cũ bằng đoạn này để đảm bảo dữ liệu "chảy" về Frontend
router.get("/details/:id", verifyToken, async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT 
                pod.id, 
                pod.product_id AS material_id, 
                pod.quantity AS quantity_used, 
                pod.unit_price AS unit_cost, 
                p.name AS material_name 
            FROM purchase_order_details pod
            JOIN products p ON pod.product_id = p.id
            WHERE pod.purchase_order_id = ?
        `, [req.params.id]);

        console.log("Dữ liệu chi tiết gửi về Frontend:", items); // Debug: Xem trong terminal server xem có data không
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: "Lỗi server" });
    }
});
// API: Cập nhật phiếu nhập (BẢN CHỐNG LỖI KHI NHẬP GIÁ 0đ)
router.put("/update/:id", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const { supplier_name, invoice_code, note, details, total_fee_amount, vat_rate } = req.body;

        await connection.beginTransaction();

        // 1. LẤY SỐ LƯỢNG CŨ TRƯỚC KHI XÓA
        const [oldDetails] = await connection.query(
            "SELECT product_id, quantity FROM purchase_order_details WHERE purchase_order_id = ?",
            [id]
        );

        // TÍNH TOÁN LẠI TIỀN HÀNG
        let total_goods_amount = 0;
        if (details && details.length > 0) {
            details.forEach(item => {
                total_goods_amount += (Number(item.quantity_used) * Number(item.unit_cost));
            });
        }

        const fee = Number(total_fee_amount) || 0;
        const rate = Number(vat_rate) || 0;
        const vat_amount = (total_goods_amount * rate) / 100;
        const total_payment = total_goods_amount + fee + vat_amount;

        // CẬP NHẬT PHIẾU NHẬP
        await connection.query(
            `UPDATE purchase_orders 
             SET supplier_name=?, invoice_code=?, total_payment=?, note=?,
                 total_goods_amount=?, total_fee_amount=?, vat_rate=?, vat_amount=? 
             WHERE id=?`,
            [supplier_name, invoice_code, total_payment, note, total_goods_amount, fee, rate, vat_amount, id]
        );

        // Xóa chi tiết cũ
        await connection.query("DELETE FROM purchase_order_details WHERE purchase_order_id = ?", [id]);

        // Lấy ID kho Nguyên Vật Liệu
        const [whRows] = await connection.query("SELECT id FROM warehouses WHERE name LIKE ? LIMIT 1", ['%Nguyên Vật Liệu%']);
        const targetWarehouseId = whRows.length > 0 ? whRows[0].id : null;

        // 2. TÍNH CHÊNH LỆCH VÀ CỘNG TRỪ VÀO KHO
        for (const item of details) {
            const newQty = Number(item.quantity_used);
            const price = Number(item.unit_cost);

            // Ép kiểu Number để chống lỗi không tìm thấy ID
            const oldItem = oldDetails.find(old => Number(old.product_id) === Number(item.material_id));
            const oldQty = oldItem ? Number(oldItem.quantity) : 0;
            const quantityDifference = newQty - oldQty;

            let allocatedFeePerUnit = 0;
            if (total_goods_amount > 0 && fee > 0) {
                allocatedFeePerUnit = (fee * ((newQty * price) / total_goods_amount)) / newQty;
            }
            const vatPerUnit = price * (rate / 100);
            const finalCostPrice = price + allocatedFeePerUnit + vatPerUnit;

            // Chèn chi tiết mới
            await connection.query(
                "INSERT INTO purchase_order_details (purchase_order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
                [id, item.material_id, newQty, price]
            );

            // Cập nhật Kho Lô (Lưu lô này giá = 0 để sếp biết mà theo dõi)
            await connection.query(
                `UPDATE inventory_batches 
                 SET quantity_initial = quantity_initial + ?, 
                     quantity_remaining = quantity_remaining + ?, 
                     unit_price = ?, allocated_fee = ?, cost_price = ? 
                 WHERE po_id = ? AND product_id = ?`,
                [quantityDifference, quantityDifference, price, allocatedFeePerUnit, finalCostPrice, id, item.material_id]
            );

            // 💡 BẢO VỆ KHO TỔNG: Xử lý thông minh khi Giá = 0
            if (finalCostPrice > 0) {
                // Nếu có nhập giá: Cập nhật cả số lượng và đè Giá vốn mới lên
                await connection.query(
                    `UPDATE products SET quantity = quantity + ?, cost_price = ? WHERE id = ?`,
                    [quantityDifference, finalCostPrice, item.material_id]
                );
            } else {
                // Nếu Giá = 0: Chỉ cộng số lượng vào kho, GIỮ NGUYÊN Giá vốn hiện tại của hệ thống!
                await connection.query(
                    `UPDATE products SET quantity = quantity + ? WHERE id = ?`,
                    [quantityDifference, item.material_id]
                );
            }

            // Cập nhật Kho Chi Nhánh
            if (targetWarehouseId) {
                await connection.query(
                    "UPDATE warehouse_products SET quantity = quantity + ? WHERE warehouse_id = ? AND product_id = ?",
                    [quantityDifference, targetWarehouseId, item.material_id]
                );
            }
        }

        await connection.commit();
        res.json({ message: "Sửa phiếu và cập nhật Tồn kho thành công!" });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// ================= 3. API LẤY LỊCH SỬ PHIẾU NHẬP =================
router.get("/history", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, supplier_name, invoice_code, total_goods_amount, total_fee_amount, vat_rate, vat_amount, total_payment, created_at, note 
            FROM purchase_orders 
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải lịch sử" });
    }
});

// ================= 4. API LẤY CHI TIẾT 1 PHIẾU NHẬP =================
router.get("/history/:id", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.id, p.name, p.unit, b.quantity_initial, b.unit_price, b.allocated_fee, b.cost_price 
            FROM inventory_batches b 
            JOIN products p ON b.product_id = p.id 
            WHERE b.po_id = ?
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải chi tiết phiếu nhập" });
    }
});

// ================= 5. API LẤY DANH SÁCH LÔ HÀNG ĐANG TỒN KHO (MẮT THẦN) =================
router.get("/batches", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT b.id, b.po_id, p.name, p.unit, b.quantity_remaining, 
                   b.unit_price, b.allocated_fee, b.cost_price, 
                   b.created_at, po.supplier_name,
                   po.invoice_code
            FROM inventory_batches b 
            JOIN products p ON b.product_id = p.id 
            LEFT JOIN purchase_orders po ON b.po_id = po.id
        
            ORDER BY p.name ASC, b.created_at ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách lô hàng" });
    }
});

module.exports = router;
// WHERE b.quantity_remaining > 0 