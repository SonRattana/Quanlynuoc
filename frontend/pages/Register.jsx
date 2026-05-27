import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import logo from "../src/public/bvmt-removebg-preview.png";

export default function Register() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // State quản lý luồng: step 1 là điền thông tin, step 2 là nhập OTP
  const [step, setStep] = useState(1); 

  // Thông tin đăng ký
  const [formData, setFormData] = useState({
    name: "", phone: "", email: "", password: "", confirmPassword: ""
  });
  
  const [otp, setOtp] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ==========================================
  // BƯỚC 1: BẤM NÚT ĐĂNG KÝ -> KIỂM TRA LỖI -> GỌI API BẮN OTP
  // ==========================================
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setToast({ message: "Mật khẩu nhập lại không khớp!", type: "danger" });
    }
    
    setLoading(true);
    try {
      const res = await api.post("api/auth/send-otp", formData);
      setToast({ message: res.data.message, type: "success" });
      setStep(2); // Chuyển sang màn hình nhập OTP
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Lỗi gửi OTP", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // BƯỚC 2: NHẬP OTP XONG -> GỌI API TẠO TÀI KHOẢN
  // ==========================================
  const handleVerifyRegister = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setToast({ message: "Vui lòng nhập đủ 6 số OTP!", type: "warning" });

    setLoading(true);
    try {
      const res = await api.post("api/auth/register", {
        email: formData.email,
        otp: otp
      });
      
      alert("🎉 " + res.data.message);
      navigate("/login"); // Thành công thì đá về trang Đăng nhập
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Sai mã OTP", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="d-flex justify-content-center align-items-center min-vh-100 py-4" style={{ background: "linear-gradient(135deg, #0d6efd, #4e73df)" }}>
        <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg" style={{ width: "100%", maxWidth: "450px" }}>
          <div className="text-center mb-4">
            <img src={logo} alt="Logo" style={{ width: "90px", marginBottom: "10px", mixBlendMode: "multiply" }} />
            <h3 className="fw-bold text-primary">TẠO TÀI KHOẢN</h3>
            <p className="text-muted small">Cùng MitaFresh giải khát mùa hè!</p>
          </div>

         {/* MÀN HÌNH 1: ĐIỀN THÔNG TIN (ĐÃ XÓA Ô ĐỊA CHỈ) */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <div className="row g-2">
                <div className="col-12 mb-2">
                  <input type="text" className="form-control" name="name" placeholder="Họ và tên (*)" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="col-md-6 mb-2">
                  <input type="text" className="form-control" name="phone" placeholder="Số điện thoại (*)" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, "")})} maxLength="10" required />
                </div>
                <div className="col-md-6 mb-3">
                  <input type="email" className="form-control" name="email" placeholder="Email (*)" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="col-md-6 mb-3">
                  <input type="password" className="form-control" name="password" placeholder="Mật khẩu (*)" value={formData.password} onChange={handleChange} minLength="6" required />
                </div>
                <div className="col-md-6 mb-3">
                  <input type="password" className="form-control" name="confirmPassword" placeholder="Nhập lại Mật khẩu (*)" value={formData.confirmPassword} onChange={handleChange} minLength="6" required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100 fw-bold py-2 mt-2" disabled={loading}>
                {loading ? "Đang gửi mã..." : "ĐĂNG KÝ NGAY"}
              </button>
              
              <div className="text-center mt-3 small">
                Đã có tài khoản? <a href="/login" className="text-primary fw-bold text-decoration-none">Đăng nhập</a>
              </div>
            </form>
          )}

          {/* MÀN HÌNH 2: NHẬP OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyRegister} className="text-center">
              <div className="alert alert-success small mb-4">
                Mã xác thực 6 số đã được gửi tới email <b>{formData.email}</b>. Vui lòng kiểm tra hộp thư (hoặc thư rác).
              </div>
              
              <div className="mb-4">
                <input 
                    type="text" 
                    className="form-control form-control-lg text-center fw-bold text-danger fs-3" 
                    placeholder="_ _ _ _ _ _" 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} 
                    maxLength="6" 
                    required 
                    style={{ letterSpacing: "10px" }}
                />
              </div>

              <button type="submit" className="btn btn-danger w-100 fw-bold py-2 mb-3" disabled={loading}>
                {loading ? "Đang xác thực..." : "XÁC NHẬN MÃ OTP"}
              </button>

              <button type="button" className="btn btn-link text-muted small text-decoration-none" onClick={() => setStep(1)}>
                <i className="fa fa-arrow-left me-1"></i> Quay lại sửa email
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}