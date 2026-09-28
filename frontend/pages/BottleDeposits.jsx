import React, { useState, useEffect } from 'react';
import api from 'axios';
import Layout from '../components/layout';

export default function BottleDeposits() {
    const [summary, setSummary] = useState([]);
    const [toast, setToast] = useState(null);
    const token = localStorage.getItem("token");

    const [showReturnModal, setShowReturnModal] = useState(false);
    // 💡 ĐÃ FIX: Thêm trường note: '' vào Form
    const [returnForm, setReturnForm] = useState({ customer_id: null, customer_name: '', max_bottles: 0, return_qty: 0, lost_qty: 0, deposit_price: 50000, note: '' });
    const [searchTerm, setSearchTerm] = useState("");
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyCustomerName, setHistoryCustomerName] = useState("");
    const formatMoney = (value) => Number(value || 0).toLocaleString("vi-VN");

    const fetchSummary = async () => {
        try {
            const res = await api.get('api/bottle-deposits/summary', { headers: { Authorization: `Bearer ${token}` } });
            setSummary(res.data);
        } catch (error) {
            setToast({ message: "Chưa kết nối được API Backend!", type: "warning" });
        }
    };

    const filteredSummary = summary.filter(row => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (row.customer_name && row.customer_name.toLowerCase().includes(searchLower)) ||
            (row.customer_phone && row.customer_phone.includes(searchLower))
        );
    });

    const totalBottlesOut = summary.reduce((sum, item) => sum + Number(item.total_bottles_kept), 0);
    const totalDepositHeld = summary.reduce((sum, item) => sum + Number(item.total_deposit_kept), 0);
    const totalCustomers = new Set(summary.map(s => s.customer_name)).size;

    useEffect(() => { fetchSummary(); }, []);

    const handleOpenReturn = (customer) => {
        let calculatedPrice = 0;
        if (customer.total_bottles_kept > 0) calculatedPrice = customer.total_deposit_kept / customer.total_bottles_kept;
        setReturnForm({
            customer_id: customer.customer_id || null, invoice_id: customer.invoice_id || null,
            product_id: customer.product_id || null, product_name: customer.product_name,
            customer_name: customer.customer_name, max_bottles: customer.total_bottles_kept,
            return_qty: customer.total_bottles_kept, lost_qty: 0, deposit_price: calculatedPrice,
            note: ''
        });
        setShowReturnModal(true);
    };

    const handleSubmitReturn = async (e) => {
        e.preventDefault();
        const totalInput = returnForm.return_qty + returnForm.lost_qty;
        if (totalInput <= 0 || totalInput > returnForm.max_bottles) return setToast({ message: "Tổng số vỏ xử lý không hợp lệ!", type: "warning" });
        try {
            const res = await api.post('api/bottle-deposits/return', returnForm, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: res.data.message, type: "success" });
            setShowReturnModal(false);
            fetchSummary();
        } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi xử lý trả vỏ", type: "danger" }); }
    };

    return (
        <Layout>
            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <div className="container-fluid py-4 px-2 px-md-4">

                {/* Header Tối ưu cho Mobile */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 mb-md-4 gap-3">
                    <h4 className="fw-bold mb-0 text-center text-md-start" style={{ color: '#00838f' }}>
                        <i className="fa fa-sync-alt me-2"></i>Quản Lý Vỏ Bình
                    </h4>
                    <div className="input-group shadow-sm w-100" style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <span className="input-group-text bg-white border-0"><i className="fa fa-search text-muted"></i></span>
                        <input type="text" className="form-control border-0 bg-white shadow-none" placeholder="Tìm khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {toast && (
                    <div className={`alert alert-${toast.type} alert-dismissible fade show shadow-sm border-0 rounded-3 fw-bold`} role="alert">
                        {toast.message}
                        <button type="button" className="btn-close" onClick={() => setToast(null)}></button>
                    </div>
                )}

                {/* Widget Thống kê dạng trượt trên Mobile */}
                <div className="row g-2 g-md-3 mb-4 flex-md-wrap overflow-auto pb-2 hide-scroll" style={{ scrollSnapType: 'x mandatory' }}>
                    <div className="col-10 col-md-4" style={{ scrollSnapAlign: 'start' }}>
                        <div className="card border-0 shadow-sm rounded-4 text-white h-100" style={{ background: 'linear-gradient(135deg, #0288d1, #26c6da)' }}>
                            <div className="card-body p-3 p-md-4 d-flex align-items-center">
                                <div className="rounded-circle bg-white bg-opacity-25 p-2 p-md-3 me-3 d-flex justify-content-center align-items-center" style={{ width: '50px', height: '50px' }}><i className="fa fa-users fs-4"></i></div>
                                <div><p className="mb-0 text-white-50 fw-bold text-uppercase" style={{ fontSize: '11px' }}>Khách Nợ</p><h4 className="mb-0 fw-bold">{totalCustomers}</h4></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-10 col-md-4" style={{ scrollSnapAlign: 'start' }}>
                        <div className="card border-0 shadow-sm rounded-4 text-white h-100" style={{ background: 'linear-gradient(135deg, #e53935, #ff8a65)' }}>
                            <div className="card-body p-3 p-md-4 d-flex align-items-center">
                                <div className="rounded-circle bg-white bg-opacity-25 p-2 p-md-3 me-3 d-flex justify-content-center align-items-center" style={{ width: '50px', height: '50px' }}><i className="fa fa-prescription-bottle fs-4"></i></div>
                                <div><p className="mb-0 text-white-50 fw-bold text-uppercase" style={{ fontSize: '11px' }}>Vỏ Lưu Lạc</p><h4 className="mb-0 fw-bold">{totalBottlesOut}</h4></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-10 col-md-4" style={{ scrollSnapAlign: 'start' }}>
                        <div className="card border-0 shadow-sm rounded-4 text-white h-100" style={{ background: 'linear-gradient(135deg, #43a047, #81c784)' }}>
                            <div className="card-body p-3 p-md-4 d-flex align-items-center">
                                <div className="rounded-circle bg-white bg-opacity-25 p-2 p-md-3 me-3 d-flex justify-content-center align-items-center" style={{ width: '50px', height: '50px' }}><i className="fa fa-piggy-bank fs-4"></i></div>
                                <div><p className="mb-0 text-white-50 fw-bold text-uppercase" style={{ fontSize: '11px' }}>Cọc Đang Giữ</p><h4 className="mb-0 fw-bold">{formatMoney(totalDepositHeld)} đ</h4></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 💻 GIAO DIỆN MÁY TÍNH (Ẩn trên ĐT) */}
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden d-none d-lg-block">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 text-center">
                            <thead className="table-light text-secondary">
                                <tr>
                                    <th className="py-3 ps-4 text-start">Khách hàng</th>
                                    <th className="text-start">Sản Phẩm (Vỏ)</th>
                                    <th>Đang nợ</th>
                                    <th>Cọc đang giữ</th>
                                    <th className="pe-4 text-end">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSummary.length === 0 ? <tr><td colSpan="5" className="text-muted py-5">Trống!</td></tr> :
                                    filteredSummary.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-start ps-4 py-3"><div className="fw-bold text-dark">{row.customer_name}</div><div className="small text-muted"><i className="fa fa-phone-alt me-1" style={{ fontSize: '10px' }}></i>{row.customer_phone || '---'}</div></td>
                                            <td className="text-start fw-bold" style={{ color: '#00838f' }}>{row.product_name}</td>
                                            <td><span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-3 py-2 rounded-pill">{row.total_bottles_kept} vỏ</span></td>
                                            <td className="fw-bold text-success fs-6">{formatMoney(row.total_deposit_kept)} đ</td>
                                            <td className="pe-4 text-end"><button className="btn btn-warning text-dark fw-bold shadow-sm px-4 rounded-3" onClick={() => handleOpenReturn(row)}><i className="fa fa-exchange-alt me-2"></i> Trả Vỏ</button></td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 📱 GIAO DIỆN ĐIỆN THOẠI APP-STYLE (Ẩn trên Máy tính) */}
                <div className="d-block d-lg-none">
                    {filteredSummary.length === 0 ? (
                        <div className="text-center p-5 text-muted bg-white rounded-4 shadow-sm"><i className="fa fa-box-open fs-1 d-block mb-3 opacity-25"></i>Kho vỏ trống.</div>
                    ) : (
                        filteredSummary.map((row, idx) => (
                            <div className="card shadow-sm border-0 mb-3 rounded-4" key={idx}>
                                <div className="card-body p-3">
                                    <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
                                        <div>
                                            <div className="fw-bold fs-5 text-dark">{row.customer_name}</div>
                                            <div className="small text-muted"><i className="fa fa-phone-alt me-1"></i>{row.customer_phone || 'Không có SĐT'}</div>
                                        </div>
                                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-2 py-1 rounded-3">
                                            Nợ {row.total_bottles_kept} vỏ
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <span className="small text-muted d-block mb-1">Loại vỏ:</span>
                                        <div className="fw-bold" style={{ color: '#00838f', fontSize: '15px' }}>{row.product_name}</div>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded-3 mb-3 border">
                                        <span className="small text-muted fw-bold">Cọc đang giữ:</span>
                                        <span className="fw-bold text-success fs-6">{formatMoney(row.total_deposit_kept)} đ</span>
                                    </div>
                                    <button className="btn btn-warning text-dark fw-bold w-100 rounded-3 shadow-sm py-2" onClick={() => handleOpenReturn(row)}>
                                        <i className="fa fa-exchange-alt me-2"></i> Trả Vỏ & Hoàn Tiền
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* MODAL TRẢ VỎ */}
                {showReturnModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable m-2 m-md-auto">
                            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                                <div className="modal-header border-0 p-3 p-md-4" style={{ backgroundColor: '#ffc107', color: '#000' }}>
                                    <h5 className="modal-title fw-bold fs-5"><i className="fa fa-people-carry me-2"></i>Nhận Vỏ & Hoàn Tiền</h5>
                                    <button className="btn-close" onClick={() => setShowReturnModal(false)}></button>
                                </div>
                                <div className="modal-body p-3 p-md-4 bg-light">
                                    <div className="text-center mb-3">
                                        <h6 className="text-muted text-uppercase small fw-bold mb-1">Khách hàng</h6>
                                        <h5 className="fw-bold text-dark">{returnForm.customer_name}</h5>
                                    </div>

                                    <div className="alert alert-danger bg-danger bg-opacity-10 border border-danger fw-bold text-center rounded-3 mb-3 p-2">
                                        Đang nợ: {returnForm.max_bottles} vỏ [{returnForm.product_name}]
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <div className="bg-white p-3 rounded-4 shadow-sm border h-100 text-center border-success border-bottom border-3">
                                                <label className="fw-bold text-success mb-2 d-block text-uppercase" style={{ fontSize: '11px' }}>Số vỏ Nguyên Vẹn</label>
                                                <div className="input-group input-group-sm w-100 mx-auto">
                                                    <button className="btn btn-outline-success" onClick={() => setReturnForm({ ...returnForm, return_qty: Math.max(0, returnForm.return_qty - 1) })}><i className="fa fa-minus"></i></button>
                                                    <input type="number" className="form-control fw-bold text-center text-success fs-5 px-1" min="0" max={returnForm.max_bottles - returnForm.lost_qty} value={returnForm.return_qty} onChange={(e) => setReturnForm({ ...returnForm, return_qty: Number(e.target.value) })} />
                                                    <button className="btn btn-outline-success" onClick={() => setReturnForm({ ...returnForm, return_qty: Math.min(returnForm.max_bottles - returnForm.lost_qty, returnForm.return_qty + 1) })}><i className="fa fa-plus"></i></button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="bg-white p-3 rounded-4 shadow-sm border h-100 text-center border-danger border-bottom border-3">
                                                <label className="fw-bold text-danger mb-2 d-block text-uppercase" style={{ fontSize: '11px' }}>Số vỏ Báo Mất</label>
                                                <div className="input-group input-group-sm w-100 mx-auto">
                                                    <button className="btn btn-outline-danger" onClick={() => setReturnForm({ ...returnForm, lost_qty: Math.max(0, returnForm.lost_qty - 1) })}><i className="fa fa-minus"></i></button>
                                                    <input type="number" className="form-control fw-bold text-center text-danger fs-5 px-1" min="0" max={returnForm.max_bottles - returnForm.return_qty} value={returnForm.lost_qty} onChange={(e) => setReturnForm({ ...returnForm, lost_qty: Number(e.target.value) })} />
                                                    <button className="btn btn-outline-danger" onClick={() => setReturnForm({ ...returnForm, lost_qty: Math.min(returnForm.max_bottles - returnForm.return_qty, returnForm.lost_qty + 1) })}><i className="fa fa-plus"></i></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* 💡 ĐÃ FIX: Khu vực nhập Ghi chú Tình trạng vỏ */}
                                    <div className="bg-white p-3 rounded-4 shadow-sm border mb-3 text-start">
                                        <label className="fw-bold text-secondary mb-2 small text-uppercase"><i className="fa fa-info-circle me-1"></i>Tình trạng vỏ / Khấu hao</label>
                                        <input
                                            type="text"
                                            className="form-control bg-light"
                                            placeholder="Bỏ trống nếu bình thường. VD: Vỏ nứt, quá cũ..."
                                            value={returnForm.note}
                                            onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                                        />
                                    </div>

                                    <div className="d-flex flex-column text-center fw-bold fs-5 p-3 rounded-3" style={{ backgroundColor: '#e8f5e9', border: '2px dashed #4caf50' }}>
                                        <span className="text-dark fs-6 mb-1">Hoàn lại tiền mặt:</span>
                                        <span className="text-success fs-3">{formatMoney(returnForm.return_qty * returnForm.deposit_price)} đ</span>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-3 bg-white d-flex gap-2">
                                    <button className="btn btn-light border py-2 fw-bold shadow-sm flex-fill" onClick={() => setShowReturnModal(false)}>Hủy</button>
                                    <button className="btn btn-warning py-2 fw-bold shadow-sm fs-5 flex-fill" style={{ flex: 2 }} onClick={handleSubmitReturn}>XÁC NHẬN</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}