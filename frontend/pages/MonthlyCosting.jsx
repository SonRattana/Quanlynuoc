import React, { useState, useRef } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function MonthlyCosting() {
    const currentDate = new Date();
    // Mặc định chọn từ đầu tháng đến ngày hiện tại
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const today = currentDate.toISOString().split('T')[0];

    const [dateRange, setDateRange] = useState({ start: firstDay, end: today });

    const [costs, setCosts] = useState({
        total_electric_water: "",
        total_labor: "",
        total_depreciation: ""
    });

    const [toast, setToast] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const token = localStorage.getItem("token");

    // Refs để trigger click vào input date khi bấm vào icon
    const startDateRef = useRef(null);
    const endDateRef = useRef(null);

    const formatInput = (value) => {
        const numericValue = value.replace(/[^0-9]/g, "");
        if (!numericValue) return "";
        return new Intl.NumberFormat("vi-VN").format(numericValue);
    };

    const handleInputChange = (field, value) => {
        setCosts(prev => ({ ...prev, [field]: formatInput(value) }));
    };

    const handleFinalize = async (e) => {
        e.preventDefault();

        const payload = {
            start_date: dateRange.start,
            end_date: dateRange.end,
            total_electric_water: Number(costs.total_electric_water.replace(/\./g, "")) || 0,
            total_labor: Number(costs.total_labor.replace(/\./g, "")) || 0,
            total_depreciation: Number(costs.total_depreciation.replace(/\./g, "")) || 0
        };

        if (!window.confirm(`🔒 XÁC NHẬN CHỐT SỔ TỪ ${payload.start_date} ĐẾN ${payload.end_date}?\n\nHệ thống sẽ phân bổ chi phí và cập nhật lại giá vốn, lợi nhuận hóa đơn trong kỳ này.`)) return;

        setIsProcessing(true);
        try {
            await api.post("api/production/monthly-costing", payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setToast({ message: "Chốt sổ kỳ thành công!", type: "success" });
            setCosts({ total_electric_water: "", total_labor: "", total_depreciation: "" });
        } catch (err) {
            setToast({ message: err.response?.data?.message || "Lỗi chốt sổ. Vui lòng kiểm tra lại!", type: "danger" });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="pt-4 px-4 w-100 pb-5">
                <div className="mb-4">
                    <h4 className="fw-bold text-danger mb-1"><i className="bi bi-safe-fill me-2"></i>Chốt Sổ Giá Vốn Kỳ</h4>
                    <small className="text-muted">Nhập tổng chi phí vận hành trong kỳ để hệ thống tự động phân bổ vào giá thành sản phẩm.</small>
                </div>

                <div className="row">
                    <div className="col-md-8 mx-auto">
                        <div className="bg-white p-4 rounded-4 shadow-sm border-top border-danger border-4">
                            <form onSubmit={handleFinalize}>
                                
                                {/* CHỌN KHOẢNG THỜI GIAN */}
                                <div className="row mb-4 bg-light p-3 rounded border">
                                    <div className="col-12 mb-2">
                                        <label className="fw-bold text-dark"><i className="bi bi-calendar-range me-2 text-primary"></i>Chọn kỳ kế toán cần chốt:</label>
                                    </div>
                                    <div className="col-md-6 mb-2 mb-md-0">
                                        <label className="fw-bold small text-muted">Từ ngày</label>
                                        <div className="input-group">
                                            <span 
                                                className="input-group-text bg-white text-primary" 
                                                style={{cursor: 'pointer'}} 
                                                onClick={() => startDateRef.current.showPicker()}
                                            >
                                                <i className="bi bi-calendar-event"></i>
                                            </span>
                                            <input 
                                                type="date" 
                                                className="form-control fw-bold" 
                                                value={dateRange.start} 
                                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} 
                                                ref={startDateRef}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="fw-bold small text-muted">Đến ngày</label>
                                        <div className="input-group">
                                            <span 
                                                className="input-group-text bg-white text-danger" 
                                                style={{cursor: 'pointer'}}
                                                onClick={() => endDateRef.current.showPicker()}
                                            >
                                                <i className="bi bi-calendar-event"></i>
                                            </span>
                                            <input 
                                                type="date" 
                                                className="form-control fw-bold" 
                                                value={dateRange.end} 
                                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} 
                                                ref={endDateRef}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* INPUT CHI PHÍ */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-primary"><i className="bi bi-lightning-charge me-1"></i> Tổng tiền Điện / Nước sản xuất</label>
                                    <div className="input-group input-group-lg">
                                        <input type="text" className="form-control text-end fw-bold text-primary" placeholder="0" value={costs.total_electric_water} onChange={(e) => handleInputChange("total_electric_water", e.target.value)} />
                                        <span className="input-group-text bg-light fw-bold text-muted">VNĐ</span>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-bold text-success"><i className="bi bi-people me-1"></i> Tổng tiền Lương thợ xưởng</label>
                                    <div className="input-group input-group-lg">
                                        <input type="text" className="form-control text-end fw-bold text-success" placeholder="0" value={costs.total_labor} onChange={(e) => handleInputChange("total_labor", e.target.value)} />
                                        <span className="input-group-text bg-light fw-bold text-muted">VNĐ</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold text-warning text-dark"><i className="bi bi-gear me-1"></i> Chi Phí Khác (Bảo trì, khấu hao...)</label>
                                    <div className="input-group input-group-lg">
                                        <input type="text" className="form-control text-end fw-bold text-warning text-dark" placeholder="0" value={costs.total_depreciation} onChange={(e) => handleInputChange("total_depreciation", e.target.value)} />
                                        <span className="input-group-text bg-light fw-bold text-muted">VNĐ</span>
                                    </div>
                                </div>

                                <div className="alert alert-warning border-warning shadow-sm">
                                    <i className="bi bi-exclamation-triangle-fill me-2 text-danger"></i>
                                    <strong>Lưu ý:</strong> Khi bấm nút chốt sổ, phần mềm sẽ lấy tổng chi phí chia đều cho toàn bộ sản lượng làm ra trong kỳ từ <strong>{dateRange.start}</strong> đến <strong>{dateRange.end}</strong>, sau đó cập nhật lại giá vốn và lợi nhuận cho các hóa đơn bán trong thời gian này.
                                </div>

                                <button type="submit" className="btn btn-danger btn-lg w-100 fw-bold shadow mt-2" disabled={isProcessing}>
                                    {isProcessing ? (
                                        <><span className="spinner-border spinner-border-sm me-2"></span> Đang xử lý phân bổ...</>
                                    ) : (
                                        <><i className="bi bi-lock-fill me-2"></i> THỰC HIỆN CHỐT SỔ</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}