import { useEffect, useState } from "react";
import axios from "axios";
import React from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import CustomersTable from "../components/customerstable";
import DepositModal from "../components/depositModal";
import api from "../src/utils/axios";
import CustomerDetailModal from "../components/CustomerDetailModal";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    type: "le"
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    phone: "",
    address: "",
    type: "le"
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  const openEdit = (customer) => {
    setEditForm(customer);
    setShowEdit(true);
  };

  // Detail customer
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [depositInfo, setDepositInfo] = useState([]);
  const fetchDepositInfo = async (id) => {
    try {
      const res = await api.get(`api/customers/${id}/deposit`);
      setDepositInfo(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  const openDetail = async (customer) => {
    setDetailCustomer(customer);
    fetchDepositInfo(customer.id);
  };
  // Validate form
  const validateForm = (data) => {
    if (!data.name.trim()) {
      return "Tên không được để trống";
    }

    if (!data.address.trim()) {
      return "Địa chỉ không được để trống";
    }

    if (!data.phone) {
      return "SĐT không được để trống";
    }

    const phoneRegex = /^0\d{9}$/;

    if (!phoneRegex.test(data.phone)) {
      return "SĐT phải là số Việt Nam 10 chữ số và bắt đầu bằng 0";
    }

    return null; // hợp lệ
  };



  const handleUpdate = async (e) => {
    e.preventDefault();
    const error = validateForm(editForm);
    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }
    try {
      await api.put(`api/customers/${editForm.id}`, editForm);
      setToast({ message: "Cập nhật thành công", type: "success" });
      setShowEdit(false);
      fetchCustomers();
    } catch (err) {
      // HIỆN LỖI TRÙNG SĐT KHI SỬA
      const msg = err.response?.data?.message || "Cập nhật thất bại";
      setToast({ message: msg, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá khách hàng này?")) return;

    try {
      await api.delete(`api/customers/${id}`);
      setToast({ message: "Đã xoá", type: "success" });
      fetchCustomers();
    } catch (err) {
      setToast({ message: "Xoá thất bại", type: "error" });
    }
  };


  const [toast, setToast] = useState(null);
  const fetchCustomers = async () => {
    const res = await api.get("api/customers", {
      params: { page, limit }
    });

    setCustomers(res.data.rows);
    setTotalPages(Math.ceil(res.data.total / limit));
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm(form);
    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }
    try {
      await api.post("api/customers", form);
      setToast({ message: "Thêm khách hàng thành công", type: "success" });
      fetchCustomers();
      setForm({ name: "", phone: "", address: "", type: "le" });
    } catch (err) {
      // LẤY THÔNG BÁO LỖI TỪ BACKEND (Ví dụ: "SĐT đã tồn tại")
      const msg = err.response?.data?.message || "Thêm khách hàng thất bại";
      setToast({ message: msg, type: "error" });
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
      <div className="bg-white shadow-sm p-4 mb-4">
        <h5 className="fw-bold mb-3">Quản lý khách hàng</h5>

        <form onSubmit={handleSubmit} className="row g-3">
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Tên khách"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="SĐT"
              value={form.phone}
              onChange={(e) => {
                const value = e.target.value;

                // Chỉ cho nhập số
                if (/^\d*$/.test(value)) {
                  setForm({ ...form, phone: value });
                }
              }}
              maxLength={10}
              required
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Địa chỉ"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="le">Khách lẻ</option>
              <option value="cua_hang">Cửa hàng</option>
              <option value="doanh_nghiep">Doanh nghiệp</option>
              <option value="khoa">Khoa</option>
            </select>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary w-100">Thêm</button>
          </div>
        </form>

        <hr />

        <CustomersTable
          customers={customers}
          onEdit={openEdit}
          onDelete={handleDelete}
          onDeposit={(customer) => setSelectedCustomer(customer)}
          onView={openDetail}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
        />

        {selectedCustomer && (
          <DepositModal
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onSuccess={fetchCustomers}
          />
        )}
        <CustomerDetailModal
          customer={detailCustomer}
          depositInfo={depositInfo}
          onClose={() => setDetailCustomer(null)}
        />

        {/* Edit Modal */}
        {showEdit && (
          <>
            <div className="modal fade show d-block">
              <div className="modal-dialog">
                <div className="modal-content">

                  <div className="modal-header bg-warning">
                    <h5 className="modal-title">Sửa khách hàng</h5>
                    <button
                      className="btn-close"
                      onClick={() => setShowEdit(false)}
                    ></button>
                  </div>

                  <form onSubmit={handleUpdate}>
                    <div className="modal-body">

                      <input
                        className="form-control mb-2"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        required
                      />

                      <input
                        className="form-control"
                        placeholder="SĐT"
                        value={editForm.phone}
                        onChange={(e) => {
                          const value = e.target.value;

                          // Chỉ cho nhập số
                          if (/^\d*$/.test(value)) {
                            setEditForm({ ...editForm, phone: value });
                          }
                        }}
                        maxLength={10}
                        required
                      />

                      <input
                        className="form-control mb-2"
                        value={editForm.address}
                        onChange={(e) =>
                          setEditForm({ ...editForm, address: e.target.value })
                        }
                        required
                      />

                      <select
                        className="form-select"
                        value={editForm.type}
                        onChange={(e) =>
                          setEditForm({ ...editForm, type: e.target.value })
                        }
                      >
                        <option value="le">Khách lẻ</option>
                        <option value="cua_hang">Cửa hàng</option>
                        <option value="doanh_nghiep">Doanh nghiệp</option>
                        <option value="khoa">Khoa</option>
                      </select>

                    </div>

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

            <div
              className="modal-backdrop fade show"
              onClick={() => setShowEdit(false)}
            ></div>
          </>
        )}
      </div>
    </Layout>
  );
}