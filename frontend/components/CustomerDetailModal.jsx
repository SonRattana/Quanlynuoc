import React from "react";

function CustomerDetailModal({ customer, depositInfo, onClose }) {
    if (!customer) return null;
    const totalDeposit = depositInfo.reduce(
        (sum, d) => sum + Number(d.deposit_money),
        0
    );
    return (
        <>
            <div className="modal fade show d-block">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">

                        <div className="modal-header bg-info text-white">
                            <h5 className="modal-title">Chi tiết khách hàng</h5>
                            <button className="btn-close" onClick={onClose}></button>
                        </div>

                        <div className="modal-body">

                            <h6>Thông tin khách</h6>

                            <p><b>Tên:</b> {customer.name}</p>
                            <p><b>SĐT:</b> {customer.phone}</p>
                            <p><b>Địa chỉ:</b> {customer.address}</p>
                            <p><b>Loại:</b> {customer.type}</p>
                            <p><b>Ngày tạo:</b> {new Date(customer.created_at).toLocaleDateString("vi-VN")}</p>

                            <hr />

                            <h6>Vỏ đang giữ</h6>
                            <h6 className="mt-3">
                                Tổng tiền cọc: {totalDeposit.toLocaleString()} đ
                            </h6>
                            <table className="table table-bordered table-mobile-cards">
                                <thead>
                                    <tr>
                                        <th>Sản phẩm</th>
                                        <th>Số vỏ</th>
                                        <th>Tiền cọc</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {depositInfo.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="text-center">
                                                Không có dữ liệu
                                            </td>
                                        </tr>
                                    )}

                                    {depositInfo.map((d, i) => (
                                        <tr key={i}>
                                            <td data-label="Sản phẩm">{d.name}</td>
                                            <td data-label="Số vỏ">{d.bottles}</td>
                                            <td data-label="Tiền cọc">
                                                {Number(d.deposit_money).toLocaleString()} đ
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>
                                Đóng
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <div className="modal-backdrop fade show"></div>
        </>
    );
}

export default CustomerDetailModal;