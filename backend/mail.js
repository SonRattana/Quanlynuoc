const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sonrattana07@gmail.com', // Email dùng để gửi
        pass: 'lxxwnvswelsxzmwr'    // Mật khẩu ứng dụng vừa lấy
    }
});

const sendOrderEmail = async (orderDetail) => {
    // 💡 ĐÃ SỬA: Thêm totalDeposit vào đây để hứng dữ liệu
    const { customer_name, email, items, totalAmount, order_id, deliveryFee, shipper_name, customer_address: address, totalDeposit } = orderDetail;

    // Chuyển về số an toàn để không bao giờ bị lỗi toLocaleString()
    const safeDeliveryFee = Number(deliveryFee) || 0;
    const safeTotalAmount = Number(totalAmount) || 0;
    const safeTotalDeposit = Number(totalDeposit) || 0; // 💡 THÊM BIẾN AN TOÀN CHO TIỀN CỌC

    // Tạo danh sách món hàng theo dạng bảng cho đẹp
    const itemsHtml = items.map(item => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(item.sell_price).toLocaleString('vi-VN')}đ</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email, // Gửi tới mail của khách
        subject: `HÓA ĐƠN ĐẶT HÀNG #${order_id}`,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #2c3e50;">Chào ${customer_name}, cảm ơn bạn đã đặt nước tại Mita Fresh!</h3>
            <p>Đơn hàng <b>${order_id}</b> của bạn đã được hệ thống tiếp nhận.</p>
            
            <p><b>Hình thức nhận:</b> <span style="color: #0d6efd;">${safeDeliveryFee > 0 ? "Giao hàng tận nơi" : "Khách tự đến lấy"}</span></p>
            ${shipper_name && shipper_name !== '---' ? `<br><b>Người giao:</b> ${shipper_name}` : ''}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Sản phẩm</th>
                        <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Số lượng</th>
                        <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Đơn giá</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="margin-top: 15px; text-align: right;">
                ${safeDeliveryFee > 0 ? `<p style="margin: 5px 0; color: #555;">Phí giao hàng: <b>${safeDeliveryFee.toLocaleString('vi-VN')}đ</b></p>` : ''}
                
                ${safeTotalDeposit > 0 ? `<p style="margin: 5px 0; color: #d35400;">Phụ thu cọc vỏ bình: <b>${safeTotalDeposit.toLocaleString('vi-VN')}đ</b></p>` : ''}
                
                <h4 style="color: #e74c3c; margin-top: 10px; border-top: 2px solid #eee; padding-top: 10px;">
                    Tổng thanh toán: ${safeTotalAmount.toLocaleString('vi-VN')}đ
                </h4>
            </div>

            <p style="margin-top: 20px; font-style: italic;">Mita Fresh sẽ gọi điện xác nhận và chuẩn bị đơn hàng cho bạn!</p>
            <hr>
            <p style="font-size: 12px; color: #777;">Trân trọng, đội ngũ Mita Fresh.</p>
        </div>
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