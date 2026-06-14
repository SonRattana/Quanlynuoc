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
    onPayDebt,
    onDeposit,
    onView,
    totalPages,
    setPage,
}) {
    return (
        <>
            <div className="bg-white p-4 shadow-sm">
                <h5 className="fw-bold mb-3">Danh sách khách hàng</h5>
                <div className="table-responsive">
                    <table className="table table-hover align-middle table-mobile-cards">
                        <thead className="table-light text-nowrap">
                            <tr>
                                <th>Mã khách hàng</th>
                                <th>Tên</th>
                                <th>Email</th>
                                <th>Loại</th>
                                <th>SĐT</th>
                                <th style={{ minWidth: "200px" }}>Địa chỉ</th>
                                <th>Trạng thái</th>
                                <th>Ngày tạo</th>
                                <th>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(c => (
                                <tr key={c.id}>
                                    <td data-label="Mã khách hàng" className="fw-bold text-primary text-nowrap">
                                        {c.customer_code || `KH${c.id}`}
                                    </td>
                                    <td data-label="Tên" className="text-nowrap">{c.name}</td>
                                    <td data-label="Email">{c.email || <span className="text-muted fst-italic">Trống</span>}</td>
                                    <td data-label="Loại" className="text-nowrap">
                                        {c.type === 'le' ? 'Khách lẻ' :
                                            c.type === 'cua_hang' ? 'Cửa hàng' :
                                                c.type === 'doanh_nghiep' ? 'Doanh nghiệp' : 'Khoa'}
                                    </td>
                                    <td data-label="SĐT" className="text-nowrap">{c.phone}</td>
                                    <td data-label="Địa Chỉ">{c.address}</td>
                                    <td data-label="Trạng Thái" className="text-nowrap">
                                        <span className={`badge ${c.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                            {c.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td data-label="Ngày Tạo" className="text-nowrap">{formatDateVN(c.created_at)}</td>

                                    <td data-label="Thao Tác" className="text-nowrap">
                                        <div className="d-flex gap-1 flex-wrap justify-content-center" style={{ minWidth: "220px" }}>

                                            {/* Nút Thu Nợ */}
                                            {Number(c.debt_balance) > 0 ? (
                                                <button
                                                    className="btn btn-sm btn-warning fw-bold text-dark shadow-sm"
                                                    onClick={() => onPayDebt(c)}
                                                    title="Đang nợ tiền"
                                                >
                                                    Thu nợ
                                                </button>
                                            ) : (
                                                <button className="btn btn-sm btn-outline-secondary" disabled>Hết nợ</button>
                                            )}

                                            {/* 💡 ĐÃ SỬA: Kiểm tra dựa trên số lượng vỏ còn nợ (remaining_bottles) */}
                                            {Number(c.remaining_bottles) > 0 || Number(c.deposit_balance) > 0 ? (
                                                <button
                                                    className="btn btn-info btn-sm text-white fw-bold shadow-sm"
                                                    onClick={() => onDeposit(c)}
                                                    title="Khách đang giữ vỏ"
                                                >
                                                    Trả vỏ
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-outline-secondary btn-sm"
                                                    disabled
                                                >
                                                    Hết vỏ
                                                </button>
                                            )}

                                            <button
                                                className="btn btn-primary btn-sm fw-bold"
                                                onClick={() => onView(c)}
                                            >
                                                Chi tiết
                                            </button>
                                            <button
                                                className="btn btn-warning btn-sm fw-bold text-dark"
                                                onClick={() => onEdit(c)}
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm fw-bold"
                                                onClick={() => onDelete(c.id)}
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Phân trang */}
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
                                        if (page <= 3) { start = 1; end = Math.min(totalPages, maxVisible); }
                                        if (page > totalPages - 3) { start = Math.max(1, totalPages - maxVisible + 1); end = totalPages; }

                                        if (start > 1) {
                                            pages.push(<li key={1} className="page-item"><button className="page-link" onClick={() => setPage(1)}>1</button></li>);
                                            if (start > 2) pages.push(<li key="start-ellipsis" className="page-item disabled"><span className="page-link">...</span></li>);
                                        }
                                        for (let i = start; i <= end; i++) {
                                            pages.push(<li key={i} className={`page-item ${page === i ? "active" : ""}`}><button className="page-link" onClick={() => setPage(i)}>{i}</button></li>);
                                        }
                                        if (end < totalPages) {
                                            if (end < totalPages - 1) pages.push(<li key="end-ellipsis" className="page-item disabled"><span className="page-link">...</span></li>);
                                            pages.push(<li key={totalPages} className="page-item"><button className="page-link" onClick={() => setPage(totalPages)}>{totalPages}</button></li>);
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
            </div>
        </>
    )
}