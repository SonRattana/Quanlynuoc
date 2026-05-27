const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();


exports.register = async (req, res) => {
    try {
        const { name, phone, email, address, password } = req.body;

        // --- RÀO LỖI 1: Bắt buộc nhập đủ thông tin ---
        if (!name || !phone || !address || !password) {
            return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ Tên, SĐT, Địa chỉ và Mật khẩu nha!" });
        }
        
        // --- RÀO LỖI 2: Mật khẩu phải an toàn ---
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Mật khẩu phải từ 6 ký tự trở lên bạn ơi!" });
        }

        // --- RÀO LỖI 3: KIỂM TRA SỐ ĐIỆN THOẠI CHUẨN VIỆT NAM ---
        // Bắt buộc: Phải là số, có đúng 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số chuẩn nhà mạng Việt Nam." });
        }

        // --- RÀO LỖI 4: KIỂM TRA ĐỊNH DẠNG EMAIL ---
        if (email) { // Nếu khách có nhập email thì mới kiểm tra
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: "Email bạn nhập sai định dạng rồi (ví dụ đúng: ten@gmail.com)." });
            }
        }

        // --- RÀO LỖI 5: BẮT TRÙNG SỐ ĐIỆN THOẠI HOẶC EMAIL ---
        const [existingCustomer] = await db.query(
            'SELECT * FROM customers WHERE phone = ? OR email = ?', 
            [phone, email]
        );

        if (existingCustomer.length > 0) {
            const isPhoneExist = existingCustomer.some(c => c.phone === phone);
            const isEmailExist = existingCustomer.some(c => c.email === email && email !== "");

            if (isPhoneExist) {
                return res.status(400).json({ success: false, message: "Số điện thoại này đã đăng ký rồi, bạn ra đăng nhập luôn cho lẹ!" });
            }
            if (isEmailExist) {
                return res.status(400).json({ success: false, message: "Email này đã được xài cho tài khoản khác rồi, bạn đổi email khác nha!" });
            }
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Lưu xuống DB
        const [result] = await db.query(
            'INSERT INTO customers (name, phone, email, address, password, type) VALUES (?, ?, ?, ?, ?, ?)',
            [name, phone, email, address, hashedPassword, 'Online']
        );

        res.status(200).json({ success: true, message: "Đăng ký thành công! Mời bạn đăng nhập." });
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        res.status(500).json({ success: false, message: "Lỗi Server!" });
    }
};

exports.login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        // --- RÀO LỖI 3: Khách quên nhập ---
        if (!phone || !password) {
            return res.status(400).json({ success: false, message: "Bạn chưa nhập Số điện thoại hoặc Mật khẩu kìa!" });
        }

        const [customers] = await db.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        if (customers.length === 0) {
            return res.status(400).json({ success: false, message: "Tài khoản không tồn tại, bạn kiểm tra lại SĐT nhé!" });
        }

        const customer = customers[0];
        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Sai mật khẩu mất rồi!" });
        }

        const token = jwt.sign(
            { id: customer.id, role: 'customer' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            token: token,
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address
            }
        });
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ success: false, message: "Lỗi Server rồi bạn ơi!" });
    }
};

module.exports = router;


