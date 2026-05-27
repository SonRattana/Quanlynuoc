require('dotenv').config();
const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const { sendOTPEmail, sendResetPasswordEmail } = require("../mail");

// [CAMERA] Nhập công cụ ghi log vào đây
const { logAction } = require("../utils/logger");

// LOGIN (Cổng Đăng Nhập "All In One")
router.post("/login",
  [
    body("email").notEmpty().withMessage("Email không được bỏ trống").isEmail().withMessage("Email không đúng định dạng"),
    body("password").notEmpty().withMessage("Mật khẩu không được bỏ trống"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      // ==========================================
      // LẦN TÌM 1: TÌM TRONG BẢNG USERS (ADMIN / NHÂN VIÊN)
      // ==========================================
      const [users] = await db.query(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [email]
      );

      if (users.length > 0) {
        const user = users[0];

        let validPassword = false;
        if (user.password === password) {
          validPassword = true; 
        } else {
          validPassword = await bcrypt.compare(password, user.password); 
        }

        if (!validPassword) {
          return res.status(400).json({ message: "Sai mật khẩu rồi người lạ ơi!" });
        }

        const token = jwt.sign(
          { id: user.id, role: user.role, email: user.email },
          process.env.JWT_SECRET || "supersecretkey",
          { expiresIn: "1d" }
        );

        // [CAMERA] Ghi nhận Admin/Nhân viên đăng nhập
        req.user = { id: user.id }; // Gắn tạm ID vào req để Logger biết ai đang làm
        await logAction(req, "LOGIN", "users", user.id, null, null, `Nhân sự ${user.email} (Role: ${user.role}) vừa đăng nhập`);

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.username, 
            phone: user.phone,
            role: user.role
          }
        });
      }

      // ==========================================
      // LẦN TÌM 2: TÌM TRONG BẢNG CUSTOMERS (KHÁCH HÀNG)
      // ==========================================
      const [customers] = await db.query(
        "SELECT * FROM customers WHERE email = ? LIMIT 1",
        [email]
      );

      if (customers.length > 0) {
        const customer = customers[0];

        if (!customer.password) {
          return res.status(400).json({ message: "Tài khoản này chưa tạo mật khẩu. Vui lòng đăng ký!" });
        }

        let validPassword = false;
        if (customer.password === password) {
          validPassword = true;
        } else {
          validPassword = await bcrypt.compare(password, customer.password);
        }

        if (!validPassword) {
          return res.status(400).json({ message: "Sai mật khẩu rồi người lạ ơi!" });
        }

        const token = jwt.sign(
          { id: customer.id, role: "customer", email: customer.email },
          process.env.JWT_SECRET || "supersecretkey",
          { expiresIn: "1d" }
        );

        // [CAMERA] Ghi nhận Khách hàng đăng nhập
        req.user = { id: customer.id }; 
        await logAction(req, "LOGIN", "customers", customer.id, null, null, `Khách hàng ${customer.email} vừa đăng nhập`);

        return res.json({
          token,
          user: {
            id: customer.id,
            email: customer.email,
            phone: customer.phone,
            name: customer.name,
            role: "customer"
          }
        });
      }

      return res.status(400).json({ message: "Email này chưa được đăng ký trên hệ thống!" });

    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      res.status(500).json({ message: "Lỗi Server!" });
    }
  });


const otpStore = new Map();

// ==========================================
// 1. API NHẬN THÔNG TIN VÀ BẮN MÃ OTP (Chỉ gửi mail, không thay đổi DB nên không cần log)
// ==========================================
router.post("/send-otp", async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }

    const [existingEmail] = await db.query(
      "SELECT id FROM customers WHERE email = ? UNION SELECT id FROM users WHERE email = ?",
      [email, email]
    );
    if (existingEmail.length > 0) return res.status(400).json({ message: "Email này đã được đăng ký!" });

    const [existingPhone] = await db.query("SELECT id FROM customers WHERE phone = ?", [phone]);
    if (existingPhone.length > 0) return res.status(400).json({ message: "Số điện thoại này đã được sử dụng!" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(email, {
      otp, name, phone, email, password,
      expires: Date.now() + 300000
    });

    await sendOTPEmail(email, name, otp);

    res.json({ message: "Đã gửi mã OTP qua email của bạn!" });

  } catch (err) {
    console.error("Lỗi gửi OTP:", err);
    res.status(500).json({ message: "Lỗi Server! Không thể gửi email." });
  }
});

// ==========================================
// 2. API XÁC THỰC OTP VÀ TẠO TÀI KHOẢN
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = otpStore.get(email);

    if (!record) return res.status(400).json({ message: "Phiên đăng ký không tồn tại hoặc đã bị hủy!" });
    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({ message: "Mã OTP đã hết hạn! Vui lòng đăng ký lại." });
    }
    if (record.otp !== otp) return res.status(400).json({ message: "Mã OTP không chính xác!" });

    const hashedPassword = await bcrypt.hash(record.password, 10);
    const onlineCustomerCode = `ONL-${record.phone}`;

    // Lưu kết quả INSERT để lấy ID vừa tạo
    const [insertResult] = await db.query(
      "INSERT INTO customers (name, phone, email, type, customer_code, password, is_active) VALUES (?, ?, ?, 'le', ?, ?, 1)",
      [record.name, record.phone, record.email, onlineCustomerCode, hashedPassword]
    );

    // [CAMERA] Ghi nhận có người vừa tạo tài khoản thành công
    req.user = { id: insertResult.insertId }; // Tự gán ID người vừa đăng ký
    const newCustomerData = { name: record.name, email: record.email, phone: record.phone };
    await logAction(req, "REGISTER", "customers", insertResult.insertId, null, newCustomerData, `Khách hàng mới tự đăng ký Online: ${record.name}`);

    otpStore.delete(email);
    res.json({ message: "Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ." });

  } catch (err) {
    console.error("Lỗi xác nhận đăng ký:", err);
    res.status(500).json({ message: "Lỗi Server khi tạo tài khoản!" });
  }
});

// ==========================================
// FORGOT PASSWORD - BƯỚC 1: NHẬN EMAIL VÀ BẮN OTP
// ==========================================
router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng nhập email!" });

    let userType = null;
    let userName = "";

    const [users] = await db.query("SELECT username FROM users WHERE email = ? LIMIT 1", [email]);

    if (users.length > 0) {
      userType = "users";
      userName = users[0].username; 
    } else {
      const [customers] = await db.query("SELECT name FROM customers WHERE email = ? LIMIT 1", [email]);
      if (customers.length > 0) {
        userType = "customers";
        userName = customers[0].name; 
      }
    }

    if (!userType) {
      return res.status(400).json({ message: "Email này chưa được đăng ký trong hệ thống!" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, userType, expires: Date.now() + 300000 });

    await sendResetPasswordEmail(email, userName, otp);
    res.json({ message: "Mã khôi phục đã được gửi vào email của bạn!" });

  } catch (err) {
    console.error("Lỗi gửi OTP Quên mật khẩu:", err);
    res.status(500).json({ message: "Lỗi Server!" });
  }
});

// ==========================================
// FORGOT PASSWORD - BƯỚC 2: XÁC NHẬN OTP & LƯU PASS MỚI
// ==========================================
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const record = otpStore.get(email);

    if (!record) return res.status(400).json({ message: "Phiên giao dịch không tồn tại hoặc đã hết hạn!" });
    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({ message: "Mã OTP đã hết hạn!" });
    }
    if (record.otp !== otp) return res.status(400).json({ message: "Mã OTP không chính xác!" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(`UPDATE ${record.userType} SET password = ? WHERE email = ?`, [hashedPassword, email]);

    // [CAMERA] Ghi nhận sự kiện lấy lại mật khẩu
    // Vì lúc quên mật khẩu người ta chưa đăng nhập, nên req.user = null, camera sẽ chỉ lưu IP.
    await logAction(req, "RESET_PASSWORD", record.userType, null, null, null, `Lấy lại mật khẩu thành công bằng OTP cho email: ${email}`);

    otpStore.delete(email); 
    res.json({ message: "Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới." });

  } catch (err) {
    console.error("Lỗi đặt lại mật khẩu:", err);
    res.status(500).json({ message: "Lỗi Server!" });
  }
});

// ==========================================
// ĐỔI MẬT KHẨU CÓ XÁC THỰC OTP - BƯỚC 1: KIỂM TRA PASS CŨ & BẮN OTP
// ==========================================
router.post("/change-password/send-otp", async (req, res) => {
  try {
    const { email, role, oldPassword } = req.body;

    if (!email || !oldPassword) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu cũ!" });
    }

    const tableName = (role === 'admin' || role === 'user') ? 'users' : 'customers';
    const nameColumn = (role === 'admin' || role === 'user') ? 'username' : 'name';

    const [rows] = await db.query(`SELECT id, password, ${nameColumn} AS name FROM ${tableName} WHERE email = ? LIMIT 1`, [email]);
    if (rows.length === 0) return res.status(400).json({ message: "Không tìm thấy tài khoản trên hệ thống!" });

    const user = rows[0];

    // Xác thực pass cũ
    let validPassword = false;
    if (user.password === oldPassword) {
      validPassword = true; 
    } else {
      validPassword = await bcrypt.compare(oldPassword, user.password); 
    }

    if (!validPassword) {
      return res.status(400).json({ message: "Mật khẩu cũ không chính xác bạn ơi!" });
    }

    // Pass cũ chuẩn rồi thì đẻ mã OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu kho, đặt tên chìa khóa có chữ CHANGE_PASS để không đụng với Forgot Password
    otpStore.set(`CHANGE_PASS_${email}`, {
      otp,
      tableName,
      userId: user.id,
      expires: Date.now() + 300000 // 5 phút
    });

    await sendOTPEmail(email, user.name, otp);

    res.json({ success: true, message: "Mã xác thực OTP đã bay thẳng vào Email của bạn!" });

  } catch (err) {
    console.error("Lỗi gửi OTP đổi mật khẩu:", err);
    res.status(500).json({ message: "Lỗi Hệ Thống! Không thể gửi mail xác thực." });
  }
});

// ==========================================
// ĐỔI MẬT KHẨU CÓ XÁC THỰC OTP - BƯỚC 2: KIỂM TRA OTP & LƯU PASS MỚI
// ==========================================
router.post("/change-password/reset", async (req, res) => {
  try {
    const { email, newPassword, otp } = req.body;

    if (!email || !newPassword || !otp) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ mã OTP và mật khẩu mới!" });
    }

    const record = otpStore.get(`CHANGE_PASS_${email}`);

    if (!record) return res.status(400).json({ message: "Phiên giao dịch không tồn tại hoặc đã hết hạn!" });
    if (Date.now() > record.expires) {
      otpStore.delete(`CHANGE_PASS_${email}`);
      return res.status(400).json({ message: "Mã OTP đã hết hạn! Vui lòng lấy lại mã mới." });
    }
    if (record.otp !== otp) return res.status(400).json({ message: "Mã OTP không chính xác!" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật pass mới
    await db.query(`UPDATE ${record.tableName} SET password = ? WHERE id = ?`, [hashedNewPassword, record.userId]);

    // [CAMERA HÀNH TRÌNH] Ghi log lại
    req.user = { id: record.userId }; 
    await logAction(req, "CHANGE_PASSWORD_AUTH", record.tableName, record.userId, null, null, `Đổi mật khẩu bảo mật (kèm OTP) thành công cho Email: ${email}`);

    otpStore.delete(`CHANGE_PASS_${email}`); 

    res.json({ success: true, message: "Đổi mật khẩu thành công rực rỡ! Bạn nhớ đăng nhập lại nhé." });

  } catch (err) {
    console.error("Lỗi cập nhật mật khẩu mới:", err);
    res.status(500).json({ message: "Lỗi Server khi cập nhật mật khẩu!" });
  }
});

module.exports = router;