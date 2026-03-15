import { useState } from 'react'
import React from 'react'

import './App.css'
import Login from '../pages/login'
import Dashboard from '../pages/dashboard'
import Products from '../pages/products'
import Stock from '../pages/stock'
import Sales from '../pages/sales'
import Customer from '../pages/customers'
import Invoice from '../pages/invoice'
import Users from '../pages/Users'
import Reports from '../pages/Reports'

import ProtectedRoute from '../components/protectedroute'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom' // <-- Thêm Navigate

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ==========================================
            NHÓM 1: CHỈ ADMIN MỚI ĐƯỢC VÀO
            Gắn thêm allowedRoles={['admin']}
        ========================================== */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute allowedRoles={['admin']}><Products /></ProtectedRoute>
        } />
        <Route path="/stock" element={
          <ProtectedRoute allowedRoles={['admin']}><Stock /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>
        } />

        {/* ==========================================
            NHÓM 2: AI CŨNG VÀO ĐƯỢC (Nhân viên + Quản lý)
            Không cần truyền allowedRoles
        ========================================== */}
        <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customer /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />
        <Route path="/invoice/:id" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />

        {/* Xử lý an toàn: Nếu gõ localhost:5173/ linh tinh thì đá về trang Đăng nhập */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App