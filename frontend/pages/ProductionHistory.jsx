import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import { useNavigate } from "react-router-dom";

export default function ProductionHistory() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];

    const [toast, setToast] = useState(null);
    const [history, setHistory] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [details, setDetails] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // 💡 STATE CHO TAB VÀ BÁO CÁO HAO HỤT
    const [activeTab, setActiveTab] = useState("history");
    const [wastageData, setWastageData] = useState([]);
    const [loadingWastage, setLoadingWastage] = useState(false);

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [searchShift, setSearchShift] = useState("");
    // ==========================================
    // 💡 HÀM CHỌN NGÀY NHANH (BÊ TỪ REPORTS SANG)
    // ==========================================
    const setQuickDate = (type) => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth();

        const toDateString = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        if (type === 'today') {
            const dStr = toDateString(d);
            setStartDate(dStr); setEndDate(dStr);
        } else if (type === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(d.getFullYear(), d.getMonth(), diff);
            const end = new Date(d.getFullYear(), d.getMonth(), diff + 6);
            setStartDate(toDateString(start));
            setEndDate(toDateString(end));
        } else if (type === 'month') {
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);
            setStartDate(toDateString(start));
            setEndDate(toDateString(end));
        } else if (type === 'year') {
            setStartDate(`${year}-01-01`);
            setEndDate(`${year}-12-31`);
        } else {
            setStartDate(""); setEndDate("");
        }
    };
    const token = localStorage.getItem("token");

    // ==========================================
    // 1. TẢI DỮ LIỆU LỊCH SỬ SẢN XUẤT
    // ==========================================
    const fetchHistory = async () => {
        try {
            const res = await api.get("api/production/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Lỗi tải lịch sử:", err);
            setToast({ message: "Không thể tải dữ liệu lịch sử sản xuất", type: "danger" });
        }
    };

    // ==========================================
    // 2. TẢI DỮ LIỆU BÁO CÁO HAO HỤT (GỌI API THẬT)
    // ==========================================
    const fetchWastageReport = async () => {
        setLoadingWastage(true);
        try {
            const res = await api.get(`api/production/wastage-report?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWastageData(res.data);
        } catch (err) {
            console.error("Lỗi API hao hụt:", err);
            setToast({ message: "Không thể tải dữ liệu hao hụt. Hãy kiểm tra lại Backend!", type: "danger" });
            setWastageData([]); // Xóa trắng bảng nếu API lỗi
        } finally {
            setLoadingWastage(false);
        }
    };

    useEffect(() => {
        if (activeTab === "history") {
            fetchHistory();
        } else {
            fetchWastageReport();
        }
    }, [activeTab, startDate, endDate]);

    const handleViewDetails = async (order) => {
        setSelectedOrder(order);
        setLoadingDetails(true);
        try {
            const res = await api.get(`api/production/history/${order.id}/details`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDetails(res.data);
        } catch (err) {
            setToast({ message: "Không tải được chi tiết vật tư", type: "danger" });
        } finally {
            setLoadingDetails(false);
        }
    };

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);
    const formatDate = (dateString) => {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN");
    };

    const filteredHistory = history.filter(item => {
        const itemDateObj = new Date(item.created_at);
        const itemDate = new Date(itemDateObj.getTime() - (itemDateObj.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
        const isDateValid = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        const isShiftValid = !searchShift ||
            (item.note && item.note.toLowerCase().includes(searchShift.toLowerCase())) ||
            (item.product_name && item.product_name.toLowerCase().includes(searchShift.toLowerCase()));
        return isDateValid && isShiftValid;
    });

    const productionStats = filteredHistory.reduce((acc, curr) => {
        if (!acc[curr.product_name]) acc[curr.product_name] = 0;
        acc[curr.product_name] += Number(curr.quantity);
        return acc;
    }, {});

    // Tính tổng tiền thất thoát
    const totalWastageCost = wastageData.reduce((sum, item) => sum + Number(item.wastage_cost), 0);

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="container-fluid py-4 px-2 px-md-4">

                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                    <h4 className="fw-bold text-success mb-0 text-center text-md-start">
                        <i className="bi bi-clock-history me-2"></i>Sản Xuất & Báo Cáo
                    </h4>
                </div>

                {/* ================= BỘ LỌC NGÀY THÁNG DÙNG CHUNG ================= */}
                <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border mb-4">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-3">
                            <label className="form-label small fw-bold text-secondary">Từ ngày:</label>
                            {/* 💡 ĐÃ FIX: Thêm icon lịch và hiệu ứng click bung lịch cho ô Từ ngày */}
                            <div className="input-group shadow-sm">
                                <span
                                    className="input-group-text bg-white text-success"
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        const input = e.currentTarget.nextElementSibling;
                                        if (input && input.showPicker) input.showPicker();
                                    }}
                                    title="Chọn ngày"
                                >
                                    <i className="bi bi-calendar-event"></i>
                                </span>
                                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ cursor: 'pointer' }} />
                            </div>
                        </div>
                        <div className="col-12 col-md-3">
                            <label className="form-label small fw-bold text-secondary">Đến ngày:</label>
                            {/* 💡 ĐÃ FIX: Thêm icon lịch và hiệu ứng click bung lịch cho ô Đến ngày */}
                            <div className="input-group shadow-sm">
                                <span
                                    className="input-group-text bg-white text-success"
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        const input = e.currentTarget.nextElementSibling;
                                        if (input && input.showPicker) input.showPicker();
                                    }}
                                    title="Chọn ngày"
                                >
                                    <i className="bi bi-calendar-check"></i>
                                </span>
                                <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ cursor: 'pointer' }} />
                            </div>
                        </div>
                        <div className="col-12 col-md-4">
                            <label className="form-label small fw-bold text-secondary">Tìm theo Ca / Ghi chú / Tên sản phẩm:</label>
                            <input type="text" className="form-control shadow-sm" placeholder="VD: Ca 1, rách màng..." value={searchShift} onChange={(e) => setSearchShift(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-2">
                            <button className="btn btn-outline-secondary w-100 fw-bold shadow-sm" onClick={() => { setStartDate(""); setEndDate(""); setSearchShift(""); }}>
                                <i className="bi bi-arrow-clockwise me-1"></i> Xóa lọc
                            </button>
                        </div>
                    </div>
                    {/* 💡 ĐÃ FIX: Thêm hàng nút chọn mốc thời gian siêu tốc */}
                    <div className="mt-3 pt-3 border-top d-flex flex-wrap gap-2 align-items-center">
                        <span className="small fw-bold text-muted me-2">
                            <i className="bi bi-lightning-charge-fill text-warning me-1"></i>Mốc thời gian:
                        </span>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={() => setQuickDate('today')}>Hôm nay</button>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={() => setQuickDate('week')}>Tuần này</button>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={() => setQuickDate('month')}>Tháng này</button>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={() => setQuickDate('year')}>Năm nay</button>
                    </div>
                </div>

                {/* ================= MENU TABS ĐIỀU HƯỚNG ================= */}
                <ul className="nav nav-tabs border-bottom-0 mb-3" style={{ borderBottom: "2px solid #dee2e6" }}>
                    <li className="nav-item">
                        <button
                            className={`nav-link fw-bold border-0 border-bottom border-3 ${activeTab === "history" ? "active border-success text-success" : "border-transparent text-muted bg-transparent"}`}
                            onClick={() => setActiveTab("history")}
                            style={{ borderRadius: 0, borderBottomColor: activeTab === "history" ? "#198754" : "transparent" }}
                        >
                            <i className="bi bi-list-check me-2"></i>Lịch sử Lệnh SX
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link fw-bold border-0 border-bottom border-3 ${activeTab === "wastage" ? "active border-danger text-danger" : "border-transparent text-muted bg-transparent"}`}
                            onClick={() => setActiveTab("wastage")}
                            style={{ borderRadius: 0, borderBottomColor: activeTab === "wastage" ? "#dc3545" : "transparent" }}
                        >
                            <i className="bi bi-graph-down-arrow me-2"></i>Báo Cáo Hao Hụt
                        </button>
                    </li>
                </ul>

                <div className="tab-content">
                    {/* ================= TAB 1: LỊCH SỬ SẢN XUẤT ================= */}
                    {activeTab === "history" && (
                        <div className="animate__animated animate__fadeIn">
                            <div className="alert alert-success border-success mb-3 shadow-sm rounded-4">
                                <h6 className="fw-bold text-success mb-3"><i className="bi bi-bar-chart-fill me-2"></i>Tổng sản lượng đợt này:</h6>
                                <div className="d-flex flex-wrap gap-3">
                                    {Object.keys(productionStats).length === 0 ? (
                                        <span className="text-muted fst-italic">Không có dữ liệu.</span>
                                    ) : (
                                        Object.entries(productionStats).map(([productName, totalQty]) => (
                                            <div key={productName} className="bg-white border border-success rounded-3 px-3 py-2 shadow-sm d-flex align-items-center">
                                                <span className="fw-bold text-dark me-2">{productName}:</span>
                                                <span className="badge bg-success fs-6">{totalQty}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* BẢNG MÁY TÍNH */}
                            <div className="card border-0 shadow-sm rounded-4 overflow-hidden d-none d-lg-block">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle text-center mb-0">
                                        <thead className="table-success text-nowrap">
                                            <tr>
                                                <th>Mã Lệnh</th>
                                                <th>Thời gian</th>
                                                <th>Tham chiếu Đơn</th>
                                                <th className="text-start">Ghi chú hao hụt</th>
                                                <th className="text-start">Sản phẩm</th>
                                                <th>SL Sản xuất</th>
                                                <th className="text-end">Tổng vốn</th>
                                                <th>Trạng thái</th>
                                                <th>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHistory.length === 0 ? <tr><td colSpan="9" className="text-muted py-5 fst-italic">Trống.</td></tr> :
                                                filteredHistory.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="fw-bold text-secondary">#{item.id}</td>
                                                        <td className="small text-muted">{formatDate(item.created_at)}</td>
                                                        <td>
                                                            {item.ref_sales_order_id ? (
                                                                <button className="btn btn-sm btn-outline-success fw-bold rounded-pill px-3 shadow-sm" onClick={() => navigate('/sales-orders')}><i className="bi bi-link-45deg me-1"></i>Đơn #{item.ref_sales_order_id}</button>
                                                            ) : <span className="badge bg-light text-secondary border fw-normal">SX lưu kho</span>}
                                                        </td>
                                                        <td className="text-start fw-bold text-danger small fst-italic" style={{ maxWidth: '200px' }}>{item.note || "---"}</td>
                                                        <td className="text-start fw-bold text-primary">{item.product_name}</td>
                                                        <td><span className="badge bg-primary fs-6">{Number(item.quantity)}</span></td>
                                                        <td className="text-end fw-bold text-danger">{formatMoney(item.total_cost)}</td>
                                                        <td>{item.cost_status === 'FINAL' ? <span className="badge bg-success">Đã chốt</span> : <span className="badge bg-warning text-dark">Tạm tính</span>}</td>
                                                        <td><button className="btn btn-sm btn-outline-success fw-bold shadow-sm" onClick={() => handleViewDetails(item)} data-bs-toggle="modal" data-bs-target="#detailModal"><i className="bi bi-eye"></i> Chi tiết</button></td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* THẺ ĐIỆN THOẠI */}
                            <div className="d-block d-lg-none">
                                {filteredHistory.length === 0 ? <div className="text-center p-5 bg-white rounded-4 shadow-sm text-muted">Trống</div> :
                                    filteredHistory.map((item) => (
                                        <div key={item.id} className="card shadow-sm border-0 mb-3 rounded-4">
                                            <div className="card-header bg-white border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
                                                <span className="fw-bold text-secondary">Lệnh #{item.id}</span>
                                                <span className="small text-muted">{formatDate(item.created_at)}</span>
                                            </div>
                                            <div className="card-body p-3">
                                                <div className="fw-bold text-primary fs-5 mb-1">{item.product_name}</div>
                                                <div className="mb-2">
                                                    <span className="badge bg-primary fs-6 me-2">Sản Xuất: {Number(item.quantity)}</span>
                                                    {item.cost_status === 'FINAL' ? <span className="badge bg-success">Đã chốt</span> : <span className="badge bg-warning text-dark">Tạm tính</span>}
                                                </div>

                                                {item.ref_sales_order_id && (
                                                    <button className="btn btn-sm btn-outline-success fw-bold rounded-pill w-100 mb-2" onClick={() => navigate('/sales-orders')}><i className="bi bi-link-45deg me-1"></i>Sản xuất bù cho Đơn #{item.ref_sales_order_id}</button>
                                                )}

                                                {item.note && <div className="alert alert-danger py-2 px-3 small fw-bold fst-italic mb-2 border-0"><i className="bi bi-exclamation-triangle-fill me-2"></i>{item.note}</div>}

                                                <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded-3 border mb-3">
                                                    <span className="small fw-bold text-muted">Tổng vốn:</span>
                                                    <span className="fw-bold text-danger fs-6">{formatMoney(item.total_cost)}</span>
                                                </div>

                                                <button className="btn btn-outline-success w-100 fw-bold shadow-sm" onClick={() => handleViewDetails(item)} data-bs-toggle="modal" data-bs-target="#detailModal"><i className="bi bi-eye me-2"></i>Xem Chi Tiết Vật Tư</button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* ================= TAB 2: BÁO CÁO HAO HỤT (MỚI) ================= */}
                    {activeTab === "wastage" && (
                        <div className="animate__animated animate__fadeIn">

                            {/* 💡 ĐÃ FIX LỖI TÀNG HÌNH: Dùng bg-danger chuẩn của Bootstrap */}
                            <div className="row mb-4">
                                <div className="col-12">
                                    <div className="card border-0 shadow-sm rounded-4 bg-danger text-white">
                                        <div className="card-body p-4 d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center">
                                                <div className="rounded-circle bg-white text-danger me-3 d-flex justify-content-center align-items-center shadow" style={{ width: '60px', height: '60px' }}>
                                                    <i className="bi bi-graph-down-arrow fs-3"></i>
                                                </div>
                                                <div>
                                                    <p className="mb-0 fw-bold text-uppercase small opacity-75">Tổng Tiền Thất Thoát / Hao Hụt</p>
                                                    <h3 className="mb-0 fw-bold text-white">{formatMoney(totalWastageCost)} <span className="fs-6 fw-normal">VNĐ</span></h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 💡 ĐÃ FIX BẢNG: Đổi header thành màu xám nhạt chữ đỏ cho sang trọng, dễ nhìn */}
                            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                                <div className="card-header bg-white p-4 border-bottom">
                                    <h6 className="fw-bold text-danger mb-0"><i className="bi bi-exclamation-triangle-fill me-2"></i>Bảng Kê Chi Tiết Vật Tư Hao Hụt</h6>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle text-center mb-0">
                                        <thead className="table-light text-danger text-nowrap">
                                            <tr>
                                                <th className="text-start ps-4 py-3">Tên Vật Tư</th>
                                                <th>Định Mức Chuẩn</th>
                                                <th>Thực Tế Đã Dùng</th>
                                                <th>SL Hao Hụt</th>
                                                <th className="pe-4 text-end">Thiệt Hại (VNĐ)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingWastage ? (
                                                <tr><td colSpan="5" className="py-5 text-muted"><span className="spinner-border spinner-border-sm me-2"></span>Đang quét dữ liệu...</td></tr>
                                            ) : wastageData.length === 0 ? (
                                                <tr><td colSpan="5" className="text-center py-5 text-success fw-bold"><i className="bi bi-shield-check fs-1 d-block mb-3 opacity-75"></i>Tuyệt vời! Không có vật tư nào bị hao hụt trong đợt này.</td></tr>
                                            ) : (
                                                wastageData.map((w, idx) => (
                                                    <tr key={idx}>
                                                        <td className="text-start ps-4 fw-bold text-dark">{w.material_name}</td>
                                                        <td className="text-muted fw-bold">{Number(w.standard_qty)}</td>
                                                        <td className="text-primary fw-bold">{Number(w.used_qty)}</td>
                                                        <td>
                                                            <span className="badge bg-danger fs-6 px-3 py-2 rounded-pill shadow-sm">
                                                                + {Number(w.wastage_qty)}
                                                            </span>
                                                        </td>
                                                        <td className="pe-4 text-end fw-bold text-danger fs-6">{formatMoney(w.wastage_cost)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CHI TIẾT SẢN XUẤT */}
            <div className="modal fade" id="detailModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                        <div className="modal-header bg-light border-0 p-4">
                            <h5 className="modal-title fw-bold text-primary">Chi tiết vật tư - Lệnh #{selectedOrder?.id}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4 bg-light">
                            {loadingDetails ? (
                                <div className="text-center py-4"><span className="spinner-border spinner-border-sm me-2"></span>Đang tải dữ liệu...</div>
                            ) : details.length === 0 ? (
                                <div className="text-center py-4 text-muted">Không có dữ liệu chi tiết cho lệnh này.</div>
                            ) : (
                                <div className="card border-0 shadow-sm rounded-4">
                                    <div className="table-responsive">
                                        <table className="table table-hover text-center align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="text-start ps-3">Nguyên vật liệu</th>
                                                    <th>Lô (Batch ID)</th>
                                                    <th>Số lượng dùng</th>
                                                    <th className="text-end pe-3">Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details.map((d) => (
                                                    <tr key={d.id}>
                                                        <td className="text-start ps-3 fw-bold">{d.material_name}</td>
                                                        <td>{d.batch_id ? <span className="badge bg-secondary">Lô #{d.batch_id}</span> : <span className="badge bg-warning text-dark">Giá dự phòng</span>}</td>
                                                        <td className="fw-bold text-primary">
                                                            {Number(d.quantity_used)} <span className="small text-muted">{d.unit}</span>
                                                        </td>
                                                        <td className="text-end pe-3 fw-bold text-danger">{formatMoney(d.total_cost)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}