const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year)
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });

    // ===== Tổng doanh thu + lợi nhuận + số hóa đơn =====
    const [[summary]] = await db.query(
      `
      SELECT 
        SUM(total_amount) as totalRevenue,
        SUM(total_profit) as totalProfit,
        COUNT(*) as totalInvoices
      FROM invoices
      WHERE MONTH(created_at) = ?
      AND YEAR(created_at) = ?
      `,
      [month, year]
    );

    // ===== 2. NÂNG CẤP: Doanh thu & Lợi nhuận theo ngày (Cho Line Chart) =====
    const [revenueByDay] = await db.query(
      `
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        SUM(total_profit) as profit 
      FROM invoices
      WHERE MONTH(created_at) = ?
      AND YEAR(created_at) = ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
      `,
      [month, year]
    );

    // ===== 3. Top 5 sản phẩm =====
    const [topProducts] = await db.query(
      `
      SELECT 
        p.name,
        SUM(ii.quantity) as total_sold
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE MONTH(i.created_at) = ?
      AND YEAR(i.created_at) = ?
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 5
      `,
      [month, year]
    );

    // ===== 4. MỚI: Tỷ trọng doanh thu theo Đơn vị tính (Cho Pie Chart) =====
    const [revenueByCategory] = await db.query(
      `
      SELECT 
        UPPER(p.unit) as name,
        SUM(ii.quantity * ii.sell_price) as value
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE MONTH(i.created_at) = ?
      AND YEAR(i.created_at) = ?
      GROUP BY p.unit
      ORDER BY value DESC
      `,
      [month, year]
    );

    // ===== 5. MỚI: Tình trạng Vỏ bình (Nợ khách) =====
    // Lấy tổng vỏ và tổng tiền cọc từ bảng bottle_deposits (Cộng mượn, Trừ trả)
    const [[bottleStats]] = await db.query(
      `
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN type = 'deposit' THEN quantity 
            WHEN type = 'refund' THEN -quantity 
            ELSE 0 
          END
        ), 0) as totalBottlesOut,
        
        COALESCE(SUM(
          CASE 
            WHEN type = 'deposit' THEN deposit_amount 
            WHEN type = 'refund' THEN -deposit_amount 
            ELSE 0 
          END
        ), 0) as totalDepositHeld
      FROM bottle_deposits
      `
    );

    res.json({
      totalRevenue: summary.totalRevenue || 0,
      totalProfit: summary.totalProfit || 0,
      totalInvoices: summary.totalInvoices || 0,
      revenueByDay,
      topProducts,
      revenueByCategory,                     // Trả về data cho Biểu đồ tròn
      totalBottlesOut: bottleStats.totalBottlesOut,   // Trả về tổng vỏ khách giữ
      totalDepositHeld: bottleStats.totalDepositHeld,
    });

  } catch (err) {
    console.error(err);
    console.error(" LỖI DASHBOARD:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;