import { useNavigate } from "react-router-dom";

function Sidebar() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("users"));
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("users");
        navigate("/login");
    };

    return (
        <div className="sidebar">
            {/* Logo */}
            <div className="logo">
                <h3>
                    <i className="fa"></i>Quản lý nước
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
                    <span>{user?.role || "User"}</span>
                </div>
            </div>

            {/* Menu */}
            <div className="menu" >
                <a className="menu-item" href="/dashboard">
                    <i className="fa fa-chart-bar"></i>
                    Dashboard
                </a>

                <a className="menu-item" href="/products">
                    <i className="fa fa-box"></i>
                    Sản phẩm
                </a>

                <a className="menu-item" href="/reports">
                    <i className="fa fa-file-alt"></i>
                    Báo cáo
                </a>

                {/* Logout */}
                <a className="menu-item logout" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                    <i className="fa fa-sign-out-alt"></i>
                    Logout
                </a>
            </div>
        </div>
    );
}

export default Sidebar;