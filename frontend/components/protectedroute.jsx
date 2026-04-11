import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));

    // 1. Chưa đăng nhập -> Đá văng về trang Login
    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    // 2. MỚI: Nếu trang này yêu cầu Quyền đặc biệt (vd: Sếp), mà user không có -> Đá văng về trang Bán hàng
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/sales" replace />; // Cấm cửa!
    }

    // 3. Hợp lệ thì cho render component bên trong
    return children;
}