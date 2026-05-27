const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sonrattana07@gmail.com', // Email dùng để gửi
        pass: 'lxxwnvswelsxzmwr'    // Mật khẩu ứng dụng vừa lấy
    }
});

const sendOrderEmail = async (orderDetail) => {
    const { customer_name, email, items, totalAmount, order_id } = orderDetail;

    // Tạo danh sách món hàng theo dạng bảng cho đẹp
    const itemsHtml = items.map(item => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${Number(item.sell_price).toLocaleString('vi-VN')}đ</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email, // Gửi tới mail của khách
        subject: `HÓA ĐƠN ĐẶT HÀNG #${order_id}`,
        html: `
            <h3>Chào ${customer_name}, cảm ơn bạn đã đặt nước!</h3>
            <p>Đơn hàng <b>#${order_id}</b> của bạn đã được hệ thống tiếp nhận.</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 8px;">Sản phẩm</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Số lượng</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Giá</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <h4 style="color: red;">Tổng tiền: ${totalAmount.toLocaleString('vi-VN')}đ</h4>
            <p>Quán sẽ gọi điện xác nhận và giao hàng ngay cho bạn!</p>
        `
    };

    return transporter.sendMail(mailOptions);
};

// ==========================================
// [HÀM 2] - MỚI: GỬI MÃ OTP ĐĂNG KÝ
// ==========================================
const sendOTPEmail = async (email, name, otp) => {
    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email,
        subject: "Mã xác thực đăng ký tài khoản MitaFresh",
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2 style="color: #0d6efd;">Chào mừng bạn ${name} đến với MitaFresh!</h2>
                <p>Để hoàn tất đăng ký, vui lòng nhập mã xác thực gồm 6 chữ số dưới đây:</p>
                <h1 style="color: #dc3545; letter-spacing: 5px; background: #f8f9fa; padding: 10px; border-radius: 8px; display: inline-block;">${otp}</h1>
                <p><i>Mã này sẽ hết hạn sau 5 phút. Vui lòng không chia sẻ cho người lạ!</i></p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

// [HÀM 3] - GỬI MÃ OTP QUÊN MẬT KHẨU
const sendResetPasswordEmail = async (email, name, otp) => {
    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email,
        subject: "Mã OTP Khôi phục mật khẩu - MitaFresh",
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2 style="color: #0d6efd;">Xin chào ${name},</h2>
                <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.</p>
                <p>Đây là mã OTP để đặt lại mật khẩu:</p>
                <h1 style="color: #dc3545; letter-spacing: 5px; background: #f8f9fa; padding: 10px; border-radius: 8px; display: inline-block;">${otp}</h1>
                <p><i>Mã này sẽ hết hạn sau 5 phút. Vui lòng KHÔNG chia sẻ cho bất kỳ ai!</i></p>
                <p>Nếu bạn không yêu cầu đổi mật khẩu, xin hãy bỏ qua email này.</p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

module.exports = { sendOrderEmail, sendOTPEmail, sendResetPasswordEmail };