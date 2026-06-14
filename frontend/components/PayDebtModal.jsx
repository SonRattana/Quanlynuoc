import React, { useState } from "react";
import api from "../src/utils/axios";

export default function PayDebtModal({ customer, onClose, onSuccess }) {
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const currentDebt = Number(customer?.debt_balance) || 0;

    const handlePayDebt = async () => {
        if (!amount || Number(amount) <= 0) {
            return setError("Vui lòng nhập số tiền hợp lệ!");
        }
        if (Number(amount) > currentDebt) {
            return setError("Số tiền trả không được lớn hơn số tiền đang nợ!");
        }

        setLoading(true);
        setError("");
        try {
            await api.post("/api/customers/pay-debt", {
                customer_id: customer.id,
                amount: Number(amount),
                note: note
            });
            onSuccess(); // Load lại danh sách khách hàng
            onClose(); // Đóng Modal
        } catch (err) {
            setError(err.response?.data?.message || "Lỗi khi thu nợ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow-lg border-0">
                    <div className="modal-header bg-success text-white">
                        <h5 className="modal-title fw-bold"><i className="bi bi-cash-coin me-2"></i>Thu Nợ Khách Hàng</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    
                    <div className="modal-body p-4">
                        <div className="alert alert-warning border-warning border-start border-4">
                            <div className="d-flex justify-content-between">
                                <span className="fw-bold text-dark">Khách hàng:</span>
                                <span className="fw-bold text-primary">{customer?.name}</span>
                            </div>
                            <div className="d-flex justify-content-between mt-2">
                                <span className="fw-bold text-dark">Đang nợ:</span>
                                <span className="fw-bold text-danger fs-5">
                                    {currentDebt.toLocaleString('vi-VN')} đ
                                </span>
                            </div>
                        </div>

                        {error && <div className="alert alert-danger py-2">{error}</div>}

                        <div className="mb-3">
                            <label className="form-label fw-bold text-secondary">Số tiền khách trả (VNĐ)</label>
                            <div className="input-group">
                                <input 
                                    type="number" 
                                    className="form-control form-control-lg fw-bold text-success" 
                                    placeholder="Nhập số tiền..."
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <button 
                                    className="btn btn-outline-secondary fw-bold" 
                                    type="button"
                                    onClick={() => setAmount(currentDebt)} // Nút bấm nhanh "Trả tất cả"
                                >
                                    Trả tất cả
                                </button>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-bold text-secondary">Ghi chú (Tùy chọn)</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="VD: Khách chuyển khoản Techcombank..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="modal-footer bg-light">
                        <button type="button" className="btn btn-secondary fw-bold px-4" onClick={onClose}>Hủy</button>
                        <button 
                            type="button" 
                            className="btn btn-success fw-bold px-4" 
                            onClick={handlePayDebt}
                            disabled={loading || !amount}
                        >
                            {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-circle-fill me-2"></i>}
                            Xác nhận Thu Nợ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}