import React, { useState, useEffect } from "react";
import api from "../src/utils/axios";

export default function UpdatePaymentModal({ invoice, onClose, onSuccess }) {
    const invoiceId = invoice?.id || invoice?.invoice_id || "";
    const totalAmount = Number(invoice?.total_amount || invoice?.total_payment || invoice?.grandTotal || 0);
    const currentPaid = Number(invoice?.paid_amount || 0);
    
    // 💡 LOGIC MỚI 1: Tính ngay số nợ hiện tại để Kế toán khỏi nhẩm
    const currentDebt = totalAmount - currentPaid;

    // 💡 LOGIC MỚI 2: Mặc định ô nhập sẽ ĐIỀN SẴN số nợ còn lại.
    // Khách trả hết thì Kế toán chỉ việc bấm "Lưu", không cần gõ 1 số nào cả!
    const [addPayment, setAddPayment] = useState(currentDebt);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setAddPayment(totalAmount - currentPaid);
    }, [totalAmount, currentPaid]);

    // 💡 LOGIC MỚI 3: Tự động cộng dồn (Cũ + Mới) để gửi xuống Backend
    const newDebt = currentDebt - Number(addPayment);
    const newTotalPaid = currentPaid + Number(addPayment);

    const handleUpdate = async (e) => {
        e.preventDefault();

        if (addPayment < 0 || addPayment > currentDebt) {
            alert("Số tiền thu thêm không hợp lệ! Không được nhập số âm hoặc lớn hơn số nợ hiện tại.");
            return;
        }

        if (!window.confirm(`Xác nhận KHÁCH TRẢ THÊM: ${Number(addPayment).toLocaleString("vi-VN")} đ?\n(Hệ thống sẽ cập nhật lại nợ cho khách hàng)`)) {
            return;
        }

        try {
            setLoading(true);
            // Gửi cục tiền đã gộp (Cũ + Mới) xuống API để khỏi lỗi Data
            await api.put(`api/invoice/${invoiceId}/update-payment`, {
                actual_paid_amount: newTotalPaid
            });
            onSuccess(); 
            onClose();   
        } catch (err) {
            const msg = err.response?.data?.message || "Cập nhật thất bại";
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!invoice || !invoiceId) return null;

    return (
        <>
            <div className="modal fade show d-block">
                <div className="modal-dialog modal-sm modal-dialog-centered">
                    <div className="modal-content shadow-lg border-0">
                        <div className="modal-header bg-warning">
                            <h5 className="modal-title fw-bold text-dark">
                                <i className="bi bi-wallet2 me-2"></i>Thu Thêm Tiền Nợ
                            </h5>
                            <button className="btn-close" onClick={onClose}></button>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div className="modal-body p-4">
                                <div className="mb-3 text-center">
                                    <span className="text-muted d-block small">Mã Hóa Đơn</span>
                                    <span className="fw-bold fs-4 text-primary">HD{invoiceId}</span>
                                </div>

                                {/* THỐNG KÊ RÕ RÀNG TRÁNH LÚ LẪN */}
                                <div className="d-flex justify-content-between mb-1 small">
                                    <span className="text-secondary">Tổng Bill:</span>
                                    <span className="fw-bold text-dark">{totalAmount.toLocaleString("vi-VN")} đ</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2 small border-bottom pb-2">
                                    <span className="text-success">Đã thu trước đó:</span>
                                    <span className="fw-bold text-success">{currentPaid.toLocaleString("vi-VN")} đ</span>
                                </div>
                                <div className="d-flex justify-content-between mb-3">
                                    <span className="fw-bold text-danger">NỢ HIỆN TẠI:</span>
                                    <span className="fw-bold text-danger fs-5">{currentDebt.toLocaleString("vi-VN")} đ</span>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-bold text-primary">Khách TRẢ THÊM đợt này</label>
                                    <div className="input-group">
                                        <input
                                            type="number"
                                            className="form-control fw-bold fs-5 text-primary"
                                            value={addPayment === 0 ? "" : addPayment}
                                            min="0"
                                            max={currentDebt}
                                            onKeyDown={(e) => {
                                                if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (val === "") {
                                                    setAddPayment(0);
                                                } else {
                                                    let num = Number(val);
                                                    // Ép không cho gõ lố số nợ
                                                    setAddPayment(num < 0 ? 0 : (num > currentDebt ? currentDebt : num));
                                                }
                                            }}
                                            required
                                            autoFocus
                                        />
                                        <span className="input-group-text bg-light fw-bold text-secondary">VNĐ</span>
                                    </div>
                                </div>

                                <div className="bg-light p-3 rounded border border-info border-opacity-50 text-center">
                                    <span className="text-secondary fw-bold d-block small mb-1">Nợ còn lại sau khi thu:</span>
                                    <span className={`fw-bold fs-3 ${newDebt > 0 ? 'text-danger' : 'text-success'}`}>
                                        {newDebt > 0 ? `${newDebt.toLocaleString("vi-VN")} đ` : "0 đ (Đã thu đủ)"}
                                    </span>
                                </div>
                            </div>

                            <div className="modal-footer bg-light">
                                <button type="button" className="btn btn-secondary fw-bold" onClick={onClose}>Hủy</button>
                                <button type="submit" className="btn btn-warning fw-bold text-dark px-4" disabled={loading || addPayment > currentDebt || addPayment < 0}>
                                    {loading ? "Đang xử lý..." : "Chốt thu tiền"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show" onClick={onClose}></div>
        </>
    );
}