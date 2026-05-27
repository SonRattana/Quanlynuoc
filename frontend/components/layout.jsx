import Sidebar from "./sidebar";
import React, { useState, useEffect } from "react";
// 1. Gọi thêm Toast để hiện thông báo và io để bắt sóng
import Toast from "./Toast"; 
import { io } from "socket.io-client";

// 2. Khởi tạo kết nối Socket (Ăng-ten) ngoài component để tránh bị reset
const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";
const socket = io(BACKEND_URL);
// const socket = io("http://192.168.1.129:3000");

function Layout({ children }) {
  // 3. State quản lý việc hiện/ẩn thông báo Popup
  const [toast, setToast] = useState(null);

  useEffect(() => {
        socket.on("co_don_hang_moi", (data) => {
            // 1. Hiện Popup như cũ
            setToast({ 
                message: `🚨 CÓ ĐƠN MỚI! Khách: ${data.customer_name}`, 
                type: "success" 
            });

            // 2. PHÁT TIẾNG CHUÔNG (Sếp dùng link âm thanh online này cho nhanh)
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
            audio.play().catch(err => console.log("Trình duyệt chặn tự động phát âm thanh:", err));
        });

        return () => socket.off("co_don_hang_moi");
    }, []);

  return (
    <div className="d-flex bg-light min-vh-100">
      <Sidebar />

      <div className="content flex-grow-1 p-0 position-relative">
        {/* 5. GẮN CÁI POPUP Ở ĐÂY - TRANG NÀO CŨNG SẼ THẤY */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Nội dung của các trang con (Dashboard, Products, Orders...) */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Layout;