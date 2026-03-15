import { useNavigate } from "react-router-dom";
import React from "react";
// Đã xóa import Link vì mình không thèm xài nó nữa
import logo from "../src/public/bvmt-removebg-preview.png"; 

function Sidebar() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user")) || {};

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    // Hàm chuyển trang ngầm, không lộ link
    const goTo = (path) => {
        navigate(path);
    };

    return (
        <div className="sidebar">
            {/* Logo */}
            <div className="logo mb-4 mt-3 px-3">
                <h3 className="d-flex align-items-center justify-content-center text-primary fw-bold" style={{ margin: 0, whiteSpace: "nowrap", fontSize: "1.4rem" }}>
                    <img
                        src={logo}
                        alt="Logo"
                        style={{
                            width: '80px',
                            height: 'auto',
                            marginRight: '1px',
                            mixBlendMode: 'multiply' /* <--- TUYỆT CHIÊU XÓA NỀN TRẮNG BẰNG CSS */
                        }}
                    />
                    Quản lý nước
                </h3>
            </div>

            {/* User Info */}
            <div className="user-box">
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
            <div className="menu">

                {/* =========================================
                    NHÓM 1: AI CŨNG THẤY (Admin & User)
                ========================================= */}
                <a className="menu-item" onClick={() => goTo('/sales')} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-file-alt"></i>
                    Bán hàng
                </a>

                <a className="menu-item" onClick={() => goTo('/invoices')} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-file-invoice"></i>
                    Lịch sử giao dịch
                </a>

                <a className="menu-item" onClick={() => goTo('/customers')} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-users"></i>
                    Khách hàng
                </a>

                <a className="menu-item" onClick={() => goTo('/reports')} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-file"></i>
                    Báo cáo
                </a>


                {/* =========================================
                    NHÓM 2: CHỈ ADMIN MỚI THẤY
                ========================================= */}
                {user?.role === "admin" && (
                    <>
                        <a className="menu-item" onClick={() => goTo('/users')} style={{ cursor: 'pointer' }}>
                            <i className="fa fa-user-shield"></i>
                            Quản lý Nhân sự
                        </a>

                        <a className="menu-item" onClick={() => goTo('/dashboard')} style={{ cursor: 'pointer' }}>
                            <i className="fa fa-chart-bar"></i>
                            Dashboard
                        </a>

                        <a className="menu-item" onClick={() => goTo('/products')} style={{ cursor: 'pointer' }}>
                            <i className="fa fa-box"></i>
                            Sản phẩm
                        </a>

                        <a className="menu-item" onClick={() => goTo('/stock')} style={{ cursor: 'pointer' }}>
                            <i className="fa fa-warehouse"></i>
                            Kho
                        </a>
                    </>
                )}

                {/* Logout */}
                <a className="menu-item logout mt-4 text-danger fw-bold" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-sign-out-alt"></i>
                    Logout
                </a>
            </div>
        </div>
    );
}

export default Sidebar;