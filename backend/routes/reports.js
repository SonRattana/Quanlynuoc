const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ================= 📊 API TRÙM CUỐI: BÁO CÁO LÃI LỖ (P&L) ĐÃ NÂNG CẤP =================
router.get('/pnl', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        // 1. LẤY DỮ LIỆU TỔNG: DOANH THU & GIÁ VỐN 
        // (💡 Dùng ii.cost_price thay vì p.cost_price để giữ đúng giá vốn lịch sử lúc xuất bán)
        const [salesData] = await db.query(`
            SELECT 
                IFNULL(SUM(ii.quantity * ii.sell_price), 0) AS total_revenue,
                IFNULL(SUM(ii.quantity * ii.cost_price), 0) AS total_cogs
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE i.created_at >= ? AND i.created_at <= ?
        `, [startDateTime, endDateTime]);

        const totalRevenue = Number(salesData[0].total_revenue);
        const totalCOGS = Number(salesData[0].total_cogs);

        // 2. LẤY DỮ LIỆU CHI PHÍ HOẠT ĐỘNG (Giữ nguyên logic cực chuẩn của sếp)
        const [expenseData] = await db.query(`
            SELECT IFNULL(SUM(amount), 0) AS total_expenses
            FROM expenses
            WHERE expense_date >= ? AND expense_date <= ?
        `, [startDate, endDate]);

        const totalExpenses = Number(expenseData[0].total_expenses);

        // Tính toán lợi nhuận
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;

        // 3. LẤY DỮ LIỆU CHI TIẾT TỪNG MẶT HÀNG (Tính năng mới)
        const [detailRows] = await db.query(`
            SELECT 
                p.name AS product_name,
                SUM(ii.quantity) AS total_sold,
                SUM(ii.quantity * ii.sell_price) AS total_revenue,
                SUM(ii.quantity * ii.cost_price) AS total_cogs,
                SUM((ii.sell_price - ii.cost_price) * ii.quantity) AS gross_profit,
                ROUND((SUM((ii.sell_price - ii.cost_price) * ii.quantity) / NULLIF(SUM(ii.quantity * ii.sell_price), 0)) * 100, 2) AS margin_percentage
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            JOIN products p ON ii.product_id = p.id
            WHERE i.created_at >= ? AND i.created_at <= ?
            GROUP BY p.id, p.name
            ORDER BY gross_profit DESC
        `, [startDateTime, endDateTime]);

        // 4. TRẢ VỀ JSON CÓ CẢ 2 PHẦN (SUMMARY VÀ DETAILS) CHO FRONTEND
        res.json({
            summary: {
                total_revenue: totalRevenue,
                total_cogs: totalCOGS,
                gross_profit: grossProfit,
                total_expenses: totalExpenses,
                net_profit: netProfit
            },
            details: detailRows || []
        });

    } catch (err) {
        console.error("LỖI API BÁO CÁO P&L:", err.message);
        // Trả về cấu trúc rỗng để Frontend không bị sập
        res.status(500).json({ summary: {}, details: [] });
    }
});

// API: Lấy báo cáo doanh thu CHI TIẾT (Sổ chi tiết bán hàng)
router.get('/revenue', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                i.id AS invoice_id,
                i.created_at,
                i.shipper_name,
                i.unreturned_bottles,
                '' AS note, 
                c.name AS customer_name,
                c.phone,
                COALESCE(c.address, '') AS address, 
                p.name AS product_name,
                p.unit,
                ii.quantity,
                ii.sell_price,
                (ii.quantity * ii.sell_price) AS thanh_tien,
                (ii.quantity * COALESCE(p.deposit_price, 0)) AS the_chan
            FROM invoices i 
            LEFT JOIN customers c ON i.customer_id = c.id
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN products p ON ii.product_id = p.id
            WHERE i.created_at >= ? AND i.created_at <= ?
            ORDER BY i.created_at DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("LỖI API SỔ CHI TIẾT BÁN HÀNG:", err.message);
        res.status(500).json([]);
    }
});

// API: Lấy báo cáo công nợ vỏ bình
router.get('/bottles', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                c.customer_code,
                c.name AS customer_name,
                c.phone,
                c.address AS customer_address,
                SUM(CASE WHEN b.type = 'deposit' THEN b.quantity ELSE 0 END) AS total_borrowed,
                SUM(CASE WHEN b.type = 'refund' THEN b.quantity ELSE 0 END) AS total_returned,
                SUM(CASE WHEN b.type = 'deposit' THEN b.quantity ELSE -b.quantity END) AS remaining_bottles,
                SUM(CASE WHEN b.type = 'deposit' THEN b.deposit_amount ELSE -b.deposit_amount END) AS total_deposit
            FROM customers c
            JOIN bottle_deposits b ON c.id = b.customer_id
            GROUP BY c.id
            HAVING remaining_bottles > 0
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
        // Sử dụng mảng param chuẩn để tránh SQL Injection
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
              AND b.note NOT IN ('Hoàn vỏ bình thường', '')
              AND b.created_at BETWEEN ? AND ?
            ORDER BY b.created_at DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Khấu hao:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Khách hàng Mới / Cũ
router.get('/customers', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Đảm bảo là chuỗi ngày tháng chuẩn
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                c.customer_code,
                c.name AS customer_name,
                c.phone,
                c.address AS customer_address,
                MIN(i.created_at) AS first_purchase_date,
                COUNT(i.id) AS total_orders,
                SUM(i.total_amount) AS total_revenue,
                -- 💡 ĐIỂM SÁNG: Nếu ngày mua đầu tiên >= startDate thì là khách mới trong kỳ này
                CASE 
                    WHEN MIN(i.created_at) >= ? THEN 'Khách Mới' 
                    ELSE 'Khách Cũ' 
                END AS customer_type
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            -- 💡 TỐI ƯU: Lọc ngay ở WHERE để tránh quét toàn bộ DB
            WHERE i.created_at BETWEEN ? AND ?
            GROUP BY c.id
            ORDER BY total_revenue DESC
        `, [startDateTime, startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Khách hàng:", err);
        res.status(500).json([]);
    }
});

// API: Báo cáo Tồn kho hiện tại
router.get('/inventory', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.name AS product_name,
                p.unit AS unit,           
                p.quantity AS current_stock,
                p.sell_price,
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

// API: Báo cáo Doanh thu theo Sản Phẩm
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

// 💡 API MỚI: BÁO CÁO NHẬP HÀNG & THUẾ VAT
router.get('/purchases', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                id,
                created_at,
                supplier_name,
                invoice_code,
                total_goods_amount,
                vat_rate,
                vat_amount,
                total_fee_amount,
                total_payment,
                note
            FROM purchase_orders
            WHERE created_at >= ? AND created_at <= ?
            ORDER BY created_at DESC
        `, [startDateTime, endDateTime]);

        res.json(rows || []);
    } catch (err) {
        console.error("Lỗi API Báo cáo Nhập hàng:", err);
        res.status(500).json([]);
    }
});

// ================= BÁO CÁO DOANH THU THEO KHU VỰC (ĐỊA CHỈ) =================
router.get("/sales-by-region", verifyToken, async (req, res) => {
    try {
        // 💡 ĐÃ SỬA: Đón thêm từ khóa searchRegion từ Frontend truyền lên
        const { startDate, endDate, searchRegion } = req.query;

        let query = `
            SELECT 
                COALESCE(NULLIF(TRIM(c.address), ''), 'Khách tự lấy / Không ghi địa chỉ') AS region,
                COUNT(DISTINCT i.id) AS total_orders,
                SUM(ii.quantity) AS total_products_sold,
                SUM(ii.sell_price * ii.quantity) AS total_revenue
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?
        `;
        const params = [startDate, endDate];

        // 💡 ĐÃ SỬA: Nếu sếp có gõ tìm kiếm thì ghép thêm điều kiện lọc
        if (searchRegion && searchRegion.trim() !== "") {
            query += ` AND c.address LIKE ?`;
            params.push(`%${searchRegion.trim()}%`);
        }

        query += `
            GROUP BY region
            ORDER BY total_revenue DESC
        `;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi báo cáo khu vực:", err);
        res.status(500).json({ message: "Lỗi server khi lấy báo cáo khu vực" });
    }
});

// API: Báo cáo Doanh thu Thực tế (Cập nhật Vỏ & Cọc & DÒNG TIỀN)
router.get('/actual-revenue', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        const [rows] = await db.query(`
            SELECT 
                i.id AS invoice_id,
                i.created_at,
                i.shipper_name,
                c.name AS customer_name,
                c.phone,
                c.address AS customer_address,
                p.name AS product_name,
                p.unit,
                ii.quantity,
                ii.sell_price,
                (ii.quantity * ii.sell_price) AS subtotal,
                
                -- 💡 THÊM 3 DÒNG NÀY ĐỂ KÉO DÒNG TIỀN VÀO BÁO CÁO
                i.total_amount AS inv_total,
                i.paid_amount AS inv_paid,
                (i.total_amount - i.paid_amount) AS inv_debt,
                
                COALESCE(bd.remaining_bottles, 0) AS actual_unreturned_bottles,
                COALESCE(bd.remaining_deposit, 0) AS actual_deposit_held

            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customers c ON i.customer_id = c.id
            JOIN products p ON ii.product_id = p.id
            
            LEFT JOIN (
                SELECT invoice_id, product_id, 
                       SUM(quantity) AS remaining_bottles, 
                       SUM(deposit_amount) AS remaining_deposit
                FROM bottle_deposits
                WHERE status = 'dang_giu' AND type = 'deposit'
                GROUP BY invoice_id, product_id
            ) bd ON i.id = bd.invoice_id AND ii.product_id = bd.product_id
            
            WHERE i.created_at BETWEEN ? AND ?
            ORDER BY i.created_at DESC, i.id DESC
        `, [startDateTime, endDateTime]);

        res.json(rows);
    } catch (err) {
        console.error("Lỗi lấy báo cáo doanh thu thực tế:", err);
        res.status(500).json({ message: "Lỗi Server" });
    }
});

module.exports = router;