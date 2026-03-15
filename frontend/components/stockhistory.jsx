import React, { useState } from "react";
import StockDetailModal from "./StockDetailModal";

const formatDateVN = (date) => {
    return new Date(date).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
    });
};

export default function StockHistory({ stocks, page, totalPages, setPage }) {
    // State lưu trữ giao dịch đang được chọn để xem chi tiết
    const [selectedTx, setSelectedTx] = useState(null);

    return (
        <div className="bg-white p-4 shadow-sm rounded">
            <h5 className="fw-bold mb-3">Lịch sử nhập xuất</h5>

            <div className="table-responsive">
                <table className="table table-hover align-middle">
                    <thead className="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Sản phẩm</th>
                            <th>Kho</th>
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
                                <td>{s.id}</td>
                                <td className="fw-bold">{s.product_name}</td>
                                <td>
                                    {s.warehouse_name ? (
                                        <span className="badge bg-secondary">{s.warehouse_name}</span>
                                    ) : (
                                        <span className="text-muted small">N/A</span>
                                    )}
                                </td>
                                <td className="text-truncate" style={{ maxWidth: "150px" }} title={s.reason}>
                                    {s.reason}
                                </td>
                                <td>
                                    <span className={`badge ${s.type === "import" ? "bg-success" : "bg-danger"}`}>
                                        {s.type}
                                    </span>
                                </td>
                                <td>{s.quantity}</td>
                                <td>{formatDateVN(s.created_at)}</td>
                                <td className="text-center">
                                    {/* NÚT CHI TIẾT */}
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

            {/* Pagination (Giữ nguyên của anh) */}
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