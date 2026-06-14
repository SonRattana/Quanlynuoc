import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function ProductionHistory() {
    const today = new Date().toISOString().split("T")[0];

    const [history, setHistory] = useState([]);
    const [toast, setToast] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [details, setDetails] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // 💡 STATE CHO NÚT CHỐT SỔ
    const [isFinalizing, setIsFinalizing] = useState(false);

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [searchShift, setSearchShift] = useState("");

    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchHistory();
    }, []);

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

    // 💡 HÀM GỌI API CHỐT SỔ
    const handleFinalizeCosts = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn chốt sổ và cộng chi phí lương, khấu hao vào các mẻ nước hôm nay? (Hành động này sẽ cập nhật lại giá vốn thực tế)")) return;
        
        setIsFinalizing(true);
        try {
            const res = await api.post("api/production/finalize-costs", {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setToast({ message: res.data.message, type: "success" });
            fetchHistory(); // Tải lại bảng để thấy trạng thái chuyển sang FINAL
        } catch (err) {
            setToast({ message: err.response?.data?.message || "Lỗi khi chốt sổ", type: "danger" });
        } finally {
            setIsFinalizing(false);
        }
    };

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
        if (!acc[curr.product_name]) {
            acc[curr.product_name] = 0;
        }
        acc[curr.product_name] += Number(curr.quantity);
        return acc;
    }, {});

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="pt-4 px-4 w-100 pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-success mb-0">
                        <i className="bi bi-clock-history me-2"></i>Lịch sử & Thống kê Sản xuất
                    </h4>
                    {/* 💡 NÚT CHỐT SỔ ĐƯỢC THÊM VÀO ĐÂY */}
                    {/* <button 
                        className="btn btn-warning fw-bold shadow-sm" 
                        onClick={handleFinalizeCosts}
                        disabled={isFinalizing}
                    >
                        {isFinalizing ? (
                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>ĐANG CHỐT SỔ...</>
                        ) : (
                            <><i className="bi bi-calculator-fill me-2"></i>CHỐT SỔ CUỐI NGÀY (CỘNG LƯƠNG)</>
                        )}
                    </button> */}
                </div>

                <div className="bg-white p-3 rounded shadow-sm border-top border-primary border-4 mb-4">
                    <div className="row g-3 align-items-end mb-3">
                        <div className="col-md-3">
                            <label className="form-label small fw-bold text-secondary">Từ ngày:</label>
                            <div className="input-group shadow-sm">
                                <input
                                    type="date"
                                    className="form-control border-end-0"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <span
                                    className="input-group-text bg-white text-primary border-start-0"
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => e.currentTarget.previousElementSibling.showPicker()}
                                >
                                    <i className="bi bi-calendar2-week-fill"></i>
                                </span>
                            </div>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label small fw-bold text-secondary">Đến ngày:</label>
                            <div className="input-group shadow-sm">
                                <input
                                    type="date"
                                    className="form-control border-end-0"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                <span
                                    className="input-group-text bg-white text-primary border-start-0"
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => e.currentTarget.previousElementSibling.showPicker()}
                                >
                                    <i className="bi bi-calendar2-check-fill"></i>
                                </span>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <label className="form-label small fw-bold text-secondary">Tìm theo Ca / Ghi chú / Tên sản phẩm:</label>
                            <input
                                type="text"
                                className="form-control shadow-sm"
                                placeholder="VD: Ca 1, Ca 2, Mita..."
                                value={searchShift}
                                onChange={(e) => setSearchShift(e.target.value)}
                            />
                        </div>

                        <div className="col-md-2">
                            <button className="btn btn-outline-secondary w-100 fw-bold shadow-sm" onClick={() => { setStartDate(""); setEndDate(""); setSearchShift(""); }}>
                                <i className="bi bi-arrow-clockwise me-1"></i> Xóa bộ lọc
                            </button>
                        </div>
                    </div>

                    <div className="alert alert-success border-success mb-0">
                        <h6 className="fw-bold text-success mb-3"><i className="bi bi-bar-chart-fill me-2"></i>Tổng kết sản lượng đợt này:</h6>
                        <div className="d-flex flex-wrap gap-3">
                            {Object.keys(productionStats).length === 0 ? (
                                <span className="text-muted fst-italic">Không có dữ liệu sản xuất trong thời gian này.</span>
                            ) : (
                                Object.entries(productionStats).map(([productName, totalQty]) => (
                                    <div key={productName} className="bg-white border border-success rounded px-3 py-2 shadow-sm d-flex align-items-center">
                                        <span className="fw-bold text-dark me-2">{productName}:</span>
                                        <span className="badge bg-success fs-6">{totalQty}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-3 rounded shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle text-center border table-mobile-cards">
                            <thead className="table-success text-nowrap">
                                <tr>
                                    <th>Mã Lệnh</th>
                                    <th>Thời gian</th>
                                    <th className="text-start">Ca / Ghi chú</th>
                                    <th className="text-start">Sản phẩm</th>
                                    <th>SL Sản xuất</th>
                                    <th className="text-end">Giá vốn / ĐV</th>
                                    <th className="text-end">Tổng vốn</th>
                                    {/* 💡 THÊM CỘT TRẠNG THÁI */}
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.length === 0 ? (
                                    <tr><td colSpan="9" className="text-muted py-4 fst-italic">Không tìm thấy dữ liệu khớp với bộ lọc.</td></tr>
                                ) : (
                                    filteredHistory.map((item) => (
                                        <tr key={item.id}>
                                            <td data-label="Mã Lệnh" className="fw-bold text-secondary">#{item.id}</td>
                                            <td data-label="Sản phẩm" className="small text-muted">{formatDate(item.created_at)}</td>
                                            <td data-label="Thời Gian" className="text-start fw-bold text-info">{item.note || "---"}</td>
                                            <td data-label="Ca/ghi chú" className="text-start fw-bold text-primary">{item.product_name}</td>
                                            <td data-label="SL sản xuất" ><span className="badge bg-primary fs-6">{item.quantity}</span></td>
                                            <td data-label="Giá vốn/ĐV" className="text-end fw-bold text-danger">{formatMoney(item.unit_cost)}</td>
                                            <td data-label="Tổng vốn" className="text-end fw-bold text-danger">{formatMoney(item.total_cost)}</td>
                                            {/* 💡 HIỂN THỊ BADGE TRẠNG THÁI */}
                                            <td data-label="Trạng thái">
                                                {item.cost_status === 'FINAL' ? (
                                                    <span className="badge bg-success">Đã chốt</span>
                                                ) : (
                                                    <span className="badge bg-warning text-dark">Tạm tính</span>
                                                )}
                                            </td>
                                            <td data-label="Thao tác">
                                                <button
                                                    className="btn btn-sm btn-outline-success fw-bold"
                                                    onClick={() => handleViewDetails(item)}
                                                    data-bs-toggle="modal"
                                                    data-bs-target="#detailModal"
                                                >
                                                    <i className="bi bi-eye"></i> Chi tiết
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

            {/* MODAL CHI TIẾT SẢN XUẤT */}
            <div className="modal fade" id="detailModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header bg-light">
                            <h5 className="modal-title fw-bold text-primary">
                                Chi tiết xuất kho nguyên vật liệu - Lệnh #{selectedOrder?.id}
                            </h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            {loadingDetails ? (
                                <div className="text-center py-4">Đang tải dữ liệu...</div>
                            ) : details.length === 0 ? (
                                <div className="text-center py-4 text-muted">Không có dữ liệu chi tiết cho lệnh này.</div>
                            ) : (
                                <div>
                                    <table className="table table-bordered text-center align-middle mb-0 table-mobile-cards">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="text-start">Nguyên vật liệu</th>
                                                <th>Lô lấy hàng (Batch ID)</th>
                                                <th>Số lượng dùng</th>
                                                <th className="text-end">Giá xuất kho</th>
                                                <th className="text-end">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {details.map((d) => (
                                                <tr key={d.id}>
                                                    <td data-label="Nguyên Vật Liệu" className="text-start fw-bold">{d.material_name}</td>
                                                    <td data-label="Lô hàng (ID)">
                                                        {d.batch_id ? (
                                                            <span className="badge bg-secondary">Lô #{d.batch_id}</span>
                                                        ) : (
                                                            <span className="badge bg-warning text-dark">Giá dự phòng</span>
                                                        )}
                                                    </td>
                                                    <td data-label="Số lượng dùng" className="fw-bold text-dark">{Math.round(d.quantity_used)} <span className="small text-muted">{d.unit}</span></td>
                                                    <td data-label="Giá xuất Kho" className="text-end">{formatMoney(d.unit_cost)}</td>
                                                    <td data-label="Thành Tiền" className="text-end fw-bold text-danger">{formatMoney(d.total_cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="table-success fw-bold">
                                                <td data-label="Tổng tiền" colSpan="4" className="text-end">TỔNG CỘNG TIỀN VỐN:</td>
                                                <td  className="text-end text-danger fs-5">{formatMoney(selectedOrder?.total_cost)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                    {selectedOrder?.note && (
                                        <div className="alert alert-warning mt-3 mb-0 text-start border-warning shadow-sm">
                                            <h6 className="fw-bold mb-1 text-dark"><i className="bi bi-card-text me-2"></i>Ghi chú & Phí vận hành:</h6>
                                            <div className="text-dark fst-italic" style={{ whiteSpace: "pre-wrap" }}>
                                                {selectedOrder.note}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}