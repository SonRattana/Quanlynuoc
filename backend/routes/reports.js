const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// API: Lấy báo cáo doanh thu theo khoảng thời gian
router.get('/revenue', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Ép thời gian để lấy trọn vẹn từ 0h ngày bắt đầu đến 23h59 ngày kết thúc
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
      SELECT 
        s.id AS invoice_id,
        s.created_at,
        c.customer_code,
        c.name AS customer_name,
        s.total_amount
      FROM invoices s 
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at >= ? AND s.created_at <= ?
      ORDER BY s.created_at DESC
    `, [startDateTime, endDateTime]);

        // Trả về mảng rỗng nếu không có dữ liệu để Frontend không bị lỗi
        res.json(rows || []);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// API: Lấy báo cáo công nợ vỏ bình (Ai đang nợ, nợ bao nhiêu cái, giữ bao nhiêu tiền)
router.get('/bottles', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT 
        c.customer_code,
        c.name AS customer_name,
        c.phone,
        -- Tổng số vỏ đã mượn (đặt cọc)
        SUM(CASE WHEN b.type = 'deposit' THEN b.quantity ELSE 0 END) AS total_borrowed,
        -- Tổng số vỏ đã trả (hoàn tiền)
        SUM(CASE WHEN b.type = 'refund' THEN b.quantity ELSE 0 END) AS total_returned,
        -- Số vỏ ĐANG NỢ = Mượn - Trả
        SUM(CASE WHEN b.type = 'deposit' THEN b.quantity ELSE -b.quantity END) AS remaining_bottles,
        -- Tổng tiền cọc quán đang giữ (VNĐ)
        SUM(CASE WHEN b.type = 'deposit' THEN b.deposit_amount ELSE -b.deposit_amount END) AS total_deposit
      FROM customers c
      JOIN bottle_deposits b ON c.id = b.customer_id
      GROUP BY c.id
      HAVING remaining_bottles > 0 -- Chỉ hiện khách còn nợ vỏ
      ORDER BY remaining_bottles DESC
    `);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Vỏ bình:", err);
        res.status(500).json([]);
    }
});

// API: Lấy báo cáo ghi chú khi hoàn vỏ bình
router.get('/bottle-notes', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                b.created_at,
                c.name AS customer_name,
                c.phone,
                p.name AS product_name,
                b.quantity,
                b.deposit_amount,
                b.note
            FROM bottle_deposits b
            JOIN customers c ON b.customer_id = c.id
            LEFT JOIN products p ON b.product_id = p.id
            WHERE b.type = 'refund' 
              AND b.note IS NOT NULL 
              AND b.note != 'Hoàn vỏ bình thường' 
              AND b.note != ''
              AND b.created_at >= ? AND b.created_at <= ?
            ORDER BY b.created_at DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Khấu hao:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Khách hàng Mới / Cũ (Theo ngày tháng)
router.get('/customers', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // Logic: Lấy ngày mua hàng đầu tiên của khách. 
        // Nếu ngày mua đầu tiên nằm trong khoảng thời gian lọc -> Khách Mới. Ngược lại -> Khách Cũ.
        const [rows] = await db.query(`
            SELECT 
                c.customer_code,
                c.name AS customer_name,
                c.phone,
                COUNT(i.id) AS total_orders,
                SUM(i.total_amount) AS total_revenue,
                MIN(i.created_at) AS first_order_date,
                IF(MIN(i.created_at) >= ?, 'Khách Mới', 'Khách Cũ') AS customer_type
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.created_at >= ? AND i.created_at <= ?
            GROUP BY c.id
            ORDER BY total_revenue DESC
        `, [startDateTime, startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Khách hàng:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Tồn kho hiện tại (Không cần lọc theo ngày, lấy thực tế ngay lúc bấm)
router.get('/inventory', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.name AS product_name,
                p.quantity AS current_stock,
                p.sell_price,
                -- Tính tổng vỏ của sản phẩm này khách đang ôm ở nhà
                COALESCE((
                    SELECT SUM(CASE WHEN type = 'deposit' THEN quantity ELSE -quantity END)
                    FROM bottle_deposits
                    WHERE product_id = p.id
                ), 0) AS bottles_with_customers
            FROM products p
            ORDER BY p.quantity DESC
        `);
        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Tồn kho:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Xuất kho (Thống kê số lượng bán ra theo từng sản phẩm)
router.get('/stock-history', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                p.id AS product_id,
                p.name AS product_name,
                COALESCE(SUM(ii.quantity), 0) AS total_export,
                COALESCE(SUM(ii.quantity * ii.sell_price), 0) AS total_export_revenue
            FROM products p
            JOIN invoice_items ii ON p.id = ii.product_id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.created_at >= ? AND i.created_at <= ?
            GROUP BY p.id
            ORDER BY total_export DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Xuất kho:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Lịch sử Nhập / Xuất Kho chi tiết
router.get('/stock-history', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // LƯU Ý: Vì anh chưa có bảng nhập kho, em dùng UNION để giả lập form chuẩn.
        // Phần 1: Lấy dữ liệu XUẤT KHO từ hóa đơn bán hàng (Đã có thật)
        const [rows] = await db.query(`
            SELECT 
                i.created_at,
                p.name AS product_name,
                'Xuất kho' AS transaction_type,
                'Kho Cửa Hàng' AS from_location,
                COALESCE(c.name, 'Khách lẻ') AS to_location,
                ii.quantity
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN products p ON ii.product_id = p.id
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.created_at >= ? AND i.created_at <= ?
            
            /* Sắp xếp mới nhất lên đầu */
            ORDER BY created_at DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Nhập/Xuất kho:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Doanh thu theo Loại Sản Phẩm
router.get('/revenue-by-product', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                p.name AS product_name,
                COALESCE(SUM(ii.quantity), 0) AS total_quantity,
                COALESCE(SUM(ii.quantity * ii.sell_price), 0) AS total_revenue
            FROM products p
            JOIN invoice_items ii ON p.id = ii.product_id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.created_at >= ? AND i.created_at <= ?
            GROUP BY p.id
            ORDER BY total_revenue DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Doanh thu theo sản phẩm:", err);
        res.status(500).json([]);
    }
});

module.exports = router;