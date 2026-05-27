import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../src/utils/axios";
import Toast from "../components/Toast";

export default function ChangePassword() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [step, setStep] = useState(1);

    const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "", otp: "" });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        } else {
            setToast({ message: "Bạn chưa đăng nhập! Đang quay về trang chủ...", type: "warning" });
            setTimeout(() => navigate("/"), 2000);
        }
    }, [navigate]);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        let newErrors = {};

        if (!form.oldPassword) newErrors.oldPassword = "Vui lòng nhập mật khẩu cũ.";
        if (!form.newPassword) newErrors.newPassword = "Vui lòng nhập mật khẩu mới.";
        if (form.newPassword.length < 6) newErrors.newPassword = "Mật khẩu mới phải từ 6 ký tự trở lên.";
        if (form.newPassword === form.oldPassword) newErrors.newPassword = "Mật khẩu mới không được trùng mật khẩu cũ.";
        if (form.newPassword !== form.confirmPassword) newErrors.confirmPassword = "Xác nhận mật khẩu không trùng khớp.";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post("api/auth/change-password/send-otp", {
                email: currentUser.email,
                role: currentUser.role,
                oldPassword: form.oldPassword
            });

            setToast({ message: res.data.message, type: "success" });
            setStep(2); 
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi gửi mã OTP!", type: "danger" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmReset = async (e) => {
        e.preventDefault();
        if (!form.otp || form.otp.length !== 6) {
            setErrors({ otp: "Vui lòng nhập đúng mã OTP gồm 6 chữ số." });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post("api/auth/change-password/reset", {
                email: currentUser.email,
                newPassword: form.newPassword,
                otp: form.otp
            });

            setToast({ message: "🚀 " + res.data.message, type: "success" });
            
            setTimeout(() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login");
            }, 2000);

        } catch (error) {
            setToast({ message: error.response?.data?.message || "Mã OTP không đúng!", type: "danger" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Hàm quay lại an toàn (Trở về trang trước đó)
    const handleGoBack = () => {
        navigate(-1); // Quay lại đúng trang khách vừa bấm nút "Đổi mật khẩu"
    };

    return (
        <div className="container-fluid d-flex justify-content-center align-items-center min-vh-100 bg-light py-5">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* GIAO DIỆN CARD MỚI: CÓ HEADER XANH ĐỒNG BỘ THƯƠNG HIỆU */}
            <div className="card shadow-lg border-0 rounded-4" style={{ width: "100%", maxWidth: "450px", overflow: "hidden" }}>
                
                {/* Phần Banner phía trên */}
                <div className="bg-primary text-white text-center py-4 px-3 relative">
                    <h3 className="fw-bold mb-0">
                        <i className="fa fa-shield-alt me-2"></i> MitaFresh
                    </h3>
                    <p className="mb-0 mt-1 opacity-75 small">Hệ thống bảo mật tài khoản</p>
                </div>

                <div className="card-body p-4 p-md-5 bg-white">
                    <div className="text-center mb-4">
                        <h5 className="fw-bold text-dark mb-1">Đổi Mật Khẩu</h5>
                        <p className="text-muted small mb-0">Tài khoản: <span className="text-primary fw-bold">{currentUser?.email}</span></p>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleSendOTP}>
                            <div className="mb-3">
                                <label className="fw-bold small mb-1 text-secondary">Mật khẩu hiện tại</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light text-muted border-end-0"><i className="fa fa-unlock"></i></span>
                                    <input type="password" className={`form-control border-start-0 ${errors.oldPassword ? "is-invalid" : ""}`} placeholder="••••••••" value={form.oldPassword} onChange={(e) => { setForm({ ...form, oldPassword: e.target.value }); setErrors({ ...errors, oldPassword: null }); }} />
                                    {errors.oldPassword && <div className="invalid-feedback fw-bold">{errors.oldPassword}</div>}
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="fw-bold small mb-1 text-secondary">Mật khẩu mới</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light text-muted border-end-0"><i className="fa fa-key"></i></span>
                                    <input type="password" className={`form-control border-start-0 ${errors.newPassword ? "is-invalid" : ""}`} placeholder="Tối thiểu 6 ký tự" value={form.newPassword} onChange={(e) => { setForm({ ...form, newPassword: e.target.value }); setErrors({ ...errors, newPassword: null }); }} />
                                    {errors.newPassword && <div className="invalid-feedback fw-bold">{errors.newPassword}</div>}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="fw-bold small mb-1 text-secondary">Xác nhận mật khẩu mới</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light text-muted border-end-0"><i className="fa fa-check-circle"></i></span>
                                    <input type="password" className={`form-control border-start-0 ${errors.confirmPassword ? "is-invalid" : ""}`} placeholder="Nhập lại mật khẩu mới" value={form.confirmPassword} onChange={(e) => { setForm({ ...form, confirmPassword: e.target.value }); setErrors({ ...errors, confirmPassword: null }); }} />
                                    {errors.confirmPassword && <div className="invalid-feedback fw-bold">{errors.confirmPassword}</div>}
                                </div>
                            </div>

                            <div className="d-grid gap-2">
                                <button type="submit" className="btn btn-primary py-2 fw-bold shadow-sm" disabled={isSubmitting}>
                                    {isSubmitting ? <><span className="spinner-border spinner-border-sm me-2"></span> Đang xử lý...</> : <><i className="fa fa-paper-plane me-2"></i> LẤY MÃ XÁC THỰC OTP</>}
                                </button>
                                
                                {/* NÚT QUAY LẠI MỚI THÊM */}
                                <button type="button" className="btn btn-light border py-2 fw-bold text-muted" onClick={handleGoBack}>
                                    <i className="fa fa-arrow-left me-2"></i> Hủy & Quay lại
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleConfirmReset}>
                            <div className="alert alert-info small text-center mb-4 border-0 shadow-sm rounded-3">
                                <i className="fa fa-envelope-open-text mb-2 fs-4 d-block"></i>
                                Hệ thống đã gửi một mã OTP gồm 6 chữ số về Email của bạn. Vui lòng kiểm tra hộp thư!
                            </div>

                            <div className="mb-4">
                                <label className="fw-bold text-center d-block mb-2 text-muted fs-6">Nhập Mã OTP</label>
                                <input type="text" className={`form-control text-center fw-bold fs-3 border-2 py-2 ${errors.otp ? "is-invalid" : ""}`} placeholder="000000" maxLength="6" value={form.otp} onChange={(e) => { setForm({ ...form, otp: e.target.value.replace(/\D/g, "") }); setErrors({ ...errors, otp: null }); }} style={{ letterSpacing: "12px", color: "#0d6efd" }} />
                                {errors.otp && <div className="invalid-feedback text-center fw-bold">{errors.otp}</div>}
                            </div>

                            <div className="d-grid gap-2">
                                <button type="submit" className="btn btn-success py-2 fw-bold shadow-sm" disabled={isSubmitting}>
                                    {isSubmitting ? <><span className="spinner-border spinner-border-sm me-2"></span> Đang xác thực...</> : <><i className="fa fa-check-circle me-2"></i> XÁC NHẬN ĐỔI</>}
                                </button>
                                
                                <button type="button" className="btn btn-light border py-2 fw-bold text-muted" onClick={() => setStep(1)}>
                                    <i className="fa fa-refresh me-2"></i> Gửi lại mã khác
                                </button>

                                <button type="button" className="btn btn-link text-danger small text-decoration-none mt-2" onClick={handleGoBack}>
                                    <i className="fa fa-times me-1"></i> Hủy thao tác
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}