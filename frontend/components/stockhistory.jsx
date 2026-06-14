import React, { useState, useEffect } from "react";
import StockDetailModal from "./StockDetailModal";
import api from "../src/utils/axios"; // 💡 Chú ý import api để gọi dữ liệu nhé sếp
import axios from "axios";
const formatDateVN = (date) => {
    return new Date(date).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
    });
};

export default function StockHistory({ stocks, page, totalPages, setPage }) {
    const [selectedTx, setSelectedTx] = useState(null);

    // 💡 STATE MỚI CHO TABS VÀ DỮ LIỆU CẤP PHÁT
    const [activeTab, setActiveTab] = useState("general");
    const [issueHistory, setIssueHistory] = useState([]);
    const token = localStorage.getItem("token");
    const fetchIssueHistory = async () => {
        try {
            // 💡 Đã bỏ dấu gạch chéo ở đầu và thêm headers chứa token bảo mật
            const res = await api.get("api/stock/internal-issues/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIssueHistory(res.data);
        } catch (error) {
            console.error("Lỗi tải lịch sử cấp phát", error);
        }
    };

    // Tự động gọi hàm lấy dữ liệu khi load Component
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

            {/* ================= NỘI DUNG TABS ================= */}
            <div className="tab-content">

                {/* 📦 TAB 1: LỊCH SỬ NHẬP XUẤT (Bảng cũ của sếp) */}
                {activeTab === "general" && (
                    <div className="animate__animated animate__fadeIn">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle table-mobile-cards">
                                <thead className="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Sản phẩm</th>
                                        <th>Kho</th>
                                        <th>Đến Kho</th>
                                        <th>Lý do</th>
                                        <th>Loại</th>
                                        <th>Số lượng</th>
                                        <th>Thời gian</th>
                                        <th className="text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stocks.map((s) => (
                                        <tr key={s.id}>
                                            <td data-label="ID">{s.id}</td>
                                            <td data-label="Sản Phẩm" className="fw-bold">{s.product_name}</td>
                                            <td data-label="Kho">
                                                {s.warehouse_name ? (
                                                    <span className="badge bg-secondary">{s.warehouse_name}</span>
                                                ) : (
                                                    <span className="text-muted small">N/A</span>
                                                )}
                                            </td>
                                            <td data-label="Đến Kho">
                                                {s.target_warehouse_name ? (
                                                    <span className="badge bg-secondary">{s.target_warehouse_name}</span>
                                                ) : (
                                                    <span className="text-muted small">Xuất hủy hoặc bán</span>
                                                )}
                                            </td>
                                            <td data-label="Lý do" className="text-truncate" style={{ maxWidth: "150px" }} title={s.reason}>
                                                {s.reason}
                                            </td>
                                            <td data-label="Loại">
                                                <span className={`badge ${s.type === "import" ? "bg-success" : "bg-danger"}`}>
                                                    {s.type}
                                                </span>
                                            </td>
                                            <td data-label="Số Lượng">{s.quantity}</td>
                                            <td data-label="Thời Gian">{formatDateVN(s.created_at)}</td>
                                            <td data-label="Thao Tác" className="text-center">
                                                <button
                                                    className="btn btn-sm btn-info text-white shadow-sm"
                                                    onClick={() => setSelectedTx(s)}
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Phân trang của Tab General */}
                        <div>
                            <div className="d-flex justify-content-center mt-3">
                                <nav>
                                    <ul className="pagination">
                                        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                                            <button className="page-link" onClick={() => setPage(page - 1)}>«</button>
                                        </li>
                                        {(() => {
                                            const pages = [];
                                            const maxVisible = 5;
                                            let start = Math.max(1, page - 2);
                                            let end = Math.min(totalPages, page + 2);

                                            if (page <= 3) {
                                                start = 1;
                                                end = Math.min(totalPages, maxVisible);
                                            }

                                            if (page > totalPages - 3) {
                                                start = Math.max(1, totalPages - maxVisible + 1);
                                                end = totalPages;
                                            }

                                            if (start > 1) {
                                                pages.push(
                                                    <li key={1} className="page-item">
                                                        <button className="page-link" onClick={() => setPage(1)}>1</button>
                                                    </li>
                                                );
                                                if (start > 2) {
                                                    pages.push(
                                                        <li key="start-ellipsis" className="page-item disabled">
                                                            <span className="page-link">...</span>
                                                        </li>
                                                    );
                                                }
                                            }

                                            for (let i = start; i <= end; i++) {
                                                pages.push(
                                                    <li key={i} className={`page-item ${page === i ? "active" : ""}`}>
                                                        <button className="page-link" onClick={() => setPage(i)}>{i}</button>
                                                    </li>
                                                );
                                            }

                                            if (end < totalPages) {
                                                if (end < totalPages - 1) {
                                                    pages.push(
                                                        <li key="end-ellipsis" className="page-item disabled">
                                                            <span className="page-link">...</span>
                                                        </li>
                                                    );
                                                }
                                                pages.push(
                                                    <li key={totalPages} className="page-item">
                                                        <button className="page-link" onClick={() => setPage(totalPages)}>{totalPages}</button>
                                                    </li>
                                                );
                                            }
                                            return pages;
                                        })()}
                                        <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                                            <button className="page-link" onClick={() => setPage(page + 1)}>»</button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🏥 TAB 2: LỊCH SỬ CẤP PHÁT NỘI BỘ */}
                {activeTab === "internal" && (
                    <div className="table-responsive animate__animated animate__fadeIn">
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
                                {issueHistory && issueHistory.length > 0 ? (
                                    issueHistory.map((item) => (
                                        <tr key={item.id}>
                                            <td data-label="Thời gian" className="text-muted">{item.created_at}</td>
                                            <td data-label="Từ Kho" className="fw-bold text-dark">{item.warehouse_name}</td>
                                            <td data-label="Sản phẩm" className="fw-bold text-primary">{item.product_name}</td>
                                            <td data-label="Số lượng">
                                                <span className="badge bg-danger fs-6">-{item.quantity}</span>
                                            </td>
                                            <td data-label="Tổng giá vốn" className="text-end fw-bold text-danger">
                                                {Number(item.total_cost).toLocaleString("vi-VN")} đ
                                            </td>
                                            <td data-label="Khoa nhận & Ghi chú" className="text-start fw-bold text-secondary fst-italic">
                                                {item.reason}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-muted py-4">Chưa có lịch sử cấp phát nào</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>

            {/* GỌI MODAL CHI TIẾT */}
            {selectedTx && (
                <StockDetailModal
                    transaction={selectedTx}
                    onClose={() => setSelectedTx(null)}
                />
            )}
        </div>
    );
}