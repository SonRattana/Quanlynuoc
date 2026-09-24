import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function MRP() {
    const token = localStorage.getItem("token");
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const [products, setProducts] = useState([]);
    const [plan, setPlan] = useState({});
    // 💡 ĐÃ FIX: Đọc kết quả tính toán cũ từ LocalStorage (nếu có)
    const [mrpResult, setMrpResult] = useState(() => {
        try {
            const savedResult = localStorage.getItem("mrp_saved_result");
            return savedResult ? JSON.parse(savedResult) : [];
        } catch (e) {
            return [];
        }
    });

    const [searchTerm, setSearchTerm] = useState("");

    // 💡 ĐÃ FIX: Mặc định TẮT công tắc và ghi nhớ sở thích của sếp vào LocalStorage
    const [showOnlyActive, setShowOnlyActive] = useState(() => {
        const savedToggle = localStorage.getItem("mrp_toggle_state");
        return savedToggle !== null ? JSON.parse(savedToggle) : false;
    });

    useEffect(() => {
        localStorage.setItem("mrp_toggle_state", JSON.stringify(showOnlyActive));
    }, [showOnlyActive]);

    const filteredProducts = products.filter(p => {
        const orderQty = Number(plan[p.id]?.order_qty || 0);
        const reserveQty = Number(plan[p.id]?.reserve_qty || 0);
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());

        if (showOnlyActive) return matchSearch && (orderQty > 0 || reserveQty > 0);
        return matchSearch;
    });

    // 1. Kéo dữ liệu & Đọc LocalStorage cực mượt
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const prodRes = await api.get("api/production/finished-goods", { headers: { Authorization: `Bearer ${token}` } });
                const goods = prodRes.data || [];

                const orderRes = await api.get("api/sales-orders", { headers: { Authorization: `Bearer ${token}` } });
                const pendingOrders = orderRes.data.filter(o => o.status === 'cho_san_xuat' || o.status === 'dang_san_xuat');

                let backlog = {};
                if (pendingOrders.length > 0) {
                    const detailPromises = pendingOrders.map(o => api.get(`api/sales-orders/${o.id}`, { headers: { Authorization: `Bearer ${token}` } }));
                    const detailResponses = await Promise.all(detailPromises);

                    detailResponses.forEach(res => {
                        const details = res.data.details || [];
                        details.forEach(item => {
                            const remaining = item.ordered_quantity - Math.max(item.produced_quantity || 0, item.delivered_quantity || 0);
                            if (remaining > 0) {
                                if (!backlog[item.product_id]) backlog[item.product_id] = 0;
                                backlog[item.product_id] += remaining;
                            }
                        });
                    });
                }

                // Đọc bản nháp ra an toàn tuyệt đối
                let savedDraft = {};
                try {
                    const localData = localStorage.getItem("mrp_draft_plan");
                    if (localData) savedDraft = JSON.parse(localData);
                } catch (e) { }

                let initialPlan = {};
                goods.forEach(p => {
                    initialPlan[p.id] = {
                        order_qty: backlog[p.id] || 0,
                        reserve_qty: (savedDraft[p.id] && savedDraft[p.id].reserve_qty) ? savedDraft[p.id].reserve_qty : "",
                    };
                });

                setProducts(goods);
                setPlan(initialPlan);

            } catch (err) {
                console.error("Lỗi lấy dữ liệu MRP:", err);
                setToast({ message: "Lỗi tải dữ liệu ban đầu", type: "danger" });
            }
        };
        fetchInitialData();
    }, []);

    // Tự động lưu nháp
    useEffect(() => {
        if (Object.keys(plan).length > 0) {
            localStorage.setItem("mrp_draft_plan", JSON.stringify(plan));
        }
    }, [plan]);
    // 💡 ĐÃ FIX: Tự động lưu Kết quả Shopping List vào LocalStorage
    useEffect(() => {
        localStorage.setItem("mrp_saved_result", JSON.stringify(mrpResult));
    }, [mrpResult]);

    const handleReserveChange = (productId, val) => {
        setPlan(prev => ({
            ...prev,
            [productId]: { ...prev[productId], reserve_qty: val }
        }));
    };

    const handleCalculateMRP = async () => {
        setIsLoading(true);
        const payload = products.map(p => {
            const orderQty = Number(plan[p.id]?.order_qty || 0);
            const reserveQty = Number(plan[p.id]?.reserve_qty || 0);
            return { product_id: p.id, quantity: orderQty + reserveQty };
        });

        try {
            const res = await api.post("api/production/calculate-mrp", { plan: payload }, { headers: { Authorization: `Bearer ${token}` } });
            setMrpResult(res.data);
            if (res.data.length === 0) setToast({ message: "Không có vật tư nào cần dùng!", type: "info" });
            else setToast({ message: "Tính toán thành công!", type: "success" });
        } catch (error) {
            setToast({ message: "Lỗi khi tính toán dự trù", type: "danger" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearDraft = () => {
        localStorage.removeItem("mrp_draft_plan");
        localStorage.removeItem("mrp_saved_result"); // 💡 Thêm dòng này để xóa luôn bảng bên phải

        setPlan(prev => {
            const resetPlan = {};
            Object.keys(prev).forEach(key => {
                resetPlan[key] = { ...prev[key], reserve_qty: "" };
            });
            return resetPlan;
        });
        setMrpResult([]);
        setToast({ message: "Đã dọn dẹp bản nháp!", type: "success" });
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="container-fluid py-4 px-2 px-md-4">
                <h4 className="fw-bold text-primary mb-4 text-center text-md-start">
                    <i className="bi bi-calculator me-2"></i>Hoạch định & Dự trù Vật tư
                </h4>

                <div className="row g-4">
                    {/* CỘT TRÁI */}
                    <div className="col-12 col-xl-7">
                        <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                            <div className="card-header bg-info text-white fw-bold py-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                <span className="fs-5"><i className="bi bi-box-seam me-2"></i>1. Kế hoạch Thành phẩm</span>

                                <div className="d-flex flex-column gap-2" style={{ width: '100%', maxWidth: '350px' }}>
                                    <div className="input-group input-group-sm shadow-sm">
                                        <span className="input-group-text bg-white border-0"><i className="bi bi-search text-muted"></i></span>
                                        <input
                                            type="text"
                                            className="form-control border-0"
                                            placeholder="Tìm nhanh mặt hàng..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-check form-switch mt-1">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="switchActive"
                                            checked={showOnlyActive}
                                            onChange={(e) => setShowOnlyActive(e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label className="form-check-label small text-light" htmlFor="switchActive" style={{ cursor: 'pointer' }}>
                                            Chỉ hiện món đang nợ / cần làm
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* 💡 ĐÃ FIX CHỐT HẠ: Ép Bootstrap text-wrap và !important để bẻ gãy chữ */}
                            <div className="card-body p-0" style={{ maxHeight: "60vh", overflowY: "auto", overflowX: "hidden" }}>
                                <table className="table table-hover table-sm align-middle mb-0 text-center w-100" style={{ tableLayout: "fixed" }}>
                                    <thead className="table-light text-muted sticky-top shadow-sm" style={{ zIndex: 1, fontSize: '0.8rem' }}>
                                        <tr>
                                            {/* Nhích cột tên rộng ra chút xíu để dễ nhìn hơn */}
                                            <th className="text-start ps-2" style={{ width: '45%' }}>Tên SP</th>
                                            <th style={{ width: '15%' }}>Nợ</th>
                                            <th style={{ width: '22%' }}>Dự Trữ</th>
                                            <th style={{ width: '18%' }}>Tổng</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ fontSize: '0.85rem' }}>
                                        {filteredProducts.length > 0 ? filteredProducts.map(p => {
                                            const orderQty = Number(plan[p.id]?.order_qty || 0);
                                            const reserveQty = Number(plan[p.id]?.reserve_qty || 0);
                                            const total = orderQty + reserveQty;

                                            return (
                                                <tr key={p.id}>
                                                    {/* 💡 Dùng class text-wrap và ép whiteSpace normal !important */}
                                                    <td className="text-start ps-2 text-wrap" style={{ whiteSpace: 'normal !important', overflowWrap: 'break-word', wordWrap: 'break-word' }}>
                                                        <div className="fw-bold text-dark lh-sm mb-1" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                            {p.name}
                                                        </div>
                                                        <span className="badge bg-light text-secondary border px-1" style={{ fontSize: '0.65rem' }}>{p.unit}</span>
                                                    </td>
                                                    <td className="text-danger fw-bold align-middle">{orderQty > 0 ? orderQty : '-'}</td>
                                                    <td className="px-1 align-middle">
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm text-center fw-bold text-primary mx-auto shadow-none border-info"
                                                            style={{ width: '100%', maxWidth: '60px', fontSize: '0.9rem', padding: '0.25rem' }}
                                                            min="0"
                                                            placeholder="0"
                                                            value={plan[p.id]?.reserve_qty}
                                                            onChange={(e) => handleReserveChange(p.id, e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="fw-bold text-success pe-1 align-middle">{total > 0 ? total : '-'}</td>
                                                </tr>
                                            )
                                        }) : (
                                            <tr>
                                                <td colSpan="4" className="text-muted py-4 text-center fst-italic">
                                                    Không có sản phẩm nào
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="card-footer bg-light p-3 border-top-0 d-flex flex-column flex-md-row justify-content-end gap-2">
                                <button className="btn btn-outline-secondary fw-bold shadow-sm px-4 py-2" onClick={handleClearDraft}>
                                    <i className="bi bi-trash3 me-1"></i> Xóa nháp
                                </button>
                                <button className="btn btn-primary fw-bold shadow-sm px-4 py-2" onClick={handleCalculateMRP} disabled={isLoading}>
                                    {isLoading ? <i className="fa fa-spinner fa-spin me-2"></i> : <i className="bi bi-magic me-2"></i>}
                                    LẬP BẢNG DỰ TRÙ
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI */}
                    <div className="col-12 col-xl-5">
                        <div className="card shadow-sm border-0 rounded-4 overflow-hidden sticky-lg-top" style={{ top: '20px' }}>
                            <div className="card-header bg-warning text-dark fw-bold py-3 fs-5">
                                <i className="bi bi-cart-check-fill me-2"></i>2. Bảng Dự Trù
                            </div>
                            <div className="card-body p-0 table-responsive">
                                {mrpResult.length === 0 ? (
                                    <div className="text-center py-5 text-muted px-3">
                                        <i className="bi bi-basket fs-1 d-block mb-3 text-warning opacity-75"></i>
                                        Nhập số lượng sản phẩm bên trái và bấm <br className="d-none d-md-block" /> <b>"Lập bảng dự trù"</b> để xem danh sách.
                                    </div>
                                ) : (
                                    <table className="table table-hover align-middle mb-0 text-center text-nowrap">
                                        <thead className="table-light text-muted small">
                                            <tr>
                                                <th className="text-start ps-3 py-3">Vật Tư</th>
                                                <th>Cần Dùng</th>
                                                <th>Tồn Kho</th>
                                                <th className="pe-3">Trạng Thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mrpResult.map((m, idx) => (
                                                <tr key={idx} className={m.to_buy_qty > 0 ? 'table-danger' : ''}>
                                                    <td className="text-start ps-3 fw-bold text-dark">
                                                        <div className="text-wrap" style={{ minWidth: '120px' }}>{m.material_name}</div>
                                                    </td>
                                                    <td className="fw-bold">{Number(m.required_qty)} <span className="small text-muted">{m.unit}</span></td>
                                                    <td className="fw-bold text-secondary">{Number(m.current_stock)} <span className="small text-muted">{m.unit}</span></td>
                                                    <td className="pe-3">
                                                        {m.to_buy_qty > 0 ? (
                                                            <span className="badge bg-danger fs-6 rounded-pill px-3 py-2 shadow-sm d-block">
                                                                Thiếu {Number(m.to_buy_qty)} {m.unit}
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-success rounded-pill px-3 py-2 text-wrap"><i className="bi bi-check-circle me-1"></i>Đủ xài</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </Layout>
    );
}