import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../src/utils/axios";

export default function OrderLookup() {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem("user")); 
    
    // Đổi state từ phone sang email
    const [email, setEmail] = useState("");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Tự động nhận diện Email nếu khách đã đăng nhập
    useEffect(() => {
        if (currentUser && currentUser.email) {
            setEmail(currentUser.email);
            handleAutoLookup(currentUser.email);
        }
    }, []);

    const handleAutoLookup = async (searchEmail) => {
        setLoading(true);
        try {
            // Truyền email lên API
            const res = await api.get(`api/orders/public/lookup?email=${searchEmail}`);
            setOrders(res.data);
            setSearched(true);
        } catch (error) {
            console.error(error);
            alert("Lỗi tra cứu: " + (error.response?.data?.message || "Không kết nối được server"));
        } finally {
            setLoading(false);
        }
    };

    const handleManualLookup = (e) => {
        e.preventDefault();
        if (!email.trim()) return alert("Vui lòng nhập Email!");
        handleAutoLookup(email);
    };

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
    const formatDate = (date) => new Date(date).toLocaleString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="container-fluid bg-light min-vh-100 py-5">
            <div className="container" style={{ maxWidth: '900px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3 className="fw-bold text-primary"><i className="fa fa-envelope-open-text me-2"></i>Tra cứu đơn hàng</h3>
                    <button className="btn btn-outline-secondary" onClick={() => navigate("/")}>Về trang chủ</button>
                </div>

                {!currentUser && (
                    <div className="bg-white p-4 rounded-3 shadow-sm border mb-4">
                        <form onSubmit={handleManualLookup} className="d-flex gap-2">
                            {/* Đổi input thành type email */}
                            <input 
                                type="email" 
                                className="form-control form-control-lg" 
                                placeholder="Nhập Email mua hàng của bạn (VD: khachhang@gmail.com)" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary px-4 fw-bold" disabled={loading}>
                                {loading ? "Đang tìm..." : "Tra cứu"}
                            </button>
                        </form>
                    </div>
                )}

                {searched && (
                    <div className="bg-white p-4 rounded-3 shadow-sm border">
                        <h5 className="fw-bold mb-3 border-bottom pb-2">
                            {currentUser ? "Danh sách đơn hàng của bạn" : <>Kết quả tra cứu cho Email: <span className="text-danger">{email}</span></>}
                        </h5>
                        
                        {orders.length === 0 ? (
                            <div className="text-center py-4">
                                <i className="fa fa-box-open fa-3x text-muted mb-3"></i>
                                <h6 className="text-muted">Không tìm thấy đơn hàng nào!</h6>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Mã Đơn</th>
                                            <th>Sản Phẩm</th>
                                            <th>Ngày đặt</th>
                                            <th>Tổng tiền</th>
                                            <th>Trạng thái</th>
                                            <th className="text-center">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(o => (
                                            <tr key={o.id}>
                                                <td className="fw-bold text-danger">#{o.id}</td>
                                                <td style={{ maxWidth: '200px' }} className="text-truncate" title={o.product_names}>
                                                    {o.product_names || <span className="text-muted fst-italic">Không rõ</span>}
                                                </td>
                                                <td>{formatDate(o.created_at)}</td>
                                                <td className="fw-bold text-primary">{formatMoney(o.total_amount)}</td>
                                                <td>
                                                    {o.status === 'pending' && <span className="badge bg-secondary">Đã tiếp nhận</span>}
                                                    {o.status === 'delivering' && <span className="badge bg-info">Đang giao</span>}
                                                    {o.status === 'completed' && <span className="badge bg-success">Hoàn thành</span>}
                                                </td>
                                                <td className="text-center">
                                                    <button 
                                                        className="btn btn-sm btn-outline-primary fw-bold text-nowrap"
                                                        onClick={() => navigate(`/tracking/${o.id}`)}
                                                    >
                                                        <i className="fa fa-eye"></i> Theo dõi
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}