const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");
const { logAction } = require("../utils/logger");
const { sendOrderEmail } = require('../mail');

// ================= GET ALL INVOICES (LẤY DANH SÁCH HÓA ĐƠN) =================
router.get("/", verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 💡 ĐÃ SỬA: Bỏ các lệnh JOIN dư thừa gây trùng lặp, dùng trực tiếp data đã lưu
    const [rows] = await db.query(`
      SELECT 
        i.id, 
        i.created_at, 
        COALESCE(i.customer_name, c.name) AS customer_name,
        COALESCE(i.phone, c.phone) AS phone, 
        COALESCE(i.customer_address, c.address) AS customer_address, 
        i.total_amount, 
        i.deposit_amount,
        i.delivery_fee,
        i.paid_amount,
        i.payment_status,
        i.shipper_name, 
        i.note,
        
        -- 💡 THUẬT TOÁN MỚI: Hút thẳng Mã Đơn (order_code) từ tầng đáy Database lên
        (SELECT so.order_code 
         FROM stock_transactions st 
         JOIN sales_orders so ON st.ref_sales_order_id = so.id 
         WHERE (st.reference_id = i.id AND st.reference_type = 'invoice') 
            OR (st.id = i.ref_export_log_id)
         LIMIT 1) AS order_code

      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM invoices");

    res.json({ data: rows, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (err) {
    res.status(500).json({ message: "Lỗi load danh sách hóa đơn" });
  }
});

// =========================================================================
// API MỚI: LẤY DANH SÁCH PHIẾU XUẤT KHO CHƯA XUẤT HÓA ĐƠN
// =========================================================================
router.get("/pending-exports", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT 
                st.id as export_id, st.created_at, st.quantity,
                p.id as product_id, p.name as product_name, p.sell_price,
                so.order_code, so.customer_name, so.customer_phone, so.total_payment as order_total, so.advance_payment
            FROM stock_transactions st
            JOIN products p ON st.product_id = p.id
            JOIN sales_orders so ON st.ref_sales_order_id = so.id
            -- 💡 SỬA CHỖ NÀY: Móc nối chuẩn xác bằng reference_id
            LEFT JOIN invoices i ON st.reference_id = i.id AND st.reference_type = 'invoice'
            WHERE st.type = 'export' 
              AND st.ref_sales_order_id IS NOT NULL 
              AND i.id IS NULL 
            ORDER BY st.created_at ASC
        `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
});

// =========================================================================
// API MỚI: SINH HÓA ĐƠN TỪ PHIẾU XUẤT (ERP LUỒNG SẢN XUẤT)
// =========================================================================
router.post("/from-export", verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Nhận ID của phiếu xuất kho
    const { export_id, discount = 0, delivery_fee = 0 } = req.body;

    if (!export_id) throw new Error("Mã Phiếu Xuất không hợp lệ!");

    // 1. Kiểm tra lại Phiếu xuất này đã xuất hóa đơn chưa
    const [checkInvoice] = await connection.query(`SELECT id FROM invoices WHERE ref_export_log_id = ?`, [export_id]);
    if (checkInvoice.length > 0) throw new Error("Phiếu xuất này ĐÃ XUẤT HÓA ĐƠN rồi!");

    // 2. Lấy thông tin từ Phiếu xuất và Đơn hàng
    const [exportRows] = await connection.query(`
            SELECT st.*, p.name as product_name, p.sell_price, p.cost_price, 
                   so.customer_id, so.customer_name, so.shipper_name, so.delivery_fee, 
                   so.id as order_id, so.advance_payment, so.order_code
            FROM stock_transactions st
            JOIN products p ON st.product_id = p.id
            JOIN sales_orders so ON st.ref_sales_order_id = so.id
            WHERE st.id = ?
        `, [export_id]);

    if (exportRows.length === 0) throw new Error("Không tìm thấy dữ liệu phiếu xuất!");
    const exportData = exportRows[0];

    // 3. Tính toán tiền nong (Bao gồm cả Phí Ship)
    const deliveryFee = Number(exportData.delivery_fee) || 0;
    const totalGoodsAmount = exportData.quantity * exportData.sell_price;
    const totalAmount = totalGoodsAmount + deliveryFee - Number(discount);
    const totalProfit = (exportData.sell_price - exportData.cost_price) * exportData.quantity;

    let paidAmount = 0;
    let paymentStatus = 'unpaid';

    if (exportData.advance_payment > 0) {
      paidAmount = Math.min(totalAmount, exportData.advance_payment);
      paymentStatus = (paidAmount >= totalAmount) ? 'paid' : 'partial';
      await connection.query(`UPDATE sales_orders SET advance_payment = advance_payment - ? WHERE id = ?`, [paidAmount, exportData.order_id]);
    }

    // 4. Sinh Hóa Đơn (Gắn customer_id, shipper, delivery_fee vào luôn)
    const [invRes] = await connection.query(`
            INSERT INTO invoices (
                customer_id, customer_name, phone, customer_address, total_amount, paid_amount, payment_status, 
                delivery_fee, shipper_name, total_profit, ref_export_log_id, created_by, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
      exportData.customer_id || null,
      exportData.customer_name,
      exportData.customer_phone,
      exportData.customer_address || null, // 💡 Bơm thêm địa chỉ
      totalAmount, paidAmount, paymentStatus,
      deliveryFee, exportData.shipper_name, totalProfit, export_id, req.user.id,
      `Xuất hóa đơn từ Phiếu xuất #${export_id} (Đơn ${exportData.order_code})` // 💡 Bơm thêm ghi chú
    ]);
    const invoiceId = invRes.insertId;

    // 5. Thêm chi tiết hóa đơn
    await connection.query(`
            INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price)
            VALUES (?, ?, ?, ?, ?)
        `, [invoiceId, exportData.product_id, exportData.quantity, exportData.sell_price, exportData.cost_price]);

    await connection.commit();
    res.json({ message: "Xuất hóa đơn thành công!", invoice_id: invoiceId });

  } catch (err) {
    await connection.rollback();
    console.error("Lỗi xuất hóa đơn ERP:", err);
    res.status(400).json({ message: err.message });
  } finally {
    connection.release();
  }
});

// ================= TẠO HÓA ĐƠN POS & BẮN MAIL =================
router.post("/", verifyToken, async (req, res) => {
  const { customer_id, customer_name, email, items } = req.body;
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [invoiceResult] = await connection.query(`INSERT INTO invoices (customer_id, created_at) VALUES (?, NOW())`, [customer_id]);
    const invoiceId = invoiceResult.insertId;

    let totalDeposit = 0, grandTotal = 0, totalProfit = 0;

    for (const item of items) {
      // 1. Lấy thông tin sản phẩm
      const [productRows] = await connection.query(`SELECT deposit_price, cost_price FROM products WHERE id = ?`, [item.product_id]);
      const defaultDepositPrice = productRows[0]?.deposit_price || 0;
      const costPrice = productRows[0]?.cost_price || 0;

      // 2. Insert vào invoice_items
      await connection.query(
        `INSERT INTO invoice_items (invoice_id, product_id, quantity, sell_price, cost_price) VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, item.product_id, item.quantity, item.sell_price, costPrice]
      );

      // 3. XỬ LÝ GỘP: Chỉ insert 1 lần vào bottle_deposits
      // Dùng giá cọc từ client nếu có, không thì lấy mặc định
      const depositPriceToUse = item.deposit_price || defaultDepositPrice;
      // Số lượng vỏ nợ (nếu client không gửi missing_bottles thì mặc định là quantity)
      const missing_bottles = item.missing_bottles !== undefined ? item.missing_bottles : item.quantity;
      // Tính tiền cọc (nếu client không gửi deposit_fee thì tính theo công thức)
      const depositAmount = item.deposit_fee !== undefined ? item.deposit_fee : (missing_bottles * depositPriceToUse);

      // Sửa đoạn INSERT trong vòng lặp tạo hóa đơn ở invoice.js
      if (defaultDepositPrice > 0 && missing_bottles > 0) {
        totalDeposit += depositAmount;

        // 💡 Thêm cột status = 'dang_giu' vào đây. 
        // Đây là "chìa khóa" để bên Hoàn tiền vỏ nhìn thấy khoản nợ này.
        await connection.query(`
        INSERT INTO bottle_deposits 
        (customer_id, product_id, quantity, deposit_amount, status, type, invoice_id, created_at) 
        VALUES (?, ?, ?, ?, 'dang_giu', 'deposit', ?, NOW())
    `, [
          customer_id,
          item.product_id,
          missing_bottles,
          depositAmount,
          invoiceId
        ]);
      }

      // 4. Tính toán tổng
      grandTotal += (item.sell_price * item.quantity);
      totalProfit += (item.sell_price - costPrice) * item.quantity;
    }

    grandTotal += totalDeposit;

    await connection.query(`UPDATE invoices SET deposit_amount = ?, total_amount = ?, total_profit = ? WHERE id = ?`, [totalDeposit, grandTotal, totalProfit, invoiceId]);
    await connection.commit();

    if (email && email.trim() !== "") {
      const emailItems = items.map(i => ({ product_name: i.product_name, quantity: i.quantity, sell_price: i.sell_price }));
      sendOrderEmail({
        customer_name: customer_name || "Quý khách",
        email: email.trim(), items: emailItems,
        totalAmount: grandTotal,
        totalDeposit: totalDeposit,
        deliveryFee: 0,
        shipper_name: "",
        customer_address: "",
        order_id: `POS-${invoiceId}`
      }).catch(err => console.error(err));
    }

    await logAction(req, "CREATE_INVOICE", "invoices", invoiceId, null, { items, grandTotal, totalDeposit, totalProfit }, `Tạo hóa đơn #${invoiceId}`);
    res.json({ message: "Tạo hóa đơn thành công", invoice_id: invoiceId });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: "Lỗi tạo hóa đơn" });
  } finally { connection.release(); }
});


// ================= GET HÓA ĐƠN CHI TIẾT ĐỂ IN ẤN =================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.id, i.created_at, i.delivery_fee, i.shipper_name, i.paid_amount, i.payment_status,
        COALESCE(SUM(bd.deposit_amount), 0) as deposit_amount,
        c.id as customer_code, 
        COALESCE(i.customer_name, c.name) as customer_name,
        COALESCE(i.phone, c.phone) as phone,
        COALESCE(i.customer_address, c.address) as customer_address,
        p.name as product_name, ii.quantity, ii.sell_price
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      JOIN invoice_items ii ON i.id = ii.invoice_id
      JOIN products p ON ii.product_id = p.id
      LEFT JOIN bottle_deposits bd ON bd.invoice_id = i.id
      WHERE i.id = ?
      GROUP BY ii.id
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    res.json({
      id: rows[0].id, created_at: rows[0].created_at, deposit_amount: rows[0].deposit_amount || 0,
      delivery_fee: rows[0].delivery_fee || 0, paid_amount: rows[0].paid_amount || 0,
      payment_status: rows[0].payment_status || 'paid', shipper_name: rows[0].shipper_name || "",
      customer_code: rows[0].customer_code || "", customer_name: rows[0].customer_name || "Khách lẻ",
      phone: rows[0].phone || "", customer_address: rows[0].customer_address || "",
      items: rows.map(r => ({ product_name: r.product_name, quantity: r.quantity, sell_price: r.sell_price }))
    });
  } catch (err) { res.status(500).json({ message: "Lỗi load hóa đơn" }); }
});

// ================= API CẬP NHẬT SỐ TIỀN THỰC THU (GHI NỢ HÓA ĐƠN CŨ) =================
router.put('/:id/update-payment', verifyToken, async (req, res) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const invoiceId = req.params.id;
    const { actual_paid_amount } = req.body; // Số tiền sếp thực thu mới nhập
    const newPaidAmount = Number(actual_paid_amount);

    if (isNaN(newPaidAmount) || newPaidAmount < 0) {
      throw new Error("Số tiền thực thu không hợp lệ!");
    }

    // 1. Lấy thông tin hóa đơn hiện tại
    const [invoiceRows] = await connection.query(
      "SELECT customer_id, total_amount, paid_amount FROM invoices WHERE id = ? FOR UPDATE",
      [invoiceId]
    );

    if (invoiceRows.length === 0) throw new Error("Không tìm thấy hóa đơn");
    const invoice = invoiceRows[0];

    if (newPaidAmount > invoice.total_amount) {
      throw new Error("Không thể thu lố tổng tiền của hóa đơn!");
    }

    // 2. Tính toán độ lệch tiền
    // Ví dụ: Bill 70k, lúc trước ghi nhận đã thu 70k (paid_amount).
    // Nay sửa lại thực thu chỉ có 10k (newPaidAmount).
    // => Độ lệch (delta) = 10k - 70k = -60k.
    // => Khách bị thiếu 60k => Phải TĂNG nợ của khách lên 60k.
    const deltaPaid = newPaidAmount - Number(invoice.paid_amount);

    // 3. Cập nhật lại hóa đơn (Số tiền đã thu & Trạng thái)
    let newStatus = 'unpaid';
    if (newPaidAmount === Number(invoice.total_amount)) newStatus = 'paid';
    else if (newPaidAmount > 0) newStatus = 'partial';

    await connection.query(
      "UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?",
      [newPaidAmount, newStatus, invoiceId]
    );

    // 4. Cập nhật thẳng vào Sổ Nợ Khách Hàng (debt_balance)
    // Vì deltaPaid âm (-60k), khi trừ đi một số âm sẽ thành cộng (Tăng nợ)
    if (deltaPaid !== 0 && invoice.customer_id) {
      await connection.query(
        "UPDATE customers SET debt_balance = debt_balance - ? WHERE id = ?",
        [deltaPaid, invoice.customer_id]
      );
    }

    // 5. Ghi Log để sếp tra cứu lại nếu nhân viên sửa bậy
    await logAction(
      req,
      "UPDATE_PAYMENT",
      "invoices",
      invoiceId,
      null,
      { old_paid: invoice.paid_amount, new_paid: newPaidAmount },
      `Sửa thực thu từ ${invoice.paid_amount}đ thành ${newPaidAmount}đ`
    );

    await connection.commit();
    res.json({ message: "Cập nhật thanh toán & công nợ thành công!" });

  } catch (err) {
    await connection.rollback();
    console.error("Lỗi cập nhật thực thu:", err);
    res.status(400).json({ message: err.message });
  } finally {
    connection.release();
  }
});

// ================= LẤY CHI TIẾT HÓA ĐƠN =================
router.get("/details/:id", verifyToken, async (req, res) => {
  try {
    const [invoiceRows] = await db.query(`
        SELECT i.*, 
               COALESCE(i.customer_name, c.name) AS customer_name, 
               COALESCE(i.phone, c.phone) AS phone,               
               COALESCE(i.customer_address, c.address) AS customer_address
        FROM invoices i 
        LEFT JOIN customers c ON i.customer_id = c.id 
        WHERE i.id = ?
    `, [req.params.id]);

    if (invoiceRows.length === 0) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    const [items] = await db.query(`
        SELECT ii.quantity, ii.sell_price, p.name AS product_name, COALESCE(bd.deposit_amount, 0) as deposit 
        FROM invoice_items ii 
        JOIN products p ON ii.product_id = p.id 
        LEFT JOIN bottle_deposits bd ON ii.invoice_id = bd.invoice_id AND ii.product_id = bd.product_id 
        WHERE ii.invoice_id = ?
    `, [req.params.id]);

    res.json({ ...invoiceRows[0], items: items });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/return-bottle", verifyToken, async (req, res) => {
  try {
    const { customer_id, product_id, quantity } = req.body;
    const [rows] = await db.query("SELECT deposit_price FROM products WHERE id = ?", [product_id]);
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const depositPrice = rows[0].deposit_price || 0;
    const amount = quantity * depositPrice;

    // Lệnh cũ: Ghi lịch sử trả vỏ
    const [result] = await db.query(`INSERT INTO bottle_deposits (customer_id, product_id, quantity, deposit_amount, status, type, created_at) VALUES (?, ?, ?, ?, 'da_tra', 'refund', NOW())`, [customer_id, product_id, quantity, amount]);

    // 💡 THÊM ĐÚNG DÒNG NÀY: Trừ tiền cọc vỏ ra khỏi ví của khách (dùng GREATEST để không bao giờ bị âm tiền)
    await db.query(`UPDATE customers SET deposit_balance = GREATEST(0, deposit_balance - ?) WHERE id = ?`, [amount, customer_id]);

    await logAction(req, "RETURN_BOTTLE", "bottle_deposits", result.insertId, null, req.body, `Khách trả vỏ bình`);
    res.json({ message: "Đã trả vỏ thành công" });
  } catch (err) { res.status(500).json({ message: "Lỗi trả vỏ" }); }
});




module.exports = router;