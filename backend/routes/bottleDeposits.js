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
// 2. XỬ LÝ TRẢ VỎ (NHẬN DIỆN ĐÚNG LOẠI VỎ, CÓ GHI CHÚ VÀ TRỪ CỌC NẾU MẤT)
// ==========================================
router.post('/return', verifyToken, async (req, res) => {
    // 💡 ĐÃ FIX: Nhận thêm biến lost_qty từ Giao diện
    const { customer_id, invoice_id, product_id, return_qty, lost_qty, deposit_price, note } = req.body;

    const qtyReturn = Number(return_qty) || 0;
    const qtyLost = Number(lost_qty) || 0;
    const totalQty = qtyReturn + qtyLost;

    if (totalQty <= 0) return res.status(400).json({ message: "Số lượng không hợp lệ" });

    const refundAmount = qtyReturn * deposit_price; // Tiền trả lại khách
    const lostAmount = qtyLost * deposit_price;     // Tiền tịch thu (doanh thu khấu hao)
    const totalDepositClear = refundAmount + lostAmount;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Lưu biên bản Trả vỏ nguyên vẹn (Hoàn tiền)
        if (qtyReturn > 0) {
            await connection.query(
                `INSERT INTO bottle_deposits (customer_id, invoice_id, product_id, type, quantity, deposit_amount, note) 
                 VALUES (?, ?, ?, 'refund', ?, ?, ?)`,
                [customer_id, invoice_id, product_id, qtyReturn, refundAmount, note || 'Trả vỏ nguyên vẹn']
            );
        }

        // 2. Lưu biên bản Khách làm mất vỏ (Tịch thu cọc -> Chuyển thành Loss)
        if (qtyLost > 0) {
            await connection.query(
                `INSERT INTO bottle_deposits (customer_id, invoice_id, product_id, type, quantity, deposit_amount, note) 
                 VALUES (?, ?, ?, 'loss', ?, ?, ?)`,
                [customer_id, invoice_id, product_id, qtyLost, lostAmount, note || 'Báo mất / Hư hỏng nặng']
            );
        }

        // 3. Trừ công nợ cọc của khách hàng
        if (customer_id) {
            await connection.query(
                `UPDATE customers SET deposit_balance = GREATEST(0, deposit_balance - ?) WHERE id = ?`,
                [totalDepositClear, customer_id]
            );
        }

        await connection.commit();

        // GHI AUDIT LOG
        const logMsg = `Thu hồi: ${qtyReturn} vỏ nguyên, Mất: ${qtyLost} vỏ. Hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ. Ghi chú: ${note}`;
        await logAction(req, "CREATE", "bottle_deposits", null, null, req.body, logMsg);

        res.json({ message: `Đã thu ${qtyReturn} vỏ, mất ${qtyLost} vỏ. Hoàn lại ${refundAmount.toLocaleString('vi-VN')}đ tiền cọc.` });

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