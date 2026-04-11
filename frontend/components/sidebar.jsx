import { useNavigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import logo from "../src/public/bvmt-removebg-preview.png";
function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user")) || {};

    // State để quản lý việc mở/đóng menu trên điện thoại
    const [isOpen, setIsOpen] = useState(false);

    // Tự động đóng menu khi anh bấm chuyển trang trên đt
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const goTo = (path) => {
        navigate(path);
    };

    return (
        <>
            {/* NHÚNG CSS CHỮA CHÁY CHO GIAO DIỆN ĐIỆN THOẠI (LIỀU MẠNH) */}
            <style>{`
            /* ============================================== */
                /* FIX LỖI MẤT MENU TRÊN PC: BẬT THANH CUỘN DỌC   */
                /* ============================================== */
                .sidebar {
                    overflow-y: auto !important; 
                    padding-bottom: 30px !important; 
                    /* 2 dòng dưới là tàng hình scroll trên Firefox/Edge */
                    scrollbar-width: none !important; 
                    -ms-overflow-style: none !important; 
                }
                
                /* TÀNG HÌNH THANH CUỘN TRÊN CHROME/CỐC CỐC/SAFARI */
                .sidebar::-webkit-scrollbar {
                    width: 0px; /* Cho độ rộng bằng 0 luôn */
                    background: transparent; 
                }
                /* ============================================== */
                /* Khóa chặt chiều ngang màn hình */
                html, body {
                    overflow-x: hidden !important; 
                    max-width: 100vw !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                /* Nút 3 gạch */
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

                /* CẦU HÌNH DÀNH RIÊNG CHO ĐIỆN THOẠI (Dưới 768px) */
                @media (max-width: 768px) {
                    .mobile-toggle-btn {
                        display: flex !important; 
                    }
                    .mobile-overlay.show {
                        display: block !important; 
                    }
                    
                    /* Bảng cho vuốt ngang */
                    .table-responsive {
                        width: 100% !important;
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }

                    /* Khung Sidebar trượt */
                    .sidebar {
                    padding-top: 10px !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: -300px !important; 
                        width: 260px !important;
                        height: 100vh !important;
                        z-index: 9998 !important;
                        transition: left 0.3s ease-in-out !important; 
                        box-shadow: 4px 0 15px rgba(0,0,0,0.2);
                        overflow-y: auto !important; 
                        flex-direction: column !important; 
                        background: #fff;
                    }
                    .sidebar.open {
                        left: 0 !important; 
                    }
                    .sidebar .menu {
                        flex-direction: column !important; 
                    }

                    /* 🔥 ĐÂY LÀ THUỐC ĐẶC TRỊ BỆNH "MẤT PHÂN NỬA MÀN HÌNH" 🔥 */
                    /* Ép cục Nội dung (nằm kế Sidebar) không được chừa lùi sang phải nữa */
                    .sidebar + div, .main-content, #root > div > div:nth-child(2) {
                        margin-left: 0 !important; 
                        width: 100vw !important; 
                        max-width: 100vw !important;
                        padding-left: 15px !important;
                        padding-right: 15px !important;
                        padding-top: 70px !important; /* Đẩy nội dung xuống xíu chừa chỗ cho Nút 3 gạch */
                        box-sizing: border-box !important;
                    }

                    /* Ép mấy cái Form (Nhập kho, Xuất kho) phải thu mình lại, không được đâm rách viền */
                    .bg-white.p-5, .bg-white.p-4, .p-md-4 {
                        padding: 15px !important; 
                        margin: 0 !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }

                    /* Bẻ gãy các thẻ row (hàng) của Bootstrap hay bị dư biên ngang */
                    .row {
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        width: 100% !important;
                    }
                }
            `}</style>

            {/* NÚT HAMBURGER DÀNH CHO MOBILE */}
            <button
                className="btn btn-primary mobile-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
            >
                <i className={isOpen ? "fa fa-times fs-4" : "fa fa-bars fs-4"}></i>
            </button>

            {/* MÀN MỜ TRÊN MOBILE */}
            <div
                className={`mobile-overlay ${isOpen ? "show" : ""}`}
                onClick={() => setIsOpen(false)}
            ></div>

            {/* KHỐI SIDEBAR CHÍNH */}
            <div className={`sidebar ${isOpen ? "open" : ""}`}>
                
                {/* Logo - Đổi mt-3 thành mt-1 (sát nóc), mb-4 thành mb-2 (sát mục User) */}
                <div className="logo mb-2 mt-1 px-3">
                    <h3 className="d-flex align-items-center justify-content-center text-primary fw-bold" style={{ margin: 0, whiteSpace: "nowrap", fontSize: "1.4rem" }}>
                        <img 
                            src={logo} 
                            alt="Logo" 
                            style={{ width: '80px', height: 'auto', marginRight: '10px' }} 
                        />
                        Quản lý nước
                    </h3>
                </div>

                {/* User Info - Thêm mb-2 để nó xích gần lại với Menu ở dưới */}
                <div className="user-box mb-2">
                    <img
                        src="https://i.pravatar.cc/100"
                        alt="user"
                        className="avatar"
                    />
                    <div>
                        <h6>{user?.username || "User"}</h6>
                        <span className={user?.role === "admin" ? "text-danger fw-bold" : "text-primary"}>
                            {user?.role === "admin" ? "Quản lý" : "Nhân viên"}
                        </span>
                    </div>
                </div>

                {/* Menu */}
                <div className="menu mt-0"> {/* Thêm mt-0 để menu không bị đẩy xuống */}
                    {/* NHÓM 1: AI CŨNG THẤY */}
                    <a className="menu-item" onClick={() => goTo('/sales')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-file-alt"></i> Bán hàng
                    </a>
                    <a className="menu-item" onClick={() => goTo('/invoices')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-file-invoice"></i> Lịch sử giao dịch
                    </a>
                    <a className="menu-item" onClick={() => goTo('/customers')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-users"></i> Khách hàng
                    </a>
                    <a className="menu-item" onClick={() => goTo('/reports')} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-file"></i> Báo cáo
                    </a>

                    {/* NHÓM 2: CHỈ ADMIN MỚI THẤY */}
                    {user?.role === "admin" && (
                        <>
                            <a className="menu-item" onClick={() => goTo('/users')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-user-shield"></i> Quản lý Nhân sự
                            </a>
                            <a className="menu-item" onClick={() => goTo('/dashboard')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-chart-bar"></i> Dashboard
                            </a>
                            <a className="menu-item" onClick={() => goTo('/products')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-box"></i> Sản phẩm
                            </a>
                            <a className="menu-item" onClick={() => goTo('/stock')} style={{ cursor: 'pointer' }}>
                                <i className="fa fa-warehouse"></i> Kho
                            </a>
                        </>
                    )}

                    {/* Logout */}
                    <a className="menu-item logout mt-4 text-danger fw-bold" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        <i className="fa fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </div>
        </>
    );
}

export default Sidebar;