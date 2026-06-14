const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");
const { sendOrderEmail } = require("../mail");

// 1. LẤY DANH SÁCH HÓA ĐƠN (CHO BẢNG LỊCH SỬ)
// ================= GET ALL INVOICES (LẤY DANH SÁCH HÓA ĐƠN) =================
router.get("/", verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // 💡 ĐÃ FIX TRỪ PHÍ SHIP VÀ TIỀN CỌC ĐỂ RA ĐÚNG "TIỀN HÀNG" NGUYÊN BẢN
        const [rows] = await db.query(`
      SELECT 
        i.id, 
        i.created_at, 
        c.name AS customer_name,
        c.address AS customer_address,
        (i.total_amount - COALESCE(i.delivery_fee, 0) - COALESCE(i.deposit_amount, 0)) as total_amount,
        i.deposit_amount,
        i.delivery_fee
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

// 2. TẠO HÓA ĐƠN MỚI
router.post("/", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        // 💡 ĐÃ FIX: Đón thêm biến paid_amount từ Frontend truyền xuống
        const { items, customer_id, customer_name, email, shipper_name, unreturned_bottles, delivery_fee, warehouse_id, customer_address, paid_amount } = req.body;

        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Giỏ hàng trống" });

        await connection.beginTransaction();
        let totalAmount = 0, totalProfit = 0, totalDeposit = 0, emailItems = [];
        const finalDeliveryFee = Number(delivery_fee) || 0;
        const targetWarehouse = warehouse_id || 1;

        for (const item of items) {
            const [rows] = await connection.query("SELECT name, quantity, sell_price, cost_price, deposit_price, requires_deposit FROM products WHERE id = ? FOR UPDATE", [item.product_id]);
            if (rows.length === 0) throw new Error("Không tìm thấy sản phẩm");
            const product = rows[0];

            let depositFee = 0;
            if (product.requires_deposit === 1) {
                const missing = Math.max(0, item.quantity - (item.returned_bottles || 0));
                if (missing > 0 && product.deposit_price > 0) depositFee = missing * product.deposit_price;
            }

            totalAmount += (item.sell_price * item.quantity) + depositFee;
            totalDeposit += depositFee;
            totalProfit += (item.sell_price - product.cost_price) * item.quantity;

            await connection.query("UPDATE products SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.product_id]);
            await connection.query("UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?", [item.quantity, targetWarehouse, item.product_id]);
            await connection.query(`INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason, transaction_type) VALUES (?, ?, 'export', ?, 'Bán hàng', 'sale')`, [item.product_id, targetWarehouse, item.quantity]);

            emailItems.push({ product_name: product.name, quantity: item.quantity, sell_price: item.sell_price });
        }

        totalAmount += finalDeliveryFee;

        // ========================================================
        // 💡 LOGIC CÔNG NỢ & TRẠNG THÁI THANH TOÁN 
        // ========================================================
        // Mặc định nếu Frontend không gửi gì, coi như trả đủ
        let inputPaid = paid_amount !== undefined ? Number(paid_amount) : totalAmount;

        // Khách lẻ (không có ID) thì bắt buộc thu đủ, không cho ghi nợ
        if (!customer_id && inputPaid < totalAmount) {
            inputPaid = totalAmount;
        }

        let actualPaid = inputPaid;
        let debtIncurred = 0;
        let paymentStatus = 'paid';

        if (actualPaid < totalAmount) {
            debtIncurred = totalAmount - actualPaid;
            paymentStatus = actualPaid > 0 ? 'partial' : 'unpaid';
        } else {
            actualPaid = totalAmount; // Nếu khách trả dư thì tiền thực thu của đơn = tổng bill
        }

        // 💡 LƯU HÓA ĐƠN VÀO DB CÓ KÈM THÔNG TIN TIỀN ĐÃ TRẢ & TRẠNG THÁI
        const [invoiceResult] = await connection.query(
            `INSERT INTO invoices (total_amount, total_profit, deposit_amount, created_by, customer_id, shipper_name, unreturned_bottles, delivery_fee, paid_amount, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [totalAmount, totalProfit, totalDeposit, req.user.id, customer_id || null, shipper_name || null, unreturned_bottles || 0, finalDeliveryFee, actualPaid, paymentStatus]
        );
        const invoiceId = invoiceResult.insertId;

        for (const item of items) {
            const [pRow] = await connection.query("SELECT cost_price, deposit_price, requires_deposit FROM products WHERE id = ?", [item.product_id]);
            await connection.query(`INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price) VALUES (?, ?, ?, ?, ?)`, [invoiceId, item.product_id, item.quantity, item.sell_price, pRow[0].cost_price]);

            if (pRow[0].requires_deposit === 1) {
                const returned = item.returned_bottles || 0;
                if (customer_id && returned > 0) {
                    const [debts] = await connection.query("SELECT id, quantity FROM bottle_deposits WHERE customer_id = ? AND product_id = ? AND status = 'dang_giu' ORDER BY created_at ASC", [customer_id, item.product_id]);
                    let remaining = returned;
                    for (const debt of debts) {
                        if (remaining <= 0) break;
                        if (debt.quantity <= remaining) {
                            await connection.query("UPDATE bottle_deposits SET status = 'da_tra' WHERE id = ?", [debt.id]);
                            remaining -= debt.quantity;
                        } else {
                            await connection.query("UPDATE bottle_deposits SET quantity = quantity - ? WHERE id = ?", [remaining, debt.id]);
                            remaining = 0;
                        }
                    }
                }
                const missing = Math.max(0, item.quantity - returned);
                if (customer_id && missing > 0 && pRow[0].deposit_price > 0) {
                    await connection.query(`INSERT INTO bottle_deposits (customer_id, product_id, quantity, deposit_amount, status, type, invoice_id, created_at) VALUES (?, ?, ?, ?, 'dang_giu', 'deposit', ?, NOW())`, [customer_id, item.product_id, missing, missing * pRow[0].deposit_price, invoiceId]);
                }
            }
        }

        // ========================================================
        // 💡 CỘNG NỢ VÀ GHI VÀO SỔ GIAO DỊCH NẾU CÓ NỢ 
        // ========================================================
        if (customer_id && debtIncurred > 0) {
            // Cộng thẳng tổng nợ mới vào hồ sơ Khách hàng
            await connection.query(`UPDATE customers SET debt_balance = debt_balance + ? WHERE id = ?`, [debtIncurred, customer_id]);

            // Ghi chép chi tiết vào sổ theo dõi Công nợ
            await connection.query(
                `INSERT INTO customer_payments (customer_id, invoice_id, amount, transaction_type, note) VALUES (?, ?, ?, 'debt_increase', ?)`,
                [customer_id, invoiceId, debtIncurred, `Ghi nợ từ Hóa đơn #${invoiceId}`]
            );
        }

        // (Giữ nguyên) Cộng số tiền cọc vỏ vào ví tiền cọc vỏ của khách
        if (customer_id && totalDeposit > 0) {
            await connection.query(`UPDATE customers SET deposit_balance = deposit_balance + ? WHERE id = ?`, [totalDeposit, customer_id]);
        }

        await connection.commit();

        if (email && email.trim() !== "") {
            sendOrderEmail({
                customer_name: customer_name || "Quý khách",
                email: email.trim(),
                items: emailItems,
                totalAmount: totalAmount,
                deliveryFee: finalDeliveryFee,
                totalDeposit: totalDeposit,
                shipper_name: shipper_name || "---",
                order_id: `POS-${invoiceId}`,
                customer_address: customer_address || "Khách tự lấy / Không ghi địa chỉ"
            }).catch(err => console.error("Lỗi gửi mail:", err));
        }

        await logAction(req, "CREATE_INVOICE", "invoices", invoiceId, null, { items, totalAmount, paid_amount: actualPaid, debt: debtIncurred }, `Thanh toán hóa đơn #${invoiceId}`);
        res.json({ message: "Thanh toán thành công", invoice_id: invoiceId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(400).json({ message: err.message });
    } finally { connection.release(); }
});

// 3. GET HÓA ĐƠN IN ẤN (CHO INVOICEMODAL BẢN IN)
router.get("/:id", verifyToken, async (req, res) => {
    try {
        // 💡 ĐÃ FIX: Bổ sung lôi address, shipper_name và delivery_fee từ DB lên
        const [rows] = await db.query(`
            SELECT 
                i.id, i.created_at, i.shipper_name, i.delivery_fee, 
                COALESCE(SUM(bd.deposit_amount),0) as deposit_amount,
                c.id as customer_code, c.name as customer_name, c.phone, c.address as customer_address,
                p.name as product_name, ii.quantity, ii.sell_price
            FROM invoices i 
            LEFT JOIN customers c ON i.customer_id = c.id
            JOIN invoice_items ii ON i.id = ii.invoice_id 
            JOIN products p ON ii.product_id = p.id
            LEFT JOIN bottle_deposits bd ON bd.invoice_id = i.id
            WHERE i.id = ? 
            GROUP BY ii.id
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy" });

        res.json({
            id: rows[0].id,
            created_at: rows[0].created_at,
            deposit_amount: rows[0].deposit_amount || 0,
            delivery_fee: rows[0].delivery_fee || 0,
            shipper_name: rows[0].shipper_name || "",
            customer_code: rows[0].customer_code || "",
            customer_name: rows[0].customer_name || "Khách lẻ",
            phone: rows[0].phone || "",
            customer_address: rows[0].customer_address || "",
            items: rows.map(r => ({ product_name: r.product_name, quantity: r.quantity, sell_price: r.sell_price }))
        });
    } catch (err) { res.status(500).json({ message: "Lỗi load hóa đơn" }); }
});

// 4. GET CHI TIẾT HÓA ĐƠN (CHO MODAL MÀU XANH)
router.get("/details/:id", verifyToken, async (req, res) => {
    try {
        // 💡 ĐÃ SỬA: Thêm c.address vào câu lệnh SELECT
        const [invRows] = await db.query(`
            SELECT i.*, c.name AS customer_name, c.phone, c.address AS customer_address 
            FROM invoices i 
            LEFT JOIN customers c ON i.customer_id = c.id 
            WHERE i.id = ?
        `, [req.params.id]);

        const [items] = await db.query(`
            SELECT ii.quantity, ii.sell_price, p.name AS product_name, COALESCE(bd.deposit_amount, 0) as deposit 
            FROM invoice_items ii 
            JOIN products p ON ii.product_id = p.id 
            LEFT JOIN bottle_deposits bd ON ii.invoice_id = bd.invoice_id AND ii.product_id = bd.product_id 
            WHERE ii.invoice_id = ?
        `, [req.params.id]);

        if (invRows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
        }

        res.json({ ...invRows[0], items: items });
    } catch (err) {
        console.error("Lỗi lấy chi tiết:", err);
        res.status(500).json({ message: "Lỗi server" });
    }
});

module.exports = router;