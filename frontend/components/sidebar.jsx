import { useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import logo from "../src/public/bvmt-removebg-preview.png";

import { io } from "socket.io-client";
const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user")) || {};

    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(() => {
        const savedCount = localStorage.getItem("unread_orders");
        return savedCount ? parseInt(savedCount, 10) : 0;
    });

    useEffect(() => {
        localStorage.setItem("unread_orders", unreadCount);
    }, [unreadCount]);

    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        socket.on("co_don_hang_moi", () => {
            setUnreadCount(prev => prev + 1);
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
            audio.play().catch(e => console.log("Trình duyệt chặn âm thanh tự động"));
        });
        return () => socket.off("co_don_hang_moi");
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login-admin");
    };

    const goTo = (path) => {
        if (path === '/orders') {
            setUnreadCount(0);
        }
        navigate(path);
    };

    // HÀM KIỂM TRA TRANG HIỆN TẠI ĐỂ TÔ ĐẬM MENU
    const isActive = (path) => {
        return location.pathname === path ? "active" : "";
    };

    return (
        <>
            <style>{`
                /* ============================================== */
                /* ĐỊNH DẠNG LẠI CỤC THÔNG BÁO CHO CHUẨN */
                /* ============================================== */
                .menu-item {
                    position: relative; /* Để cục thông báo neo theo nút */
                    padding: 12px 15px; /* Thêm tí padding cho nút bấm nó bự dễ bấm */
                    border-radius: 8px; /* Bo góc menu */
                    margin-bottom: 5px;
                    display: block;
                    color: #555;
                    transition: all 0.3s ease;
                    text-decoration: none;
                }
                
                .menu-item:hover {
                    background-color: #f8f9fa;
                    color: #0d6efd;
                }

                /* ============================================== */
                /* CSS CHO TRANG ĐANG ĐƯỢC CHỌN (ACTIVE) */
                /* ============================================== */
                .menu-item.active {
                    background-color: rgba(13, 110, 253, 0.1) !important; /* Nền xanh nhạt */
                    color: #0d6efd !important; /* Chữ xanh đậm */
                    font-weight: 800 !important; /* Tô đậm chữ */
                    border-left: 4px solid #0d6efd; /* Vạch kẻ xanh bên trái nhìn cực kỳ pro */
                }

                .badge-notify {
                    background: #ff4d4f;
                    color: white;
                    border-radius: 50%;
                    padding: 2px 6px;
                    font-size: 11px;
                    font-weight: bold;
                    position: absolute;
                    top: 50%;
                    right: 15px;
                    transform: translateY(-50%);
                    box-shadow: 0 0 5px rgba(255, 77, 79, 0.5);
                }

                /* FIX LỖI THANH CUỘN */
                .sidebar {
                    overflow-y: auto !important; 
                    padding-bottom: 30px !important; 
                    scrollbar-width: none !important; 
                    -ms-overflow-style: none !important; 
                }
                .sidebar::-webkit-scrollbar {
                    width: 0px; 
                    background: transparent; 
                }
                html, body {
                    overflow-x: hidden !important; 
                    max-width: 100vw !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                .mobile-toggle-btn {
                    position: fixed !important; 
                    top: 15px !important;
                    left: 15px !important;
                    z-index: 9999 !important; 
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    width: 45px;
                    height: 45px;
                    display: none; 
                    align-items: center;
                    justify-content: center;
                    background-color: #0d6efd; 
                    color: white;
                    border: none;
                }
                
                .mobile-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0,0,0,0.5) !important;
                    z-index: 9997 !important;
                    display: none;
                }

                /* ============================================== */
                /* GIAO DIỆN ĐIỆN THOẠI */
                /* ============================================== */
                @media (max-width: 768px) {
                    .mobile-toggle-btn { display: flex !important; }
                    .mobile-overlay.show { display: block !important; }
                    
                    .table-responsive {
                        width: 100% !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }

                    .sidebar {
                        position: fixed !important;
                        top: 0 !important;
                        left: -300px !important; 
                        width: 260px !important;
                        height: 100vh !important;
                        z-index: 9998 !important;
                        transition: left 0.3s ease-in-out !important; 
                        box-shadow: 4px 0 15px rgba(0,0,0,0.2);
                        background: #fff;
                        display: flex !important;
                        flex-direction: column !important; 
                        justify-content: flex-start !important; 
                        align-items: stretch !important;
                        padding-top: 20px !important; 
                        padding-bottom: 80px !important; 
                        overflow-y: auto !important; 
                    }
                    .sidebar.open { left: 0 !important; }
                    .sidebar .menu { flex-direction: column !important; padding: 0 15px; }

                    .badge-notify {
                        top: 10px; 
                        right: 10px;
                        transform: none;
                    }

                    .sidebar + div, .main-content, #root > div > div:nth-child(2) {
                        margin-left: 0 !important; 
                        width: 100vw !important; 
                        max-width: 100vw !important;
                        padding-left: 15px !important;
                        padding-right: 15px !important;
                        padding-top: 70px !important; 
                        box-sizing: border-box !important;
                    }
                    .bg-white.p-5, .bg-white.p-4, .p-md-4 {
                        padding: 15px !important; 
                        margin: 0 !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .row {
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        width: 100% !important;
                    }
                }
            `}</style>

            <button className="btn btn-primary mobile-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
                <i className={isOpen ? "fa fa-times fs-4" : "fa fa-bars fs-4"}></i>
            </button>

            <div className={`mobile-overlay ${isOpen ? "show" : ""}`} onClick={() => setIsOpen(false)}></div>

            <div className={`sidebar ${isOpen ? "open" : ""}`}>
                <div className="logo mb-2 mt-1 px-3">
                    <h3 className="d-flex align-items-center justify-content-center text-primary fw-bold" style={{ margin: 0, whiteSpace: "nowrap", fontSize: "1.4rem" }}>
                        <img src={logo} alt="Logo" style={{ width: '80px', height: 'auto', marginRight: '10px' }} />
                        MitaFresh
                    </h3>
                </div>

                <div className="user-box mb-2 px-3">
                    <img src="https://i.pravatar.cc/100" alt="user" className="avatar" />
                    <div>
                        <h6>{user?.username || "User"}</h6>
                        <span className={user?.role === "admin" ? "text-danger fw-bold" : "text-primary"}>
                            {user?.role === "admin" ? "Quản lý" : "Nhân viên"}
                        </span>
                    </div>
                </div>

                <div className="menu mt-0 px-2">
                    <a className={`menu-item ${isActive('/')}`} onClick={() => goTo('/')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-store text-success me-2"></i> Xem Cửa hàng
                    </a>

                    <hr className="my-2 text-muted opacity-25" />
                    {/* ========================================== */}
                    {/* KHU VỰC CHỈ DÀNH CHO SẾP (ADMIN) */}
                    {/* ========================================== */}
                    {user?.role === "admin" && (
                        <>
                            <hr className="my-2 text-muted opacity-25" />
                            <a className={`menu-item ${isActive('/dashboard')}`} onClick={() => goTo('/dashboard')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-chart-bar me-2"></i> Dashboard
                            </a>

                            {/* Giấu trang Báo cáo lợi nhuận vào đây */}
                            <a className={`menu-item ${isActive('/reports')}`} onClick={() => goTo('/reports')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-chart-line me-2"></i> Báo cáo Tài chính
                            </a>

                            <a className={`menu-item ${isActive('/products')}`} onClick={() => goTo('/products')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-box me-2"></i> Quản lý Sản phẩm
                            </a>
                            <a className={`menu-item ${isActive('/stock')}`} onClick={() => goTo('/stock')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-warehouse me-2"></i> Nhập/Xuất Kho
                            </a>
                            <a className={`menu-item ${isActive('/users')}`} onClick={() => goTo('/users')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-user-shield me-2"></i> Quản lý Nhân sự
                            </a>
                            <a className={`menu-item ${isActive('/logs')}`} onClick={() => goTo('/logs')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-history me-2"></i> Nhật ký hệ thống
                            </a>
                        </>
                    )}
                    {/* ========================================== */}
                    {/* KHU VỰC CỦA NHÂN VIÊN VÀ SẾP (XÀI CHUNG) */}
                    {/* ========================================== */}

                    {/* Kéo nút Đơn hàng ra đây cho Nhân viên trực online */}
                    <a className={`menu-item ${isActive('/orders')}`} onClick={() => goTo('/orders')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-clipboard-list me-2"></i> Đơn online
                        {unreadCount > 0 && (
                            <span className="badge-notify">{unreadCount}</span>
                        )}
                    </a>

                    <a className={`menu-item ${isActive('/sales')}`} onClick={() => goTo('/sales')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-file-alt me-2"></i> Bán tại quầy
                    </a>
                    <a className={`menu-item ${isActive('/invoices')}`} onClick={() => goTo('/invoices')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-file-invoice me-2"></i> Lịch sử giao dịch
                    </a>
                    <a className={`menu-item ${isActive('/customers')}`} onClick={() => goTo('/customers')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-users me-2"></i> Khách hàng
                    </a>

                    <hr className="my-3 text-muted opacity-25" />

                    <a className="menu-item logout text-danger fw-bold" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-sign-out-alt me-2"></i> Đăng xuất
                    </a>
                </div>
            </div>
        </>
    );
}

export default Sidebar;