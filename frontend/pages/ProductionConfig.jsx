import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function ProductionConfig() {
    const [configs, setConfigs] = useState([]);
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState({});

    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const res = await api.get("api/production/cost-configs", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConfigs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setToast({ message: "Không thể tải danh sách định mức", type: "danger" });
        }
    };

    // 💡 SỬA: Hàm handleInputChange chuẩn xác cho từng field
    const handleInputChange = (productId, field, value) => {
        const numericValue = value.replace(/[^0-9]/g, ""); 
        setConfigs(prev => 
            prev.map(item => 
                item.id === productId ? { ...item, [field]: numericValue } : item
            )
        );
    };

    const handleSaveConfig = async (product) => {
        setIsSaving(prev => ({ ...prev, [product.id]: true }));
        try {
            await api.post("api/production/cost-configs", {
                product_id: product.id,
                labor_cost: Number(product.labor_cost),
                depreciation_cost: Number(product.depreciation_cost)
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setToast({ message: `Đã lưu định mức cho [${product.name}]`, type: "success" });
            fetchConfigs();
        } catch (err) {
            setToast({ message: "Lỗi khi lưu định mức", type: "danger" });
        } finally {
            setIsSaving(prev => ({ ...prev, [product.id]: false }));
        }
    };

    // 💡 HÀM FORMAT SỐ (3.500)
    const fmt = (val) => new Intl.NumberFormat("vi-VN").format(val || 0);

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="pt-4 px-4 w-100 pb-5">
                <div className="mb-4">
                    <h4 className="fw-bold text-primary"><i className="bi bi-sliders me-2"></i>Cấu Hình Định Mức Giá Vốn</h4>
                </div>

                <div className="bg-white p-4 rounded shadow-sm border-top border-primary border-4">
                    <div className="table-responsive">
                        <table className="table table-bordered align-middle text-center mb-0 table-mobile-cards">
                            <thead className="table-dark">
                                <tr>
                                    <th>ID</th>
                                    <th className="text-start">Tên Thành Phẩm</th>
                                    <th>Đơn vị</th>
                                    <th>👷 Lương Nhân Công / SP</th>
                                    <th>🔧 Khấu Hao Máy Móc / SP</th>
                                    <th>Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((prod) => (
                                    <tr key={prod.id}>
                                        <td data-label="ID" className="fw-bold text-secondary">#{prod.id}</td>
                                        <td data-label="Tên Thành Phẩm" className="text-start fw-bold text-dark">{prod.name}</td>
                                        <td data-label="Đơn vị"><span className="badge bg-light text-dark text-uppercase">{prod.unit}</span></td>
                                        
                                        {/* Ô Lương */}
                                        <td data-label="Lương Nhân Công / SP">
                                            <div className="input-group input-group-sm">
                                                <input
                                                    type="text"
                                                    className="form-control fw-bold text-end text-success"
                                                    value={fmt(prod.labor_cost)}
                                                    onChange={(e) => handleInputChange(prod.id, "labor_cost", e.target.value.replace(/\./g, ""))}
                                                />
                                                <span className="input-group-text bg-light fw-bold text-muted">đ</span>
                                            </div>
                                        </td>

                                        {/* Ô Khấu Hao */}
                                        <td data-label="Khấu Hao Máy Móc / SP">
                                            <div className="input-group input-group-sm">
                                                <input
                                                    type="text"
                                                    className="form-control fw-bold text-end text-danger"
                                                    value={fmt(prod.depreciation_cost)} // 💡 Đã sửa thành depreciation_cost
                                                    onChange={(e) => handleInputChange(prod.id, "depreciation_cost", e.target.value.replace(/\./g, ""))}
                                                />
                                                <span className="input-group-text bg-light fw-bold text-muted">đ</span>
                                            </div>
                                        </td>

                                        <td data-label="Thao Tác">
                                            <button className="btn btn-sm btn-primary fw-bold" onClick={() => handleSaveConfig(prod)} disabled={isSaving[prod.id]}>
                                                {isSaving[prod.id] ? "..." : "Lưu lại"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}