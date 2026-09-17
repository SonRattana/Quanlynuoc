const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year)
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });

    // ===== 1. TỔNG DOANH THU & LỢI NHUẬN (ĐỒNG BỘ 100% VỚI BÁO CÁO P&L) =====
    const [[summary]] = await db.query(
      `
      SELECT 
        COUNT(DISTINCT i.id) as totalInvoices,
        SUM(ii.quantity * ii.sell_price) as totalRevenue,
        SUM((ii.sell_price - ii.cost_price) * ii.quantity) as totalProfit
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE MONTH(i.created_at) = ? AND YEAR(i.created_at) = ?
      `,
      [month, year]
    );

    // ===== 2. DOANH THU & LỢI NHUẬN THEO NGÀY (Cho Line Chart) =====
    const [revenueByDay] = await db.query(
      `
      SELECT 
        DATE(i.created_at) as date,
        SUM(ii.quantity * ii.sell_price) as revenue,
        SUM((ii.sell_price - ii.cost_price) * ii.quantity) as profit 
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE MONTH(i.created_at) = ? AND YEAR(i.created_at) = ?
      GROUP BY DATE(i.created_at)
      ORDER BY DATE(i.created_at)
      `,
      [month, year]
    );

    // ===== 3. Top 5 sản phẩm bán chạy =====
    const [topProducts] = await db.query(
      `
      SELECT 
        p.name,
        SUM(ii.quantity) as total_sold
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE MONTH(i.created_at) = ? AND YEAR(i.created_at) = ?
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 5
      `,
      [month, year]
    );

    // ===== 4. Tỷ trọng doanh thu theo Đơn vị tính (Cho Pie Chart) =====
    const [revenueByCategory] = await db.query(
      `
      SELECT 
        UPPER(p.unit) as name,
        SUM(ii.quantity * ii.sell_price) as value
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE MONTH(i.created_at) = ? AND YEAR(i.created_at) = ?
      GROUP BY p.unit
      ORDER BY value DESC
      `,
      [month, year]
    );

    // ===== 5. Tình trạng Vỏ bình (Nợ khách) - Tự triệt tiêu Mượn/Trả =====
    const [[bottleStats]] = await db.query(
      `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN quantity ELSE -quantity END), 0) as totalBottlesOut,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN deposit_amount ELSE -deposit_amount END), 0) as totalDepositHeld
      FROM bottle_deposits
      `
    );

    res.json({
      totalRevenue: summary.totalRevenue || 0,
      totalProfit: summary.totalProfit || 0,
      totalInvoices: summary.totalInvoices || 0,
      revenueByDay,
      topProducts,
      revenueByCategory,
      totalBottlesOut: bottleStats.totalBottlesOut,
      totalDepositHeld: bottleStats.totalDepositHeld,
    });

  } catch (err) {
    console.error("LỖI DASHBOARD:", err);
    res.status(500).json({ message: "Lỗi server dashboard" });
  }
});

module.exports = router;