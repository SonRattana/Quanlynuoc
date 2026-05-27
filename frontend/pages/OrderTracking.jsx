import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../src/utils/axios";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

export default function OrderTracking() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const currentUser = JSON.parse(localStorage.getItem("users"));
    useEffect(() => {
        // 1. Lấy thông tin đơn hàng lần đầu
        const fetchOrder = async () => {
            try {
                // (Sếp nhớ làm API get đơn hàng theo ID ở backend nhé: GET /api/orders/:id)
                const res = await api.get(`api/orders/${orderId}`);
                setOrder(res.data);
            } catch (error) {
                console.error("Lỗi lấy đơn hàng:", error);
                alert("Không tìm thấy đơn hàng!");
                navigate("/");
            }
        };
        fetchOrder();

        // 2. Lắng nghe Radar Socket.io (Chỉ nghe đúng ID đơn hàng này)
        const socket = io(BACKEND_URL);

        socket.on(`cap_nhat_don_hang_${orderId}`, (newData) => {
            setOrder(prev => ({ ...prev, status: newData.status }));
            // Đổ chuông ting ting cho khách biết
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
            audio.play().catch(e => console.log("Lỗi play audio"));
        });

        return () => socket.disconnect();
    }, [orderId]);

    if (!order) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div></div>;

    // Quy đổi trạng thái thành số để vẽ thanh tiến trình
    const getStepPosition = (status) => {
        if (status === 'pending') return 1;
        if (status === 'delivering' || status === 'chot') return 2;
        if (status === 'completed' || status === 'xong') return 3;
        return 1; // Mặc định
    };

    const currentStep = getStepPosition(order.status);

    return (
        <div className="container-fluid bg-light min-vh-100 py-5">
            <style>{`
                .tracking-container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 15px; padding: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
                .progress-track { position: relative; display: flex; justify-content: space-between; margin: 40px 0; }
                .progress-track::before { content: ''; position: absolute; top: 15px; left: 0; width: 100%; height: 4px; background: #e9ecef; z-index: 1; }
                .progress-bar-fill { position: absolute; top: 15px; left: 0; height: 4px; background: #28a745; z-index: 2; transition: width 0.5s ease; }
                .step { position: relative; z-index: 3; text-align: center; width: 33.33%; }
                .step-icon { width: 35px; height: 35px; border-radius: 50%; background: #e9ecef; color: #fff; line-height: 35px; margin: 0 auto 10px; font-weight: bold; border: 3px solid #fff; transition: all 0.3s; }
                .step.active .step-icon { background: #28a745; box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.3); }
                .step p { font-size: 0.9rem; font-weight: 500; color: #6c757d; margin: 0; }
                .step.active p { color: #28a745; font-weight: bold; }
            `}</style>

            <div className="tracking-container">
                <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <h4 className="text-primary fw-bold m-0"><i className="fa fa-box me-2"></i>Chi tiết đơn hàng #{orderId}</h4>

                    {/* Gom nhóm các nút bấm lại */}
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/")}>Về trang chủ</button>

                        {/* NẾU LÀ ADMIN HOẶC NHÂN VIÊN (USER) -> HIỆN NÚT VỀ QUẢN LÝ ĐƠN */}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'user') && (
                            <button className="btn btn-warning btn-sm fw-bold text-dark shadow-sm" onClick={() => navigate("/orders")}>
                                <i className="fa fa-clipboard-list me-1"></i> Quản lý đơn hàng
                            </button>
                        )}
                    </div>
                </div>

                {/* THANH TIẾN TRÌNH SHOPEE STYLE */}
                <div className="progress-track">
                    {/* Thanh màu xanh chạy theo trạng thái */}
                    <div className="progress-bar-fill" style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}></div>

                    <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
                        <div className="step-icon"><i className="fa fa-receipt"></i></div>
                        <p>Đã tiếp nhận</p>
                    </div>
                    <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
                        <div className="step-icon"><i className="fa fa-truck"></i></div>
                        <p>Đang giao hàng</p>
                    </div>
                    <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
                        <div className="step-icon"><i className="fa fa-check"></i></div>
                        <p>Giao thành công</p>
                    </div>
                </div>

                <div className="card border-0 bg-light p-3 mt-5">
                    <h6 className="fw-bold"><i className="fa fa-map-marker-alt text-danger me-2"></i>Địa chỉ nhận hàng</h6>
                    <p className="mb-1"><strong>{order.customer_name}</strong> - {order.phone}</p>
                    <p className="text-muted mb-0">{order.shipping_address}</p>
                </div>
            </div>
        </div>
    );
}