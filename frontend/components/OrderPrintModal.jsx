import React, { useEffect, useState } from "react";
import api from "axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function OrderPrintModal({ orderId, onClose }) {
    const [orderData, setOrderData] = useState(null);
    const [paperSize, setPaperSize] = useState("A5");
    const token = localStorage.getItem("token");

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatMoney = (value) => Number(value).toLocaleString("vi-VN");
    const maskPhone = (phone) => phone && phone.length > 5 ? `${phone.slice(0, 3)}***${phone.slice(-2)}` : phone;

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await api.get(`api/sales-orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
                setOrderData(res.data);
            } catch (error) { console.error("Lỗi lấy đơn hàng", error); }
        };
        if (orderId) fetchOrder();
    }, [orderId]);

    const handlePrint = () => {
        const printElement = document.getElementById("printable-order");
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

    if (!orderData) return <div className="text-center p-5 text-white">Loading...</div>;

    const { details } = orderData;
    let itemsToPrint = details.map(d => {
        const thieuKhach = (d.ordered_quantity || 0) - (d.delivered_quantity || 0);
        const xuongLam = (d.produced_quantity || 0);
        let smart_deliver = xuongLam > 0 ? Math.max(0, xuongLam - (d.delivered_quantity || 0)) : thieuKhach;
        return { ...d, actual_deliver: Math.min(smart_deliver, thieuKhach) };
    }).filter(d => d.actual_deliver > 0);

    let isReviewMode = itemsToPrint.length === 0;
    if (isReviewMode) {
        itemsToPrint = details.map(d => ({ ...d, actual_deliver: d.ordered_quantity }));
    }

    const deposit = Number(orderData.bottle_deposit) || 0;
    const deliveryFee = Number(orderData.delivery_fee) || 0;
    const advancePayment = Number(orderData.advance_payment) || 0;
    const totalGoods = itemsToPrint.reduce((sum, item) => sum + (item.actual_deliver * item.unit_price), 0);
    const finalTotal = totalGoods + deposit + deliveryFee;
    const remainingToCollect = finalTotal - advancePayment;

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

                        <div className="modal-header bg-dark text-white d-print-none border-0">
                            <h5 className="modal-title fw-bold"><i className="bi bi-truck me-2"></i>In Phiếu Giao Hàng</h5>
                            <button className="btn-close btn-close-white" onClick={onClose}></button>
                        </div>

                        <div className="bg-light p-2 text-center d-print-none border-bottom">
                            <span className="fw-bold me-3">Chọn khổ in:</span>
                            <div className="btn-group shadow-sm">
                                <button className={`btn btn-sm ${paperSize === 'A5' ? 'btn-dark fw-bold' : 'btn-outline-dark'}`} onClick={() => setPaperSize('A5')}>Khổ A4/A5</button>
                                <button className={`btn btn-sm ${paperSize === '80mm' ? 'btn-dark fw-bold' : 'btn-outline-dark'}`} onClick={() => setPaperSize('80mm')}>Bill 80mm</button>
                            </div>
                        </div>

                        <div className="modal-body p-3 p-md-4 overflow-auto" id="printable-order" style={{ backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                            <div className="hospital-header text-center" style={{ marginBottom: paperSize === 'A5' ? '15px' : '8px' }}>
                                <img src={logo} alt="Logo" style={{ width: paperSize === 'A5' ? '150px' : '120px', height: 'auto', objectFit: 'contain' }} />
                                <div className="fw-bold fs-large" style={{ textTransform: 'uppercase' }}>MITAFRESH</div>
                                <div className="fw-bold">Số 56, Mậu Thân, Khóm 10, P. Trà Vinh, Tỉnh Vĩnh Long</div>
                                <div className="fw-bold">SĐT: 0824 009 779 - 0973 141 307</div>
                            </div>

                            <h5 className="text-center fw-bold text-uppercase fs-large" style={{ paddingBottom: '10px' }}>
                                {isReviewMode ? "PHIẾU TỔNG KẾT ĐƠN" : "PHIẾU GIAO HÀNG"}
                            </h5>

                            <div className="fw-bold" style={{ lineHeight: '1.5', marginBottom: '15px' }}>
                                <div>Mã Đơn: <b>{orderData.order_code}</b></div>
                                <div>Khách hàng: {orderData.customer_name} {orderData.customer_phone ? `- ${maskPhone(orderData.customer_phone)}` : ''}</div>
                                <div>Địa chỉ: {orderData.customer_address || '---'}</div>
                                <div>Ngày đặt: {orderData.created_at ? formatDate(orderData.created_at) : '---'}</div>
                                {orderData.shipper_name && <div>Người giao: <b>{orderData.shipper_name}</b></div>}
                                {orderData.note && <div style={{ fontStyle: 'italic', border: '1px dashed #ccc', padding: '3px 5px', marginTop: '3px' }}>Ghi chú: {orderData.note}</div>}
                            </div>

                            {paperSize === 'A5' ? (
                                <table className="table table-bordered mb-3">
                                    <thead>
                                        <tr>
                                            <th>Sản phẩm</th>
                                            <th>SL Giao</th>
                                            <th>Đơn giá</th>
                                            <th>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsToPrint.map((item, i) => (
                                            <tr key={i}>
                                                <td className="text-start">{item.product_name}</td>
                                                <td className="fs-large">{item.actual_deliver}</td>
                                                <td>{formatMoney(item.unit_price)}</td>
                                                <td className="text-end fw-bold">{formatMoney(item.unit_price * item.actual_deliver)} đ</td>
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
                                    {itemsToPrint.map((item, i) => (
                                        <div key={i} className="mb-2 fw-bold">
                                            <div>{item.product_name}</div>
                                            <div className="d-flex">
                                                <div style={{ flex: 2 }}>{formatMoney(item.unit_price)}</div>
                                                <div className="text-center">{item.actual_deliver}</div>
                                                <div className="text-end" style={{ flex: 2 }}>{formatMoney(item.unit_price * item.actual_deliver)} đ</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }}></div>
                                </>
                            )}

                            {/* 💡 ĐÃ SỬA: ÉP FULL 100% WIDTH */}
                            <div style={{ width: '100%' }}>
                                <div className="d-flex justify-content-between mb-1 fw-bold">
                                    <span>Tiền hàng:</span>
                                    <span>{formatMoney(totalGoods)} đ</span>
                                </div>
                                {deposit > 0 && (
                                    <div className="d-flex justify-content-between mb-1 fw-bold">
                                        <span>Tạm tính cọc vỏ:</span>
                                        <span>{formatMoney(deposit)} đ</span>
                                    </div>
                                )}
                                {deliveryFee > 0 && (
                                    <div className="d-flex justify-content-between mb-1 fw-bold">
                                        <span>Phí giao hàng:</span>
                                        <span>{formatMoney(deliveryFee)} đ</span>
                                    </div>
                                )}
                                <div className="d-flex justify-content-between fw-bold mt-2 pt-2 fs-large" style={{ borderTop: '2px solid #000' }}>
                                    <span>TỔNG ĐƠN:</span>
                                    <span>{formatMoney(finalTotal)} đ</span>
                                </div>
                                {advancePayment > 0 && (
                                    <div className="d-flex justify-content-between mt-1 fw-bold" style={{ color: '#555' }}>
                                        <span>Khách đã cọc trước:</span>
                                        <span>- {formatMoney(advancePayment)} đ</span>
                                    </div>
                                )}
                                <div className="d-flex justify-content-between fw-bold mt-1 pt-1" style={{ borderTop: '1px dashed #000', fontSize: '16px' }}>
                                    <span>SHIPPER THU:</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '4px' }}>{formatMoney(remainingToCollect)} đ</span>
                                </div>
                            </div>

                            {paperSize === 'A5' && (
                                <div className="d-flex justify-content-between text-center fw-bold mt-3 pt-3">
                                    <div>
                                        <p>Người giao hàng</p>
                                        <p style={{ marginTop: '65px', fontStyle: 'italic', fontSize: '12px' }}>(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div>
                                        <p>Khách hàng nhận</p>
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
                            <button className="btn btn-dark px-4 fw-bold shadow-sm" onClick={handlePrint}>
                                <i className="bi bi-printer me-2"></i>IN PHIẾU ({paperSize})
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