import React, { useEffect, useState } from "react";
import axios from "axios";
import logo from "../src/public/bvmt-removebg-preview.png"; 
export default function InvoiceModal({ invoiceId, onClose }) {

    const [invoices, setInvoices] = useState(null);

    const token = localStorage.getItem("token");

    const formatMoney = (value) => {
        return Number(value).toLocaleString("vi-VN") + " đ";
    };

    // Fix lỗi data: customerName nên lấy từ customer_name
    const customerName = invoices?.customer_name || "Khách lẻ";
    
    useEffect(() => {
        const fetchInvoice = async () => {
            const res = await axios.get(`/api/invoice/${invoiceId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("DỮ LIỆU HÓA ĐƠN BÁN HÀNG:", res.data)
            setInvoices(res.data);
        };

        fetchInvoice();
    }, [invoiceId]);

    // ===== HÀM IN ẤN ĐẶC TRỊ CHO MÁY IN BILL 80mm - ÉP SÁT TRÊN DƯỚI, CHỈ THỤT 2 BÊN =====
    const handlePrint = () => {
        const printContent = document.getElementById("printable-invoice").innerHTML;
        const originalContent = document.body.innerHTML;

        // Reset class và scroll tuốt lên đầu trang
        document.body.className = "";
        window.scrollTo(0, 0); 

        document.body.innerHTML = `
            <style>
                @page {
                    size: 80mm auto !important; /* Định dạng khổ giấy cuộn */
                    margin: 0 !important; /* Xóa lề máy in nhiệt */
                }
                html, body {
                    width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    box-sizing: border-box !important;
                }
                /* Bọc toàn bộ hóa đơn để khống chế vị trí */
                #print-wrapper {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    /* ÉP SÁT NỐC (top: 0), CHỈ THỤT LỀ TRÁI/PHẢI 15px */
                    padding: 0px 15px 0px 35px !important; 
                    box-sizing: border-box !important;
                    color: #000 !important;
                    font-family: Arial, sans-serif !important;
                    overflow: hidden; /* Tiêu diệt thanh cuộn */
                }
                /* 2. Tiêu diệt margin/padding mặc định của Bootstrap cho sát nóc */
                .modal-body {
                    padding: 0 !important; 
                    margin: 0 !important;
                }
                /* 3. Tiêu diệt khoảng cách trên đầu cục LOGO BỆNH VIỆN */
                .hospital-header {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                }
                /* 4. CHUYỂN LOGO VÀ INFO VỀ MÀU ĐEN TRẮNG ĐỂ IN TIẾT KIỆM MỰC */
                .hospital-header img {
                    filter: grayscale(100%) !important;
                    -webkit-filter: grayscale(100%) !important;
                }
                /* Giấu sạch nút bấm, header, footer của modal web */
                .d-print-none, .modal-header, .modal-footer, .modal-backdrop {
                    display: none !important;
                }
            </style>
            <div id="print-wrapper">
                ${printContent}
            </div>
        `;

        window.print(); // Gọi lệnh In nhiệt

        // In xong thì trả lại giao diện gốc
        document.body.innerHTML = originalContent;
        window.location.reload();
    };
    // ============================================

    if (!invoices) {
        return <div>Loading...</div>;
    }

    const { items } = invoices;

    let total = 0;

    items.forEach(i => {
        total += i.quantity * i.sell_price;
    });

    const deposit = Number(invoices.deposit_amount) || 0;

    return (
        <>
            {/* Modal hiển thị trên Web (d-block) */}
            <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                <div className="modal-dialog">
                    
                    {/* KHU VỰC SẼ IN RA (printable-invoice) */}
                    <div className="modal-content" id="printable-invoice">

                        <div className="modal-header d-print-none">
                            <h5>Hóa đơn</h5>
                            <button className="btn-close" onClick={onClose}></button>
                        </div>

                        {/* modal-body này sẽ bị CSS in đè bẹp dí padding (p-0) */}
                        <div className="modal-body p-4"> {/* Đổi p-4 thành p-0 để ép sát rạt nóc */}

                            {/* +++++++++++++++++++++++++++++++++++++++++++++++ */}
                            {/* BƯỚC 3: PHẦN THÔNG TIN BỆNH VIỆN MỚI TOANH NẰM TRÊN CÙNG - BỐ CỤC MỚI CÙNG 1 DÒNG */}
                            <div className="hospital-header d-flex align-items-center mb-4 pt-1 border-bottom pb-2">
                                {/* Đường dẫn tới file ảnh trong folder /public/bvmt-removebg-preview.png (bỏ /public) */}
                                <div className="hospital-logo me-3">
                                    <img src={logo} alt="Logo" style={{ maxWidth: '25mm', height: 'auto' }} />
                                </div>
                                
                                <div className="hospital-info text-start">
                                    <h4 className="fw-bold text-dark">BỆNH VIỆN ĐK MINH TÂM</h4>
                                    <div className="small text-dark">Số 36 Đ. Nguyễn Đáng, Trà Vinh, Vĩnh Long</div>
                                    <div className="small text-dark">SĐT: 0294 3850 665</div>
                                </div>
                            </div>
                            {/* +++++++++++++++++++++++++++++++++++++++++++++++ */}

                            {/* Tiêu đề hóa đơn thụt xuống dưới cục logo */}
                            <h5 className="text-center fw-bold mb-4">HÓA ĐƠN BÁN HÀNG</h5>

                            <div className="mb-1">Mã hóa đơn: <b>{invoiceId}</b></div>
                            <div className="mb-1">Mã khách hàng: {invoices.customer_code}</div>
                            {/*customerName: "H lão hồ" (hình 9)*/}
                            <div className="mb-1">Tên khách hàng: {customerName}</div>
                            <div className="mb-1">Số điện thoại: {invoices.phone}</div>
                            {/* Fix lỗi data: fix created_at và dùng toán tử an toàn */}
                            <div className="mb-3">Ngày: {invoices?.created_at ? new Date(invoices.created_at).toLocaleString('vi-VN') : '---'}</div>

                            <hr style={{ borderStyle: 'dashed' }} />

                            {items.map((item, i) => (
                                <div key={i} className="d-flex justify-content-between mb-2">
                                    <div>{item.product_name} <b>x{item.quantity}</b></div>
                                    <div>{formatMoney(item.sell_price * item.quantity)}</div>
                                </div>
                            ))}

                            <hr style={{ borderStyle: 'dashed' }} />

                            <div className="d-flex justify-content-between mb-2">
                                <span>Tiền hàng</span>
                                <b>{formatMoney(total)}</b>
                            </div>

                            <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
                                <span>Tiền cọc vỏ</span>
                                <b>{formatMoney(deposit)}</b>
                            </div>

                            <div className="d-flex justify-content-between fs-5 mt-2">
                                <span><b>TỔNG CỘNG</b></span>
                                {/* Tổng cộng đỏ */}
                                <b className="text-danger">{formatMoney(total + deposit)}</b>
                            </div>

                            <div className="text-center mt-4 text-muted fst-italic" style={{ fontSize: '12px' }}>
                                Xin cảm ơn quý khách!
                            </div>

                        </div>

                        {/* Footer web d-print-none */}
                        <div className="modal-footer d-print-none">
                            <button
                                className="btn btn-primary px-4"
                                onClick={handlePrint} /* <--- Gọi hàm In đặc trị ở trên */
                            >
                                In hóa đơn
                            </button>

                            <button
                                className="btn btn-secondary px-4"
                                onClick={onClose}
                            >
                                Đóng
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Backdroppade-backdrop d-print-none */}
            <div className="modal-backdrop fade show d-print-none"></div>
        </>
    );
}