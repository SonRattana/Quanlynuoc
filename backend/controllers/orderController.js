const db = require('../db');
const { sendOrderEmail } = require('../mail');
const { logAction } = require('../utils/logger');


exports.createOnlineOrder = async (req, res) => {
    try {
        // 1. Lấy thông tin thô từ Frontend gửi lên trước
        let { customer_name, phone, email, shipping_address, note, items } = req.body;

        // ==========================================================
        // ĐOẠN FIX CHÍ MẠNG: ĐÃ ĐĂNG NHẬP THÌ PHẢI LẤY ĐỒ CHÍNH CHỦ!
        // ==========================================================
        // Giả sử sếp có xài Middleware verifyToken (JWT) kẹp ở Route để đá qua req.user
        if (req.user && req.user.id) {
            // Chui thẳng vào DB lấy thông tin chuẩn đét của cái thằng đang đăng nhập này
            const [realUser] = await db.query('SELECT name, phone, email FROM customers WHERE id = ?', [req.user.id]);

            if (realUser.length > 0) {
                // Đè bẹp dí thông tin nhập tay ở Frontend bằng thông tin chính chủ trong DB!
                customer_name = realUser[0].name;
                phone = realUser[0].phone;
                email = realUser[0].email || email; // Nếu DB không có email thì mới dùng email ở body
            }
        }

        // Rào lỗi đầu vào (Lúc này phone đã là phone an toàn)
        if (!customer_name || !phone || !shipping_address || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin đặt hàng hoặc giỏ hàng trống!" });
        }

        // 1. Kiểm tra khách cũ hay mới (Bây giờ chạy cực kỳ an toàn)
        let customerId;
        const [existingCustomer] = await db.query('SELECT id FROM customers WHERE phone = ?', [phone]);

        if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
        } else {
            // CẤP MÃ CHỨNG MINH THƯ CHO KHÁCH ONLINE MỚI TOANH
            const onlineCustomerCode = `ONL-${phone}`;

            const [newCustomer] = await db.query(
                'INSERT INTO customers (name, phone, email, address, type, customer_code) VALUES (?, ?, ?, ?, ?, ?)',
                [customer_name, phone, email || null, shipping_address, 'le', onlineCustomerCode]
            );
            customerId = newCustomer.insertId;
        }

        // 2. Tính tổng tiền
        let totalAmount = 0;
        items.forEach(item => {
            totalAmount += item.sell_price * item.buyQty;
        });

        // 3. Tạo Đơn hàng mới
        const [newOrder] = await db.query(
            'INSERT INTO orders (customer_id, total_amount, shipping_address, note, status) VALUES (?, ?, ?, ?, ?)',
            [customerId, totalAmount, shipping_address, note, 'pending']
        );
        const orderId = newOrder.insertId;

        // 4. Lưu chi tiết món nước
        for (let item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, product_id, quantity, sell_price) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.buyQty, item.sell_price]
            );
        }

        // TRẢ KẾT QUẢ VỀ CHO KHÁCH TRƯỚC
        res.status(200).json({
            success: true,
            message: "Đặt hàng thành công! Hóa đơn sẽ được gửi vào email bạn.",
            order_id: orderId
        });

        // BẮN TÍN HIỆU RADAR SANG CHO ADMIN
        req.io.emit("co_don_hang_moi", {
            message: "Bạn ơi, có đơn vãng lai mới!",
            order_id: orderId,
            customer_name: customer_name,
            total: totalAmount
        });

        // BẮN MAIL ÂM THẦM
        sendOrderEmail({
            customer_name,
            customer_address,
            email,
            items,
            totalAmount,
            deliveryFee: 0,
            shipper_name: null,
            order_id: orderId
        })
            .then(() => console.log(` Mail hóa đơn đơn #${orderId} đã bay đi!`))
            .catch(err => console.error(` Mail hóa đơn đơn #${orderId} bị xịt:`, err));

    } catch (error) {
        console.error("Lỗi hệ thống:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Lỗi server khi đặt hàng!" });
        }
    }
};
exports.getAllOrders = async (req, res) => {
    try {
        // 1. Nhận thông số trang từ URL (mặc định là trang 1, 10 dòng/trang)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // 2. Đếm tổng số đơn hàng
        const [[{ total }]] = await db.query('SELECT COUNT(id) as total FROM orders');
        const totalPages = Math.ceil(total / limit);

        // 3. Lấy dữ liệu của trang hiện tại (ĐÃ BỔ SUNG CỘT `note` VÀ `email` CHO CHUẨN FRONTEND)
        const [orders] = await db.query(`
            SELECT 
                o.id, 
                c.name AS customer_name, 
                c.phone, 
                c.address AS customer_address,
                c.email, 
                o.shipping_address, 
                o.note, 
                o.total_amount, 
                o.status, 
                o.created_at
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        // 4. Trả về format giống y xì Products
        res.status(200).json({
            data: orders,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

// CẬP NHẬT TRẠNG THÁI: TRỪ KHO + TÍNH LÃI + CHUYỂN THÀNH HÓA ĐƠN CHÍNH THỨC
exports.updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const createdBy = (req.user && req.user.id) || req.userId || (req.user && req.user.userId) || 1;
        // Bắt thêm biến status truyền từ Frontend lên (nếu không truyền mặc định là completed)
        const newStatus = req.body.status || 'completed';

        // 1. Lấy thông tin tổng quát của đơn đặt hàng
        const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
        }
        const order = orders[0];

        // Chặn click đúp 2 lần nếu đơn đã hoàn thành
        if (order.status === 'completed' && newStatus === 'completed') {
            return res.status(400).json({ message: "Đơn này đã được chốt rồi nha!" });
        }

        // ==========================================
        // 2, 3, 4, 5. TRỪ KHO VÀ CHUYỂN QUA HÓA ĐƠN
        // (Chỉ thực hiện khi trạng thái được chốt là 'completed')
        // ==========================================
        if (newStatus === 'completed' && order.status !== 'completed') {
            const [items] = await db.query(`
                SELECT oi.product_id, oi.quantity, oi.sell_price, p.cost_price 
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `, [orderId]);

            let totalProfit = 0;
            for (let item of items) {
                totalProfit += (item.sell_price - item.cost_price) * item.quantity;
                // Trừ kho
                await db.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
            }

            // Lưu Invoice
            const [newInvoice] = await db.query(
                'INSERT INTO invoices (customer_id, total_amount, total_profit, created_by, deposit_amount) VALUES (?, ?, ?, ?, ?)',
                [order.customer_id, order.total_amount, totalProfit, createdBy, 0]
            );
            const invoiceId = newInvoice.insertId;

            // Lưu Invoice Items
            for (let item of items) {
                await db.query(
                    'INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price) VALUES (?, ?, ?, ?, ?)',
                    [invoiceId, item.product_id, item.quantity, item.sell_price, item.cost_price]
                );
            }
        }

        // ==========================================
        // 6. CẬP NHẬT TRẠNG THÁI VÀ BẮN RADAR SOCKET CHO KHÁCH
        // ==========================================
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);

        // [QUAN TRỌNG NHẤT]: Bắn Socket báo riêng cho ID đơn hàng này
        if (req.io) {
            req.io.emit(`cap_nhat_don_hang_${orderId}`, { status: newStatus });
        }

        // ==========================================
        // 7. GHI LOG CHO ADMIN BIẾT AI VỪA DUYỆT ĐƠN
        // ==========================================
        await logAction(
            req,
            "APPROVE_ORDER",
            "orders",
            orderId,
            { old_status: order.status },
            { new_status: newStatus },
            `Duyệt đơn hàng Online #${orderId} - Trạng thái: ${newStatus}`
        );

        res.status(200).json({ success: true, message: "Cập nhật trạng thái đơn hàng thành công!" });

    } catch (error) {
        console.error("Lỗi khi chốt đơn:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Lỗi server khi chốt đơn!" });
        }
    }
};
// ==========================================
// LẤY CHI TIẾT 1 ĐƠN HÀNG DÀNH CHO TRANG TRACKING (PUBLIC)
// ==========================================
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        // Lấy thông tin đơn hàng + tên khách + sđt từ 2 bảng orders và customers
        const [orders] = await db.query(`
            SELECT o.id, o.total_amount, o.shipping_address, o.status, o.created_at, 
                   c.name AS customer_name, c.phone, c.address AS customer_address
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng này" });
        }

        // Trả dữ liệu về cho Frontend
        res.status(200).json(orders[0]);

    } catch (error) {
        console.error("Lỗi lấy chi tiết đơn hàng (Tracking):", error);
        res.status(500).json({ message: "Lỗi server khi tìm đơn hàng" });
    }
};

// ==========================================
// TRA CỨU LỊCH SỬ ĐƠN HÀNG BẰNG EMAIL (PUBLIC)
// ==========================================
exports.lookupOrdersByEmail = async (req, res) => {
    try {
        // Lấy tham số email thay vì phone
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: "Vui lòng cung cấp email để tra cứu." });

        const [orders] = await db.query(`
            SELECT 
                o.id, 
                o.total_amount, 
                o.status, 
                o.created_at, 
                o.shipping_address,
                GROUP_CONCAT(CONCAT(p.name, ' (x', oi.quantity, ')') SEPARATOR ', ') AS product_names
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE c.email = ?
            GROUP BY o.id, o.total_amount, o.status, o.created_at, o.shipping_address
            ORDER BY o.created_at DESC
        `, [email]); // Đổi biến truyền vào thành email

        res.status(200).json(orders);
    } catch (error) {
        console.error("Lỗi tra cứu đơn hàng:", error);
        res.status(500).json({ message: "Lỗi server khi tra cứu đơn hàng" });
    }
};

// ==========================================
// ĐẾM SỐ ĐƠN HÀNG CHỜ XỬ LÝ (LÚC ADMIN VỪA MỞ WEB)
// ==========================================
exports.countPendingOrders = async (req, res) => {
    try {
        const [[{ totalPending }]] = await db.query("SELECT COUNT(id) as totalPending FROM orders WHERE status = 'pending'");
        res.status(200).json({ count: totalPending });
    } catch (error) {
        console.error("Lỗi đếm đơn hàng tồn đọng:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

// ==========================================
// MOI RUỘT CHI TIẾT 1 ĐƠN HÀNG (DÀNH CHO ADMIN)
// ==========================================
exports.getAdminOrderDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [orders] = await db.query(`
            SELECT o.*, c.name AS customer_name, c.phone, c.email, c.address AS customer_address
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
        }

        // BỔ SUNG: Kéo thêm cột p.deposit_price (Tiền cọc) từ bảng products
        const [items] = await db.query(`
            SELECT oi.quantity, oi.sell_price, p.name AS product_name, p.deposit_price
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [id]);

        res.status(200).json({
            orderInfo: orders[0],
            items: items
        });

    } catch (error) {
        console.error("Lỗi moi ruột đơn hàng:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};