import React, { useEffect, useState } from "react";
import axios from "axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function InvoiceModal({ invoiceId, onClose }) {
    const [invoices, setInvoices] = useState(null);
    const [paperSize, setPaperSize] = useState("A5");
    const token = localStorage.getItem("token");

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const formatMoney = (value) => Number(value).toLocaleString("vi-VN");
    const maskPhone = (phone) => phone && phone.length > 5 ? `${phone.slice(0, 3)}***${phone.slice(-2)}` : phone;

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

        const printStyles = paperSize === "80mm"
            ? `
                @page { size: 80mm auto !important; margin: 0 !important; }
                html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; font-family: Arial, sans-serif !important; }
                #print-wrapper { position: absolute !important; top: 0 !important; left: 0 !important; width: 80mm !important; padding: 0px 2mm 10px 6mm !important; box-sizing: border-box !important; }
            `
            : `
                /* 💡 ĐÃ FIX: Bóp lề từ 15mm xuống 5mm để có thêm chỗ trống */
                @page { size: A5 portrait !important; margin: 5mm !important; }
                
                /* 💡 ĐÃ FIX: Ép thu nhỏ toàn bộ nội dung xuống 95% để đảm bảo không bị rớt trang */
                html, body { width: 100% !important; margin: 0 !important; background: #fff !important; color: #000 !important; font-family: Arial, sans-serif !important; zoom: 0.95; }
                
                #print-wrapper { width: 100% !important; padding: 0 !important; font-size: 14px !important; }
                #print-wrapper .text-center { text-align: center !important; }
                #print-wrapper table { width: 100% !important; border-collapse: collapse !important; margin-top: 10px !important; margin-bottom: 10px !important; }
                #print-wrapper th, #print-wrapper td { border: 1px solid #000 !important; padding: 5px !important; text-align: center !important; }
                #print-wrapper th { font-weight: bold !important; background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
                #print-wrapper .fs-large { font-size: 18px !important; }
            `;
        const printContent = printElement.innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.className = "";
        window.scrollTo(0, 0);

        document.body.innerHTML = `
            <style>
                ${printStyles}
                #print-wrapper img { filter: grayscale(100%) contrast(1000%) brightness(80%) !important; -webkit-filter: grayscale(100%) contrast(1000%) brightness(80%) !important; }
                .d-print-none { display: none !important; }
            </style>
            <div id="print-wrapper">${printContent}</div>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload();
    };

    if (!invoices) return <div className="text-center p-5 text-white">Loading...</div>;

    const { items } = invoices;
    let total = 0; items.forEach(i => { total += i.quantity * i.sell_price; });
    const deposit = Number(invoices.deposit_amount) || 0;
    const deliveryFee = Number(invoices.delivery_fee) || 0;
    const finalTotal = total + deposit + deliveryFee;
    const paidAmount = Number(invoices.paid_amount) || 0;
    const debtAmount = finalTotal > paidAmount ? finalTotal - paidAmount : 0;

    return (
        <>
            <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>

                {/* 💡 CHÈN THÊM ĐOẠN STYLE CSS NÀY ĐỂ ÉP ZOOM TRÊN ĐIỆN THOẠI */}
                <style>{`
                    @media screen and (max-width: 768px) {
                        /* Tự động thu nhỏ bản Preview xuống 65% trên màn hình điện thoại */
                        #printable-order, #printable-invoice {
                            zoom: 0.65;
                            margin: 0 auto;
                        }
                        /* Ép thẻ chứa Modal vừa khít màn hình, không bị rớt lề */
                        .modal-dialog {
                            margin: 0.5rem;
                            max-width: 100% !important;
                        }
                    }
                `}</style>
                {/* 💡 KẾT THÚC ĐOẠN CHÈN */}

                <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: paperSize === '80mm' ? '400px' : '650px' }}>
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header bg-primary text-white d-print-none border-0">
                            <h5 className="modal-title fw-bold"><i className="bi bi-receipt me-2"></i>Xem trước Hóa Đơn</h5>
                            <button className="btn-close btn-close-white" onClick={onClose}></button>
                        </div>

                        <div className="bg-light p-2 text-center d-print-none border-bottom">
                            <span className="fw-bold me-3">Chọn khổ in:</span>
                            <div className="btn-group shadow-sm">
                                <button className={`btn btn-sm ${paperSize === 'A5' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`} onClick={() => setPaperSize('A5')}>Khổ A4/A5</button>
                                <button className={`btn btn-sm ${paperSize === '80mm' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`} onClick={() => setPaperSize('80mm')}>Bill 80mm</button>
                            </div>
                        </div>

                        <div className="modal-body p-3 p-md-4 overflow-auto" id="printable-invoice" style={{ backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                            <div className="hospital-header text-center" style={{ marginBottom: paperSize === 'A5' ? '15px' : '8px' }}>
                                <img src={logo} alt="Logo" style={{ width: paperSize === 'A5' ? '150px' : '120px', height: 'auto', objectFit: 'contain' }} />
                                <div className="fw-bold fs-large" style={{ textTransform: 'uppercase' }}>MITAFRESH</div>
                                <div className="fw-bold">Số 56, Mậu Thân, Khóm 10, P. Trà Vinh, Tỉnh Vĩnh Long</div>
                                <div className="fw-bold">SĐT: 0824 009 779 - 0973 141 307</div>
                            </div>

                            <h5 className="text-center fw-bold text-uppercase fs-large" style={{ paddingBottom: '10px' }}>PHIẾU THU TIỀN</h5>

                            <div className="fw-bold" style={{ lineHeight: '1.5', marginBottom: '15px' }}>
                                <div>Mã hóa đơn: <b>#{invoiceId}</b></div>
                                <div>Khách hàng: {invoices.customer_name || "Khách vãng lai"} {invoices.phone ? `- ${maskPhone(invoices.phone)}` : ''}</div>
                                <div>Địa chỉ: {invoices.customer_address || '---'}</div>
                                <div>Ngày: {invoices.created_at ? formatDate(invoices.created_at) : '---'}</div>
                                {invoices.shipper_name && <div>Người giao: {invoices.shipper_name}</div>}
                            </div>

                            {paperSize === 'A5' ? (
                                <table className="table table-bordered mb-3">
                                    <thead>
                                        <tr>
                                            <th>Sản phẩm</th>
                                            <th>SL</th>
                                            <th>Đơn giá</th>
                                            <th>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, i) => (
                                            <tr key={i}>
                                                <td className="text-start">{item.product_name}</td>
                                                <td>{item.quantity}</td>
                                                <td>{formatMoney(item.sell_price)}</td>
                                                <td className="text-end fw-bold">{formatMoney(item.sell_price * item.quantity)} đ</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <>
                                    <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px' }}></div>
                                    <div className="d-flex fw-bold mb-1">
                                        <div style={{ flex: 2 }}>Đơn giá</div>
                                        <div className="text-center" style={{ flex: 1 }}>SL</div>
                                        <div className="text-end" style={{ flex: 2 }}>Thành tiền</div>
                                    </div>
                                    <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px' }}></div>
                                    {items.map((item, i) => (
                                        <div key={i} className="mb-2 fw-bold">
                                            <div>{item.product_name}</div>
                                            <div className="d-flex">
                                                <div style={{ flex: 2 }}>{formatMoney(item.sell_price)}</div>
                                                <div className="text-center" style={{ flex: 1 }}>{item.quantity}</div>
                                                <div className="text-end" style={{ flex: 2 }}>{formatMoney(item.sell_price * item.quantity)} đ</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                                </>
                            )}

                            {/* 💡 ĐÃ SỬA CHỖ NÀY: ÉP FULL 100% WIDTH CHO PHẲNG PHIU */}
                            <div style={{ width: '100%' }}>
                                <div className="d-flex justify-content-between mb-1 fw-bold">
                                    <span>Tiền hàng:</span>
                                    <span>{formatMoney(total)} đ</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 fw-bold">
                                    <span>Tiền cọc vỏ:</span>
                                    <span>{formatMoney(deposit)} đ</span>
                                </div>
                                {deliveryFee > 0 && (
                                    <div className="d-flex justify-content-between mb-1 fw-bold">
                                        <span>Phí giao hàng:</span>
                                        <span>{formatMoney(deliveryFee)} đ</span>
                                    </div>
                                )}
                                <div className="d-flex justify-content-between fw-bold mt-2 pt-2 fs-large" style={{ borderTop: '2px solid #000' }}>
                                    <span>TỔNG CỘNG:</span>
                                    <span>{formatMoney(finalTotal)} đ</span>
                                </div>
                                <div className="d-flex justify-content-between mt-1 fw-bold">
                                    <span>Khách đã trả:</span>
                                    <span>{formatMoney(paidAmount)} đ</span>
                                </div>
                                {debtAmount > 0 && (
                                    <div className="d-flex justify-content-between fw-bold mt-1 pt-1" style={{ borderTop: '1px dashed #000' }}>
                                        <span>CÒN NỢ LẠI:</span>
                                        <span>{formatMoney(debtAmount)} đ</span>
                                    </div>
                                )}
                            </div>

                            {paperSize === 'A5' && (
                                <div className="d-flex justify-content-between text-center fw-bold mt-3 pt-3">
                                    <div>
                                        <p>Người lập phiếu</p>
                                        <p style={{ marginTop: '65px', fontStyle: 'italic', fontSize: '12px' }}>(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div>
                                        <p>Khách hàng / Người nhận</p>
                                        <p style={{ marginTop: '65px', fontStyle: 'italic', fontSize: '12px' }}>(Ký, ghi rõ họ tên)</p>
                                    </div>
                                </div>
                            )}

                            {/* 💡 CHÂN TRANG: ĐIỀU KIỆN & QUẢNG CÁO */}
                            {paperSize === '80mm' && (
                                <div className="text-center mt-4 text-dark fw-bold" style={{ fontSize: paperSize === '80mm' ? '11px' : '13px', lineHeight: '1.4' }}>
                                    <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                                    <div style={{ textAlign: 'left', padding: '0 5px', marginBottom: '8px' }}>
                                        <div className="fw-bold text-decoration-underline mb-1" style={{ fontSize: paperSize === '80mm' ? '12px' : '14px' }}>Điều Kiện Giao Hàng:</div>
                                        <ul className="fw-bold" style={{ paddingLeft: '15px', margin: 0 }}>
                                            <li>Bình 20L: Giao từ 5 bình trở lên.</li>
                                            <li>Bình 5L: Giao từ 4 bình trở lên.</li>
                                            <li>Lốc (250ml - 350ml - 500ml - 1.5L): Giao từ 10 lốc trở lên (hoặc mua kèm bình 20L).</li>
                                        </ul>
                                    </div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                                    <div className="fw-bold" style={{ fontSize: paperSize === '80mm' ? '16px' : '18px', fontStyle: 'italic', marginBottom: '2px' }}>Mita Fresh</div>
                                    <div className="fw-bold" style={{ fontSize: paperSize === '80mm' ? '12px' : '14px', marginBottom: '3px' }}>NƯỚC UỐNG SIÊU TINH KHIẾT</div>
                                    <div className="fw-bold" style={{ fontSize: paperSize === '80mm' ? '11px' : '13px', textAlign: 'left', padding: '0 5px' }}>
                                        • Sản xuất khép kín, diệt khuẩn tia UV an toàn.<br />
                                        • Lọc công nghệ R.O, đạt chuẩn TDS &lt; 20 mg/l.<br />
                                        • Lựa chọn hàng đầu bảo vệ sức khỏe gia đình.
                                    </div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                                    <div className="fw-bold" style={{ fontSize: paperSize === '80mm' ? '12px' : '14px' }}>Cảm ơn Quý Khách đã tin dùng Mita Fresh!</div>
                                    <div className="fw-bold" style={{ fontSize: paperSize === '80mm' ? '12px' : '14px' }}>Tổng đài hỗ trợ: <b>0824 009 779 - 0973 141 307</b></div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer bg-light d-print-none border-0">
                            <button className="btn btn-primary px-4 fw-bold shadow-sm" onClick={handlePrint}>
                                <i className="bi bi-printer me-2"></i>IN HÓA ĐƠN ({paperSize})
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