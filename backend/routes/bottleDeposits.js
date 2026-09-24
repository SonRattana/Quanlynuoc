const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const { logAction } = require('../utils/logger'); // 💡 BỔ SUNG AUDIT LOG

// ==========================================
// 1. TỔNG HỢP DANH SÁCH NỢ VỎ (ĐÃ TÁCH THEO SẢN PHẨM & HIỆN TÊN KHÁCH LẺ)
// ==========================================
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                bd.customer_id as customer_id, 
                MAX(bd.invoice_id) as invoice_id,
                bd.product_id,
                COALESCE(p.name, 'Vỏ bình cũ') as product_name,
                
                -- 💡 THUẬT TOÁN MỚI: Ưu tiên moi tên thật từ Đơn đặt hàng (so) lên trước
                COALESCE(c.name, i.customer_name, so.customer_name, 'Khách vãng lai') as customer_name, 
                COALESCE(c.phone, i.phone, so.customer_phone, '') as customer_phone, 
                COALESCE(c.address, i.customer_address, so.customer_address, '') as customer_address,
                
                SUM(CASE WHEN bd.type = 'deposit' THEN bd.quantity ELSE -bd.quantity END) as total_bottles_kept,
                SUM(CASE WHEN bd.type = 'deposit' THEN bd.deposit_amount ELSE -bd.deposit_amount END) as total_deposit_kept
            FROM bottle_deposits bd
            LEFT JOIN customers c ON bd.customer_id = c.id
            LEFT JOIN invoices i ON bd.invoice_id = i.id
            LEFT JOIN products p ON bd.product_id = p.id
            
            -- 💡 XÂY CẦU NỐI: Móc từ Hóa Đơn (i) -> Phiếu Xuất (st) -> Đơn Đặt Hàng (so)
            LEFT JOIN stock_transactions st ON i.ref_export_log_id = st.id
            LEFT JOIN sales_orders so ON st.ref_sales_order_id = so.id
            
            GROUP BY 
                bd.customer_id, 
                bd.product_id,
                p.name,
                COALESCE(c.name, i.customer_name, so.customer_name, 'Khách vãng lai'), 
                COALESCE(c.phone, i.phone, so.customer_phone, ''),
                COALESCE(c.address, i.customer_address, so.customer_address, '')
                
            HAVING total_bottles_kept > 0
            ORDER BY customer_name ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi lấy danh sách nợ vỏ:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});

// ==========================================
// 2. XỬ LÝ TRẢ VỎ (NHẬN DIỆN ĐÚNG LOẠI VỎ & CÓ GHI CHÚ)
// ==========================================
router.post('/return', verifyToken, async (req, res) => {
    const { customer_id, invoice_id, product_id, return_qty, deposit_price, note } = req.body;
    const refundAmount = return_qty * deposit_price;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Lưu thông tin trả vỏ có gắn kèm Mã sản phẩm và Ghi chú (Nếu lủng, vỡ...)
        const [result] = await db.query(
            `INSERT INTO bottle_deposits (customer_id, invoice_id, product_id, type, quantity, deposit_amount, note) 
             VALUES (?, ?, ?, 'refund', ?, ?, ?)`,
            [customer_id, invoice_id, product_id, return_qty, refundAmount, note || '']
        );
        
        const depositRecordId = result.insertId;

        if (customer_id) {
            await connection.query(
                `UPDATE customers SET deposit_balance = GREATEST(0, deposit_balance - ?) WHERE id = ?`,
                [refundAmount, customer_id]
            );
        }

        await connection.commit();
        
        // 💡 GHI AUDIT LOG THAO TÁC THU VỎ VÀ HOÀN TIỀN
        const logMsg = note 
            ? `Thu ${return_qty} vỏ, hoàn ${refundAmount.toLocaleString('vi-VN')}đ. Ghi chú: ${note}` 
            : `Thu ${return_qty} vỏ bình thường, hoàn ${refundAmount.toLocaleString('vi-VN')}đ`;
            
        await logAction(req, "CREATE", "bottle_deposits", depositRecordId, null, req.body, logMsg);

        res.json({ message: `Đã thu về ${return_qty} vỏ và hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ tiền cọc.` });

    } catch (error) {
        await connection.rollback();
        console.error("Lỗi khi xử lý trả vỏ:", error);
        res.status(500).json({ message: "Lỗi xử lý hoàn cọc" });
    } finally {
        connection.release();
    }
});

// ==========================================
// 3. XEM LỊCH SỬ NỢ / TRẢ VỎ
// ==========================================
router.get('/history', verifyToken, async (req, res) => {
    try {
        const { customer_id, invoice_id } = req.query;
        let query = `
            SELECT bd.*, COALESCE(c.name, i.customer_name, 'Khách vãng lai') as customer_name
            FROM bottle_deposits bd
            LEFT JOIN customers c ON bd.customer_id = c.id
            LEFT JOIN invoices i ON bd.invoice_id = i.id
            WHERE 1=1
        `;
        const params = [];

        // Lọc theo Khách có tài khoản hoặc Khách vãng lai (theo invoice)
        if (customer_id && customer_id !== 'null') {
            query += ` AND bd.customer_id = ?`;
            params.push(customer_id);
        } else if (invoice_id && invoice_id !== 'null') {
            query += ` AND bd.invoice_id = ?`;
            params.push(invoice_id);
        }

        query += ` ORDER BY bd.created_at DESC`;

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi lấy lịch sử vỏ:", error);
        res.status(500).json({ message: "Lỗi server khi lấy lịch sử" });
    }
});

module.exports = router;