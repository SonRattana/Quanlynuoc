import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function Expenses() {
    const [expenses, setExpenses] = useState([]);
    const [toast, setToast] = useState(null);
    const token = localStorage.getItem("token");

    const [form, setForm] = useState({
        expense_type: "Điện, nước VP/Cửa hàng",
        amount: "",
        description: "",
        expense_date: new Date().toISOString().split('T')[0]
    });

    // 💡 STATE CHO BỘ LỌC TÌM KIẾM
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const res = await api.get("api/expenses", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpenses(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setToast({ message: "Lỗi tải danh sách chi phí", type: "danger" });
        }
    };

    const formatInputNumber = (num) => {
        if (!num) return "";
        return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const handleAmountChange = (e) => {
        const numericString = String(e.target.value).replace(/[^0-9]/g, "");
        setForm({ ...form, amount: numericString === "" ? "" : Number(numericString) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.amount || form.amount <= 0) {
            return setToast({ message: "Vui lòng nhập số tiền hợp lệ", type: "warning" });
        }

        try {
            await api.post("api/expenses", form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setToast({ message: "Đã lưu phiếu chi thành công!", type: "success" });
            setForm({ ...form, amount: "", description: "" });
            fetchExpenses();
        } catch (err) {
            setToast({ message: err.response?.data?.message || "Lỗi lưu phiếu chi", type: "danger" });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Sếp có chắc chắn muốn xóa khoản chi này không?")) return;
        try {
            await api.delete(`api/expenses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setToast({ message: "Đã xóa thành công", type: "success" });
            fetchExpenses();
        } catch (err) {
            setToast({ message: "Lỗi xóa phiếu chi", type: "danger" });
        }
    };

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);
    const formatDate = (dateString) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString("vi-VN");
    };

    // 💡 HÀM CHỌN NHANH NGÀY/TUẦN/THÁNG/NĂM
    const setQuickDate = (type) => {
        const d = new Date();
        // 💡 BÍ QUYẾT: Dùng toLocaleDateString('en-CA') để lấy định dạng YYYY-MM-DD 
        // mà KHÔNG bị lệch múi giờ như toISOString()
        const getLocalDateString = (date) => date.toLocaleDateString('en-CA');

        if (type === 'today') {
            const dStr = getLocalDateString(d);
            setStartDate(dStr); setEndDate(dStr);
        } else if (type === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(d.setDate(diff));
            const end = new Date(d.setDate(diff + 6));
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
        } else if (type === 'month') {
            // Cố định ngày 1 và ngày cuối tháng bằng cách tạo object mới
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
        } else if (type === 'year') {
            setStartDate(`${d.getFullYear()}-01-01`);
            setEndDate(`${d.getFullYear()}-12-31`);
        } else {
            setStartDate(""); setEndDate("");
        }

        // Nếu có state search thì reset luôn
        if (typeof setSearchTerm === 'function') setSearchTerm("");

        // Reset data báo cáo nếu cần
        if (typeof setData === 'function') setData([]);
        if (typeof setPnlDetails === 'function') setPnlDetails([]);
    };

    // 💡 LOGIC LỌC DỮ LIỆU
    const filteredExpenses = expenses.filter(item => {
        const itemDateObj = new Date(item.expense_date);
        const itemDate = new Date(itemDateObj.getTime() - (itemDateObj.getTimezoneOffset() * 60000)).toISOString().split("T")[0];

        const matchDate = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        const matchSearch = !searchTerm ||
            item.expense_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchDate && matchSearch;
    });

    // 💡 TÍNH TỔNG TIỀN CỦA DANH SÁCH ĐÃ LỌC
    const totalFilteredAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="pt-4 px-4 w-100 pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-danger">
                        <i className="bi bi-wallet2 me-2"></i>Quản lý Chi phí Hoạt động
                    </h4>
                </div>

                <div className="row">
                    {/* ================= CỘT TRÁI: FORM NHẬP LIỆU ================= */}
                    <div className="col-md-4 mb-4">
                        <div className="bg-white p-4 rounded shadow-sm border-top border-danger border-4">
                            <h6 className="fw-bold mb-3 text-secondary">Lập phiếu chi mới</h6>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Loại chi phí</label>
                                    <select
                                        className="form-select border-primary shadow-sm"
                                        value={form.expense_type}
                                        onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
                                    >
                                        <optgroup label="--- Vận hành VP & Cửa hàng ---">
                                            <option value="Điện, nước VP/Cửa hàng">⚡ Điện, nước VP/Cửa hàng</option>
                                            <option value="Internet, Rác, Văn phòng phẩm">🌐 Internet, Rác, Văn phòng phẩm</option>
                                            <option value="Chi phí Tiếp khách, Ngoại giao">🍻 Chi phí Tiếp khách, Ngoại giao</option>
                                        </optgroup>
                                        <optgroup label="--- Vận chuyển & Giao hàng ---">
                                            <option value="Xăng xe, Vận chuyển">🚚 Xăng xe, Vận chuyển</option>
                                            <option value="Sửa chữa, bảo dưỡng xe">🔧 Sửa chữa, bảo dưỡng xe</option>
                                        </optgroup>
                                        <optgroup label="--- Hành chính & Đầu tư ---">
                                            <option value="Lương (Kế toán, Quản lý, Tài xế)">👩‍💻 Lương (Kế toán, Quản lý, Tài xế)</option>
                                            <option value="Marketing, Quảng cáo, Bảng hiệu">📢 Marketing, Quảng cáo, Bảng hiệu</option>
                                            <option value="Mua tài sản, Máy móc mới">📠 Mua tài sản, Máy móc mới</option>
                                            <option value="Chi phí phát sinh khác">💰 Chi phí phát sinh khác</option>
                                        </optgroup>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Số tiền (VNĐ)</label>
                                    <input
                                        type="text"
                                        className="form-control text-end fw-bold text-danger fs-5 shadow-sm"
                                        placeholder="0"
                                        value={formatInputNumber(form.amount)}
                                        onChange={handleAmountChange}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-bold">Ngày chi</label>
                                    <div className="input-group shadow-sm">
                                        <input
                                            type="date"
                                            className="form-control border-end-0"
                                            value={form.expense_date}
                                            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                                        />
                                        <span
                                            className="input-group-text bg-white text-danger border-start-0"
                                            style={{ cursor: "pointer" }}
                                            onClick={(e) => e.currentTarget.previousElementSibling.showPicker()}
                                        >
                                            <i className="bi bi-calendar2-check-fill"></i>
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label small fw-bold">Ghi chú chi tiết (nếu có)</label>
                                    <textarea
                                        className="form-control shadow-sm"
                                        rows="2"
                                        placeholder="Ví dụ: Đóng tiền mạng tháng 5..."
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <button type="submit" className="btn btn-danger w-100 fw-bold shadow-sm">
                                    <i className="bi bi-save me-2"></i> LƯU PHIẾU CHI
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* ================= CỘT PHẢI: LỊCH SỬ & BỘ LỌC ================= */}
                    <div className="col-md-8">
                        <div className="bg-white p-3 rounded shadow-sm border-top border-info border-4 h-100">

                            <h6 className="fw-bold mb-3 text-secondary"><i className="bi bi-search me-2"></i>Tra cứu lịch sử xuất quỹ</h6>

                            {/* 💡 BỘ LỌC TÌM KIẾM */}
                            <div className="row g-2 mb-3 bg-light p-2 rounded border">
                                <div className="col-md-4">
                                    <label className="small text-muted fw-bold mb-1">Từ ngày:</label>
                                    <div className="input-group input-group-sm shadow-sm">
                                        <input type="date" className="form-control border-end-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        <span className="input-group-text bg-white text-primary border-start-0" style={{ cursor: "pointer" }} onClick={(e) => e.currentTarget.previousElementSibling.showPicker()}>
                                            <i className="bi bi-calendar2-week"></i>
                                        </span>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <label className="small text-muted fw-bold mb-1">Đến ngày:</label>
                                    <div className="input-group input-group-sm shadow-sm">
                                        <input type="date" className="form-control border-end-0" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                        <span className="input-group-text bg-white text-primary border-start-0" style={{ cursor: "pointer" }} onClick={(e) => e.currentTarget.previousElementSibling.showPicker()}>
                                            <i className="bi bi-calendar2-check"></i>
                                        </span>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <label className="small text-muted fw-bold mb-1">Tìm kiếm:</label>
                                    <input type="text" className="form-control form-control-sm shadow-sm" placeholder="Loại chi phí, ghi chú..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>

                                <div className="col-12 mt-2 d-flex flex-wrap gap-2">
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setQuickDate('today')}>Hôm nay</button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setQuickDate('week')}>Tuần này</button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setQuickDate('month')}>Tháng này</button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setQuickDate('year')}>Năm nay</button>
                                    <button className="btn btn-sm btn-outline-danger fw-bold ms-auto" onClick={() => setQuickDate('all')}>
                                        <i className="bi bi-x-circle me-1"></i>Xóa lọc
                                    </button>
                                </div>
                            </div>

                            {/* BẢNG LỊCH SỬ */}
                            <div className="table-responsive" style={{ maxHeight: "550px", overflowY: "auto" }}>
                                <table className="table table-hover align-middle text-center border table-mobile-cards">
                                    <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th>Ngày chi</th>
                                            <th className="text-start">Loại chi phí</th>
                                            <th className="text-start">Diễn giải</th>
                                            <th className="text-end">Số tiền</th>
                                            <th>Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredExpenses.length === 0 ? (
                                            <tr><td colSpan="5" className="text-muted py-4 fst-italic">Không tìm thấy dữ liệu chi phí phù hợp.</td></tr>
                                        ) : (
                                            filteredExpenses.map((item) => (
                                                <tr key={item.id}>
                                                    <td data-label="Ngày Chi" className="small text-muted">{formatDate(item.expense_date)}</td>
                                                    <td data-label="Loại Chi Phí" className="text-start fw-bold text-dark">{item.expense_type}</td>
                                                    <td data-label="Diễn Giải" className="text-start text-muted small">{item.description}</td>
                                                    <td data-label="Số Tiền" className="text-end fw-bold text-danger">{formatMoney(item.amount)}</td>
                                                    <td data-label="Xóa">
                                                        <button className="btn btn-sm btn-outline-danger shadow-sm" onClick={() => handleDelete(item.id)}>
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {/* 💡 DÒNG TỔNG CỘNG */}
                                    {filteredExpenses.length > 0 && (
                                        <tfoot style={{ position: "sticky", bottom: 0, zIndex: 1 }}>
                                            <tr className="table-warning">
                                                <td data-label colSpan="3" className="text-end fw-bold text-dark fs-6">TỔNG CỘNG CHI PHÍ:</td>
                                                <td data-label className="text-end fw-bold text-danger fs-5">{formatMoney(totalFilteredAmount)}</td>
                                                <td data-label></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}