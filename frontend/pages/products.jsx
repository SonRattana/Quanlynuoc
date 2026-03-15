import { useEffect, useState } from "react";
import React from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";

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

    // ================= BỘ TỪ ĐIỂN DUNG TÍCH (TỰ ĐỘNG) =================
    const VOLUME_MAPPING = {
        chai: [330, 350, 500, 700, 1000, 1200, 1500],
        thung: [330, 350, 500, 700, 1500],
        binh: [5000, 19000, 20000],
        lon: [320, 330]
    };

    // ===== ADD FORM =====
    const [addForm, setAddForm] = useState({
        name: "",
        volume: 330, // Khởi tạo mặc định
        unit: "chai",
        cost_price: "",
        sell_price: "",
        deposit_price: "",
    });

    // Hàm tự động đổi dung tích cho Add Form
    const handleAddUnitChange = (e) => {
        const selectedUnit = e.target.value;
        const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
        setAddForm({ ...addForm, unit: selectedUnit, volume: defaultVolume });
    };

    // ===== EDIT FORM =====
    const [editForm, setEditForm] = useState({
        name: "",
        volume: "",
        unit: "chai",
        cost_price: "",
        sell_price: "",
        deposit_price: "",
    });

    // Hàm tự động đổi dung tích cho Edit Form
    const handleEditUnitChange = (e) => {
        const selectedUnit = e.target.value;
        const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
        setEditForm({ ...editForm, unit: selectedUnit, volume: defaultVolume });
    };

    const [editingId, setEditingId] = useState(null);
    const [showEdit, setShowEdit] = useState(false);

    const token = localStorage.getItem("token");

    // ================= FETCH =================
    const fetchProducts = async () => {
        const res = await fetch(
            `api/products?page=${page}&limit=${limit}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        const data = await res.json();

        if (data.data) {
            setProducts(data.data);
            setTotalPages(data.totalPages);
        } else {
            setProducts(data);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [page]);

    // ================= ADD =================
    const handleAdd = async (e) => {
        e.preventDefault();

        const volume = Number(addForm.volume);
        const costPrice = Number(addForm.cost_price);
        const sellPrice = Number(addForm.sell_price);

        if (!Number.isInteger(volume) || volume <= 0)
            return setToast({ message: "Thể tích phải là số nguyên dương", type: "danger" });

        if (costPrice < 0 || sellPrice < 0)
            return setToast({ message: "Giá không được âm", type: "danger" });

        const res = await fetch(`api/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                ...addForm,
                volume,
                cost_price: costPrice,
                sell_price: sellPrice,
            }),
        });

        const data = await res.json();
        if (!res.ok) return setToast({ message: data.message, type: "danger" });

        setToast({ message: "Thêm thành công", type: "success" });
        setAddForm({
            name: "",
            volume: 330, // Trả về mặc định chai 330ml
            unit: "chai",
            cost_price: "",
            sell_price: "",
            deposit_price: "",
        });

        fetchProducts();
    };

    // ================= EDIT =================
    const handleEdit = (product) => {
        setEditForm(product);
        setEditingId(product.id);
        setShowEdit(true);
    };

    // ================= UPDATE =================
    const handleUpdate = async (e) => {
        e.preventDefault();

        const volume = Number(editForm.volume);
        const costPrice = Number(editForm.cost_price);
        const sellPrice = Number(editForm.sell_price);

        if (!Number.isInteger(volume) || volume <= 0)
            return setToast({ message: "Thể tích phải là số nguyên dương", type: "danger" });

        if (costPrice < 0 || sellPrice < 0)
            return setToast({ message: "Giá không được âm", type: "danger" });

        const res = await fetch(
            `api/products/${editingId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...editForm,
                    volume,
                    cost_price: costPrice,
                    sell_price: sellPrice,
                }),
            }
        );

        const data = await res.json();
        if (!res.ok) return setToast({ message: data.message, type: "danger" });

        setToast({ message: "Cập nhật thành công", type: "success" });
        setShowEdit(false);
        setEditingId(null);
        fetchProducts();
    };

    // ================= DELETE =================
    const handleDelete = async (id) => {
        if (!window.confirm("Xóa sản phẩm này?")) return;

        await fetch(`api/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        setToast({ message: "Xóa thành công", type: "success" });
        fetchProducts();
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
                    <form onSubmit={handleAdd} className="row g-3">
                        <div className="col-md-3">
                            <input
                                className="form-control"
                                placeholder="Tên sản phẩm"
                                value={addForm.name}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, name: e.target.value })
                                }
                                required
                            />
                        </div>

                        {/* Ô CHỌN LOẠI */}
                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={addForm.unit}
                                onChange={handleAddUnitChange} /* Đã thêm hàm tự nhảy dung tích */
                            >
                                <option value="chai">Chai</option>
                                <option value="thung">Thùng</option>
                                <option value="binh">Bình</option>
                                <option value="lon">Lon</option>
                            </select>
                        </div>

                        {/* Ô CHỌN DUNG TÍCH TỰ ĐỘNG */}
                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={addForm.volume}
                                onChange={(e) => setAddForm({ ...addForm, volume: Number(e.target.value) })}
                                required
                            >
                                {addForm.unit && VOLUME_MAPPING[addForm.unit]?.map((vol) => (
                                    <option key={`add-${vol}`} value={vol}>
                                        {vol >= 1000 ? `${vol / 1000} Lít` : `${vol} ml`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                className="form-control"
                                placeholder="Giá nhập"
                                value={addForm.cost_price}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, cost_price: e.target.value })
                                }
                                required
                                onKeyDown={preventNegativeInput}
                            />
                        </div>

                        <div className="col-md-2">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                className="form-control"
                                placeholder="Giá bán"
                                value={addForm.sell_price}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, sell_price: e.target.value })
                                }
                                required
                                onKeyDown={preventNegativeInput}
                            />
                        </div>

                        <div className="col-md-2">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                className="form-control"
                                placeholder="Tiền cọc thế chân"
                                value={addForm.deposit_price}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, deposit_price: e.target.value })
                                }
                                required
                                onKeyDown={preventNegativeInput}
                            />
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

                                    {/* HEADER */}
                                    <div className="modal-header bg-warning">
                                        <h5 className="modal-title fw-bold">
                                            Sửa sản phẩm
                                        </h5>
                                        <button
                                            type="button"
                                            className="btn-close"
                                            onClick={() => setShowEdit(false)}
                                        ></button>
                                    </div>

                                    {/* BODY */}
                                    <form onSubmit={handleUpdate}>
                                        <div className="modal-body">

                                            <div className="mb-3">
                                                <label className="form-label">Tên sản phẩm</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Tên sản phẩm"
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Loại</label>
                                                <select
                                                    className="form-select"
                                                    value={editForm.unit}
                                                    onChange={handleEditUnitChange} /* Đã thêm hàm tự nhảy dung tích */
                                                >
                                                    <option value="chai">Chai</option>
                                                    <option value="thung">Thùng</option>
                                                    <option value="binh">Bình</option>
                                                    <option value="lon">Lon</option>
                                                </select>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Dung tích</label>
                                                <select
                                                    className="form-select"
                                                    value={editForm.volume}
                                                    onChange={(e) => setEditForm({ ...editForm, volume: Number(e.target.value) })}
                                                    required
                                                >
                                                    {editForm.unit && VOLUME_MAPPING[editForm.unit]?.map((vol) => (
                                                        <option key={`edit-${vol}`} value={vol}>
                                                            {vol >= 1000 ? `${vol / 1000} Lít` : `${vol} ml`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Giá nhập</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="form-control"
                                                    value={editForm.cost_price}
                                                    onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                                                    required
                                                    onKeyDown={preventNegativeInput}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Giá bán</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="form-control"
                                                    value={editForm.sell_price}
                                                    onChange={(e) => setEditForm({ ...editForm, sell_price: e.target.value })}
                                                    required
                                                    onKeyDown={preventNegativeInput}
                                                />
                                            </div>
                                            
                                            <div className="mb-3">
                                                <label className="form-label">Tiền cọc thế chân</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="form-control"
                                                    value={editForm.deposit_price}
                                                    onChange={(e) => setEditForm({ ...editForm, deposit_price: e.target.value })}
                                                    required
                                                    onKeyDown={preventNegativeInput}
                                                />
                                            </div>

                                        </div>

                                        {/* FOOTER */}
                                        <div className="modal-footer">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setShowEdit(false)}
                                            >
                                                Hủy
                                            </button>
                                            <button type="submit" className="btn btn-warning">
                                                Cập nhật
                                            </button>
                                        </div>
                                    </form>

                                </div>
                            </div>
                        </div>

                        {/* Backdrop */}
                        <div
                            className="modal-backdrop fade show"
                            onClick={() => setShowEdit(false)}
                        ></div>
                    </>
                )}

                {/* ===== TABLE ===== */}
                <div className="bg-white shadow-sm p-4">
                    <h5 className="fw-bold mb-3">Quản lý sản phẩm</h5>

                    <table className="table table-hover align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Dung tích</th>
                                <th>Loại</th>
                                <th>Giá nhập</th>
                                <th>Giá bán</th>
                                <th>Tiền cọc thế chân</th>
                                <th>Số lượng</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>

                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>{p.name}</td>
                                    <td>{p.volume >= 1000 ? `${p.volume / 1000} Lít` : `${p.volume} ml`}</td>
                                    <td>{p.unit}</td>
                                    <td>{formatMoney(p.cost_price)}</td>
                                    <td>{formatMoney(p.sell_price)}</td>
                                    <td>{formatMoney(p.deposit_price)}</td>
                                    <td>{p.quantity}</td>
                                    <td>
                                        <button
                                            className="btn btn-warning btn-sm me-2"
                                            onClick={() => handleEdit(p)}
                                        >
                                            Edit
                                        </button>

                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDelete(p.id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* ===== PHÂN TRANG ===== */}
                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </div>
            </div>
        </Layout>
    );
}

export default Products;