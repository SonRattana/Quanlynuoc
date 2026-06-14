import { useEffect, useState } from "react";
import React from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import CustomersTable from "../components/customerstable";
import DepositModal from "../components/depositModal";
import api from "../src/utils/axios";
import CustomerDetailModal from "../components/CustomerDetailModal";
import PayDebtModal from "../components/PayDebtModal";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerForDebt, setSelectedCustomerForDebt] = useState(null);
  
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterAddress, setFilterAddress] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDelivery, setFilterDelivery] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    type: "le",
    delivery_method: "giao_hang"
  });

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    type: "le",
    delivery_method: "giao_hang"
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const openEdit = (customer) => {
    setEditForm({
      ...customer,
      delivery_method: customer.delivery_method || "giao_hang"
    });
    setShowEdit(true);
  };

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

  const validateForm = (data) => {
    if (!data.name.trim()) return "Tên không được để trống";
    if (!data.address.trim()) return "Địa chỉ không được để trống";
    if (data.email && data.email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return "Email không đúng định dạng (Ví dụ: abc@gmail.com)";
      }
    }
    if (!data.phone) return "SĐT không được để trống";
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(data.phone)) {
      return "SĐT phải là số Việt Nam 10 chữ số và bắt đầu bằng 0";
    }
    return null;
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
      params: {
        page,
        limit,
        search: searchKeyword,
        address: filterAddress,
        type: filterType,
        delivery_method: filterDelivery
      }
    });

    setCustomers(res.data.rows);
    setTotalPages(Math.ceil(res.data.total / limit));
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const handleSearchClick = () => {
    setPage(1);
    fetchCustomers();
  };

  const clearFilters = () => {
    setSearchKeyword("");
    setFilterAddress("");
    setFilterType("");
    setFilterDelivery("");
    setPage(1);
    setTimeout(fetchCustomers, 0); 
  };

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
      setForm({ name: "", phone: "", email: "", address: "", type: "le", delivery_method: "giao_hang" });
    } catch (err) {
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
      <div className="bg-white shadow-sm p-4 mb-4 rounded">
        <h5 className="fw-bold mb-3"><i className="bi bi-person-plus-fill me-2 text-primary"></i>Thêm Khách Hàng</h5>

        <form onSubmit={handleSubmit} className="row g-2 align-items-center mb-4">
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
              type="email"
              className="form-control"
              placeholder="Email (Tùy chọn)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="SĐT"
              value={form.phone}
              onChange={(e) => {
                const value = e.target.value;
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
          <div className="col-md-2">
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
          <div className="col-12 mt-3 text-end">
            <button type="submit" className="btn btn-primary px-5 fw-bold shadow-sm">Thêm Khách Hàng</button>
          </div>
        </form>

        <hr className="text-muted" />

        <div className="bg-light p-3 rounded-3 mb-4 border border-light">
          <h6 className="fw-bold text-secondary mb-3"><i className="bi bi-funnel-fill me-2"></i>BỘ LỌC TÌM KIẾM</h6>
          <div className="row g-2">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Tìm Tên khách hoặc SĐT..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Gõ Phường/Đường để lọc địa chỉ..."
                value={filterAddress}
                onChange={(e) => setFilterAddress(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">-- Tất cả loại khách --</option>
                <option value="le">Khách lẻ</option>
                <option value="cua_hang">Cửa hàng</option>
                <option value="doanh_nghiep">Doanh nghiệp</option>
                <option value="khoa">Khoa</option>
              </select>
            </div>
            <div className="col-md-2 d-flex gap-2">
              <button className="btn btn-success w-100 fw-bold" onClick={handleSearchClick}>Lọc</button>
              <button className="btn btn-outline-secondary w-100 fw-bold" onClick={clearFilters}>Xóa</button>
            </div>
          </div>
        </div>

        <CustomersTable
          customers={customers}
          onEdit={openEdit}
          onDelete={handleDelete}
          onPayDebt={(customer) => setSelectedCustomerForDebt(customer)}
          onDeposit={(customer) => setSelectedCustomer(customer)}
          onView={openDetail}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
        />

        {selectedCustomerForDebt && (
          <PayDebtModal
            customer={selectedCustomerForDebt}
            onClose={() => setSelectedCustomerForDebt(null)}
            onSuccess={fetchCustomers}
          />
        )}

        {/* 💡 Modal Trả vỏ: Sếp đã gọi fetchCustomers vào onSuccess cực kỳ chuẩn xác! */}
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
                      <th>Tên Khách Hàng</th>
                      <input
                        className="form-control mb-2"
                        placeholder="Tên khách"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        required
                      />

                      <th>Email</th>
                      <input
                        type="email"
                        className="form-control mb-2"
                        placeholder="Email"
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />

                      <th>SĐT</th>
                      <input
                        className="form-control mb-2"
                        placeholder="SĐT"
                        value={editForm.phone}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*$/.test(value)) {
                            setEditForm({ ...editForm, phone: value });
                          }
                        }}
                        maxLength={10}
                        required
                      />

                      <th>Địa chỉ</th>
                      <input
                        className="form-control mb-2"
                        placeholder="Địa chỉ"
                        value={editForm.address}
                        onChange={(e) =>
                          setEditForm({ ...editForm, address: e.target.value })
                        }
                        required
                      />
                      <th>Loại Khách</th>
                      <select
                        className="form-select mb-2"
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

                      <th>Hình Thức Nhận Hàng</th>
                      <select
                        className="form-select border-warning text-dark fw-bold"
                        value={editForm.delivery_method}
                        onChange={(e) => setEditForm({ ...editForm, delivery_method: e.target.value })}
                      >
                        <option value="giao_hang">🏠 Đặt giao tại nhà</option>
                        <option value="tu_lay">🏪 Tự đến lấy</option>
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