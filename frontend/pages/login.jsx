import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Dùng 'api' (Axios) thay vì 'fetch'
      // Nó sẽ tự động lấy baseURL (IP của máy anh) mà anh đã cấu hình trong file axios.js
      const res = await api.post("api/auth/login", {
        username,
        password
      });

      // 2. Axios trả về dữ liệu nằm trong biến .data
      const data = res.data;

      // 3. Lưu thông tin (Giữ nguyên logic của anh)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (err) {
      // 4. Bắt lỗi: Nếu backend trả về lỗi, lấy message đó hiện lên Toast
      const errorMsg = err.response?.data?.message || "Lỗi server hoặc sai thông tin";
      setToast({ message: errorMsg, type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div
        className="d-flex justify-content-center align-items-center vh-100"
        style={{
          background: "linear-gradient(135deg, #0d6efd, #4e73df)",
        }}
      >
        <div
          className="bg-white p-5 rounded-4 shadow-lg"
          style={{ width: "100%", maxWidth: "400px" }}
        >
          <div className="text-center mb-4">
            <img
              src={logo}
              alt="Logo Quản Lý Nước"
              style={{
                width: "120px", 
                marginBottom: "15px",
                mixBlendMode: "multiply" 
              }}
            />
            <h2 className="fw-bold text-primary">QUẢN LÝ NƯỚC</h2>
            <p className="text-muted mb-0">Đăng nhập hệ thống</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Tên đăng nhập
              </label>
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Nhập username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">
                Mật khẩu
              </label>
              <input
                type="password"
                className="form-control form-control-lg"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-100 btn-lg"
              disabled={loading}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}