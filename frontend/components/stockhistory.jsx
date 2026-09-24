import React, { useState, useEffect } from "react";
import StockDetailModal from "./StockDetailModal";
import api from "../src/utils/axios";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // 💡 IMPORT THÊM CÁI NÀY ĐỂ CHUYỂN TRANG

const formatDateVN = (date) => {
    if (!date) return "";

    // Ép chuỗi và cắt bỏ ký tự 'Z' ở cuối để trình duyệt không tự cộng thêm 7 tiếng
    const fixedDate = date.toString().replace('Z', '');

    return new Date(fixedDate).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
    });
};

export default function StockHistory({ stocks, page, totalPages, setPage }) {
    const navigate = useNavigate(); // 💡 KHỞI TẠO BỘ ĐIỀU HƯỚNG
    const [selectedTx, setSelectedTx] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterProduct, setFilterProduct] = useState("");

    const uniqueProducts = [...new Set(stocks.map(item => item.product_name))].filter(Boolean);

    const filteredStocks = stocks.filter(s => {
        const productName = (s.product_name || "").toLowerCase();
        const reason = (s.reason || "").toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        const matchSearch = productName.includes(searchLower) || reason.includes(searchLower);
        const matchProduct = filterProduct ? s.product_name === filterProduct : true;
        return matchSearch && matchProduct;
    });

    const [activeTab, setActiveTab] = useState("general");
    const [issueHistory, setIssueHistory] = useState([]);
    const token = localStorage.getItem("token");

    const fetchIssueHistory = async () => {
        try {
            const res = await api.get("api/stock/internal-issues/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIssueHistory(res.data);
        } catch (error) {
            console.error("Lỗi tải lịch sử cấp phát", error);
        }
    };

    const [searchInternal, setSearchInternal] = useState("");
    const [filterInternal, setFilterInternal] = useState("");
    const uniqueInternalProducts = [...new Set((issueHistory || []).map(item => item.product_name))].filter(Boolean);

    const filteredIssueHistory = (issueHistory || []).filter(item => {
        const productName = (item.product_name || "").toLowerCase();
        const reason = (item.reason || "").toLowerCase();
        const searchLower = searchInternal.toLowerCase();
        const matchSearch = productName.includes(searchLower) || reason.includes(searchLower);
        const matchProduct = filterInternal ? item.product_name === filterInternal : true;
        return matchSearch && matchProduct;
    });

    useEffect(() => {
        fetchIssueHistory();
    }, []);

    return (
        <div className="bg-white p-4 shadow-sm rounded border">
            {/* ================= MENU TABS ================= */}
            <ul className="nav nav-tabs border-bottom-0 mb-3" style={{ borderBottom: "2px solid #dee2e6" }}>
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold border-0 border-bottom border-3 ${activeTab === "general" ? "active border-primary text-primary" : "border-transparent text-muted bg-transparent"}`}
                        onClick={() => setActiveTab("general")}
                        style={{ borderRadius: 0, borderBottomColor: activeTab === "general" ? "#0d6efd" : "transparent" }}
                    >
                        <i className="bi bi-box-seam me-2"></i>Lịch sử Nhập / Xuất kho
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link fw-bold border-0 border-bottom border-3 ${activeTab === "internal" ? "active border-info text-info" : "border-transparent text-muted bg-transparent"}`}
                        onClick={() => setActiveTab("internal")}
                        style={{ borderRadius: 0, borderBottomColor: activeTab === "internal" ? "#0dcaf0" : "transparent" }}
                    >
                        <i className="bi bi-diagram-3 me-2"></i>Lịch sử Cấp phát nội bộ
                    </button>
                </li>
            </ul>

            <div className="tab-content">
                {/* 📦 TAB 1: LỊCH SỬ NHẬP XUẤT */}
                {activeTab === "general" && (
                    <div className="animate__animated animate__fadeIn">
                        <div className="table-responsive">
                            <div className="row mb-3 g-2">
                                <div className="col-12 col-md-6">
                                    <div className="input-group shadow-sm">
                                        <span className="input-group-text bg-primary text-white border-primary"><i className="bi bi-search"></i></span>
                                        <input type="text" className="form-control border-primary" placeholder="Tìm nhanh theo tên SP, NVL hoặc lý do..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                        {searchTerm && <button className="btn btn-outline-danger" onClick={() => setSearchTerm("")}><i className="bi bi-x-lg"></i></button>}
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <select className="form-select shadow-sm border-info text-info fw-bold" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
                                        <option value="">-- Lọc tất cả Sản phẩm / NVL --</option>
                                        {uniqueProducts.map((name, idx) => <option key={idx} value={name}>{name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <table className="table table-hover align-middle table-mobile-cards">
                                <thead className="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Sản phẩm</th>
                                        <th>Kho</th>
                                        <th>Đến Kho</th>
                                        <th>Lý do</th>
                                        {/* 💡 THÊM CỘT THAM CHIẾU */}
                                        <th className="text-center">Tham chiếu</th>
                                        <th>Loại</th>
                                        <th>Số lượng</th>
                                        <th>Thời gian</th>
                                        <th className="text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStocks.length > 0 ? (
                                        filteredStocks.map((s) => (
                                            <tr key={s.id}>
                                                <td data-label="ID">{s.id}</td>
                                                <td data-label="Sản Phẩm" className="fw-bold text-dark">{s.product_name}</td>
                                                <td data-label="Kho">
                                                    {s.warehouse_name ? <span className="badge bg-secondary">{s.warehouse_name}</span> : <span className="text-muted small">N/A</span>}
                                                </td>
                                                <td data-label="Đến Kho">
                                                    {s.target_warehouse_name ? <span className="badge bg-secondary">{s.target_warehouse_name}</span> : <span className="text-muted small">Xuất hủy hoặc bán</span>}
                                                </td>
                                                <td data-label="Lý do" className="text-truncate text-muted small" style={{ maxWidth: "120px" }} title={s.reason}>
                                                    {s.reason}
                                                </td>

                                                {/* 💡 ĐÃ FIX: Đổi từ s.ref_sales_order_id sang s.order_code để khớp với Backend */}
                                                <td data-label="Tham chiếu" className="text-center">
                                                    {s.order_code ? (
                                                        <button
                                                            className="btn btn-sm btn-outline-primary fw-bold rounded-pill px-3 shadow-sm"
                                                            onClick={() => navigate('/sales-orders')}
                                                            title="Nhảy đến trang Đơn Đặt Hàng"
                                                        >
                                                            <i className="bi bi-link-45deg me-1"></i>{s.order_code}
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted small">---</span>
                                                    )}
                                                </td>
                                                <td data-label="Loại">
                                                    <span className={`badge ${s.type === "import" ? "bg-success" : "bg-danger"}`}>{s.type}</span>
                                                </td>
                                                <td data-label="Số Lượng" className="fw-bold">
                                                    {Number(s.quantity)}
                                                    {/* 💡 THÊM ĐOẠN NÀY VÀO PHÍA SAU CON SỐ */}
                                                    <span className="ms-1 text-muted small">
                                                        {s.unit}
                                                    </span>
                                                </td>
                                                <td data-label="Thời Gian" className="text-muted small">{formatDateVN(s.created_at)}</td>
                                                <td data-label="Thao Tác" className="text-center">
                                                    <button className="btn btn-sm btn-info text-white shadow-sm fw-bold" onClick={() => setSelectedTx(s)}>Chi tiết</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            {/* 💡 Đổi colSpan từ 9 thành 10 vì đã thêm 1 cột */}
                                            <td colSpan="10" className="text-center text-muted py-5 bg-light">
                                                <i className="bi bi-inbox fs-1 d-block mb-3 text-secondary"></i>
                                                Chưa tìm thấy lịch sử giao dịch nào khớp với bộ lọc!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Phân trang (Giữ nguyên) */}
                        <div className="d-flex justify-content-center mt-3">
                            <nav>
                                <ul className="pagination">
                                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}><button className="page-link" onClick={() => setPage(page - 1)}>«</button></li>
                                    {(() => {
                                        const pages = []; const maxVisible = 5; let start = Math.max(1, page - 2); let end = Math.min(totalPages, page + 2);
                                        if (page <= 3) { start = 1; end = Math.min(totalPages, maxVisible); }
                                        if (page > totalPages - 3) { start = Math.max(1, totalPages - maxVisible + 1); end = totalPages; }
                                        if (start > 1) { pages.push(<li key={1} className="page-item"><button className="page-link" onClick={() => setPage(1)}>1</button></li>); if (start > 2) pages.push(<li key="start-ellipsis" className="page-item disabled"><span className="page-link">...</span></li>); }
                                        for (let i = start; i <= end; i++) pages.push(<li key={i} className={`page-item ${page === i ? "active" : ""}`}><button className="page-link" onClick={() => setPage(i)}>{i}</button></li>);
                                        if (end < totalPages) { if (end < totalPages - 1) pages.push(<li key="end-ellipsis" className="page-item disabled"><span className="page-link">...</span></li>); pages.push(<li key={totalPages} className="page-item"><button className="page-link" onClick={() => setPage(totalPages)}>{totalPages}</button></li>); }
                                        return pages;
                                    })()}
                                    <li className={`page-item ${page === totalPages ? "disabled" : ""}`}><button className="page-link" onClick={() => setPage(page + 1)}>»</button></li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                )}

                {/* 🏥 TAB 2: LỊCH SỬ CẤP PHÁT NỘI BỘ (Giữ nguyên) */}
                {activeTab === "internal" && (
                    <div className="animate__animated animate__fadeIn">
                        <div className="row mb-3 g-2">
                            <div className="col-12 col-md-6">
                                <div className="input-group shadow-sm">
                                    <span className="input-group-text bg-info text-white border-info"><i className="bi bi-search"></i></span>
                                    <input type="text" className="form-control border-info" placeholder="Tìm nhanh theo tên SP hoặc Khoa nhận / Ghi chú..." value={searchInternal} onChange={(e) => setSearchInternal(e.target.value)} />
                                    {searchInternal && <button className="btn btn-outline-danger" onClick={() => setSearchInternal("")}><i className="bi bi-x-lg"></i></button>}
                                </div>
                            </div>
                            <div className="col-12 col-md-4">
                                <select className="form-select shadow-sm border-info text-info fw-bold" value={filterInternal} onChange={(e) => setFilterInternal(e.target.value)}>
                                    <option value="">-- Lọc tất cả Sản phẩm --</option>
                                    {uniqueInternalProducts.map((name, idx) => <option key={idx} value={name}>{name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-bordered table-hover align-middle shadow-sm text-center table-mobile-cards">
                                <thead className="table-info">
                                    <tr>
                                        <th>Thời gian</th>
                                        <th>Từ Kho</th>
                                        <th>Sản phẩm</th>
                                        <th>Số lượng</th>
                                        <th className="text-end">Tổng giá vốn</th>
                                        <th className="text-start">Khoa nhận & Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIssueHistory.length > 0 ? (
                                        filteredIssueHistory.map((item) => (
                                            <tr key={item.id}>
                                                <td data-label="Thời gian" className="text-muted">{item.created_at}</td>
                                                <td data-label="Từ Kho" className="fw-bold text-dark">{item.warehouse_name}</td>
                                                <td data-label="Sản phẩm" className="fw-bold text-primary">{item.product_name}</td>
                                                <td data-label="Số lượng">
                                                    <span className="badge bg-danger fs-6">
                                                        -{Number(item.quantity)} {item.unit}
                                                    </span>
                                                </td>
                                                <td data-label="Tổng giá vốn" className="text-end fw-bold text-danger">{Number(item.total_cost).toLocaleString("vi-VN")} đ</td>
                                                <td data-label="Khoa nhận & Ghi chú" className="text-start fw-bold text-secondary fst-italic">{item.reason}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center text-muted py-5 bg-light"><i className="bi bi-inbox fs-1 d-block mb-3 text-secondary"></i>Chưa có lịch sử cấp phát nào khớp với bộ lọc!</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {selectedTx && <StockDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
        </div>
    );
}