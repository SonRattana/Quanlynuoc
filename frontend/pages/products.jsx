import { useEffect, useState } from "react";
import React from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";
import api from "../src/utils/axios"; // <-- VŨ KHÍ AXIOS

function Products() {
    const getPageFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return Number(params.get("page")) || 1;
    };
    const [toast, setToast] = useState(null);
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(getPageFromURL());
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // Biến môi trường cho ảnh (Tự động ăn theo cấu hình .env)
    const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("page", page);
        window.history.replaceState({}, "", `?${params}`);
    }, [page]);

    const preventNegativeInput = (e) => {
        if (e.key === "-" || e.key === "e") {
            e.preventDefault();
        }
    };

    const formatMoney = (value) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(value);
    };

    const VOLUME_MAPPING = {
        chai: [330, 350, 500, 700, 1000, 1200, 1500],
        thung: [330, 350, 500, 700, 1500],
        binh: [5000, 19000, 20000],
        lon: [320, 330]
    };

    const [addForm, setAddForm] = useState({
        name: "", volume: 330, unit: "chai", cost_price: "", sell_price: "", deposit_price: "", image: null
    });

    const handleAddUnitChange = (e) => {
        const selectedUnit = e.target.value;
        const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
        setAddForm({ ...addForm, unit: selectedUnit, volume: defaultVolume });
    };

    const [editForm, setEditForm] = useState({
        name: "", volume: "", unit: "chai", cost_price: "", sell_price: "", deposit_price: "", image: null
    });

    const handleEditUnitChange = (e) => {
        const selectedUnit = e.target.value;
        const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
        setEditForm({ ...editForm, unit: selectedUnit, volume: defaultVolume });
    };

    const [editingId, setEditingId] = useState(null);
    const [showEdit, setShowEdit] = useState(false);

    const token = localStorage.getItem("token");

    // ================= FETCH DỮ LIỆU BẰNG AXIOS =================
    const fetchProducts = async () => {
        try {
            const res = await api.get(`api/products?page=${page}&limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data;

            if (data.data) {
                setProducts(data.data);
                setTotalPages(data.totalPages);
            } else {
                setProducts(data);
            }
        } catch (error) {
            console.error("Lỗi lấy danh sách sản phẩm:", error);
            setToast({ message: "Lỗi kết nối máy chủ", type: "danger" });
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [page]);

    // ================= THÊM MỚI BẰNG AXIOS =================
    const handleAdd = async (e) => {
        e.preventDefault();

        const volume = Number(addForm.volume);
        const costPrice = Number(addForm.cost_price);
        const sellPrice = Number(addForm.sell_price);

        if (!Number.isInteger(volume) || volume <= 0)
            return setToast({ message: "Thể tích phải là số nguyên dương", type: "danger" });

        if (costPrice < 0 || sellPrice < 0)
            return setToast({ message: "Giá không được âm", type: "danger" });

        const formData = new FormData();
        formData.append("name", addForm.name);
        formData.append("volume", volume);
        formData.append("unit", addForm.unit);
        formData.append("cost_price", costPrice);
        formData.append("sell_price", sellPrice);
        formData.append("deposit_price", addForm.deposit_price || 0);

        if (addForm.image) {
            formData.append("image", addForm.image);
        }

        try {
            await api.post("api/products", formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                    // Axios tự động set Content-Type multipart/form-data, không cần gõ thêm!
                }
            });

            setToast({ message: "Thêm thành công", type: "success" });
            setAddForm({ name: "", volume: 330, unit: "chai", cost_price: "", sell_price: "", deposit_price: "", image: null });

            const fileInput = document.getElementById('addFileInput');
            if (fileInput) fileInput.value = "";

            fetchProducts();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi khi thêm sản phẩm", type: "danger" });
        }
    };

    // ================= SỬA (CHUẨN BỊ FORM) =================
    const handleEdit = (product) => {
        setEditForm({ ...product, image: null });
        setEditingId(product.id);
        setShowEdit(true);
    };

    // ================= CẬP NHẬT BẰNG AXIOS =================
    const handleUpdate = async (e) => {
        e.preventDefault();

        const volume = Number(editForm.volume);
        const costPrice = Number(editForm.cost_price);
        const sellPrice = Number(editForm.sell_price);

        if (!Number.isInteger(volume) || volume <= 0)
            return setToast({ message: "Thể tích phải là số nguyên dương", type: "danger" });

        if (costPrice < 0 || sellPrice < 0)
            return setToast({ message: "Giá không được âm", type: "danger" });

        const formData = new FormData();
        formData.append("name", editForm.name);
        formData.append("volume", volume);
        formData.append("unit", editForm.unit);
        formData.append("cost_price", costPrice);
        formData.append("sell_price", sellPrice);
        formData.append("deposit_price", editForm.deposit_price || 0);

        if (editForm.image) {
            formData.append("image", editForm.image);
        }

        try {
            await api.put(`api/products/${editingId}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            setToast({ message: "Cập nhật thành công", type: "success" });
            setShowEdit(false);
            setEditingId(null);
            fetchProducts();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi khi cập nhật", type: "danger" });
        }
    };

    // ================= XÓA BẰNG AXIOS =================
    const handleDelete = async (id) => {
        if (!window.confirm("Xóa sản phẩm này?")) return;

        try {
            await api.delete(`api/products/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setToast({ message: "Xóa thành công", type: "success" });
            fetchProducts();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi khi xóa", type: "danger" });
        }
    };

    return (
        <Layout>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <div className="pt-4 px-4 w-100">

                {/* ===== ADD FORM ===== */}
                <div className="bg-white shadow-sm p-4 mb-4">
                    <h5 className="fw-bold mb-3">Thêm sản phẩm</h5>
                    <form onSubmit={handleAdd} className="row g-3 align-items-center">
                        <div className="col-md-2">
                            <input className="form-control" placeholder="Tên sản phẩm" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
                        </div>
                        <div className="col-md-1">
                            <select className="form-select" value={addForm.unit} onChange={handleAddUnitChange}>
                                <option value="chai">Chai</option><option value="thung">Thùng</option><option value="binh">Bình</option><option value="lon">Lon</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select className="form-select" value={addForm.volume} onChange={(e) => setAddForm({ ...addForm, volume: Number(e.target.value) })} required>
                                {addForm.unit && VOLUME_MAPPING[addForm.unit]?.map((vol) => (
                                    <option key={`add-${vol}`} value={vol}>{vol >= 1000 ? `${vol / 1000} Lít` : `${vol} ml`}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <input type="number" min="0" step="1" className="form-control" placeholder="Giá nhập" value={addForm.cost_price} onChange={(e) => setAddForm({ ...addForm, cost_price: e.target.value })} required onKeyDown={preventNegativeInput} />
                        </div>
                        <div className="col-md-2">
                            <input type="number" min="0" step="1" className="form-control" placeholder="Giá bán" value={addForm.sell_price} onChange={(e) => setAddForm({ ...addForm, sell_price: e.target.value })} required onKeyDown={preventNegativeInput} />
                        </div>

                        <div className="col-md-2">
                            <input id="addFileInput" type="file" className="form-control" accept="image/*" onChange={(e) => setAddForm({ ...addForm, image: e.target.files[0] })} />
                        </div>

                        <div className="col-md-1">
                            <button className="btn btn-primary w-100">Thêm</button>
                        </div>
                    </form>
                </div>

                {/* ===== EDIT FORM ===== */}
                {showEdit && (
                    <>
                        <div className="modal fade show d-block" tabIndex="-1">
                            <div className="modal-dialog">
                                <div className="modal-content">
                                    <div className="modal-header bg-warning">
                                        <h5 className="modal-title fw-bold">Sửa sản phẩm</h5>
                                        <button type="button" className="btn-close" onClick={() => setShowEdit(false)}></button>
                                    </div>
                                    <form onSubmit={handleUpdate}>
                                        <div className="modal-body">
                                            <div className="mb-3">
                                                <label className="form-label">Tên sản phẩm</label>
                                                <input type="text" className="form-control" placeholder="Tên sản phẩm" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                                            </div>
                                            <div className="row mb-3">
                                                <div className="col">
                                                    <label className="form-label">Loại</label>
                                                    <select className="form-select" value={editForm.unit} onChange={handleEditUnitChange}>
                                                        <option value="chai">Chai</option><option value="thung">Thùng</option><option value="binh">Bình</option><option value="lon">Lon</option>
                                                    </select>
                                                </div>
                                                <div className="col">
                                                    <label className="form-label">Dung tích</label>
                                                    <select className="form-select" value={editForm.volume} onChange={(e) => setEditForm({ ...editForm, volume: Number(e.target.value) })} required>
                                                        {editForm.unit && VOLUME_MAPPING[editForm.unit]?.map((vol) => (
                                                            <option key={`edit-${vol}`} value={vol}>{vol >= 1000 ? `${vol / 1000} Lít` : `${vol} ml`}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="row mb-3">
                                                <div className="col">
                                                    <label className="form-label">Giá nhập</label>
                                                    <input type="number" min="0" step="1" className="form-control" value={editForm.cost_price} onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })} required onKeyDown={preventNegativeInput} />
                                                </div>
                                                <div className="col">
                                                    <label className="form-label">Giá bán</label>
                                                    <input type="number" min="0" step="1" className="form-control" value={editForm.sell_price} onChange={(e) => setEditForm({ ...editForm, sell_price: e.target.value })} required onKeyDown={preventNegativeInput} />
                                                </div>
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Tiền cọc thế chân</label>
                                                <input type="number" min="0" step="1" className="form-control" value={editForm.deposit_price} onChange={(e) => setEditForm({ ...editForm, deposit_price: e.target.value })} required onKeyDown={preventNegativeInput} />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label text-primary fw-bold">Thay ảnh mới (Bỏ trống nếu muốn giữ ảnh cũ)</label>
                                                <input type="file" className="form-control border-primary" accept="image/*" onChange={(e) => setEditForm({ ...editForm, image: e.target.files[0] })} />
                                            </div>

                                        </div>
                                        <div className="modal-footer">
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Hủy</button>
                                            <button type="submit" className="btn btn-warning">Cập nhật</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="modal-backdrop fade show" onClick={() => setShowEdit(false)}></div>
                    </>
                )}

                {/* ===== TABLE ===== */}
                <div className="bg-white shadow-sm p-4">
                    <h5 className="fw-bold mb-3">Quản lý sản phẩm</h5>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Ảnh</th>
                                    <th>ID</th>
                                    <th>Tên</th>
                                    <th>Dung tích</th>
                                    <th>Loại</th>
                                    <th>Giá nhập</th>
                                    <th>Giá bán</th>
                                    <th>Tiền cọc</th>
                                    <th>Số lượng</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>

                            <tbody>
                                {products.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <img
                                                // src={p.image ? `${import.meta.env.VITE_BASE_URL}${p.image}` : "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/No-Image-Placeholder.svg/1665px-No-Image-Placeholder.svg.png"} 
                                                src={p.image ? p.image : "/no-image.png"}
                                                alt={p.name || "Img"}
                                                onError={(e) => { e.target.src = "/no-image.png" }}
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px' }}
                                            />
                                        </td>
                                        <td>{p.id}</td>
                                        <td>{p.name}</td>
                                        <td>{p.volume >= 1000 ? `${p.volume / 1000} Lít` : `${p.volume} ml`}</td>
                                        <td>{p.unit}</td>
                                        <td>{formatMoney(p.cost_price)}</td>
                                        <td>{formatMoney(p.sell_price)}</td>
                                        <td>{formatMoney(p.deposit_price)}</td>
                                        <td>{p.quantity}</td>
                                        <td>
                                            <button className="btn btn-warning btn-sm me-2" onClick={() => handleEdit(p)}>Edit</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default Products;