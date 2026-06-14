import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Pagination from "../components/Pagination";
import { io } from "socket.io-client";
import api from "../src/utils/axios";

const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);

export default function Orders() {
    // Hàm đọc số trang từ URL
    const getPageFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return Number(params.get("page")) || 1;
    };

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // THÊM STATE QUẢN LÝ TRANG
    const [page, setPage] = useState(getPageFromURL());
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // ==========================================
    // STATE QUẢN LÝ CÁI BẢNG POPUP CHI TIẾT
    // ==========================================
    const [showModal, setShowModal] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

    const token = localStorage.getItem("token");

    // TỰ CẬP NHẬT URL KHI ĐỔI TRANG
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("page", page);
        window.history.replaceState({}, "", `?${params}`);
    }, [page]);

    // FETCH DỮ LIỆU ĐƠN HÀNG
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get(`api/orders?page=${page}&limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.data;

            if (data.data) {
                setOrders(data.data);
                setTotalPages(data.totalPages);
            } else {
                setOrders(data);
            }
            setLoading(false);
        } catch (error) {
            console.error("Lỗi lấy đơn hàng:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page]);

    useEffect(() => {
        socket.on("co_don_hang_moi", () => {
            fetchOrders();
        });
        return () => {
            socket.off("co_don_hang_moi");
        };
    }, [page]);

    // ==========================================
    // HÀM MỞ POPUP & LẤY CHI TIẾT 1 ĐƠN HÀNG
    // ==========================================
    const handleViewDetails = async (orderId) => {
        try {
            // Dùng thẳng instance api của sếp cho mượt
            const res = await api.get(`api/orders/admin-details/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedOrderDetails(res.data);
            setShowModal(true); // Có data rồi thì bật Popup lên
        } catch (error) {
            console.error("Lỗi lấy chi tiết:", error);
            alert("Lỗi không lấy được chi tiết đơn!");
        }
    };

    // HÀM CHỐT ĐƠN 
    const handleUpdateStatus = async (id, newStatus) => {
        const actionText = newStatus === 'delivering'
            ? "Chuyển đơn này sang trạng thái ĐANG GIAO HÀNG?"
            : "Xác nhận đã GIAO XONG đơn này? (Hệ thống sẽ trừ kho và lên biên lai)";

        if (!window.confirm(actionText)) return;

        try {
            const res = await api.put(`api/orders/${id}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.status === 200 || res.status === 201) {
                fetchOrders();
            } else {
                alert("Lỗi khi cập nhật trạng thái!");
            }
        } catch (error) {
            console.error("Lỗi:", error);
            alert("❌ Lỗi: " + (error.response?.data?.message || "Không thể cập nhật"));
        }
    };

    const formatPhone = (phone) => {
        if (!phone) return "";
        return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    };

    // ==========================================
    // TÍNH TOÁN TIỀN CỌC VÀ TỔNG TIỀN CHO MODAL
    // ==========================================
    let totalDepositModal = 0;
    let finalTotalModal = 0;
    if (showModal && selectedOrderDetails) {
        // Lấy Tiền cọc vỏ * Số lượng
        totalDepositModal = selectedOrderDetails.items.reduce((sum, item) => sum + (Number(item.deposit_price || 0) * item.quantity), 0);
        // Tổng cần thu = Tiền nước (total_amount) + Tổng cọc
        finalTotalModal = Number(selectedOrderDetails.orderInfo.total_amount) + totalDepositModal;
    }

    return (
        <Layout>
            <div className="pt-4 px-4 w-100">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="fw-bold text-primary">📦 Quản lý Đơn hàng</h2>
                    <button className="btn btn-outline-secondary" onClick={fetchOrders}>
                        🔄 Làm mới
                    </button>
                </div>

                <div className="bg-white shadow-sm p-4">
                    <h5 className="fw-bold mb-3">Danh sách đơn chờ</h5>

                    {loading ? (
                        <p className="text-center p-4">Đang tải dữ liệu...</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle border table-mobile-cards">
                                <thead className="table-light">
                                    <tr>
                                        <th className="text-center">Mã Đơn</th>
                                        <th>Tên Khách Hàng</th>
                                        <th className="text-center">Số Điện Thoại/Email</th>
                                        <th>Địa Chỉ Giao</th>
                                        <th>Ghi Chú</th>
                                        <th className="text-end">Tổng Tiền</th>
                                        <th className="text-center">Trạng Thái</th>
                                        <th className="text-center">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center p-5 text-muted">
                                                <i className="fa fa-box-open fs-1 mb-3 opacity-50"></i>
                                                <br />
                                                Chưa có đơn hàng nào...
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order.id} className="align-middle">
                                                <td className="text-center fw-bold text-danger">#{order.id}</td>
                                                <td className="fw-bold">{order.customer_name}</td>
                                                <td className="text-center">
                                                    <div className="text-primary fw-bold">{formatPhone(order.phone)}</div>
                                                    {order.email && <div className="text-muted small">{order.email}</div>}
                                                </td>
                                                <td>{order.shipping_address}</td>
                                                <td className="text-danger small fw-bold fst-italic">
                                                    {order.note || ''}
                                                </td>
                                                <td className="text-end text-danger fw-bold">
                                                    {Number(order.total_amount).toLocaleString("vi-VN")} đ
                                                </td>
                                                <td className="text-center">
                                                    {order.status === 'pending' ? (
                                                        <div className="d-flex justify-content-center gap-2">
                                                            <button
                                                                className="btn btn-info btn-sm fw-bold text-white shadow-sm"
                                                                onClick={() => handleUpdateStatus(order.id, 'delivering')}
                                                                title="Chuyển sang Đang giao"
                                                            >
                                                                <i className="fa fa-truck"></i> Giao
                                                            </button>
                                                            <button
                                                                className="btn btn-warning btn-sm fw-bold text-dark shadow-sm"
                                                                onClick={() => handleUpdateStatus(order.id, 'completed')}
                                                                title="Giao và chốt đơn luôn"
                                                            >
                                                                <i className="fa fa-check"></i> Chốt
                                                            </button>
                                                        </div>
                                                    ) : order.status === 'delivering' ? (
                                                        <button
                                                            className="btn btn-primary btn-sm fw-bold text-white shadow-sm"
                                                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                                                        >
                                                            <i className="fa fa-check-circle me-1"></i> Đã Giao
                                                        </button>
                                                    ) : (
                                                        <span className="badge bg-success px-3 py-2 shadow-sm">Hoàn Thành</span>
                                                    )}
                                                </td>
                                                {/* 8. CHI TIẾT & THEO DÕI */}
                                                <td className="text-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        {/* Nút 1: Bật Popup Chi Tiết của Admin */}
                                                        <button
                                                            className="btn btn-outline-primary btn-sm fw-bold shadow-sm"
                                                            onClick={() => handleViewDetails(order.id)}
                                                            title="Xem chi tiết các món nước của đơn này"
                                                        >
                                                            <i className="fa fa-list me-1"></i> Chi tiết
                                                        </button>

                                                        {/* Nút 2: Mở trang Tracking của Khách */}
                                                        <button
                                                            className="btn btn-outline-info btn-sm fw-bold shadow-sm"
                                                            onClick={() => window.open(`/tracking/${order.id}`, '_blank')}
                                                            title="Mở tab mới xem giao diện Tracking của khách"
                                                        >
                                                            <i className="fa fa-external-link-alt me-1"></i> Theo Dõi
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                        </div>
                    )}
                </div>

                {/* ========================================== */}
                {/* MODAL CHI TIẾT ĐƠN HÀNG CHÀ BÁ NẰM Ở ĐÂY */}
                {/* ========================================== */}
                {showModal && selectedOrderDetails && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
                        <div className="modal-dialog modal-lg modal-dialog-centered">
                            <div className="modal-content shadow-lg border-0">
                                <div className="modal-header bg-primary text-white">
                                    <h5 className="modal-title fw-bold">
                                        🛒 Chi Tiết Đơn Hàng #{selectedOrderDetails.orderInfo.id}
                                    </h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="row mb-4 bg-light p-3 rounded">
                                        <div className="col-md-7">
                                            <p className="mb-2"><strong className="text-muted">👤 Khách hàng:</strong> <span className="fw-bold">{selectedOrderDetails.orderInfo.customer_name}</span></p>
                                            <p className="mb-2"><strong className="text-muted">📞 SĐT:</strong> {formatPhone(selectedOrderDetails.orderInfo.phone)}</p>
                                            <p className="mb-0"><strong className="text-muted">📍 Địa chỉ:</strong> {selectedOrderDetails.orderInfo.shipping_address}</p>
                                        </div>
                                        <div className="col-md-5 text-md-end border-start">
                                            <p className="mb-2 text-primary fw-bold">
                                                🕒 Đặt lúc: {new Date(selectedOrderDetails.orderInfo.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </p>
                                            <p className="mb-0"><strong className="text-muted">Trạng thái:</strong> <span className={`badge ${selectedOrderDetails.orderInfo.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'} ms-1`}>{selectedOrderDetails.orderInfo.status === 'completed' ? 'Hoàn Thành' : selectedOrderDetails.orderInfo.status}</span></p>
                                        </div>
                                    </div>

                                    <h6 className="fw-bold text-primary mb-3"><i className="fa fa-box-open me-2"></i>Sản phẩm khách gọi:</h6>
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-hover mb-0">
                                            <thead className="table-light text-muted">
                                                <tr>
                                                    <th>Tên Món</th>
                                                    <th className="text-center" width="10%">Số lượng</th>
                                                    <th className="text-end" width="20%">Đơn giá</th>
                                                    <th className="text-end" width="20%">Cọc vỏ/bình</th>
                                                    <th className="text-end" width="25%">Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrderDetails.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="fw-bold">{item.product_name}</td>
                                                        <td className="text-center fw-bold text-danger fs-5">{item.quantity}</td>
                                                        <td className="text-end">{Number(item.sell_price).toLocaleString('vi-VN')} đ</td>
                                                        <td className="text-end text-warning fw-bold">
                                                            {Number(item.deposit_price || 0) > 0 ? `${Number(item.deposit_price).toLocaleString('vi-VN')} đ` : '-'}
                                                        </td>
                                                        <td className="text-end fw-bold text-primary">{Number(item.sell_price * item.quantity).toLocaleString('vi-VN')} đ</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="table-light">
                                                <tr>
                                                    <td colSpan="4" className="text-end fw-bold text-muted pt-3 pb-1 border-bottom-0">Tiền nước:</td>
                                                    <td className="text-end fw-bold text-muted pt-3 pb-1 border-bottom-0">
                                                        {Number(selectedOrderDetails.orderInfo.total_amount).toLocaleString('vi-VN')} đ
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan="4" className="text-end fw-bold text-warning py-1 border-bottom-0">Tiền cọc vỏ:</td>
                                                    <td className="text-end fw-bold text-warning py-1 border-bottom-0">
                                                        + {Number(totalDepositModal).toLocaleString('vi-VN')} đ
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan="4" className="text-end fw-bold text-uppercase pt-2 fs-6">Tổng cộng cần thu:</td>
                                                    <td className="text-end fw-bold text-danger fs-4 pt-2">
                                                        {Number(finalTotalModal).toLocaleString('vi-VN')} đ
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light d-flex justify-content-between align-items-center">
                                    <div className="text-danger fst-italic">
                                        <i className="fa fa-comment-dots me-2"></i>Ghi chú: {selectedOrderDetails.orderInfo.note || "Không có"}
                                    </div>
                                    <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => setShowModal(false)}>Đóng</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}