import React, { useEffect, useState } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import Pagination from "../components/Pagination";

function Users() {
    const [users, setUsers] = useState([]);
    const [toast, setToast] = useState(null);
    const token = localStorage.getItem("token");

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ===== Bổ sung trường 'email' vào Form =====
    const [form, setForm] = useState({ username: "", email: "", password: "", role: "user" });
    const [editForm, setEditForm] = useState({ id: null, username: "", email: "", password: "", role: "user" });
    const [showEdit, setShowEdit] = useState(false);

   const fetchUsers = async () => {
        try {
            // Nhớ thêm ?page=${page}&limit=10 vào link
            const res = await api.get(`api/users?page=${page}&limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Hứng data kiểu mới
            setUsers(res.data.data || []);
            setTotalPages(res.data.totalPages || 1);
        } catch (err) {
            console.error(err);
            setUsers([]);
        }
    };

    // Theo dõi sự thay đổi của 'page', hễ bấm chuyển trang là gọi lại API
    useEffect(() => {
        fetchUsers();
    }, [page]);;

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post("api/users", form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast("Tạo tài khoản thành công!", "success");
            // Reset form sau khi thành công
            setForm({ username: "", email: "", password: "", role: "user" });
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.message || "Lỗi tạo tài khoản", "danger");
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`api/users/${editForm.id}`, editForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast("Cập nhật thành công!", "success");
            setShowEdit(false);
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.message || "Lỗi cập nhật", "danger");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) return;
        try {
            await api.delete(`api/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast("Xóa tài khoản thành công", "success");
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.message || "Lỗi xóa tài khoản", "danger");
        }
    };

    const openEditMode = (user) => {
        setEditForm({ id: user.id, username: user.username, email: user.email || "", password: "", role: user.role });
        setShowEdit(true);
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="container-fluid pt-4 px-2 px-md-4 pb-5">
                {/* Form Thêm Mới */}
                <div className="bg-white p-3 p-md-4 shadow-sm rounded mb-4 w-100 overflow-hidden">
                    <h5 className="fw-bold mb-3">Thêm nhân viên mới</h5>
                    <form onSubmit={handleAdd} className="row g-2 g-md-3 align-items-center">
                        <div className="col-12 col-md-2">
                            <input 
                                className="form-control" 
                                placeholder="Tên đăng nhập" 
                                value={form.username} 
                                onChange={(e) => setForm({...form, username: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="col-12 col-md-3">
                            <input 
                                type="email" 
                                className="form-control" 
                                placeholder="Email" 
                                value={form.email} 
                                onChange={(e) => setForm({...form, email: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="col-12 col-md-3">
                            <input 
                                type="password" 
                                className="form-control" 
                                placeholder="Mật khẩu" 
                                value={form.password} 
                                onChange={(e) => setForm({...form, password: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="col-12 col-md-2">
                            <select 
                                className="form-select border-info" 
                                value={form.role} 
                                onChange={(e) => setForm({...form, role: e.target.value})}
                            >
                                <option value="user">Nhân viên (User)</option>
                                <option value="admin">Quản lý (Admin)</option>
                            </select>
                        </div>
                        <div className="col-12 col-md-2 mt-3 mt-md-0">
                            <button type="submit" className="btn btn-primary w-100">Tạo mới</button>
                        </div>
                    </form>
                </div>

                {/* Bảng Danh sách */}
                <div className="bg-white p-3 p-md-4 shadow-sm rounded w-100">
                    <h5 className="fw-bold mb-3">Danh sách tài khoản</h5>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 text-nowrap">
                            <thead className="table-light">
                                <tr>
                                    <th>ID</th>
                                    <th>Tên đăng nhập</th>
                                    <th>Email</th>
                                    <th>Vai trò (Role)</th>
                                    <th className="text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.id}</td>
                                        <td className="fw-bold">{u.username}</td>
                                        <td>{u.email}</td>
                                        <td>
                                            {u.role === 'admin' ? 
                                                <span className="badge bg-danger">Quản lý</span> : 
                                                <span className="badge bg-secondary">Nhân viên</span>
                                            }
                                        </td>
                                        <td className="text-center">
                                            <button className="btn btn-sm btn-warning me-2" onClick={() => openEditMode(u)}>Sửa</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}>Xóa</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </div>
            </div>

            {/* Modal Sửa Tài Khoản */}
            {showEdit && (
                <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered mx-3 mx-md-auto">
                        <div className="modal-content">
                            <div className="modal-header bg-warning">
                                <h5 className="modal-title fw-bold">Cập nhật tài khoản</h5>
                                <button type="button" className="btn-close" onClick={() => setShowEdit(false)}></button>
                            </div>
                            <form onSubmit={handleUpdate}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Tên đăng nhập</label>
                                        <input className="form-control" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-control" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Quyền hạn (Role)</label>
                                        <select className="form-select" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                                            <option value="user">Nhân viên (User)</option>
                                            <option value="admin">Quản lý (Admin)</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label text-danger">Mật khẩu mới (Bỏ trống nếu không đổi)</label>
                                        <input type="password" className="form-control" placeholder="***" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Hủy</button>
                                    <button type="submit" className="btn btn-warning">Lưu thay đổi</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default Users;