import { useEffect, useState } from "react";
import Layout from "../components/layout";
import StockHistory from "../components/stockhistory";
import StockForm from "../components/stockform";
import Toast from "../components/Toast";
import React from "react";
import axios from "axios";

function Stock() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [inventory, setInventory] = useState([]);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [isAddingWH, setIsAddingWH] = useState(false);

  // ===== STATE CHO POPUP SỬA / XÓA ĐẸP MẮT =====
  const [editWH, setEditWH] = useState({ isOpen: false, id: null, oldName: "", newName: "" });
  const [deleteWH, setDeleteWH] = useState({ isOpen: false, id: null, name: "" });

  const [importForm, setImportForm] = useState({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
  const [exportForm, setExportForm] = useState({ warehouse_id: "", product_id: "", quantity: "", reason: "" });

  const getPageFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("page")) || 1;
  };

  const [page, setPage] = useState(getPageFromURL());

  // ================= FETCH =================
  const fetchProducts = async () => {
    try {
      const res = await axios.get("api/products", { headers: { Authorization: `Bearer ${token}` } });
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get("api/stock/warehouses", { headers: { Authorization: `Bearer ${token}` } });
      setWarehouses(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchStock = async () => {
    try {
      const res = await axios.get(`api/stock?page=${page}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
      setStocks(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get("api/stock/inventory", { headers: { Authorization: `Bearer ${token}` } });
      setInventory(res.data.data || res.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page);
    window.history.replaceState({}, "", `?${params}`);
  }, [page]);

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
    fetchStock();
    fetchInventory();
  }, [page]);

  // ================= TẠO KHO MỚI =================
  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    if (!newWarehouseName.trim()) return setToast({ message: "Chưa nhập tên kho bạn ơi!", type: "warning" });

    setIsAddingWH(true);
    try {
      const res = await axios.post("api/stock/warehouses", { name: newWarehouseName }, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: res.data.message, type: "success" });
      setNewWarehouseName("");
      fetchWarehouses();
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Lỗi tạo kho", type: "danger" });
    } finally {
      setIsAddingWH(false);
    }
  };

  // ================= LƯU SỬA TÊN KHO TỪ POPUP =================
  const handleSaveEditName = async () => {
    if (!editWH.newName.trim() || editWH.newName === editWH.oldName) {
      setEditWH({ isOpen: false, id: null, oldName: "", newName: "" }); // Đóng popup nếu ko đổi gì
      return;
    }
    try {
      await axios.put(`api/stock/warehouses/${editWH.id}`, { name: editWH.newName }, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Đổi tên kho thành công!", type: "success" });
      fetchWarehouses(); fetchInventory();
    } catch (err) {
      setToast({ message: "Lỗi khi đổi tên!", type: "danger" });
    }
    setEditWH({ isOpen: false, id: null, oldName: "", newName: "" }); // Đóng popup
  };

  // ================= XÁC NHẬN XÓA TỪ POPUP =================
  const handleConfirmDelete = async () => {
    try {
      await axios.delete(`api/stock/warehouses/${deleteWH.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Đã xóa kho thành công!", type: "success" });
      fetchWarehouses(); fetchInventory();
    } catch (err) {
      setToast({ message: err.response?.data?.message || "Lỗi khi xóa kho!", type: "danger" });
    }
    setDeleteWH({ isOpen: false, id: null, name: "" }); // Đóng popup
  };

  // ================= IMPORT =================
  const handleImport = async (e) => {
    e.preventDefault();
    if (!importForm.warehouse_id || !importForm.product_id || !importForm.quantity) return setToast({ message: "Thiếu dữ liệu", type: "danger" });
    try {
      await axios.post(`api/stock/import`, importForm, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Nhập kho thành công", type: "success" });
      setImportForm({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
      fetchStock(); fetchInventory();
    } catch (err) { setToast({ message: err.response?.data?.message || "Lỗi nhập kho", type: "danger" }); }
  };

  // ================= EXPORT =================
  const handleExport = async (e) => {
    e.preventDefault();
    if (!exportForm.warehouse_id || !exportForm.product_id || !exportForm.quantity) return setToast({ message: "Thiếu dữ liệu", type: "danger" });
    try {
      await axios.post("api/stock/export", exportForm, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Xuất kho thành công", type: "success" });
      setExportForm({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
      fetchStock(); fetchInventory();
    } catch (err) { setToast({ message: err.response?.data?.message || "Lỗi xuất kho", type: "danger" }); }
  };

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="container-fluid pt-4 px-4 pb-5 relative">
        
        {/* ========================================== */}
        {/* KHU VỰC QUẢN LÝ KHO (ADMIN)                */}
        {/* ========================================== */}
        {user?.role === "admin" && (
          <div className="card shadow-sm border-0 mb-4 rounded-3 bg-light">
            <div className="card-body py-3">
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between mb-3">
                <h6 className="fw-bold text-success mb-3 mb-md-0 me-3">
                  <i className="fa fa-cogs me-2"></i>Quản lý Danh sách Kho
                </h6>
                <form onSubmit={handleAddWarehouse} className="d-flex w-100" style={{ maxWidth: "500px" }}>
                  <input 
                    type="text" 
                    className="form-control me-2 border-success" 
                    placeholder="Mở kho mới (VD: Kho Dược)..." 
                    value={newWarehouseName}
                    onChange={(e) => setNewWarehouseName(e.target.value)}
                  />
                  <button type="submit" className="btn btn-success text-nowrap fw-bold shadow-sm" disabled={isAddingWH}>
                    {isAddingWH ? <i className="fa fa-spinner fa-spin"></i> : <><i className="fa fa-plus me-1"></i> Tạo</>}
                  </button>
                </form>
              </div>

              {/* Danh sách các kho hiện tại để Sửa/Xóa */}
              <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                <span className="text-muted small fw-bold mt-2 me-2">Các kho đang có:</span>
                {warehouses.map(wh => (
                  <div key={wh.id} className="badge bg-white text-dark border p-2 d-flex align-items-center shadow-sm" style={{ transition: 'all 0.2s' }}>
                    <i className="fa fa-warehouse text-secondary me-2"></i>
                    <span className="me-3 fs-6">{wh.name}</span>
                    
                    {/* BẤM NÚT SỬA SẼ GỌI POPUP ĐẸP LÊN */}
                    <i className="fa fa-pen text-primary me-3" style={{cursor: 'pointer'}} title="Đổi tên kho"
                       onClick={() => setEditWH({ isOpen: true, id: wh.id, oldName: wh.name, newName: wh.name })}>
                    </i>

                    {/* BẤM NÚT XÓA SẼ GỌI POPUP CẢNH BÁO LÊN */}
                    <i className="fa fa-trash text-danger" style={{cursor: 'pointer'}} title="Xóa kho"
                       onClick={() => setDeleteWH({ isOpen: true, id: wh.id, name: wh.name })}>
                    </i>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NỬA TRÊN LÀ FORM NHẬP XUẤT */}
        <StockForm title="Nhập kho" type="import" products={products} warehouses={warehouses} form={importForm} setForm={setImportForm} onSubmit={handleImport} buttonClass="btn-success" />
        {user?.role === "admin" && (
          <StockForm title="Xuất kho" type="export" products={products} warehouses={warehouses} form={exportForm} setForm={setExportForm} onSubmit={handleExport} buttonClass="btn-danger" />
        )}

        {/* BẢNG TỒN KHO */}
        <div className="card shadow-sm border-0 mb-4 rounded-3">
          <div className="card-header bg-white border-bottom-0 pt-3 pb-0">
            <h5 className="fw-bold text-primary"><i className="fa fa-boxes me-2"></i>Tồn kho hiện tại</h5>
          </div>
          <div className="card-body">
            {inventory.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="fa fa-box-open fs-1 mb-2 opacity-50"></i><p>Chưa có dữ liệu tồn kho.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle border text-center">
                  <thead className="table-light">
                    <tr>
                      <th>STT</th><th className="text-start">Tên Sản Phẩm</th><th>Kho Hàng</th><th>Số Lượng Tồn</th><th>Tình Trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td className="text-start fw-bold text-dark">{item.product_name}</td>
                        <td><span className="badge bg-secondary">{item.warehouse_name}</span></td>
                        <td><span className={`fw-bold fs-5 ${item.quantity <= 10 ? 'text-danger' : 'text-success'}`}>{item.quantity}</span></td>
                        <td>
                          {item.quantity <= 0 ? <span className="badge bg-danger">Hết hàng</span> : item.quantity <= 10 ? <span className="badge bg-warning text-dark">Sắp hết</span> : <span className="badge bg-success">Còn hàng</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* BẢNG HISTORY */}
        <StockHistory stocks={stocks} page={page} totalPages={totalPages} setPage={setPage} />

      </div>

      {/* ========================================== */}
      {/* POPUP (MODAL) ĐỔI TÊN KHO SIÊU ĐẸP         */}
      {/* ========================================== */}
      {editWH.isOpen && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header bg-primary text-white border-0">
                <h5 className="modal-title fw-bold"><i className="fa fa-pen-square me-2"></i>Đổi tên kho bãi</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditWH({ isOpen: false, id: null, oldName: "", newName: "" })}></button>
              </div>
              <div className="modal-body p-4">
                <label className="fw-bold text-muted small mb-2">Nhập tên mới cho kho:</label>
                <input 
                  type="text" 
                  className="form-control form-control-lg border-primary shadow-sm"
                  value={editWH.newName}
                  onChange={(e) => setEditWH({ ...editWH, newName: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="modal-footer border-0 bg-light">
                <button type="button" className="btn btn-secondary fw-bold" onClick={() => setEditWH({ isOpen: false, id: null, oldName: "", newName: "" })}>Hủy</button>
                <button type="button" className="btn btn-primary fw-bold px-4 shadow-sm" onClick={handleSaveEditName}>Lưu thay đổi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* POPUP (MODAL) XÁC NHẬN XÓA KHO CẢNH BÁO ĐỎ */}
      {/* ========================================== */}
      {deleteWH.isOpen && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header bg-danger text-white border-0">
                <h5 className="modal-title fw-bold"><i className="fa fa-exclamation-triangle me-2"></i>Cảnh báo xóa kho</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeleteWH({ isOpen: false, id: null, name: "" })}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <i className="fa fa-trash-alt text-danger mb-3" style={{ fontSize: '4rem', opacity: 0.2 }}></i>
                <p className="fs-5 mb-1 text-dark">Bạn có chắc chắn muốn xóa kho</p>
                <h3 className="text-danger fw-bold my-2">[{deleteWH.name}]</h3>
                <p className="text-muted small mt-3 px-3">Hành động này không thể hoàn tác. Các kho đang chứa hàng sẽ bị hệ thống chặn không cho phép xóa!</p>
              </div>
              <div className="modal-footer border-0 justify-content-center bg-light">
                <button type="button" className="btn btn-secondary fw-bold px-4" onClick={() => setDeleteWH({ isOpen: false, id: null, name: "" })}>Hủy</button>
                <button type="button" className="btn btn-danger fw-bold px-4 shadow-sm" onClick={handleConfirmDelete}>Vẫn Xóa</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}

export default Stock;