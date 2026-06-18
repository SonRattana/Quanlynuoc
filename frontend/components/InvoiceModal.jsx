import React, { useEffect, useState } from "react";
import axios from "axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function InvoiceModal({ invoiceId, onClose }) {
    const [invoices, setInvoices] = useState(null);
    const token = localStorage.getItem("token");

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const formatMoney = (value) => {
        return Number(value).toLocaleString("vi-VN");
    };

    const maskPhone = (phone) => {
        if (!phone || phone.length < 6) return phone;
        const first3 = phone.slice(0, 3);
        const last2 = phone.slice(-2);
        const masked = "*".repeat(phone.length - 5);
        return `${first3}${masked}${last2}`;
    };

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const res = await axios.get(`/api/invoice/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } });
                setInvoices(res.data);
            } catch (error) { console.error("Lỗi lấy hóa đơn", error); }
        };
        if (invoiceId) fetchInvoice();
    }, [invoiceId]);

    const handlePrint = () => {
        const printElement = document.getElementById("printable-invoice");
        if (!printElement) return;
        const printContent = printElement.innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.className = "";
        window.scrollTo(0, 0);

        document.body.innerHTML = `
            <style>
                @page { size: 80mm auto !important; margin: 0 !important; }
                html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; font-family: Arial, sans-serif !important; }
                #print-wrapper { position: absolute !important; top: 0 !important; left: 0 !important; width: 80mm !important; padding: 0px 2mm 10px 6mm !important; box-sizing: border-box !important; }
                #print-wrapper img { filter: grayscale(100%) contrast(1000%) brightness(80%) !important; -webkit-filter: grayscale(100%) contrast(1000%) brightness(80%) !important; }
                .d-print-none { display: none !important; }
            </style>
            <div id="print-wrapper">${printContent}</div>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload();
    };

    if (!invoices) return <div>Loading...</div>;

    const { items } = invoices;
    let total = 0;
    items.forEach(i => { total += i.quantity * i.sell_price; });
    const deposit = Number(invoices.deposit_amount) || 0;
    const deliveryFee = Number(invoices.delivery_fee) || 0;
    const finalTotal = total + deposit + deliveryFee;

    // 💡 TÍNH NỢ CHO BẢN IN
    const paidAmount = Number(invoices.paid_amount) || 0;
    const debtAmount = finalTotal > paidAmount ? finalTotal - paidAmount : 0;

    return (
        <>
            <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
                    <div className="modal-content border-0 shadow-lg" style={{ backgroundColor: '#f4f4f4' }}>

                        <div className="modal-header bg-dark text-white d-print-none border-0">
                            <h5 className="modal-title fw-bold"><i className="bi bi-receipt me-2"></i>Xem trước bản in</h5>
                            <button className="btn-close btn-close-white" onClick={onClose}></button>
                        </div>

                        <div className="modal-body p-4" id="printable-invoice" style={{ backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                            <div className="hospital-header text-center" style={{ marginBottom: '8px' }}>
                                <img src={logo} alt="Logo" style={{
                                    width: '120px',       /* 💡 Ép cứng chiều rộng bằng px, trình duyệt in bill sẽ hiểu chuẩn hơn */
                                    height: 'auto',       /* 💡 Tự động co giãn chiều cao theo tỷ lệ, không bị méo hình */
                                    objectFit: 'contain',
                                    marginBottom: '4px'   /* 💡 Trả lại margin bình thường để không bị lẹm vào chữ */
                                }} />
                                <div className="fw-bold" style={{ fontSize: '16px', textTransform: 'uppercase', lineHeight: '1.2' }}>MITAFRESH</div>
                                <div className="fw-bold" style={{ fontSize: '11px', lineHeight: '1.2', marginTop: '2px' }}>Số 56, Mậu Thân, Khóm 10, P. Trà Vinh, Tỉnh Vĩnh Long</div>
                                <div className="fw-bold" style={{ fontSize: '11px', lineHeight: '1.2' }}>SĐT: 0824 009 779 - 0973 141 307</div>
                            </div>

                            <h6 className="text-center fw-bold m-0" style={{ fontSize: '14px', paddingBottom: '8px' }}>PHIẾU THU</h6>

                            <div className="fw-bold" style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '8px' }}>
                                <div>Mã hóa đơn: <b>{invoiceId}</b></div>
                                <div>Khách hàng: {invoices.customer_name || "Khách lẻ"} {invoices.phone ? `- ${maskPhone(invoices.phone)}` : ''}</div>
                                <div style={{ fontWeight: 'bold' }}>Hình thức: {(deliveryFee > 0 || (invoices.shipper_name && invoices.shipper_name.trim() !== "")) ? "🛵 Giao hàng tận nơi" : "🚶 Khách tự đến lấy"}</div>
                                <div>Địa chỉ: {invoices.customer_address || '---'}</div>
                                <div>Ngày: {invoices.created_at ? formatDate(invoices.created_at) : '---'}</div>
                                {invoices.shipper_name && <div>Người giao: {invoices.shipper_name}</div>}
                            </div>

                            <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px' }}></div>

                            <div className="d-flex fw-bold" style={{ fontSize: '12px', marginBottom: '5px' }}>
                                <div style={{ flex: 2 }}>Đơn giá</div>
                                <div className="text-center" style={{ flex: 1 }}>Số lượng</div>
                                <div className="text-end" style={{ flex: 2 }}>Thành tiền</div>
                            </div>

                            <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px' }}></div>

                            {items.map((item, i) => (
                                <div key={i} className="mb-2 fw-bold" style={{ fontSize: '13px' }}>
                                    <div className="fw-bold" style={{ marginBottom: '2px' }}>{item.product_name}</div>
                                    <div className="d-flex align-items-center">
                                        <div style={{ flex: 2 }}>{formatMoney(item.sell_price)}</div>
                                        <div className="text-center" style={{ flex: 1 }}>{item.quantity}</div>
                                        <div className="text-end fw-bold" style={{ flex: 2 }}>{formatMoney(item.sell_price * item.quantity)} đ</div>
                                    </div>
                                </div>
                            ))}

                            <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>

                            <div className="d-flex justify-content-between mb-1 fw-bold" style={{ fontSize: '13px' }}>
                                <span>Tiền hàng:</span>
                                <span>{formatMoney(total)} đ</span>
                            </div>
                            <div className="d-flex justify-content-between mb-1 fw-bold" style={{ fontSize: '13px' }}>
                                <span>Tiền cọc vỏ:</span>
                                <span>{formatMoney(deposit)} đ</span>
                            </div>
                            {deliveryFee > 0 && (
                                <div className="d-flex justify-content-between mb-1 fw-bold" style={{ fontSize: '13px' }}>
                                    <span>Phí giao hàng:</span>
                                    <span>{formatMoney(deliveryFee)} đ</span>
                                </div>
                            )}

                            <div className="d-flex justify-content-between fw-bold mt-2 pt-2" style={{ fontSize: '16px', borderTop: '1px dotted #ccc' }}>
                                <span>TỔNG CỘNG:</span>
                                <span>{formatMoney(finalTotal)} đ</span>
                            </div>

                            {/* 💡 THÔNG TIN THANH TOÁN (IN RA GIẤY) */}
                            <div className="d-flex justify-content-between mt-1 fw-bold" style={{ fontSize: '13px' }}>
                                <span>Khách đã trả:</span>
                                <span>{formatMoney(paidAmount)} đ</span>
                            </div>
                            {debtAmount > 0 && (
                                <div className="d-flex justify-content-between fw-bold mt-1 pt-1" style={{ fontSize: '15px', borderTop: '1px dashed #000' }}>
                                    <span>CÒN NỢ LẠI:</span>
                                    <span>{formatMoney(debtAmount)} đ</span>
                                </div>
                            )}

                            <div className="text-center mt-3 text-dark fw-bold" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

                                {/* --- PHẦN CHÍNH SÁCH GIAO HÀNG MỚI --- */}
                                <div style={{ textAlign: 'left', padding: '0 5px', marginBottom: '8px' }}>
                                    <div className="fw-bold text-decoration-underline mb-1" style={{ fontSize: '12px' }}>Điều Kiện Giao Hàng:</div>
                                    <ul className="fw-bold" style={{ paddingLeft: '15px', margin: 0 }}>
                                        <li>Bình 20L: Giao từ 5 bình trở lên.</li>
                                        <li>Bình 5L: Giao từ 4 bình trở lên.</li>
                                        <li>Lốc (250ml - 350ml - 500ml - 1.5L): Giao từ 10 lốc trở lên (hoặc mua kèm bình 20L).</li>
                                    </ul>
                                </div>
                                {/* ------------------------------------- */}
                                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                                <div className="fw-bold" style={{ fontSize: '16px', fontStyle: 'italic', marginBottom: '2px' }}>Mita Fresh</div>
                                <div className="fw-bold" style={{ fontSize: '12px', marginBottom: '3px' }}>NƯỚC UỐNG SIÊU TINH KHIẾT</div>
                                <div className="fw-bold" style={{ fontSize: '11px', textAlign: 'left', padding: '0 5px' }}>
                                    • Sản xuất khép kín, diệt khuẩn tia UV an toàn.<br />
                                    • Lọc công nghệ R.O, đạt chuẩn TDS &lt; 20 mg/l.<br />
                                    • Lựa chọn hàng đầu bảo vệ sức khỏe gia đình.
                                </div>
                                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                                <div className="fw-bold">Cảm ơn Quý Khách đã tin dùng Mita Fresh!</div>
                                <div className="fw-bold">Tổng đài hỗ trợ: <b style={{ fontSize: '11px' }}>0824 009 779 - 0973 141 307</b></div>
                            </div>
                        </div>

                        <div className="modal-footer bg-light d-print-none border-0">
                            <button className="btn btn-primary px-4 fw-bold shadow-sm" onClick={handlePrint}>
                                <i className="bi bi-printer me-2"></i>IN HÓA ĐƠN
                            </button>
                            <button className="btn btn-secondary px-4 fw-bold shadow-sm" onClick={onClose}>Đóng</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show d-print-none"></div>
        </>
    );
}