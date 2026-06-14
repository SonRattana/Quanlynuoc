import React from "react";

export default function StockDetailModal({ transaction, onClose }) {
    if (!transaction) return null;

    const isImport = transaction.type === "import";

    const formatDateVN = (date) => {
        return new Date(date).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
        });
    };

    return (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content shadow">
                    <div className="modal-header bg-light">
                        <h5 className="modal-title fw-bold text-dark">
                            Chi tiết giao dịch #{transaction.id}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    <div className="modal-body px-4">
                        <div className="table-responsive overflow-hidden">
                            <table className="table table-borderless mb-0 align-middle">
                                <tbody>
                                    <tr>
                                        <td className="text-muted text-nowrap" style={{ width: "110px" }}>Loại thao tác:</td>
                                        <td>
                                            <span className={`badge ${isImport ? "bg-success" : "bg-danger"}`}>
                                                {isImport ? "NHẬP KHO" : "XUẤT KHO"}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted text-nowrap">Sản phẩm:</td>
                                        <td className="fw-bold text-primary text-break">{transaction.product_name}</td>
                                    </tr>
                                    <tr className="border-bottom">
                                        <td className="text-muted pb-3 text-nowrap">Kho thực hiện:</td>
                                        <td className="pb-3">
                                            {transaction.warehouse_name ? (
                                                <span className="badge bg-secondary">{transaction.warehouse_name}</span>
                                            ) : (
                                                <span className="text-muted fst-italic">Không xác định</span>
                                            )}
                                        </td>
                                    </tr>
                                    {transaction.type === "export" && (
                                        <tr>
                                            <td className="text-muted text-nowrap">Đích đến:</td>
                                            <td>
                                                {transaction.target_warehouse_name ? (
                                                    <span className="badge bg-info">{transaction.target_warehouse_name}</span>
                                                ) : (
                                                    <span className="text-danger fw-bold">Xuất hủy / Bán lẻ</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="text-muted pt-3 text-nowrap">Số lượng:</td>
                                        <td className={`pt-3 fw-bold fs-5 ${isImport ? "text-success" : "text-danger"}`}>
                                            {isImport ? "+" : "-"}{transaction.quantity}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted text-nowrap">Lý do:</td>
                                        <td className="text-dark text-break">{transaction.reason}</td>
                                    </tr>
                                    <tr>
                                        <td className="text-muted text-nowrap">Thời gian:</td>
                                        <td className="text-dark">{formatDateVN(transaction.created_at)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-footer bg-light">
                        <button type="button" className="btn btn-secondary px-4" onClick={onClose}>
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}