import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Quản lý Màn hình (1: Nhập Email, 2: Nhập OTP & Pass mới)
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ==========================================
  // BƯỚC 1: GỬI YÊU CẦU LẤY MÃ OTP
  // ==========================================
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return setToast({ message: "Vui lòng nhập email!", type: "warning" });

    setLoading(true);
    try {
      const res = await api.post("api/auth/forgot-password/send-otp", { email });
      setToast({ message: res.data.message, type: "success" });
      setStep(2); // Chuyển sang màn hình nhập OTP
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Lỗi gửi OTP", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // BƯỚC 2: XÁC NHẬN OTP & ĐỔI MẬT KHẨU
  // ==========================================
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setToast({ message: "Vui lòng nhập đủ 6 số OTP!", type: "warning" });
    if (newPassword !== confirmPassword) return setToast({ message: "Mật khẩu nhập lại không khớp!", type: "danger" });

    setLoading(true);
    try {
      const res = await api.post("api/auth/forgot-password/reset", {
        email,
        otp,
        newPassword
      });

      alert("🎉 " + res.data.message);
      navigate("/login"); // Thành công đá về trang Đăng nhập
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Lỗi đổi mật khẩu", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="d-flex justify-content-center align-items-center min-vh-100 py-4" style={{ background: "linear-gradient(135deg, #0d6efd, #4e73df)" }}>
        <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg" style={{ width: "100%", maxWidth: "400px" }}>
          <div className="text-center mb-4">
            <img src={logo} alt="Logo" style={{ width: "90px", marginBottom: "10px", mixBlendMode: "multiply" }} />
            <h3 className="fw-bold text-primary">QUÊN MẬT KHẨU</h3>
            <p className="text-muted small">Đừng lo, MitaFresh sẽ giúp bạn!</p>
          </div>

          {/* MÀN HÌNH 1: NHẬP EMAIL */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <div className="mb-4">
                <label className="form-label fw-semibold small">Nhập Email đã đăng ký</label>
                <input 
                  type="email" 
                  className="form-control form-control-lg" 
                  placeholder="Ví dụ: khachhang@gmail.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary w-100 fw-bold py-2" disabled={loading}>
                {loading ? "Đang dò tìm..." : "LẤY MÃ KHÔI PHỤC"}
              </button>
              
              <div className="text-center mt-3">
                <button type="button" className="btn btn-link text-muted small text-decoration-none" onClick={() => navigate("/login")}>
                  <i className="fa fa-arrow-left me-1"></i> Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* MÀN HÌNH 2: NHẬP OTP VÀ PASS MỚI */}
          {step === 2 && (
            <form onSubmit={handleResetPassword}>
              <div className="alert alert-success small mb-3 text-center">
                Mã OTP đã được gửi tới <b>{email}</b>
              </div>
              
              <div className="mb-3">
                <input 
                  type="text" 
                  className="form-control form-control-lg text-center fw-bold text-danger fs-4" 
                  placeholder="Nhập 6 số OTP" 
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} 
                  maxLength="6" 
                  required 
                  style={{ letterSpacing: "5px" }}
                />
              </div>

              <div className="mb-3">
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Mật khẩu mới" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  minLength="6" 
                  required 
                />
              </div>

              <div className="mb-4">
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Nhập lại Mật khẩu mới" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  minLength="6" 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-danger w-100 fw-bold py-2 mb-2" disabled={loading}>
                {loading ? "Đang xử lý..." : "ĐỔI MẬT KHẨU MỚI"}
              </button>

              <div className="text-center">
                <button type="button" className="btn btn-link text-muted small text-decoration-none" onClick={() => setStep(1)}>
                  <i className="fa fa-arrow-left me-1"></i> Đổi email khác
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}