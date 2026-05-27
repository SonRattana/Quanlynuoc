import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Pagination from "../components/Pagination";
import { io } from "socket.io-client";
import api from "../src/utils/axios";

const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);
// const socket = io("http://192.168.1.129:3000");

export default function Orders() {
    // Hàm đọc số trang từ URL giống hệt file Products.jsx
    const getPageFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return Number(params.get("page")) || 1;
    };

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // THÊM STATE QUẢN LÝ TRANG
    const [page, setPage] = useState(getPageFromURL());
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10; // Hiện 10 đơn mỗi trang

    const token = localStorage.getItem("token");

    // ================= TỰ CẬP NHẬT URL KHI ĐỔI TRANG =================
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("page", page);
        window.history.replaceState({}, "", `?${params}`);
    }, [page]);

    // ================= FETCH DỮ LIỆU ĐƠN HÀNG (CÓ PHÂN TRANG) =================
    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Truyền thêm page và limit vào URL API
            const res = await api.get(`api/orders?page=${page}&limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.data;

            // Lấy dữ liệu theo format mới của Backend
            if (data.data) {
                setOrders(data.data);
                setTotalPages(data.totalPages);
            } else {
                setOrders(data); // Đề phòng trường hợp API cũ
            }
            setLoading(false);
        } catch (error) {
            console.error("Lỗi lấy đơn hàng:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page]); // <-- RẤT QUAN TRỌNG: Gọi lại API mỗi khi chuyển trang

    useEffect(() => {
        socket.on("co_don_hang_moi", () => {
            fetchOrders();
        });
        return () => {
            socket.off("co_don_hang_moi");
        };
    }, [page]); // <-- Sửa lại dependency để không bị lỗi lúc F5

    // HÀM CHỐT ĐƠN (Gắn ở bước trước)
    const handleUpdateStatus = async (id, newStatus) => {
        // Tùy chỉnh câu hỏi xác nhận cho từng nút
        const actionText = newStatus === 'delivering'
            ? "Chuyển đơn này sang trạng thái ĐANG GIAO HÀNG?"
            : "Xác nhận đã GIAO XONG đơn này? (Hệ thống sẽ trừ kho và lên biên lai)";

        if (!window.confirm(actionText)) return;

        try {
            // [QUAN TRỌNG]: Gửi kèm payload { status: newStatus } ở tham số thứ 2
            const res = await api.put(`api/orders/${id}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.status === 200 || res.status === 201) {
                fetchOrders(); // Load lại bảng để cập nhật màu sắc
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
                            <table className="table table-hover align-middle border">
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
                                            {/* Sửa colSpan thành 8 vì bảng giờ có 8 cột */}
                                            <td colSpan="8" className="text-center p-5 text-muted">
                                                <i className="fa fa-box-open fs-1 mb-3 opacity-50"></i>
                                                <br />
                                                Chưa có đơn hàng nào...
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order.id} className="align-middle">
                                                {/* 1. MÃ ĐƠN */}
                                                <td className="text-center fw-bold text-danger">#{order.id}</td>

                                                {/* 2. TÊN KHÁCH HÀNG */}
                                                <td className="fw-bold">{order.customer_name}</td>

                                                {/* 3. SỐ ĐIỆN THOẠI (Kèm Email cho gọn) */}
                                                <td className="text-center">
                                                    <div className="text-primary fw-bold">{formatPhone(order.phone)}</div>
                                                    {order.email && <div className="text-muted small">{order.email}</div>}
                                                </td>

                                                {/* 4. ĐỊA CHỈ GIAO */}
                                                <td>{order.shipping_address}</td>

                                                {/* 5. CỘT GHI CHÚ ĐỨNG RIÊNG (Tô đỏ in nghiêng cho Shipper dễ đọc) */}
                                                <td className="text-danger small fw-bold fst-italic">
                                                    {order.note || ''}
                                                </td>

                                                {/* 6. TỔNG TIỀN */}
                                                <td className="text-end text-danger fw-bold">
                                                    {Number(order.total_amount).toLocaleString("vi-VN")} đ
                                                </td>

                                                {/* 7. TRẠNG THÁI */}
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

                                                {/* 8. CHI TIẾT */}
                                                <td className="text-center">
                                                    <button
                                                        className="btn btn-outline-primary btn-sm fw-bold shadow-sm"
                                                        onClick={() => window.open(`/tracking/${order.id}`, '_blank')}
                                                        title="Mở tab mới xem giao diện Tracking của khách"
                                                    >
                                                        <i className="fa fa-eye me-1"></i> Theo Dõi
                                                    </button>
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
            </div>
        </Layout>
    );
}