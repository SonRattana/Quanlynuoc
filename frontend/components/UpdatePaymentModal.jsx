import React, { useState, useEffect } from "react";
import api from "../src/utils/axios";

export default function UpdatePaymentModal({ invoice, onClose, onSuccess }) {
    // 💡 BẮT LỖI THÔNG MINH: Tự dò tìm đúng tên trường dữ liệu từ cha truyền xuống
    const invoiceId = invoice?.id || invoice?.invoice_id || "";
    const totalAmount = Number(invoice?.total_amount || invoice?.total_payment || invoice?.grandTotal || 0);
    const currentPaid = Number(invoice?.paid_amount || 0);

    const [actualPaid, setActualPaid] = useState(currentPaid);
    const [loading, setLoading] = useState(false);

    // Cập nhật actualPaid nếu invoice thay đổi
    useEffect(() => {
        setActualPaid(currentPaid);
    }, [currentPaid]);

    // Tính toán số nợ mới
    const newDebt = totalAmount - Number(actualPaid);

    const handleUpdate = async (e) => {
        e.preventDefault();

        if (actualPaid < 0 || actualPaid > totalAmount) {
            alert("Số tiền không hợp lệ! Không được nhập số âm hoặc lớn hơn Tổng Bill.");
            return;
        }

        if (!window.confirm(`Xác nhận khách thực đưa: ${Number(actualPaid).toLocaleString("vi-VN")} đ?\n(Hệ thống sẽ cập nhật lại nợ cho khách hàng)`)) {
            return;
        }

        try {
            setLoading(true);
            await api.put(`api/invoice/${invoiceId}/update-payment`, {
                actual_paid_amount: actualPaid
            });
            onSuccess(); // Báo cho cha biết để F5 lại bảng
            onClose();   // Đóng Modal
        } catch (err) {
            const msg = err.response?.data?.message || "Cập nhật thất bại";
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!invoice || !invoiceId) return null; // Nếu không có data thì không render gì cả

    return (
        <>
            <div className="modal fade show d-block">
                <div className="modal-dialog modal-sm modal-dialog-centered">
                    <div className="modal-content shadow-lg border-0">
                        <div className="modal-header bg-warning">
                            <h5 className="modal-title fw-bold text-dark">
                                <i className="bi bi-pencil-square me-2"></i>Sửa Tiền Nợ
                            </h5>
                            <button className="btn-close" onClick={onClose}></button>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div className="modal-body p-4">
                                <div className="mb-3 text-center">
                                    <span className="text-muted d-block small">Mã Hóa Đơn</span>
                                    <span className="fw-bold fs-4 text-primary">HD{invoiceId}</span>
                                </div>

                                <div className="d-flex justify-content-between mb-2">
                                    <span className="fw-bold text-secondary">Tổng Bill:</span>
                                    <span className="fw-bold text-dark fs-5">{totalAmount.toLocaleString("vi-VN")} đ</span>
                                </div>

                                <hr className="text-muted" />

                                <div className="mb-3">
                                    <label className="form-label fw-bold text-primary">Khách thực tế đưa (*)</label>
                                    <div className="input-group">
                                        <input
                                            type="number"
                                            className="form-control fw-bold fs-5 text-primary"
                                            value={actualPaid === 0 ? "" : actualPaid}
                                            min="0"
                                            max={totalAmount}
                                            // 💡 1. BẮT SỰ KIỆN GÕ PHÍM: Chặn ngay dấu trừ, cộng, và chữ 'e'
                                            onKeyDown={(e) => {
                                                if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                                    e.preventDefault();
                                                }
                                            }}
                                            // 💡 2. KIỂM TRA LẠI LẦN NỮA: Chống copy/paste số âm
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (val === "") {
                                                    setActualPaid(0);
                                                } else {
                                                    let num = Number(val);
                                                    setActualPaid(num < 0 ? 0 : num); // Nếu âm thì ép về 0
                                                }
                                            }}
                                            required
                                            autoFocus
                                        />
                                        <span className="input-group-text bg-light fw-bold text-secondary">VNĐ</span>
                                    </div>
                                </div>

                                <div className="bg-light p-3 rounded border border-danger border-opacity-25 text-center">
                                    <span className="text-danger fw-bold d-block small mb-1">Công nợ sẽ ghi nhận vào sổ:</span>
                                    <span className="text-danger fw-bold fs-3">
                                        {newDebt > 0 ? `${newDebt.toLocaleString("vi-VN")} đ` : "0 đ"}
                                    </span>
                                </div>
                            </div>

                            <div className="modal-footer bg-light">
                                <button type="button" className="btn btn-secondary fw-bold" onClick={onClose}>Hủy</button>
                                <button type="submit" className="btn btn-warning fw-bold text-dark px-4" disabled={loading || actualPaid > totalAmount || actualPaid < 0}>
                                    {loading ? "Đang xử lý..." : "Lưu thay đổi"}
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