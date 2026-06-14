import React, { useEffect, useState } from "react";
import axios from "axios";

export default function InvoiceDetailModal({ invoiceId, onClose }) {
    const [data, setData] = useState(null);
    const token = localStorage.getItem("token");

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const res = await axios.get(`/api/invoice/details/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } });
                setData(res.data);
            } catch (err) { console.error("Lỗi lấy chi tiết:", err); }
        };
        if (invoiceId) fetchDetail();
    }, [invoiceId]);

    if (!data) return null;

    const productOnlyTotal = data.items.reduce((sum, item) => sum + (Number(item.sell_price) * item.quantity), 0);
    const totalDepositModal = data.items.reduce((sum, item) => sum + (Number(item.deposit || 0) * item.quantity), 0);
    const deliveryFee = Number(data.delivery_fee) || 0;
    const finalTotalModal = productOnlyTotal + totalDepositModal + deliveryFee;

    // 💡 TÍNH TOÁN CÔNG NỢ Ở ĐÂY
    const paidAmount = Number(data.paid_amount) || 0;
    const debtAmount = finalTotalModal > paidAmount ? finalTotalModal - paidAmount : 0;

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content shadow-lg border-0">
                    <div className="modal-header bg-info text-dark">
                        <h5 className="modal-title fw-bold">🛒 Chi Tiết Hóa Đơn #{data.id}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="row mb-4 bg-light p-3 rounded border">
                            <div className="col-md-7">
                                <p className="mb-2"><strong className="text-muted">👤 Khách hàng:</strong> <span className="fw-bold">{data.customer_name}</span></p>
                                <p className="mb-2"><strong className="text-muted">📞 SĐT:</strong> <span className="text-primary fw-bold">{(data.phone)}</span></p>
                                <p className="mb-2"><strong className="text-muted">🏠 Địa chỉ:</strong> <span className="fw-bold">{data.customer_address || '---'}</span></p>
                            </div>
                            <div className="col-md-5 text-md-end border-start">
                                <p className="mb-2 text-primary fw-bold">🕒 Ngày lập: {formatDate(data.created_at)}</p>
                                <p className="mb-0 text-success fw-bold small">
                                    {data.delivery_fee > 0 ? `🛵 Giao hàng: ${data.shipper_name || 'Đang chờ'}` : `🚶 Khách tự lấy`}
                                </p>
                            </div>
                        </div>

                        <h6 className="fw-bold text-primary mb-3"><i className="fa fa-box-open me-2"></i>Sản phẩm:</h6>
                        <div className="table-responsive">
                            <table className="table table-bordered table-hover mb-0 table-mobile-cards">
                                <thead className="table-light text-muted">
                                    <tr>
                                        <th>Tên Sản Phẩm</th>
                                        <th className="text-center" width="10%">Số lượng</th>
                                        <th className="text-end" width="20%">Đơn giá</th>
                                        <th className="text-end" width="20%">Cọc vỏ</th>
                                        <th className="text-end" width="25%">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((item, index) => (
                                        <tr key={index}>
                                            {/* 💡 ĐÃ BƠM ĐẦY ĐỦ DATA-LABEL VÀO ĐÂY */}
                                            <td data-label="Tên Sản Phẩm" className="fw-bold">{item.product_name}</td>

                                            <td data-label="Số lượng" className="text-center fw-bold text-danger fs-5">{item.quantity}</td>

                                            <td data-label="Đơn giá" className="text-end">{Number(item.sell_price).toLocaleString('vi-VN')} đ</td>

                                            <td data-label="Cọc vỏ" className="text-end text-warning fw-bold">
                                                {Number(item.deposit || 0) > 0 ? `${Number(item.deposit).toLocaleString('vi-VN')} đ` : '-'}
                                            </td>

                                            <td data-label="Thành tiền" className="text-end fw-bold text-primary">{Number(item.sell_price * item.quantity).toLocaleString('vi-VN')} đ</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="table-light">
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold text-muted pt-3 pb-1 border-bottom-0">Tiền nước:</td>
                                        <td className="text-end fw-bold text-muted pt-3 pb-1 border-bottom-0">{Number(productOnlyTotal).toLocaleString('vi-VN')} đ</td>
                                    </tr>
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold text-warning py-1 border-bottom-0">Tiền cọc vỏ:</td>
                                        <td className="text-end fw-bold text-warning py-1 border-bottom-0">+ {Number(totalDepositModal).toLocaleString('vi-VN')} đ</td>
                                    </tr>
                                    {deliveryFee > 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-end fw-bold text-primary py-1 border-bottom-0">Phí giao hàng:</td>
                                            <td className="text-end fw-bold text-primary py-1 border-bottom-0">+ {Number(deliveryFee).toLocaleString('vi-VN')} đ</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold text-uppercase pt-2 fs-6">Tổng cộng:</td>
                                        <td className="text-end fw-bold text-danger fs-5 pt-2">{Number(finalTotalModal).toLocaleString('vi-VN')} đ</td>
                                    </tr>

                                    {/* 💡 HIỂN THỊ KHÁCH ĐÃ TRẢ & NỢ */}
                                    <tr>
                                        <td colSpan="4" className="text-end fw-bold text-success py-1 border-bottom-0">Khách đã trả:</td>
                                        <td className="text-end fw-bold text-success py-1 border-bottom-0">{Number(paidAmount).toLocaleString('vi-VN')} đ</td>
                                    </tr>
                                    {debtAmount > 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-end fw-bold text-danger py-2 border-bottom-0" style={{ borderTop: "1px dashed #ccc" }}>CÒN NỢ LẠI (BILL NÀY):</td>
                                            <td className="text-end fw-bold text-danger fs-4 py-2 border-bottom-0" style={{ borderTop: "1px dashed #ccc" }}>{Number(debtAmount).toLocaleString('vi-VN')} đ</td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <div className="modal-footer bg-light">
                        <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={onClose}>Đóng</button>
                    </div>
                </div>
            </div>
        </div>
    );
}