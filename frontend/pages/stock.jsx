import { useEffect, useState } from "react";
import Layout from "../components/layout";
import StockHistory from "../components/stockhistory";
import StockForm from "../components/stockform";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";
import React from "react";
import axios from "axios";
import api from "../src/utils/axios";

function Stock() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const [toast, setToast] = useState(null);

  // ================= 1. KHAI BÁO TOÀN BỘ STATE TẠI ĐÂY (Để không bị lỗi ReferenceError) =================
  const [activeTab, setActiveTab] = useState("thanh_pham");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("all");
  const ITEMS_PER_PAGE = 10;
  const [pages, setPages] = useState({ tp: 1, nvl: 1, nxt_tp: 1, nxt_nvl: 1 });

  const [allProducts, setAllProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [reportNXT, setReportNXT] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [isAddingWH, setIsAddingWH] = useState(false);

  const [editWH, setEditWH] = useState({ isOpen: false, id: null, oldName: "", newName: "" });
  const [deleteWH, setDeleteWH] = useState({ isOpen: false, id: null, name: "" });
  const [theKhoModal, setTheKhoModal] = useState({ isOpen: false, productName: "", history: [] });

  const [importForm, setImportForm] = useState({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
  const [exportForm, setExportForm] = useState({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
  const [internalForm, setInternalForm] = useState({ warehouse_id: "", product_id: "", quantity: "", department_name: "Khoa Khám Bệnh", reason: "" });
  const [issueHistory, setIssueHistory] = useState([]);
  const getPageFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("page")) || 1;
  };
  const [page, setPage] = useState(getPageFromURL());

  // ================= 2. ĐỘNG CƠ TÌM KIẾM & PHÂN TRANG DÙNG CHUNG =================

  // Tự động xóa ô tìm kiếm khi chuyển Tab
  useEffect(() => { setSearchKeyword(""); }, [activeTab]);

  const handlePageChange = (tableKey, newPage) => {
    setPages(prev => ({ ...prev, [tableKey]: newPage }));
  };

  // Hàm "Xay" dữ liệu: Tự động Lọc tìm kiếm + Cắt trang
  const getTableData = (dataArray, searchFields, tableKey) => {
    if (!dataArray) return { items: [], totalPages: 0, currentPage: 1 };

    const filtered = dataArray.filter(item =>
      searchFields.some(field => String(item[field] || "").toLowerCase().includes(searchKeyword.toLowerCase()))
    );

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    let currentPage = pages[tableKey] || 1;
    if (currentPage > totalPages && totalPages > 0) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const items = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { items, totalPages, currentPage };
  };

  // Component thanh Phân Trang gắn dưới mỗi bảng
  const PaginationBar = ({ totalPages, currentPage, tableKey }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="d-flex justify-content-between align-items-center p-3 bg-light border-top rounded-bottom">
        <span className="small text-muted fw-bold">Trang {currentPage} / {totalPages}</span>
        <ul className="pagination pagination-sm mb-0 shadow-sm">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => handlePageChange(tableKey, currentPage - 1)}>« Trước</button>
          </li>
          {[...Array(totalPages)].map((_, i) => (
            <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
              <button className="page-link" onClick={() => handlePageChange(tableKey, i + 1)}>{i + 1}</button>
            </li>
          ))}
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => handlePageChange(tableKey, currentPage + 1)}>Sau »</button>
          </li>
        </ul>
      </div>
    );
  };
  // ==============================================================================

  // Phân loại Sản Phẩm
  const finishedProducts = allProducts.filter(p => p.item_type === "thanh_pham");
  const materialProducts = allProducts.filter(p => p.item_type === "nguyen_lieu");

  const isMaterialWH = (name) => name.toLowerCase().includes("nguyên vật liệu") || name.toLowerCase().includes("nvl");
  const waterWarehouses = warehouses.filter(w => !isMaterialWH(w.name));
  const materialWarehouses = warehouses.filter(w => isMaterialWH(w.name));

  const getProductsForExportForm = () => {
    if (!exportForm.warehouse_id) return [];
    const selectedWh = warehouses.find(w => String(w.id) === String(exportForm.warehouse_id));
    if (!selectedWh) return [];
    const name = selectedWh.name.toLowerCase();
    const isMaterialWH = name.includes("nguyên vật liệu") || name.includes("nvl");
    return isMaterialWH ? allProducts.filter(p => p.item_type === "nguyen_lieu") : allProducts.filter(p => p.item_type === "thanh_pham");
  };

  const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);

  // ================= FETCH DỮ LIỆU =================
  const fetchProducts = async () => {
    try {
      const res = await axios.get("api/products", { headers: { Authorization: `Bearer ${token}` } });
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setAllProducts(data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) window.location.href = "/login";
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
      const res = await axios.get(`api/stock?page=${page}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      setStocks(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) { console.error(err); }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get("api/stock/inventory", { headers: { Authorization: `Bearer ${token}` } });
      setInventory(res.data.data || res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchNXT = async () => {
    try {
      const res = await axios.get("api/stock/report-nxt", { headers: { Authorization: `Bearer ${token}` } });
      setReportNXT(res.data);
    } catch (err) { console.error("Lỗi lấy báo cáo NXT:", err); }
  };

  const fetchIssueHistory = async () => {
    try {
      // 💡 Đã bỏ dấu gạch chéo ở đầu và thêm headers chứa token bảo mật
      const res = await api.get("api/stock/internal-issues/history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssueHistory(res.data);
    } catch (error) {
      console.error("Lỗi tải lịch sử cấp phát", error);
    }
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
    fetchNXT();
    fetchIssueHistory();
  }, [page]);

  // ================= XỬ LÝ LỌC DỮ LIỆU TỒN KHO =================
  const filteredInventory = filterWarehouse === "all" ? inventory : inventory.filter(item => item.warehouse_id === Number(filterWarehouse));

  const tpInventory = filteredInventory.filter(inv => {
    const p = allProducts.find(prod => prod.name === inv.product_name || prod.id === inv.product_id);
    return p ? p.item_type === 'thanh_pham' : false;
  });

  const nvlInventory = filteredInventory.filter(inv => {
    const p = allProducts.find(prod => prod.name === inv.product_name || prod.id === inv.product_id);
    return p ? p.item_type === 'nguyen_lieu' : true;
  });

  // 💡 ÁP DỤNG ĐỘNG CƠ XAY DỮ LIỆU VÀO TAB TỒN KHO
  const dataInventoryTP = getTableData(tpInventory, ['product_name'], 'tp');
  const dataInventoryNVL = getTableData(nvlInventory, ['product_name'], 'nvl');

  const currentData = activeTab === "thanh_pham" ? dataInventoryTP : dataInventoryNVL;
  const currentTableKey = activeTab === "thanh_pham" ? 'tp' : 'nvl';

  const openTheKho = (productName) => {
    const historyOfProduct = stocks.filter(s => s.product_name === productName);
    setTheKhoModal({ isOpen: true, productName, history: historyOfProduct });
  };

  // ================= CÁC HÀM XỬ LÝ API KHO =================
  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    if (!newWarehouseName.trim()) return setToast({ message: "Chưa nhập tên kho!", type: "warning" });
    setIsAddingWH(true);
    try {
      const res = await axios.post("api/stock/warehouses", { name: newWarehouseName }, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: res.data.message, type: "success" });
      setNewWarehouseName(""); fetchWarehouses();
    } catch (err) { setToast({ message: "Lỗi tạo kho", type: "danger" }); }
    finally { setIsAddingWH(false); }
  };

  const handleSaveEditName = async () => {
    if (!editWH.newName.trim() || editWH.newName === editWH.oldName) return setEditWH({ isOpen: false, id: null, oldName: "", newName: "" });
    try {
      await axios.put(`api/stock/warehouses/${editWH.id}`, { name: editWH.newName }, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Đổi tên thành công!", type: "success" });
      fetchWarehouses(); fetchInventory();
    } catch (err) { setToast({ message: "Lỗi đổi tên!", type: "danger" }); }
    setEditWH({ isOpen: false, id: null, oldName: "", newName: "" });
  };

  const handleConfirmDelete = async () => {
    try {
      await axios.delete(`api/stock/warehouses/${deleteWH.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: "Đã xóa kho!", type: "success" });
      fetchWarehouses(); fetchInventory();
    } catch (err) { setToast({ message: err.response?.data?.message || "Lỗi xóa kho!", type: "danger" }); }
    setDeleteWH({ isOpen: false, id: null, name: "" });
  };

  const handleInternalIssue = async (e) => {
    e.preventDefault();
    if (!internalForm.warehouse_id || !internalForm.product_id || !internalForm.quantity || !internalForm.department_name) return setToast({ message: "Thiếu dữ liệu", type: "danger" });
    try {
      const res = await axios.post("api/stock/internal-issue", internalForm, { headers: { Authorization: `Bearer ${token}` } });
      setToast({ message: res.data.message || "Cấp phát thành công!", type: "success" });
      setInternalForm({ warehouse_id: "", product_id: "", quantity: "", department_name: "Khoa Khám Bệnh", reason: "" });
      fetchStock(); fetchInventory();
    } catch (err) { setToast({ message: err.response?.data?.message || "Lỗi cấp phát nội bộ", type: "danger" }); }
  };

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

      <div className="container-fluid pt-4 px-4 pb-5">

        {/* KHU VỰC TẠO KHO NHANH (ADMIN) */}
        {['admin', 'sanxuat'].includes(user?.role) && (
          <div className="card shadow-sm border-0 mb-4 rounded-3 bg-white">
            <div className="card-body p-4">
              <div className="row align-items-center">
                <div className="col-md-5">
                  <h5 className="fw-bold text-primary mb-1"><i className="fa fa-cogs me-2"></i>Thiết lập Hệ thống Kho</h5>
                  <p className="text-muted small mb-0">Tạo Kho Tổng, Kho Cửa Hàng, Kho Nguyên Vật Liệu...</p>
                </div>
                <div className="col-md-7">
                  <form onSubmit={handleAddWarehouse} className="d-flex">
                    <input type="text" className="form-control me-2 border-primary" placeholder="Tên kho mới..." value={newWarehouseName} onChange={(e) => setNewWarehouseName(e.target.value)} />
                    <button type="submit" className="btn btn-primary fw-bold shadow-sm" disabled={isAddingWH}>
                      {isAddingWH ? <i className="fa fa-spinner fa-spin"></i> : <><i className="fa fa-plus me-1"></i> Tạo Kho</>}
                    </button>
                  </form>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 pt-3 mt-3 border-top">
                {warehouses.map(wh => (
                  <div key={wh.id} className="badge bg-light text-dark border p-2 d-flex align-items-center shadow-sm">
                    <i className="fa fa-warehouse text-primary me-2"></i> <span className="me-3 fs-6">{wh.name}</span>
                    <i className="fa fa-pen text-warning me-3" style={{ cursor: 'pointer' }} onClick={() => setEditWH({ isOpen: true, id: wh.id, oldName: wh.name, newName: wh.name })}></i>
                    <i className="fa fa-trash text-danger" style={{ cursor: 'pointer' }} onClick={() => setDeleteWH({ isOpen: true, id: wh.id, name: wh.name })}></i>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MENU TABS ĐIỀU HƯỚNG */}
        <ul className="nav nav-pills mb-4 bg-white p-2 rounded-3 shadow-sm border" style={{ gap: '10px' }}>
          <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${activeTab === 'thanh_pham' ? 'active bg-success' : 'text-secondary'}`} onClick={() => setActiveTab("thanh_pham")}>
              <i className="fa fa-box-open me-2"></i>📦 Tồn Kho Sản Phẩm
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${activeTab === 'nguyen_lieu' ? 'active bg-warning text-dark' : 'text-secondary'}`} onClick={() => setActiveTab("nguyen_lieu")}>
              <i className="fa fa-tools me-2"></i>🛠️ Tồn Kho Nguyên Vật Liệu
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${activeTab === 'actions' ? 'active bg-primary' : 'text-secondary'}`} onClick={() => setActiveTab("actions")}>
              <i className="fa fa-exchange-alt me-2"></i>🔄 Phiếu Nhập / Xuất / Cấp Phát
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link fw-bold px-4 ${activeTab === 'bao_cao_nxt' ? 'active bg-danger text-white' : 'text-secondary'}`} onClick={() => setActiveTab("bao_cao_nxt")}>
              <i className="fa fa-chart-line me-2"></i>📊 Nhập - Xuất - Tồn
            </button>
          </li>
        </ul>

        {/* ================= TAB 1 & 2: BẢNG TỒN KHO VÀ THẺ KHO ================= */}
        {(activeTab === "thanh_pham" || activeTab === "nguyen_lieu") && (
          <div className="card shadow-sm border-0 mb-4 rounded-3">
            <div className="card-header bg-white pt-3 pb-3 d-flex justify-content-between align-items-center border-bottom-0 flex-wrap gap-2">
              <h5 className="fw-bold text-dark mb-0">
                {activeTab === "thanh_pham" ? "Danh sách Nước Đóng Chai / Lốc" : "Cảnh báo nguyên vật liệu Sản Xuất"}
              </h5>

              <div className="d-flex gap-2 flex-grow-1 justify-content-end" style={{ maxWidth: "600px" }}>
                <div className="input-group shadow-sm">
                  <span className="input-group-text bg-light border-secondary"><i className="bi bi-search text-muted"></i></span>
                  <input
                    type="text"
                    className="form-control border-secondary"
                    placeholder="Tìm tên hàng hóa, vật tư..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                <select
                  className="form-select border-secondary fw-bold shadow-sm"
                  style={{ width: "220px", flexShrink: 0 }}
                  value={filterWarehouse}
                  onChange={(e) => setFilterWarehouse(e.target.value)}
                >
                  <option value="all">-- Tất cả kho --</option>
                  {warehouses
                    .filter(w => {
                      const name = w.name.toLowerCase();
                      const isMaterialWH = name.includes("nguyên vật liệu") || name.includes("nguyên liệu") || name.includes("nvl");
                      return activeTab === "nguyen_lieu" ? isMaterialWH : !isMaterialWH;
                    })
                    .map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle text-center mb-0 table-mobile-cards">
                  <thead className={activeTab === 'thanh_pham' ? "table-success" : "table-warning"}>
                    <tr>
                      <th>STT</th>
                      <th className="text-start">Tên Hàng Hóa</th>
                      <th>Thuộc Kho</th>
                      <th>Số Lượng Tồn</th>
                      {activeTab === "thanh_pham" && <th>Giá Trị Tồn (Vốn)</th>}
                      <th>Tình Trạng</th>
                      <th>Thẻ Kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.items.length === 0 ? (
                      <tr><td colSpan="7" className="text-muted py-4 fst-italic">Không tìm thấy dữ liệu.</td></tr>
                    ) : (
                      currentData.items.map((item, index) => {
                        const prodInfo = allProducts.find(p => p.name === item.product_name);
                        const costPrice = prodInfo?.cost_price || 0;
                        const totalValue = item.quantity * costPrice;

                        return (
                          <tr key={index}>
                            <td data-label="STT">{(currentData.currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                            <td data-label="Tên Hàng Hóa" className="text-start fw-bold text-dark">{item.product_name}</td>
                            <td data-label="Thuộc Kho"><span className="badge bg-light text-dark border">{item.warehouse_name}</span></td>
                            <td data-label="Số Lượng Tồn">
                              <span className={`fw-bold fs-5 ${item.quantity <= 10 ? 'text-danger' : 'text-primary'}`}>
                                {item.quantity}
                              </span>
                            </td>
                            {activeTab === "thanh_pham" && (
                              <td data-label="Giá Trị Tồn (Vốn)" className="fw-bold text-success">{formatMoney(totalValue)}</td>
                            )}
                            <td data-label="Tình Trạng">
                              {item.quantity <= 0
                                ? <span className="badge bg-danger">Hết hàng</span>
                                : item.quantity <= 24 && activeTab === 'nguyen_lieu'
                                  ? <span className="badge bg-warning text-dark">Sắp hết vật tư!</span>
                                  : <span className="badge bg-success">Còn hàng</span>
                              }
                            </td>
                            <td data-label="Thẻ Kho">
                              <button className="btn btn-sm btn-outline-primary fw-bold" onClick={() => openTheKho(item.product_name)}>
                                <i className="fa fa-history me-1"></i>Xem
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar totalPages={currentData.totalPages} currentPage={currentData.currentPage} tableKey={currentTableKey} />
            </div>
          </div>
        )}

        {/* ================= TAB 3: NGHIỆP VỤ NHẬP XUẤT ================= */}
        {activeTab === "actions" && (
          <div className="row g-4">
            <div className="col-12">
              <StockForm
                title="Cấp phát nước cho các Khoa (Tiêu dùng nội bộ)"
                type="internal"
                products={finishedProducts}
                warehouses={waterWarehouses}
                form={internalForm}
                setForm={setInternalForm}
                onSubmit={handleInternalIssue}
                buttonClass="btn-info text-white"
              />
            </div>
            {['admin', 'ketoan', 'sanxuat'].includes(user?.role) && (
              <div className="col-12">
                <StockForm
                  title="Điều Chuyển / Xuất Hủy / Xuất Bán (Admin)"
                  type="export"
                  products={getProductsForExportForm()}
                  warehouses={warehouses}
                  form={exportForm}
                  setForm={setExportForm}
                  onSubmit={handleExport}
                  buttonClass="btn-danger"
                />
              </div>
            )}
            <div className="col-12 mt-5">
              <StockHistory stocks={stocks} page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          </div>
        )}

        {/* ================= TAB 4: BÁO CÁO NHẬP XUẤT TỒN ================= */}
        {activeTab === 'bao_cao_nxt' && (() => {
          // Xay dữ liệu ngay tại đây
          const nxtTP = getTableData(reportNXT.filter(i => i.item_type === 'thanh_pham'), ['name'], 'nxt_tp');
          const nxtNVL = getTableData(reportNXT.filter(i => i.item_type !== 'thanh_pham'), ['name'], 'nxt_nvl');

          return (
            <>
              {/* THANH TÌM KIẾM CHO BÁO CÁO */}
              <div className="d-flex justify-content-end mb-3">
                <div className="input-group shadow-sm" style={{ maxWidth: '400px' }}>
                  <span className="input-group-text bg-light border-secondary"><i className="bi bi-search text-muted"></i></span>
                  <input type="text" className="form-control border-secondary" placeholder="Tìm tên hàng hóa trong báo cáo..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
                </div>
              </div>

              {/* ---------------- BẢNG 1: THÀNH PHẨM ---------------- */}
              <div className="card shadow-sm border-0 mb-5 rounded-3 border-top border-success border-4">
                <div className="card-header bg-white pt-3 pb-3">
                  <h5 className="fw-bold text-success mb-0">
                    <i className="fa fa-box me-2"></i>Chi Tiết NXT - THÀNH PHẨM (Nước đóng chai, lốc)
                  </h5>
                </div>
                <div className="card-body p-0 table-responsive">
                  <table className="table table-bordered table-hover align-middle text-center mb-0 table-mobile-cards">
                    <thead className="table-success align-middle sticky-top" style={{ zIndex: 2 }}>
                      <tr>
                        <th rowSpan="2" className="text-start bg-success text-white" style={{ width: '20%' }}>Tên Thành Phẩm</th>
                        {/* 💡 THÊM CỘT TỒN KHO ĐẦU KỲ */}
                        <th colSpan="2" className="bg-secondary text-white border-end border-white">TỒN KHO ĐẦU KỲ</th>
                        <th colSpan="2" className="bg-primary text-white border-end border-white">NHẬP KHO</th>
                        <th colSpan="2" className="bg-warning text-dark border-end border-white">XUẤT KHO (Bán ra)</th>
                        <th colSpan="2" className="bg-success text-white">TỒN KHO HIỆN TẠI</th>
                      </tr>
                      <tr>
                        <th className="bg-secondary text-white border-white">Số lượng</th>
                        <th className="bg-secondary text-white border-white">Thành tiền</th>
                        <th className="bg-primary text-white border-white">Số lượng</th>
                        <th className="bg-primary text-white border-white">Thành tiền</th>
                        <th className="bg-warning text-dark border-white">Số lượng</th>
                        <th className="bg-warning text-dark border-white">Thành tiền</th>
                        <th className="bg-success text-white border-white">Số lượng</th>
                        <th className="bg-success text-white border-white">Giá trị tồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nxtTP.items.length === 0 ? <tr><td colSpan="9" className="text-muted py-4 fst-italic">Không có dữ liệu thành phẩm...</td></tr> :
                        nxtTP.items.map((item, idx) => {
                          // 💡 Tự động tính TỒN KHO ĐẦU KỲ bằng Toán học: Tồn Đầu = Tồn Cuối - Nhập + Xuất
                          const tonDauSl = Number(item.ton_sl) - Number(item.nhap_sl) + Number(item.xuat_sl);
                          const tonDauTt = Number(item.ton_tt) - Number(item.nhap_tt) + Number(item.xuat_tt);

                          return (
                            <tr key={idx}>
                              <td data-label="Tên Thành Phẩm" className="text-start fw-bold text-dark">{item.name} <span className="badge bg-light text-secondary ms-1">{item.unit}</span></td>

                              {/* TỒN ĐẦU */}
                              <td data-label="Tồn Đầu (SL)" className="text-secondary fw-bold fs-6">{tonDauSl}</td>
                              <td data-label="Tồn Đầu (TT)" className="text-secondary">{formatMoney(tonDauTt)}</td>

                              {/* NHẬP KHO */}
                              <td data-label="Nhập Kho (SL)" className="text-primary fw-bold fs-6">{item.nhap_sl}</td>
                              <td data-label="Nhập Kho (TT)" className="text-primary">{formatMoney(item.nhap_tt)}</td>

                              {/* XUẤT KHO */}
                              <td data-label="Xuất Kho (SL)" className="text-warning text-dark fw-bold fs-6">{item.xuat_sl}</td>
                              <td data-label="Xuất Kho (TT)" className="text-warning text-dark">{formatMoney(item.xuat_tt)}</td>

                              {/* TỒN CUỐI */}
                              <td data-label="Tồn Cuối (SL)" className={`fw-bold fs-5 ${item.ton_sl <= 0 ? 'text-danger' : 'text-success'}`}>{item.ton_sl}</td>
                              <td data-label="Giá Trị Tồn (TT)" className="fw-bold text-danger fs-6">{formatMoney(item.ton_tt)}</td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
                <PaginationBar totalPages={nxtTP.totalPages} currentPage={nxtTP.currentPage} tableKey="nxt_tp" />
              </div>

              {/* ---------------- BẢNG 2: NGUYÊN VẬT LIỆU ---------------- */}
              <div className="card shadow-sm border-0 mb-4 rounded-3 border-top border-warning border-4">
                <div className="card-header bg-white pt-3 pb-3">
                  <h5 className="fw-bold text-warning text-dark mb-0">
                    <i className="fa fa-layer-group me-2"></i>Chi Tiết NXT - NGUYÊN VẬT LIỆU (Màng co, tem...)
                  </h5>
                </div>
                <div className="card-body p-0 table-responsive">
                  <table className="table table-bordered table-hover align-middle text-center mb-0 table-mobile-cards">
                    <thead className="table-warning align-middle sticky-top" style={{ zIndex: 2 }}>
                      <tr>
                        <th rowSpan="2" className="text-start bg-warning text-dark" style={{ width: '20%' }}>Tên Nguyên Vật Liệu</th>
                        {/* 💡 THÊM CỘT TỒN KHO ĐẦU KỲ */}
                        <th colSpan="2" className="bg-secondary text-white border-end border-white">TỒN KHO ĐẦU KỲ</th>
                        <th colSpan="2" className="bg-primary text-white border-end border-white">NHẬP KHO (Mua vào)</th>
                        <th colSpan="2" className="bg-danger text-white border-end border-white">XUẤT KHO (Đưa đi SX)</th>
                        <th colSpan="2" className="bg-warning text-dark border-white">TỒN KHO HIỆN TẠI</th>
                      </tr>
                      <tr>
                        <th className="bg-secondary text-white border-white">Số lượng</th>
                        <th className="bg-secondary text-white border-white">Thành tiền</th>
                        <th className="bg-primary text-white border-white">Số lượng</th>
                        <th className="bg-primary text-white border-white">Thành tiền</th>
                        <th className="bg-danger text-white border-white">Số lượng</th>
                        <th className="bg-danger text-white border-white">Thành tiền</th>
                        <th className="bg-warning text-dark border-white">Số lượng</th>
                        <th className="bg-warning text-dark border-white">Giá trị tồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nxtNVL.items.length === 0 ? <tr><td colSpan="9" className="text-muted py-4 fst-italic">Không có dữ liệu nguyên vật liệu...</td></tr> :
                        nxtNVL.items.map((item, idx) => {
                          // 💡 Tính TỒN KHO ĐẦU KỲ cho NVL
                          const tonDauSl = Number(item.ton_sl) - Number(item.nhap_sl) + Number(item.xuat_sl);
                          const tonDauTt = Number(item.ton_tt) - Number(item.nhap_tt) + Number(item.xuat_tt);

                          return (
                            <tr key={idx}>
                              <td data-label="Tên NVL" className="text-start fw-bold text-dark">{item.name} <span className="badge bg-light text-secondary ms-1">{item.unit}</span></td>

                              {/* TỒN ĐẦU */}
                              <td data-label="Tồn Đầu(SL)" className="text-secondary fw-bold fs-6">{tonDauSl}</td>
                              <td data-label="Tồn Đầu(TT)" className="text-secondary">{formatMoney(tonDauTt)}</td>

                              {/* NHẬP KHO */}
                              <td data-label="Nhập Kho(SL)" className="text-primary fw-bold fs-6">{item.nhap_sl}</td>
                              <td data-label="Nhập Kho(TT)" className="text-primary">{formatMoney(item.nhap_tt)}</td>

                              {/* XUẤT KHO */}
                              <td data-label="Xuất Kho(SL)" className="text-danger fw-bold fs-6">{item.xuat_sl}</td>
                              <td data-label="Xuất Kho(TT)" className="text-danger">{formatMoney(item.xuat_tt)}</td>

                              {/* TỒN CUỐI */}
                              <td data-label="Tồn Cuối(SL)" className={`fw-bold fs-5 ${item.ton_sl <= 0 ? 'text-danger' : 'text-dark'}`}>{item.ton_sl}</td>
                              <td data-label="Tồn Cuối(TT)" className="fw-bold text-danger fs-6">{formatMoney(item.ton_tt)}</td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
                <PaginationBar totalPages={nxtNVL.totalPages} currentPage={nxtNVL.currentPage} tableKey="nxt_nvl" />
              </div>
            </>
          );
        })()}
      </div>

      {/* POPUP: THẺ KHO CHI TIẾT */}
      {theKhoModal.isOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header bg-dark text-white border-0 py-3">
                <h5 className="modal-title fw-bold">
                  <i className="fa fa-clipboard-list me-2 text-warning"></i>
                  Thẻ Kho Chi Tiết: <span className="text-warning">{theKhoModal.productName}</span>
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setTheKhoModal({ isOpen: false, productName: "", history: [] })}></button>
              </div>
              <div className="modal-body p-0 bg-light">
                <table className="table table-striped table-hover mb-0 text-center align-middle ">
                  <thead className="table-dark text-light sticky-top">
                    <tr>
                      <th>Thời gian</th>
                      <th>Mã Lệnh</th>
                      <th>Kho phát sinh</th>
                      <th>Hành động</th>
                      <th>Số lượng</th>
                      <th className="text-start">Lý do / Người nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {theKhoModal.history.length === 0 ? (
                      <tr><td colSpan="6" className="py-5 text-muted fst-italic">Chưa có phát sinh nhập/xuất nào cho mặt hàng này.</td></tr>
                    ) : (
                      theKhoModal.history.map((h, i) => (
                        <tr key={i}>
                          <td className="text-muted fw-bold">{new Date(h.created_at).toLocaleString('vi-VN')}</td>
                          <td><span className="badge bg-secondary">#{h.id}</span></td>
                          <td className="fw-bold">{h.warehouse_name}</td>
                          <td>
                            {h.type === "import" ? <span className="badge bg-success"><i className="fa fa-arrow-down me-1"></i>Nhập vào</span>
                              : <span className="badge bg-danger"><i className="fa fa-arrow-up me-1"></i>Xuất ra</span>}
                          </td>
                          <td className={`fw-bold fs-5 ${h.type === 'import' ? 'text-success' : 'text-danger'}`}>
                            {h.type === 'import' ? '+' : '-'}{h.quantity}
                          </td>
                          <td className="text-start fst-italic text-secondary">{h.reason || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP SỬA TÊN KHO */}
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
                <input type="text" className="form-control form-control-lg border-primary shadow-sm" value={editWH.newName} onChange={(e) => setEditWH({ ...editWH, newName: e.target.value })} autoFocus />
              </div>
              <div className="modal-footer border-0 bg-light">
                <button type="button" className="btn btn-secondary fw-bold" onClick={() => setEditWH({ isOpen: false, id: null, oldName: "", newName: "" })}>Hủy</button>
                <button type="button" className="btn btn-primary fw-bold px-4 shadow-sm" onClick={handleSaveEditName}>Lưu thay đổi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÓA KHO */}
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