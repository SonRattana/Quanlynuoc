const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendOrderEmail } = require('../mail');
const { verifyToken, checkRole } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger"); // 💡 ĐÃ BỔ SUNG AUDIT LOG

// ==========================================
// 💡 API MỚI: ĐẾM SỐ ĐƠN HÀNG CẦN XỬ LÝ (Dành cho Notification Badge của Trưởng Xưởng)
// ==========================================
router.get('/pending-count', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT COUNT(id) as count 
            FROM sales_orders 
            WHERE status NOT IN ('hoan_thanh', 'da_huy')
        `);
        res.json({ count: rows[0].count });
    } catch (err) {
        console.error("Lỗi đếm đơn hàng:", err);
        res.status(500).json({ count: 0 });
    }
});

// ==========================================
// 1. LẤY DANH SÁCH ĐƠN ĐẶT HÀNG
// ==========================================
router.get('/', verifyToken, async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT * FROM sales_orders 
            ORDER BY created_at DESC
        `);
        res.json(orders);
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hàng" });
    }
});

// ==========================================
// 2. TẠO ĐƠN ĐẶT HÀNG MỚI (CHƯA XUẤT HÓA ĐƠN)
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    const { customer_id, customer_name, customer_phone, customer_address, customer_email, shipper_name, delivery_fee, note, advance_payment, items, bottle_deposit, total_payment } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const order_code = `SO-${dateStr}-${randomStr}`;

        const [orderResult] = await connection.query(`
            INSERT INTO sales_orders 
            (order_code, customer_id, customer_name, customer_phone, customer_address, customer_email, shipper_name, delivery_fee, total_payment, advance_payment, bottle_deposit, note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cho_duyet')
        `, [
            order_code, customer_id ? Number(customer_id) : null, customer_name, customer_phone, customer_address, customer_email || null,
            shipper_name || "", Number(delivery_fee) || 0, Number(total_payment) || 0, Number(advance_payment) || 0, Number(bottle_deposit) || 0, note
        ]);
        const sales_order_id = orderResult.insertId;

        for (let item of items) {
            const total_price = item.quantity * item.unit_price;
            await connection.query(`
                INSERT INTO sales_order_details (sales_order_id, product_id, ordered_quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [sales_order_id, item.product_id, item.quantity, item.unit_price, total_price]);
        }

        await connection.commit();

        // 💡 GHI AUDIT LOG TẠO ĐƠN MỚI
        await logAction(req, "CREATE", "sales_orders", sales_order_id, null, req.body, `Tạo đơn đặt hàng mới: ${order_code}`);
        // 💡 SỬA LẠI CHỖ NÀY: Gọi thẳng req.io (do server.js đã cấu hình sẵn)
        if (req.io) {
            req.io.emit("co_don_hang_moi", { customer_name: customer_name });
        }
        res.status(201).json({ message: "Tạo đơn đặt hàng thành công!", order_code });

    } catch (error) {
        await connection.rollback();
        console.error("Lỗi tạo đơn:", error);
        res.status(500).json({ message: "Lỗi khi tạo đơn hàng" });
    } finally {
        connection.release();
    }
});

// ==========================================
// 3. XEM CHI TIẾT & THEO DÕI TIẾN ĐỘ 1 ĐƠN HÀNG
// ==========================================
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [orders] = await db.query('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
        if (orders.length === 0) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

        const [details] = await db.query(`
            SELECT d.*, p.name as product_name, p.unit 
            FROM sales_order_details d
            JOIN products p ON d.product_id = p.id
            WHERE d.sales_order_id = ?
        `, [req.params.id]);

        res.json({ ...orders[0], details });
    } catch (error) {
        console.error("Lỗi xem chi tiết:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ==========================================
// 4. CẬP NHẬT ĐƠN HÀNG (SỬA)
// ==========================================
router.put('/:id', verifyToken, checkRole('admin', 'nhanvien'), async (req, res) => {
    const orderId = req.params.id;
    const { customer_id, customer_name, customer_phone, customer_address, customer_email, shipper_name, delivery_fee, note, advance_payment, items, bottle_deposit, total_payment } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [checkStatus] = await connection.query("SELECT * FROM sales_orders WHERE id = ?", [orderId]);
        if (checkStatus.length === 0) throw new Error("Không tìm thấy đơn hàng");
        if (!['cho_duyet', 'cho_san_xuat'].includes(checkStatus[0].status)) {
            throw new Error("Đơn hàng đang được xử lý (đã SX hoặc giao), không thể thao tác!");
        }

        const oldData = checkStatus[0]; // Lấy data cũ để lưu log

        await connection.query(`
            UPDATE sales_orders 
            SET customer_id=?, customer_name=?, customer_phone=?, customer_address=?, customer_email=?, 
                shipper_name=?, delivery_fee=?, total_payment=?, advance_payment=?, bottle_deposit=?, note=?
            WHERE id = ?
        `, [
            customer_id ? Number(customer_id) : null, customer_name, customer_phone, customer_address, customer_email || null,
            shipper_name || "", Number(delivery_fee) || 0, Number(total_payment) || 0, Number(advance_payment) || 0, Number(bottle_deposit) || 0, note || "", orderId
        ]);

        await connection.query("DELETE FROM sales_order_details WHERE sales_order_id = ?", [orderId]);

        for (let item of items) {
            const total_price = item.quantity * item.unit_price;
            await connection.query(`
                INSERT INTO sales_order_details (sales_order_id, product_id, ordered_quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [orderId, item.product_id, item.quantity, item.unit_price, total_price]);
        }

        await connection.commit();

        // 💡 GHI AUDIT LOG SỬA ĐƠN
        await logAction(req, "UPDATE", "sales_orders", orderId, oldData, req.body, `Sửa thông tin đơn đặt hàng: ${oldData.order_code}`);

        res.json({ message: "Cập nhật đơn hàng thành công!" });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ message: error.message || "Lỗi cập nhật đơn hàng" });
    } finally {
        connection.release();
    }
});

// ==========================================
// 5. XÓA ĐƠN HÀNG
// ==========================================
router.delete('/:id', verifyToken, checkRole('admin', 'nhanvien'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [checkStatus] = await connection.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        if (checkStatus.length === 0) throw new Error("Không tìm thấy đơn hàng");
        if (checkStatus[0].status !== 'cho_duyet' && checkStatus[0].status !== 'cho_san_xuat') {
            throw new Error("Đơn hàng đã đưa vào xưởng hoặc đã giao, KHÔNG THỂ XÓA!");
        }

        const oldData = checkStatus[0]; // Lấy data cũ để lưu log

        await connection.query("DELETE FROM sales_order_details WHERE sales_order_id = ?", [req.params.id]);
        await connection.query("DELETE FROM sales_orders WHERE id = ?", [req.params.id]);

        await connection.commit();

        // 💡 GHI AUDIT LOG XÓA ĐƠN
        await logAction(req, "DELETE", "sales_orders", req.params.id, null, null, `Xóa đơn đặt hàng: ${oldData.order_code}`);

        res.json({ message: "Đã xóa đơn hàng thành công!" });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ message: error.message || "Lỗi xóa đơn hàng" });
    } finally {
        connection.release();
    }
});

// ==========================================
// 6. TRƯỞNG XƯỞNG DUYỆT ĐƠN HÀNG
// ==========================================
router.put('/approve/:id', verifyToken, checkRole('admin', 'sanxuat'), async (req, res) => {
    try {
        const [result] = await db.query("UPDATE sales_orders SET status = 'cho_san_xuat' WHERE id = ? AND status = 'cho_duyet'", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Đơn hàng không ở trạng thái Chờ duyệt hoặc đã bị hủy!" });
        }

        // 💡 GHI AUDIT LOG DUYỆT ĐƠN
        await logAction(req, "APPROVE", "sales_orders", req.params.id, null, null, `Xưởng duyệt Đơn hàng #${req.params.id}`);

        res.json({ message: "✅ Đã duyệt đơn hàng! Xưởng có thể bắt đầu sản xuất." });
    } catch (error) {
        console.error("Lỗi duyệt đơn:", error);
        res.status(500).json({ message: "Lỗi server khi duyệt đơn" });
    }
});

// ==========================================
// 7. XUẤT KHO & TẠO HÓA ĐƠN GIAO HÀNG TỪ ĐƠN ĐẶT (ERP LOGIC)
// ==========================================
router.post('/:id/export-invoice', verifyToken, checkRole('admin', 'sanxuat'), async (req, res) => {
    const orderId = req.params.id;
    const { warehouse_id, delivery_fee, items, shipper_name, customer_email } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [orders] = await connection.query("SELECT * FROM sales_orders WHERE id = ?", [orderId]);
        const order = orders[0];
        if (!order) throw new Error("Không tìm thấy đơn hàng gốc!");

        let effectiveCustomerId = order.customer_id;
        let finalCustomerName = order.customer_name;

        if (!effectiveCustomerId) {
            const [walkInCheck] = await connection.query("SELECT id FROM customers WHERE name = 'Khách vãng lai' LIMIT 1");
            if (walkInCheck.length > 0) {
                effectiveCustomerId = walkInCheck[0].id;
            } else {
                const [newWalkIn] = await connection.query(
                    "INSERT INTO customers (name, phone, address, debt_balance, deposit_balance, email) VALUES ('Khách vãng lai', '0000000000', 'Tại cửa hàng', 0, 0, NULL)"
                );
                effectiveCustomerId = newWalkIn.insertId;
            }

            if (!finalCustomerName || finalCustomerName.trim() === "") {
                finalCustomerName = 'Khách vãng lai';
            }
            await connection.query("UPDATE sales_orders SET customer_id = ?, customer_name = ? WHERE id = ?", [effectiveCustomerId, finalCustomerName, orderId]);
        }

        let finalEmail = customer_email || order.customer_email;
        if (!finalEmail && effectiveCustomerId) {
            const [cRow] = await connection.query("SELECT email FROM customers WHERE id = ?", [effectiveCustomerId]);
            if (cRow.length > 0 && cRow[0].email) {
                finalEmail = cRow[0].email;
            }
        }

        const finalShipper = shipper_name || order.shipper_name || "";

        const [invoiceResult] = await connection.query(

            `INSERT INTO invoices (total_amount, total_profit, deposit_amount, created_by, customer_id, customer_name, phone, customer_address, shipper_name, delivery_fee, paid_amount, payment_status, note, customer_email) 
             VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)`,
            [
                0, 0, req.user.id,
                effectiveCustomerId, finalCustomerName, order.customer_phone || '', order.customer_address || '',
                finalShipper, Number(delivery_fee) || 0,
                `Xuất giao đợt mới từ Đơn Đặt Hàng #${order.order_code}`,
                finalEmail || null
            ]
        );
        const invoiceId = invoiceResult.insertId;

        let totalGoods = 0;
        let totalDeposit = 0;
        let totalProfit = 0;
        let emailItems = [];

        for (let item of items) {
            if (Number(item.deliver_qty) > 0 || Number(item.returned_bottles) > 0) {
                const [pRow] = await connection.query("SELECT name, cost_price, deposit_price FROM products WHERE id = ?", [item.product_id]);
                const productName = pRow[0]?.name || "Sản phẩm";
                const costPrice = pRow[0]?.cost_price || 0;
                const depositPrice = pRow[0]?.deposit_price || 0;

                const deliverQty = Number(item.deliver_qty) || 0;
                const returnedQty = Number(item.returned_bottles) || 0;

                if (deliverQty > 0) {
                    // 💡 ĐÃ FIX: Kiểm tra kho trước khi xuất, chặn đứng nếu xuất âm
                    const [stockCheck] = await connection.query("SELECT quantity FROM products WHERE id = ?", [item.product_id]);
                    const currentStock = stockCheck[0]?.quantity || 0;

                    if (currentStock < deliverQty) {
                        throw new Error(`Sản phẩm '${productName}' không đủ tồn kho! Hiện còn ${currentStock}, nhưng yêu cầu xuất ${deliverQty}.`);
                    }

                    // (Code cũ giữ nguyên)
                    await connection.query(
                        "INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price) VALUES (?, ?, ?, ?, ?)",
                        [invoiceId, item.product_id, deliverQty, item.unit_price, costPrice]
                    );

                    await connection.query(
                        "UPDATE sales_order_details SET delivered_quantity = COALESCE(delivered_quantity, 0) + ? WHERE sales_order_id = ? AND product_id = ?",
                        [deliverQty, orderId, item.product_id]
                    );

                    await connection.query(
                        "INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason, transaction_type, ref_sales_order_id, reference_id, reference_type) VALUES (?, ?, 'export', ?, 'Bán hàng (Từ Đơn đặt)', 'sale', ?, ?, 'invoice')",
                        [item.product_id, warehouse_id || 1, deliverQty, orderId, invoiceId]
                    );

                    await connection.query("UPDATE products SET quantity = quantity - ? WHERE id = ?", [deliverQty, item.product_id]);
                    await connection.query("UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?", [deliverQty, warehouse_id || 1, item.product_id]);

                    totalGoods += (deliverQty * item.unit_price);
                    totalProfit += (item.unit_price - costPrice) * deliverQty;

                    emailItems.push({
                        product_name: productName,
                        quantity: deliverQty,
                        sell_price: item.unit_price
                    });
                }

                const missingBottles = deliverQty - returnedQty;
                if (missingBottles > 0 && depositPrice > 0) {
                    const depositFee = missingBottles * depositPrice;
                    totalDeposit += depositFee;
                    await connection.query(`INSERT INTO bottle_deposits (customer_id, product_id, quantity, deposit_amount, status, type, invoice_id, created_at) VALUES (?, ?, ?, ?, 'dang_giu', 'deposit', ?, NOW())`,
                        [effectiveCustomerId, item.product_id, missingBottles, depositFee, invoiceId]);
                }

                if (missingBottles < 0 && depositPrice > 0) {
                    const refundBottles = Math.abs(missingBottles);
                    const refundAmount = refundBottles * depositPrice;
                    await connection.query(`INSERT INTO bottle_deposits (customer_id, product_id, quantity, deposit_amount, status, type, invoice_id, created_at) VALUES (?, ?, ?, ?, 'da_tra', 'refund', ?, NOW())`,
                        [effectiveCustomerId, item.product_id, refundBottles, refundAmount, invoiceId]);
                    totalDeposit -= refundAmount;
                }
            }
        }

        const grandTotal = totalGoods + totalDeposit + Number(delivery_fee || 0);
        const advancePayment = Number(order.advance_payment || 0);
        let paidAmount = 0;
        let paymentStatus = 'unpaid';

        if (advancePayment > 0) {
            paidAmount = Math.min(grandTotal, advancePayment);
            paymentStatus = paidAmount >= grandTotal ? 'paid' : 'partial';
            await connection.query(
                "UPDATE sales_orders SET advance_payment = advance_payment - ? WHERE id = ?",
                [paidAmount, orderId]
            );
        }

        await connection.query(
            "UPDATE invoices SET deposit_amount = ?, total_amount = ?, total_profit = ?, paid_amount = ?, payment_status = ? WHERE id = ?",
            [totalDeposit, grandTotal, totalProfit, paidAmount, paymentStatus, invoiceId]
        );

        const remainingDebt = grandTotal - paidAmount;
        if (remainingDebt > 0) {
            await connection.query(`UPDATE customers SET debt_balance = debt_balance + ? WHERE id = ?`, [remainingDebt, effectiveCustomerId]);
            await connection.query(`INSERT INTO customer_payments (customer_id, invoice_id, amount, transaction_type, note) VALUES (?, ?, ?, 'debt_increase', ?)`,
                [effectiveCustomerId, invoiceId, remainingDebt, `Ghi nợ từ Hóa đơn #${invoiceId} (Đơn ${order.order_code})`]);
        }
        if (totalDeposit > 0) {
            await connection.query(`UPDATE customers SET deposit_balance = deposit_balance + ? WHERE id = ?`, [totalDeposit, effectiveCustomerId]);
        }

        const [checkQty] = await connection.query(`
            SELECT SUM(ordered_quantity) as total_ordered, SUM(delivered_quantity) as total_delivered 
            FROM sales_order_details 
            WHERE sales_order_id = ?
        `, [orderId]);

        if (checkQty[0].total_delivered >= checkQty[0].total_ordered) {
            await connection.query("UPDATE sales_orders SET status = 'hoan_thanh' WHERE id = ?", [orderId]);
        } else {
            await connection.query("UPDATE sales_orders SET status = 'dang_san_xuat' WHERE id = ?", [orderId]);
        }

        await connection.commit();

        // 💡 GHI AUDIT LOG CHỐT ĐƠN GIAO HÀNG
        await logAction(req, "CREATE", "invoices", invoiceId, null, null, `Xuất Hóa đơn giao hàng từ Đơn ${order.order_code}`);

        res.json({ message: "✅ Đã tạo Hóa Đơn và Ghi nhận Công nợ thành công!", invoiceId });

        if (finalEmail) {
            try {
                await sendOrderEmail({
                    customer_name: finalCustomerName,
                    customer_phone: order.customer_phone || '',
                    email: finalEmail,
                    items: emailItems,
                    totalAmount: grandTotal,
                    order_id: `HD${invoiceId}`,
                    deliveryFee: Number(delivery_fee) || 0,
                    shipper_name: finalShipper,
                    customer_address: order.customer_address || 'Nhận tại cửa hàng',
                    totalDeposit: totalDeposit
                });
                console.log(`Đã bắn mail thành công Hóa Đơn HD${invoiceId} tới: ${finalEmail}`);
            } catch (mailErr) {
                console.error("Lỗi khi bắn mail hóa đơn:", mailErr);
            }
        }

    } catch (error) {
        await connection.rollback();
        console.error("Lỗi xuất hóa đơn từ đơn đặt:", error);
        res.status(500).json({ message: error.message || "Lỗi server khi xuất hóa đơn" });
    } finally {
        connection.release();
    }
});

module.exports = router;