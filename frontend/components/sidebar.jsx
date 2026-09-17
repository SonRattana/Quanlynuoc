import { useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react"; // 💡 THÊM useRef Ở ĐÂY
import logo from "../src/public/bvmt-removebg-preview.png";
import axios from "axios";
import api from "../src/utils/axios";
import { io } from "socket.io-client";
const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);

function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user")) || {};

    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // 💡 1. TẠO BỘ NHỚ LƯU TỌA ĐỘ THANH CUỘN
    const sidebarRef = useRef(null);

    // 💡 2. KHÔI PHỤC VỊ TRÍ CUỘN MỖI KHI LOAD LẠI HOẶC CHUYỂN TRANG
    useEffect(() => {
        const savedPos = sessionStorage.getItem("sidebarScrollY");
        if (sidebarRef.current && savedPos) {
            // Khôi phục lại vị trí cũ
            sidebarRef.current.scrollTop = Number(savedPos);
        }
    }, [location.pathname]); // Chạy lại mỗi khi sếp bấm sang link mới

    // 💡 3. HÀM GHI NHỚ TỌA ĐỘ KHI SẾP LĂN CHUỘT
    const handleScroll = (e) => {
        sessionStorage.setItem("sidebarScrollY", e.target.scrollTop);
    };

    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const res = await axios.get(`api/orders/count-pending`);
                setUnreadCount(res.data.count);
            } catch (error) {
                console.error("Lỗi lấy số đơn chờ:", error);
            }
        };
        fetchPendingCount();
    }, []);

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

    const isActive = (path) => {
        return location.pathname === path ? "active" : "";
    };

    return (
        <>
            <style>{`
                .menu-item {
                    position: relative; 
                    padding: 12px 15px; 
                    border-radius: 8px; 
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

                .menu-item.active {
                    background-color: rgba(13, 110, 253, 0.1) !important; 
                    color: #0d6efd !important; 
                    font-weight: 800 !important; 
                    border-left: 4px solid #0d6efd; 
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

                .sidebar {
                    overflow-y: auto !important; 
                    padding-bottom: 0px !important; 
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
                        padding-bottom: 0px !important; 
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

            {/* 💡 4. GẮN MỎ NEO VÀ SỰ KIỆN CUỘN VÀO KHUNG SIDEBAR */}
            <div 
                ref={sidebarRef}
                onScroll={handleScroll}
                className={`sidebar d-flex flex-column ${isOpen ? "open" : ""}`} 
                style={{ height: "100vh" }}
            >
                <div className="logo mb-2 mt-1 px-3">
                    <h3 className="d-flex align-items-center justify-content-center text-primary fw-bold" style={{ margin: 0, whiteSpace: "nowrap", fontSize: "1.4rem" }}>
                        <img src={logo} alt="Logo" style={{ width: '80px', height: 'auto', marginRight: '10px' }} />
                        MitaFresh
                    </h3>
                </div>

                <div className="user-box mb-3 mt-2 px-3 d-flex align-items-center">
                    <img src="https://i.pravatar.cc/100" alt="user" className="avatar me-2" style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid #0d6efd' }} />
                    <div>
                        <h6 className="fw-bold mb-1" style={{ fontSize: '15px' }}>{user?.username || "User"}</h6>
                        {user?.role === 'admin' ? (
                            <span className="badge bg-danger text-white">Quản lý</span>
                        ) : user?.role === 'ketoan' ? (
                            <span className="badge bg-success text-white">Kế toán</span>
                        ) : user?.role === 'sanxuat' ? (
                            <span className="badge bg-warning text-dark">Sản xuất</span>
                        ) : (
                            <span className="badge bg-secondary text-white">Nhân viên</span>
                        )}
                    </div>
                </div>

                <div className="menu mt-0 px-2">
                    {(() => {
                        const role = user?.role || "nhanvien";
                        const isAdmin = role === "admin";
                        const isKeToan = role === "ketoan";
                        const isSanXuat = role === "sanxuat";
                        const isNhanVien = role === "nhanvien";

                        return (
                            <>
                                {(isAdmin || isKeToan) && (
                                    <>
                                        <div className="text-info small fw-bold px-3 mb-1 mt-2 ">💰 TÀI CHÍNH - BÁO CÁO</div>
                                        <a className={`menu-item ${isActive('/dashboard')}`} onClick={() => goTo('/dashboard')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-chart-bar me-2"></i> Dashboard
                                        </a>
                                        <a className={`menu-item ${isActive('/reports')}`} onClick={() => goTo('/reports')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-chart-line me-2"></i> Báo cáo Tài chính
                                        </a>
                                        <a className={`menu-item ${isActive('/monthly-costing')}`} onClick={() => goTo('/monthly-costing')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-calculator me-2"></i> Chốt Sổ Giá Vốn
                                        </a>
                                        <a className={`menu-item ${isActive('/expenses')}`} onClick={() => goTo('/expenses')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-money-bill me-2"></i> Chi phí Hoạt Động
                                        </a>
                                        <hr className="my-2 text-muted opacity-25" />
                                    </>
                                )}

                                {(isAdmin || isSanXuat || isKeToan) && (
                                    <>
                                        <div className="text-info small fw-bold px-3 mb-1 mt-2">🏭 SẢN XUẤT - KHO</div>
                                        <a className={`menu-item ${isActive('/products')}`} onClick={() => goTo('/products')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-box me-2"></i> Quản lý Sản Phẩm / Nguyên Vật Liệu
                                        </a>
                                        <a className={`menu-item ${isActive('/purchases')}`} onClick={() => goTo('/purchases')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-shopping-cart me-2"></i> Nhập Nguyên Vật Liệu
                                        </a>

                                        {(isAdmin || isSanXuat) && (
                                            <>
                                                <a className={`menu-item ${isActive('/bomsetup')}`} onClick={() => goTo('/bomsetup')} style={{ cursor: 'pointer' }}>
                                                    <i className="fa fa-cogs me-2"></i> Cấu Hình Công Thức Sản Xuất
                                                </a>
                                                <a className={`menu-item ${isActive('/production')}`} onClick={() => goTo('/production')} style={{ cursor: 'pointer' }}>
                                                    <i className="fa fa-industry me-2"></i> Lệnh Sản xuất
                                                </a>
                                            </>
                                        )}

                                        <a className={`menu-item ${isActive('/production-history')}`} onClick={() => goTo('/production-history')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-history me-2"></i> Lịch sử Sản xuất
                                        </a>
                                        <a className={`menu-item ${isActive('/stock')}`} onClick={() => goTo('/stock')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-warehouse me-2"></i> Nhập/Xuất Kho
                                        </a>
                                        <hr className="my-2 text-muted opacity-25" />
                                    </>
                                )}

                                {(isAdmin || isNhanVien || isKeToan) && (
                                    <>
                                        <div className="text-info small fw-bold px-3 mb-1 mt-2">🛒 BÁN HÀNG</div>
                                        <a className={`menu-item ${isActive('/sales-orders')}`} onClick={() => goTo('/sales-orders')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-clipboard-list me-2"></i> Đơn Đặt Hàng
                                        </a>
                                        {(isAdmin || isNhanVien) && (
                                            <>
                                                <a className={`menu-item ${isActive('/sales')}`} onClick={() => goTo('/sales')} style={{ cursor: 'pointer' }}>
                                                    <i className="fa fa-file-alt me-2"></i> Bán hàng
                                                </a>

                                            </>
                                        )}

                                        <a className={`menu-item ${isActive('/invoices')}`} onClick={() => goTo('/invoices')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-file-invoice me-2"></i> Lịch sử giao dịch
                                        </a>
                                        <a className={`menu-item ${isActive('/customers')}`} onClick={() => goTo('/customers')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-users me-2"></i> Khách hàng
                                        </a>
                                        <a className={`menu-item ${isActive('/bottle-deposits')}`} onClick={() => goTo('/bottle-deposits')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-retweet me-2"></i> Quản lý Nợ vỏ
                                        </a>
                                        <hr className="my-2 text-muted opacity-25" />
                                    </>
                                )}

                                {isAdmin && (
                                    <>
                                        <div className="text-info small fw-bold px-3 mb-1 mt-2">⚙️ HỆ THỐNG</div>
                                        <a className={`menu-item ${isActive('/users')}`} onClick={() => goTo('/users')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-user-shield me-2"></i> Quản lý Nhân sự
                                        </a>
                                        <a className={`menu-item ${isActive('/logs')}`} onClick={() => goTo('/logs')} style={{ cursor: 'pointer' }}>
                                            <i className="fa fa-shield-alt me-2"></i> Nhật ký hệ thống
                                        </a>
                                        <hr className="my-2 text-muted opacity-25" />
                                    </>
                                )}

                                <a className={`menu-item fw-bold ${isActive('/change-password')}`} onClick={() => goTo('/change-password')} style={{ cursor: 'pointer' }}>
                                    <i className="fa fa-key me-2"></i> Đổi mật khẩu
                                </a>

                                <a className="menu-item logout text-danger fw-bold" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                                    <i className="fa fa-sign-out-alt me-2"></i> Đăng xuất
                                </a>
                            </>
                        );
                    })()}
                </div>
                
                <div
                    className="mt-auto p-3 text-center text-white"
                    style={{
                        backgroundColor: "#0d6efd",
                        position: "sticky",
                        bottom: "0",
                        marginLeft: "-20px", 
                        marginRight: "-20px", 
                        marginBottom: "0",
                        fontSize: "12px",
                        zIndex: 999,
                        boxShadow: "0 -4px 10px rgba(0,0,0,0.15)"
                    }}
                >
                    &copy; {new Date().getFullYear()} Bản quyền thuộc về <br />
                    <span className="fw-bold text-warning fs-6">Phòng CNTT</span> <br />
                </div>
            </div>
        </>
    );
}

export default Sidebar;