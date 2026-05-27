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
import PublicShop from '../pages/PublicShop'
import Orders from '../pages/orders'
import Register from '../pages/Register'
import ForgotPassword from '../pages/ForgotPassword'
import SystemLogs from '../pages/SystemLogs'
import OrderTracking from '../pages/OrderTracking'
import OrderLookup from '../pages/OrderLookup'
import ChangePassword from '../pages/changepassword'

import ProtectedRoute from '../components/protectedroute'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ==========================================
            1. KHU VỰC PUBLIC: AI CŨNG VÀO ĐƯỢC
            (Không cần bọc ProtectedRoute)
        ========================================== */}
        {/* <BrowserRouter basename="/nodejs"></BrowserRouter> */}
        <Route path="/" element={<PublicShop />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/tracking/:orderId" element={<OrderTracking />} />
        <Route path="/lookup" element={<OrderLookup />} />
        <Route path="/change-password" element={<ChangePassword />} />
        {/* ==========================================
            NHÓM ADMIN (Đã được bảo vệ bằng ProtectedRoute)
        ========================================== */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute allowedRoles={['admin']}><Products /></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute allowedRoles={['admin']}><Stock /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute allowedRoles={['admin']}><SystemLogs /></ProtectedRoute>} />

        {/* ==========================================
            NHÓM NHÂN VIÊN & ADMIN ĐỀU VÀO ĐƯỢC
        ========================================== */}
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customer /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />
        <Route path="/invoice/:id" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />

        {/* ==========================================
            3. HỐ ĐEN VŨ TRỤ: BẢO MẬT CUỐI CÙNG
            Khách gõ link tào lao (vd: /admin, /test, /abc) 
            sẽ bị đá văng về trang chủ mua nước hết!
        ========================================== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App