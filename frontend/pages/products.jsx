import { useEffect, useState } from "react";
import Layout from "../components/layout";

function Dashboard() {
    const [products, setProducts] = useState([]);
    const preventNegativeInput = (e) => {
        if (e.key === "-" || e.key === "e") {
            e.preventDefault();
        }
    };
    // ===== ADD FORM =====
    const [addForm, setAddForm] = useState({
        name: "",
        volume: "",
        unit: "chai",
        cost_price: "",
        sell_price: "",
    });

    // ===== EDIT FORM =====
    const [editForm, setEditForm] = useState({
        name: "",
        volume: "",
        unit: "chai",
        cost_price: "",
        sell_price: "",
    });

    const [editingId, setEditingId] = useState(null);
    const [showEdit, setShowEdit] = useState(false);

    const token = localStorage.getItem("token");

    // ================= FETCH =================
    const fetchProducts = async () => {
        const res = await fetch("http://localhost:3000/api/products", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProducts(data);
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // ================= ADD =================
    const handleAdd = async (e) => {
        e.preventDefault();

        const volume = Number(addForm.volume);
        const costPrice = Number(addForm.cost_price);
        const sellPrice = Number(addForm.sell_price);

        if (!Number.isInteger(volume) || volume <= 0)
            return alert("Thể tích phải là số nguyên dương");

        if (costPrice < 0 || sellPrice < 0)
            return alert("Giá không được âm");

        const res = await fetch("http://localhost:3000/api/products", {
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
        if (!res.ok) return alert(data.message);

        alert("Thêm thành công");
        setAddForm({
            name: "",
            volume: "",
            unit: "chai",
            cost_price: "",
            sell_price: "",
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
            return alert("Thể tích phải là số nguyên dương");

        if (costPrice < 0 || sellPrice < 0)
            return alert("Giá không được âm");

        const res = await fetch(
            `http://localhost:3000/api/products/${editingId}`,
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
        if (!res.ok) return alert(data.message);

        alert("Cập nhật thành công");
        setShowEdit(false);
        setEditingId(null);
        fetchProducts();
    };

    // ================= DELETE =================
    const handleDelete = async (id) => {
        if (!window.confirm("Xóa sản phẩm này?")) return;

        await fetch(`http://localhost:3000/api/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        fetchProducts();
    };

    return (
        <Layout>
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

                        <div className="col-md-2">
                            <input
                                type="number"
                                min="1"
                                className="form-control"
                                placeholder="Dung tích"
                                value={addForm.volume}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, volume: e.target.value })
                                }
                                required
                                onKeyDown={preventNegativeInput}
                            />
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={addForm.unit}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, unit: e.target.value })
                                }
                            >
                                <option value="chai">Chai</option>
                                <option value="thung">Thùng</option>
                                <option value="binh">Bình</option>
                                <option value="lon">Lon</option>
                            </select>
                        </div>

                        <div className="col-md-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
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
                                step="0.01"
                                className="form-control"
                                placeholder="Giá bán"
                                value={addForm.sell_price}
                                onChange={(e) =>
                                    setAddForm({ ...addForm, sell_price: e.target.value })
                                }
                                required
                            />
                        </div>

                        <div className="col-md-1">
                            <button className="btn btn-primary w-100">Add</button>
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
                                                    onChange={(e) => {
                                                        setEditForm({ ...editForm, name: e.target.value });
                                                    }}
                                                    required
                                                   
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Dung tích</label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    placeholder="Dung tích"
                                                    min="1"
                                                    value={editForm.volume}
                                                    onChange={(e) => {
                                                        const value = e.target.value;

                                                        if (value === "" || Number(value) > 0) {
                                                            setEditForm({ ...editForm, volume: value });
                                                        }
                                                    }}
                                                    required
                                                    onKeyDown={preventNegativeInput}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Loại</label>
                                                <select
                                                    className="form-select"
                                                    value={editForm.unit}
                                                    onChange={(e) =>
                                                        setEditForm({ ...editForm, unit: e.target.value })
                                                    }
                                                >
                                                    <option value="chai">Chai</option>
                                                    <option value="thung">Thùng</option>
                                                    <option value="binh">Bình</option>
                                                    <option value="lon">Lon</option>
                                                </select>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Giá nhập</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="form-control"
                                                    value={editForm.cost_price}
                                                    onChange={(e) => {
                                                        setEditForm({ ...editForm, cost_price: e.target.value });
                                                    }}
                                                    required
                                                    onKeyDown={preventNegativeInput}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Giá bán</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="form-control"
                                                    value={editForm.sell_price}
                                                    onChange={(e) => {
                                                        setEditForm({ ...editForm, sell_price: e.target.value });
                                                    }}
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
                                <th>Số lượng</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>

                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>{p.name}</td>
                                    <td>{p.volume} ml</td>
                                    <td>{p.unit}</td>
                                    <td>{p.cost_price}</td>
                                    <td>{p.sell_price}</td>
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
                </div>
            </div>
        </Layout>
    );
}

export default Dashboard;