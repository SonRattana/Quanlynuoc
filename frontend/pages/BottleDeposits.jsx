import React, { useState, useEffect } from 'react';
import api from 'axios';
import Layout from '../components/layout';

export default function BottleDeposits() {
    const [summary, setSummary] = useState([]);
    const [toast, setToast] = useState(null);
    const token = localStorage.getItem("token");

    // State cho form Trả vỏ
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnForm, setReturnForm] = useState({ customer_id: null, customer_name: '', max_bottles: 0, return_qty: 0, deposit_price: 50000 });
    const [searchTerm, setSearchTerm] = useState("");
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyCustomerName, setHistoryCustomerName] = useState("");
    const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");

    // Hàm lấy danh sách tổng hợp nợ vỏ
    const fetchSummary = async () => {
        try {
            const res = await api.get('api/bottle-deposits/summary', { headers: { Authorization: `Bearer ${token}` } });
            setSummary(res.data);
        } catch (error) {
            setToast({ message: "Chưa kết nối được API Backend!", type: "warning" });
        }
    };
    // 💡 Lọc danh sách theo từ khóa tìm kiếm
    const filteredSummary = summary.filter(row => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (row.customer_name && row.customer_name.toLowerCase().includes(searchLower)) ||
            (row.customer_phone && row.customer_phone.includes(searchLower))
        );
    });

    useEffect(() => {
        fetchSummary();
    }, []);

    // 💡 Xử lý mở form Trả vỏ (ĐÃ FIX TÍNH TIỀN CHUẨN XÁC)
    const handleOpenReturn = (customer) => {
        let calculatedPrice = 0;
        if (customer.total_bottles_kept > 0) {
            calculatedPrice = customer.total_deposit_kept / customer.total_bottles_kept;
        }

        setReturnForm({
            customer_id: customer.customer_id || null,
            invoice_id: customer.invoice_id || null,
            product_id: customer.product_id || null, // Lấy ID vỏ
            product_name: customer.product_name,     // Lấy Tên vỏ
            customer_name: customer.customer_name,
            max_bottles: customer.total_bottles_kept,
            return_qty: customer.total_bottles_kept,
            deposit_price: calculatedPrice
        });
        setShowReturnModal(true);
    };

    // 💡 Hàm mở Lịch sử giao dịch
    const handleOpenHistory = async (customer) => {
        try {
            const res = await api.get(`api/bottle-deposits/history?customer_id=${customer.customer_id}&invoice_id=${customer.invoice_id}`, { headers: { Authorization: `Bearer ${token}` } });
            setHistoryData(res.data);
            setHistoryCustomerName(customer.customer_name);
            setShowHistoryModal(true);
        } catch (error) {
            setToast({ message: "Lỗi tải lịch sử!", type: "danger" });
        }
    };

    const handleSubmitReturn = async (e) => {
        e.preventDefault();
        if (returnForm.return_qty <= 0 || returnForm.return_qty > returnForm.max_bottles) {
            return setToast({ message: "Số vỏ trả không hợp lệ!", type: "warning" });
        }

        try {
            const res = await api.post('api/bottle-deposits/return', returnForm, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: res.data.message, type: "success" });
            setShowReturnModal(false);
            fetchSummary(); // Load lại danh sách
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi xử lý trả vỏ", type: "danger" });
        }
    };

    return (
        <Layout>
            <div className="container-fluid p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-primary mb-0">
                        <i className="fa fa-retweet me-2"></i>Quản Lý Vỏ Bình & Tiền Cọc
                    </h4>
                    <div className="input-group" style={{ maxWidth: '350px' }}>
                        <span className="input-group-text bg-white border-end-0"><i className="fa fa-search text-muted"></i></span>
                        <input
                            type="text"
                            className="form-control border-start-0 ps-0 shadow-none"
                            placeholder="Tìm tên hoặc SĐT khách hàng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {toast && (
                    <div className={`alert alert-${toast.type} alert-dismissible fade show shadow-sm`} role="alert">
                        <strong>{toast.type === 'success' ? 'Thành công!' : 'Thông báo:'}</strong> {toast.message}
                        <button type="button" className="btn-close" onClick={() => setToast(null)}></button>
                    </div>
                )}

                {/* BẢNG TỔNG HỢP KHÁCH NỢ VỎ */}
                <div className="card border-0 shadow-sm rounded-3">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle text-center mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="text-start ps-4">Thông tin Khách</th>
                                        <th className="text-start">Loại Sản Phẩm (Vỏ)</th>
                                        <th className="text-danger">Số lượng nợ</th>
                                        <th className="text-success">Tổng cọc đang giữ</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSummary.length === 0 ? (
                                        <tr><td colSpan="5" className="text-muted py-4">Không có khách hàng nào nợ vỏ.</td></tr>
                                    ) : (
                                        filteredSummary.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="text-start ps-4">
                                                    <div className="fw-bold text-dark">{row.customer_name}</div>
                                                    <div className="small text-muted">{row.customer_phone || 'Không có SĐT'}</div>
                                                </td>
                                                <td className="text-start fw-bold text-primary">{row.product_name}</td>
                                                <td className="fw-bold text-danger fs-5">{row.total_bottles_kept} <span className="fs-6 text-muted">vỏ</span></td>
                                                <td className="fw-bold text-success fs-6">{formatMoney(row.total_deposit_kept)} đ</td>
                                                <td>
                                                    {/* 💡 Đã BAY MÀU nút Lịch sử, chỉ giữ lại duy nhất nút Trả vỏ */}
                                                    <button className="btn btn-warning text-dark fw-bold shadow-sm px-3" title="Khách trả vỏ" onClick={() => handleOpenReturn(row)}>
                                                        <i className="fa fa-exchange-alt me-1"></i> Nhận Vỏ
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* MODAL TRẢ VỎ - HOÀN TIỀN */}
                {showReturnModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>
                                <div className="modal-header text-dark" style={{ backgroundColor: '#ffc107' }}>
                                    <h5 className="modal-title fw-bold"><i className="fa fa-exchange-alt me-2"></i>Khách Trả Vỏ & Hoàn Cọc</h5>
                                    <button className="btn-close" onClick={() => setShowReturnModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <h6 className="fw-bold text-primary mb-3">Khách hàng: {returnForm.customer_name}</h6>
                                    <div className="alert alert-danger fw-bold text-center">
                                        Đang nợ: {returnForm.max_bottles} vỏ [{returnForm.product_name}]
                                    </div>
                                    <div className="mb-3">
                                        <label className="fw-bold small mb-1">Số lượng vỏ khách đem trả:</label>
                                        <input type="number" className="form-control form-control-lg fw-bold text-center text-primary"
                                            min="1" max={returnForm.max_bottles} value={returnForm.return_qty}
                                            onChange={(e) => setReturnForm({ ...returnForm, return_qty: Number(e.target.value) })} />
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center fw-bold fs-5 p-3 bg-light rounded border border-success">
                                        <span>Kế toán trả lại tiền:</span>
                                        <span className="text-success">{formatMoney(returnForm.return_qty * returnForm.deposit_price)} đ</span>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light">
                                    <button className="btn btn-secondary fw-bold" onClick={() => setShowReturnModal(false)}>Hủy</button>
                                    <button className="btn btn-warning text-dark fw-bold shadow-sm" onClick={handleSubmitReturn}>
                                        <i className="fa fa-check me-2"></i>Xác nhận thu vỏ & Hoàn tiền
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL LỊCH SỬ GIAO DỊCH VỎ */}
            {showHistoryModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>
                            <div className="modal-header text-white" style={{ backgroundColor: '#17a2b8' }}>
                                <h5 className="modal-title fw-bold"><i className="fa fa-history me-2"></i>Lịch sử Vỏ Bình - {historyCustomerName}</h5>
                                <button className="btn-close btn-close-white" onClick={() => setShowHistoryModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="table-responsive">
                                    <table className="table table-hover text-center align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Thời gian</th>
                                                <th>Loại GD</th>
                                                <th>Số lượng vỏ</th>
                                                <th>Số tiền cọc</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.length === 0 ? (
                                                <tr><td colSpan="4" className="text-muted py-3">Chưa có lịch sử giao dịch.</td></tr>
                                            ) : (
                                                historyData.map((h, i) => (
                                                    <tr key={i}>
                                                        <td className="text-muted fw-bold">{new Date(h.created_at).toLocaleString('vi-VN')}</td>
                                                        <td>
                                                            {h.type === 'deposit' ? <span className="badge bg-danger"><i className="fa fa-arrow-down me-1"></i>Đưa vỏ (Thu cọc)</span>
                                                                : <span className="badge bg-success"><i className="fa fa-arrow-up me-1"></i>Trả vỏ (Hoàn tiền)</span>}
                                                        </td>
                                                        <td className="fw-bold fs-5">{h.quantity}</td>
                                                        <td className={`fw-bold ${h.type === 'deposit' ? 'text-danger' : 'text-success'}`}>{formatMoney(h.deposit_amount)} đ</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}