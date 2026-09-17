import React from "react";
import { useNavigate } from "react-router-dom";
export default function StockDetailModal({ transaction, onClose }) {
    if (!transaction) return null;
    const navigate = useNavigate();
    const isExport = transaction.type === "export";
    const dateStr = new Date(transaction.created_at).toLocaleString("vi-VN");
    // 💡 THÊM HÀM XỬ LÝ CLICK
    const handleGoToOrder = () => {
        onClose(); // Đóng popup chi tiết kho lại
        navigate("/sales-orders"); // Bay thẳng sang trang Quản lý Đơn Đặt Hàng
    };
    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
                    <div className="modal-header bg-light border-bottom-0">
                        <h5 className="modal-title fw-bold text-dark">
                            <i className="bi bi-info-circle text-primary me-2"></i>Chi tiết giao dịch #{transaction.id}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <table className="table table-borderless mb-0 align-middle">
                            <tbody>
                                <tr>
                                    <td className="text-muted" style={{ width: '130px' }}>Loại thao tác:</td>
                                    <td>
                                        <span className={`badge ${isExport ? 'bg-danger' : 'bg-success'}`}>
                                            {isExport ? 'XUẤT KHO' : 'NHẬP KHO'}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Sản phẩm:</td>
                                    <td className="fw-bold text-primary">{transaction.product_name}</td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Kho thực hiện:</td>
                                    <td><span className="badge bg-secondary">{transaction.warehouse_name || '---'}</span></td>
                                </tr>
                                {transaction.target_warehouse_name && (
                                    <tr>
                                        <td className="text-muted">Đích đến:</td>
                                        <td><span className="badge bg-info text-dark">{transaction.target_warehouse_name}</span></td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="text-muted">Số lượng:</td>
                                    <td className={`fw-bold fs-5 ${isExport ? 'text-danger' : 'text-success'}`}>
                                        {isExport ? '-' : '+'}{transaction.quantity}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Lý do:</td>
                                    <td className="fst-italic">{transaction.reason || '---'}</td>
                                </tr>
                                <tr>
                                    <td className="text-muted">Thời gian:</td>
                                    <td className="text-muted">{dateStr}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 💡 THÔNG TIN ĐƠN ĐẶT HÀNG (Chỉ hiện ra nếu có link với Đơn) */}
                        {transaction.order_code && (
                            <div className="mt-3 pt-3 border-top animate__animated animate__fadeIn">
                                <h6 className="fw-bold text-info mb-2"><i className="bi bi-cart-check-fill me-2"></i>Thông tin Giao Hàng</h6>
                                <div className="bg-light p-3 rounded border border-info border-opacity-25 shadow-sm">
                                    <div className="mb-2">
                                        <span className="text-muted small d-block">Mã Đơn Đặt Hàng: </span>
                                        {/* 💡 THAY THẾ NHÃN BẰNG NÚT BẤM CÓ LINK */}
                                        <button
                                            className="btn btn-primary btn-sm fs-6 fw-bold shadow-sm mt-1"
                                            onClick={handleGoToOrder}
                                            title="Click để đi đến trang Đơn Đặt Hàng"
                                        >
                                            {transaction.order_code} <i className="fa fa-external-link-alt ms-1"></i>
                                        </button>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-muted small d-block">Khách hàng: </span>
                                        <span className="fw-bold text-dark">{transaction.customer_name}</span>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-muted small d-block">Số điện thoại liên hệ: </span>
                                        <span className="fw-bold text-danger">{transaction.customer_phone || '---'}</span>
                                    </div>
                                    <div className="mb-0">
                                        <span className="text-muted small d-block">Địa chỉ giao hàng: </span>
                                        <span className="text-dark fst-italic">{transaction.customer_address || '---'}</span>
                                    </div>
                                    <div className="mt-2">
                                        <span className="text-muted small d-block">Ghi chú: </span>
                                        <span className="text-dark fst-italic">{transaction.note || '---'}</span>
                                    </div>
                                    {/* <div className="mt-2">
                                        <span className="text-muted small d-block">Trạng thái: </span>
                                        <span className="text-dark fst-italic">{transaction.status || '---'}</span>
                                    </div> */}
                                    <div className="mt-2">
                                        <span className="text-muted small d-block">Ngày tạo: </span>
                                        <span className="text-dark fst-italic">{transaction.created_at || '---'}</span>
                                    </div>
                                    <div className="mt-2">
                                        <span className="text-muted small d-block">Sản phẩm: </span>
                                        <span className="text-dark fst-italic">{transaction.product_name || '---'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                    <div className="modal-footer border-top-0 bg-light">
                        <button className="btn btn-secondary fw-bold px-4 shadow-sm" onClick={onClose}>Đóng lại</button>
                    </div>
                </div>
            </div>
        </div>
    );
}