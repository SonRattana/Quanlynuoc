import { useState } from 'react'
import React from 'react'
import './App.css'

// Import các trang
import Login from '../pages/login'
import Dashboard from '../pages/dashboard'
import Products from '../pages/products'
import Stock from '../pages/stock'
import Sales from '../pages/sales'
import Customer from '../pages/customers'
import Invoice from '../pages/invoice'
import Users from '../pages/Users'
import Reports from '../pages/Reports'
// import PublicShop from '../pages/PublicShop' // 💡 Tạm thời đóng băng trang Shop
import Orders from '../pages/orders'
import Register from '../pages/Register'
import ForgotPassword from '../pages/ForgotPassword'
import SystemLogs from '../pages/SystemLogs'
import OrderTracking from '../pages/OrderTracking'
import OrderLookup from '../pages/OrderLookup'
import ChangePassword from '../pages/changepassword'
import BomSetup from '../pages/bomsetup'
import Purchases from '../pages/purchases'
import Production from '../pages/Production'
import ProductionHistory from '../pages/ProductionHistory'
import Expenses from '../pages/Expenses'
import ProductionConfig from '../pages/ProductionConfig'
import MonthlyCosting from '../pages/MonthlyCosting'
import ProtectedRoute from '../components/protectedroute'

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  // ==========================================
  // BỘ NHẬN DIỆN: Kiểm tra xem đã đăng nhập chưa
  // ==========================================
  const isAuthenticated = !!localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        {/* ==========================================
            1. MẶT TIỀN MỚI (CHẶN CỬA BẢO MẬT)
            Đã đăng nhập -> Bán hàng. Chưa -> Đăng nhập
        ========================================== */}
        <Route path="/secret-shop" element={isAuthenticated ? <Navigate to="/sales" replace /> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to="/login" />} />
        {/* ==========================================
            2. KHU VỰC PUBLIC: AI CŨNG VÀO ĐƯỢC
        ========================================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Tạm thời vẫn giữ trang Tracking để lỡ khách cũ cần xem đơn đang giao */}
        <Route path="/tracking/:orderId" element={<OrderTracking />} />
        <Route path="/lookup" element={<OrderLookup />} />

        {/* ==========================================
            3. NHÓM TÀI CHÍNH (Admin + Kế Toán)
        ========================================== */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'ketoan']}><Dashboard /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'ketoan']}><Reports /></ProtectedRoute>} />
        <Route path="/monthly-costing" element={<ProtectedRoute allowedRoles={['admin', 'ketoan']}><MonthlyCosting /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute allowedRoles={['admin', 'ketoan']}><Expenses /></ProtectedRoute>} />

        {/* ==========================================
            4. NHÓM SẢN XUẤT KHO (Admin + Sản Xuất)
        ========================================== */}
        <Route path="/products" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat','ketoan']}><Products /></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat', 'ketoan']}><Stock /></ProtectedRoute>} />
        <Route path="/bomsetup" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat']}><BomSetup /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat','ketoan']}><Purchases /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat']}><Production /></ProtectedRoute>} />
        <Route path="/production-history" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat','ketoan']}><ProductionHistory /></ProtectedRoute>} />
        <Route path="/production-config" element={<ProtectedRoute allowedRoles={['admin', 'sanxuat']}><ProductionConfig /></ProtectedRoute>} />

        {/* ==========================================
            5. NHÓM BÁN HÀNG (Admin + Nhân viên + Kế Toán)
        ========================================== */}
        <Route path="/sales" element={<ProtectedRoute allowedRoles={['admin', 'nhanvien']}><Sales /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin', 'nhanvien', 'ketoan']}><Customer /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute allowedRoles={['admin', 'nhanvien', 'ketoan']}><Invoice /></ProtectedRoute>} />
        <Route path="/invoice/:id" element={<ProtectedRoute allowedRoles={['admin', 'nhanvien', 'ketoan']}><Invoice /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute allowedRoles={['admin', 'nhanvien']}><Orders /></ProtectedRoute>} />

        {/* ==========================================
            6. NHÓM HỆ THỐNG CỐT LÕI (Chỉ Admin)
        ========================================== */}
        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute allowedRoles={['admin']}><SystemLogs /></ProtectedRoute>} />
        {/* ==========================================
            7. HỐ ĐEN VŨ TRỤ: BẢO MẬT CUỐI CÙNG
            Gõ link tào lao sẽ bị đá về "Mặt tiền mới" ở trên
        ========================================== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App