const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sonrattana07@gmail.com', // Email dùng để gửi
        pass: 'mpdyjnldkjaawmnw'        // Mật khẩu ứng dụng 
    }
});

const sendOrderEmail = async (orderDetail) => {
    // 💡 ĐÃ FIX: Lấy đầy đủ SĐT, Địa chỉ để không bị lỗi trống thông tin
    const {
        customer_name,
        customer_phone,
        customer_address,
        email,
        items,
        totalAmount,
        order_id,
        deliveryFee,
        shipper_name,
        totalDeposit
    } = orderDetail;

    // Chuyển về số an toàn
    const safeDeliveryFee = Number(deliveryFee) || 0;
    const safeTotalAmount = Number(totalAmount) || 0;
    const safeTotalDeposit = Number(totalDeposit) || 0;

    // Tính tiền hàng (Không bao gồm ship và cọc)
    const safeTotalGoods = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.sell_price)), 0);

    // 💡 ĐÃ FIX LOGIC: Có tiền ship HOẶC có tên người giao thì 100% là "Giao hàng tận nơi"
    const isDelivery = safeDeliveryFee > 0 || (shipper_name && shipper_name !== '---');
    const deliveryMethod = isDelivery ? "Giao hàng tận nơi 🚚" : "Khách tự đến lấy tại cửa hàng 🏪";

    // Tạo danh sách món hàng theo dạng bảng tuyệt đẹp
    const itemsHtml = items.map(item => `
        <tr style="border-bottom: 1px solid #eeeeee;">
            <td style="padding: 12px 10px; color: #333; font-weight: bold;">${item.product_name}</td>
            <td style="padding: 12px 10px; text-align: center; color: #555;">${item.quantity}</td>
            <td style="padding: 12px 10px; text-align: right; color: #555;">${Number(item.sell_price).toLocaleString('vi-VN')} đ</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email,
        subject: `HÓA ĐƠN ĐẶT HÀNG #${order_id} - Mita Fresh`,
        html: `
        <div style="max-width: 650px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            
            <!-- HEADER -->
            <div style="background-color: #0d6efd; color: #ffffff; padding: 25px 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 26px; letter-spacing: 1px;">MITA FRESH</h1>
                <p style="margin: 5px 0 0; font-size: 15px; opacity: 0.9;">Hóa Đơn Đặt Hàng <b>#${order_id}</b></p>
            </div>

            <!-- BODY -->
            <div style="padding: 30px 25px;">
                <h3 style="color: #2c3e50; margin-top: 0;">Xin chào ${customer_name},</h3>
                <p style="color: #555; line-height: 1.6;">Cảm ơn bạn đã tin tưởng và đặt nước tại Mita Fresh. Đơn hàng của bạn đã được hệ thống tiếp nhận với chi tiết như sau:</p>

                <!-- KHUNG THÔNG TIN GIAO HÀNG -->
                <div style="background-color: #f8f9fa; border-left: 5px solid #0d6efd; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0 0 8px; color: #333;"><b>📞 Số điện thoại:</b> ${customer_phone || 'Không cung cấp'}</p>
                    <p style="margin: 0 0 8px; color: #333;"><b>📍 Địa chỉ nhận:</b> ${customer_address || 'Nhận tại cửa hàng'}</p>
                    <p style="margin: 0 0 8px; color: #333;"><b>📦 Hình thức:</b> <span style="color: #0d6efd; font-weight: bold;">${deliveryMethod}</span></p>
                    ${isDelivery && shipper_name ? `<p style="margin: 0; color: #333;"><b>🏍️ Người giao:</b> ${shipper_name}</p>` : ''}
                </div>
                
                <h4 style="color: #2c3e50; border-bottom: 2px solid #0d6efd; padding-bottom: 5px; display: inline-block;">CHI TIẾT ĐƠN HÀNG</h4>
                
                <!-- BẢNG SẢN PHẨM -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f1f3f5; color: #495057;">
                            <th style="padding: 12px 10px; text-align: left; border-radius: 5px 0 0 5px;">Sản phẩm</th>
                            <th style="padding: 12px 10px; text-align: center;">SL</th>
                            <th style="padding: 12px 10px; text-align: right; border-radius: 0 5px 5px 0;">Đơn giá</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <!-- PHẦN TỔNG TIỀN -->
                <div style="text-align: right; color: #495057; font-size: 15px;">
                    <p style="margin: 5px 0;">Tiền hàng: <b>${safeTotalGoods.toLocaleString('vi-VN')} đ</b></p>
                    
                    ${safeDeliveryFee > 0 ? `<p style="margin: 5px 0;">Phí giao hàng: <b>${safeDeliveryFee.toLocaleString('vi-VN')} đ</b></p>` : ''}
                    
                    ${safeTotalDeposit > 0 ? `<p style="margin: 5px 0; color: #d35400;">Phụ thu cọc vỏ bình: <b>${safeTotalDeposit.toLocaleString('vi-VN')} đ</b></p>` : ''}
                    
                    <h2 style="color: #dc3545; font-size: 24px; margin: 15px 0 0; padding-top: 15px; border-top: 2px dashed #ccc;">
                        Tổng thanh toán: ${safeTotalAmount.toLocaleString('vi-VN')} đ
                    </h2>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="background-color: #f1f3f5; padding: 20px; text-align: center; color: #6c757d; font-size: 13px;">
                <p style="margin: 0 0 5px; font-weight: bold; color: #343a40;">Mita Fresh</p>
                <p style="margin: 0 0 5px;">Mọi thắc mắc xin vui lòng liên hệ Zalo/Hotline.</p>
                <p style="margin: 0; font-style: italic;">Hân hạnh được phục vụ quý khách!</p>
            </div>
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
            <div style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 30px; border: 1px solid #e0e0e0; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #0d6efd; margin-top: 0;">Chào mừng bạn ${name}!</h2>
                <p style="color: #555;">Để hoàn tất đăng ký tài khoản tại Mita Fresh, vui lòng nhập mã xác thực dưới đây:</p>
                <h1 style="color: #dc3545; letter-spacing: 8px; background: #f8f9fa; padding: 15px 20px; border-radius: 8px; display: inline-block; border: 1px dashed #dc3545;">${otp}</h1>
                <p style="color: #777; font-size: 13px;"><i>* Mã này sẽ hết hạn sau 5 phút. Vui lòng không chia sẻ cho người lạ!</i></p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

// ==========================================
// [HÀM 3] - GỬI MÃ OTP QUÊN MẬT KHẨU
// ==========================================
const sendResetPasswordEmail = async (email, name, otp) => {
    const mailOptions = {
        from: '"MitaFresh 🥤" <sonrattana07@gmail.com>',
        to: email,
        subject: "Khôi phục mật khẩu tài khoản MitaFresh",
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 30px; border: 1px solid #e0e0e0; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #0d6efd; margin-top: 0;">Xin chào ${name},</h2>
                <p style="color: #555;">Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.</p>
                <h1 style="color: #dc3545; letter-spacing: 8px; background: #f8f9fa; padding: 15px 20px; border-radius: 8px; display: inline-block; border: 1px dashed #dc3545;">${otp}</h1>
                <p style="color: #777; font-size: 13px;"><i>* Mã này sẽ hết hạn sau 5 phút. Nếu bạn không yêu cầu đổi mật khẩu, xin hãy bỏ qua email này.</i></p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

module.exports = { sendOrderEmail, sendOTPEmail, sendResetPasswordEmail };