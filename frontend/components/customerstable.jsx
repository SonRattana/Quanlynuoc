
import React from "react";

const formatDateVN = (date) => {
    return new Date(date).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
    });
};

export default function CustomersTable({
    customers = [],
    page,
    onEdit,
    onDelete,
    onDeposit,
    onView,
    totalPages,
    setPage,
}) {
    return (
        <>
            <div className="bg-white p-4 shadow-sm">
                <h5 className="fw-bold mb-3">Danh sách khách hàng</h5>

                <table className="table table-hover">
                    <thead className="table-light">

                        <tr>
                            <th>Mã khách hàng</th>
                            <th>Tên</th>
                            <th>Loại</th>
                            <th>SĐT</th>
                            <th>Địa chỉ</th>
                            <th>Trạng thái</th>
                            <th>Ngày tạo</th>
                            <th>Hành động</th>

                        </tr>
                    </thead>
                    <tbody>
                        {customers.map(c => (
                            <tr key={c.id}>
                                <td>{c.customer_code}</td>
                                <td>{c.name}</td>
                                <td>{c.type}</td>
                                <td>{c.phone}</td>
                                <td>{c.address}</td>
                                <td>{c.is_active ? 'Active' : 'Inactive'}</td>
                                <td>{formatDateVN(c.created_at)}</td>
                                <td>
                                    <button
                                        className="btn btn-info btn-sm me-2"
                                        onClick={() => onDeposit(c)}>
                                        Trả vỏ
                                    </button>
                                    <button
                                        className="btn btn-info btn-sm me-1"
                                        onClick={() => onView(c)}
                                    >
                                        Chi tiết
                                    </button>
                                    <button
                                        className="btn btn-warning btn-sm me-2"
                                        onClick={() => onEdit(c)}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => onDelete(c.id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div>
                    <div className="d-flex justify-content-center mt-3">
                        <nav>
                            <ul className="pagination">

                                {/* Prev */}
                                <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                                    <button
                                        className="page-link"
                                        onClick={() => setPage(page - 1)}
                                    >
                                        «
                                    </button>
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

                                    // Trang đầu + ...
                                    if (start > 1) {
                                        pages.push(
                                            <li key={1} className="page-item">
                                                <button className="page-link" onClick={() => setPage(1)}>
                                                    1
                                                </button>
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

                                    // Các trang chính
                                    for (let i = start; i <= end; i++) {
                                        pages.push(
                                            <li
                                                key={i}
                                                className={`page-item ${page === i ? "active" : ""}`}
                                            >
                                                <button
                                                    className="page-link"
                                                    onClick={() => setPage(i)}
                                                >
                                                    {i}
                                                </button>
                                            </li>
                                        );
                                    }

                                    // ... + trang cuối
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
                                                <button
                                                    className="page-link"
                                                    onClick={() => setPage(totalPages)}
                                                >
                                                    {totalPages}
                                                </button>
                                            </li>
                                        );
                                    }

                                    return pages;
                                })()}

                                {/* Next */}
                                <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                                    <button
                                        className="page-link"
                                        onClick={() => setPage(page + 1)}
                                    >
                                        »
                                    </button>
                                </li>

                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        </>
    )
}
