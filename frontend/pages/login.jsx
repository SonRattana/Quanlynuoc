import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function Login() {
  // Đổi từ username sang email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post("api/auth/login", {
        email,
        password
      });

      const data = res.data;

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // ==========================================
      // PHÂN LÀN GIAO THÔNG (ĐÃ CHUẨN HÓA THEO APP.JSX)
      // ==========================================
      const userRole = data.user.role;

      if (userRole === "admin") {
        // Sếp sòng -> Vào thẳng buồng lái
        navigate("/dashboard");
      }
      else if (userRole === "user") {
        // Nhân viên -> Đá thẳng ra quầy bán hàng
        navigate("/sales");
      }
      else if (userRole === "customer") {
        // Khách hàng -> Đẩy ra mặt tiền mua nước
        navigate("/");
      }
      else {
        // Lỗi role tào lao -> Đá ra mặt tiền luôn
        navigate("/");
      }

    } catch (err) {
      // Bắt lỗi xịn hơn: ưu tiên lấy lỗi từ express-validator (nếu có), nếu không có mới lấy lỗi mặc định
      const errorMsg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || "Lỗi server hoặc sai thông tin";
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
            <h2 className="fw-bold text-primary">MitaFresh</h2>
            <p className="text-muted mb-0">Đăng nhập hệ thống</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold">
                Địa chỉ Email
              </label>
              <input
                type="email" // Bắt buộc nhập chuẩn format email có @
                className="form-control form-control-lg"
                placeholder="Nhập email của bạn..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                {/* <label className="form-label fw-semibold mb-0">Mật khẩu</label> */}
                {/* MỚI: NÚT QUÊN MẬT KHẨU */}
                <a href="/forgot-password" className="text-primary small text-decoration-none">Quên mật khẩu?</a>
              </div>
            </div>
            {/* THÊM NÚT ĐĂNG KÝ CHO KHÁCH HÀNG MỚI */}
            <div className="text-center mt-3">
              <span className="text-muted small">Chưa có tài khoản? </span>
              <a href="/register" className="text-primary fw-bold text-decoration-none small">
                Đăng ký ngay
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}