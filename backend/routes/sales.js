const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");
router.post("/", verifyToken, async (req, res) => {
    const connection = await db.getConnection();

    try {
        // Không còn nhận collect_deposit nữa
        const { items, customer_id } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Danh sách sản phẩm trống" });
        }

        const created_by = req.user.id;
        await connection.beginTransaction();

        let totalAmount = 0;
        let totalProfit = 0;
        let totalDeposit = 0;

        // VÒNG LẶP 1: TÍNH TOÁN TIỀN VÀ TRỪ KHO
        for (const item of items) {
            if (!item.product_id || !item.quantity || item.quantity <= 0) {
                throw new Error("Dữ liệu sản phẩm không hợp lệ");
            }

            const [rows] = await connection.query(
                "SELECT quantity, sell_price, cost_price, deposit_price FROM products WHERE id = ? FOR UPDATE",
                [item.product_id]
            );

            if (rows.length === 0) throw new Error("Không tìm thấy sản phẩm");
            const product = rows[0];

            if (product.quantity < item.quantity) {
                throw new Error("Không đủ hàng trong kho");
            }

            // 1. Tính tiền nước và lợi nhuận
            const waterPrice = product.sell_price * item.quantity;
            totalAmount += waterPrice;
            totalProfit += (product.sell_price - product.cost_price) * item.quantity;

            // 2. Tính tiền cọc vỏ (CHỈ tính trên số vỏ bị thiếu - missing_bottles)
            // Lấy missing_bottles từ frontend gửi lên (nếu không có mặc định là 0)
            const missingBottles = item.missing_bottles || 0;
            if (missingBottles > 0 && product.deposit_price > 0) {
                const depositFee = missingBottles * product.deposit_price;
                totalDeposit += depositFee;
                totalAmount += depositFee; // Cộng tiền cọc vào tổng hóa đơn khách phải trả
            }

            // 3. Trừ kho nước
            await connection.query(
                "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                [item.quantity, item.product_id]
            );
        }

        // TẠO HÓA ĐƠN
        const [invoiceResult] = await connection.query(
            `INSERT INTO invoices (total_amount, total_profit, deposit_amount, created_by, customer_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [totalAmount, totalProfit, totalDeposit, created_by, customer_id || null]
        );
        const invoiceId = invoiceResult.insertId;
        if (!invoiceId) throw new Error("Không tạo được hóa đơn");

        // VÒNG LẶP 2: LƯU CHI TIẾT HÓA ĐƠN VÀ NỢ VỎ
        for (const item of items) {
            const [rows] = await connection.query(
                "SELECT sell_price, cost_price, deposit_price FROM products WHERE id = ?",
                [item.product_id]
            );
            const product = rows[0];

            // Lưu chi tiết sản phẩm bán ra
            await connection.query(
                `INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [invoiceId, item.product_id, item.quantity, product.sell_price, product.cost_price]
            );

            // NẾU CÓ KHÁCH HÀNG VÀ CÓ NỢ THÊM VỎ -> Lưu vào lịch sử cọc
            const missingBottles = item.missing_bottles || 0;
            if (customer_id && missingBottles > 0 && product.deposit_price > 0) {
                const depositAmount = missingBottles * product.deposit_price;

                await connection.query(
                    `INSERT INTO bottle_deposits
                    (customer_id, product_id, quantity, deposit_amount, status, type, invoice_id, created_at)
                    VALUES (?, ?, ?, ?, 'dang_giu', 'deposit', ?, NOW())`,
                    [customer_id, item.product_id, missingBottles, depositAmount, invoiceId]
                );
            }
        }

        // Cập nhật tổng dư nợ cọc vào bảng customers (Nếu DB của bạn dùng cột này)
        if (customer_id && totalDeposit > 0) {
            await connection.query(
                `UPDATE customers SET deposit_balance = deposit_balance + ? WHERE id = ?`,
                [totalDeposit, customer_id]
            );
        }

        await connection.commit();

        // [CAMERA] Ghi log thanh toán thành công
        // Lưu lại danh sách items để sau này biết đơn này gồm những gì
        await logAction(
            req,
            "CREATE_INVOICE",
            "invoices",
            invoiceId,
            null,
            { items, totalAmount },
            `Thanh toán hóa đơn #${invoiceId} - Tổng tiền: ${totalAmount.toLocaleString()}đ`
        );
        res.json({
            message: "Thanh toán thành công",
            invoice_id: invoiceId,
        });

    } catch (err) {
        console.log("SALE ERROR:", err);
        await connection.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;