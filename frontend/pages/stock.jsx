import { useEffect, useState } from "react";
import Layout from "../components/layout";
import StockHistory from "../components/stockhistory";
import StockForm from "../components/stockform";
import Toast from "../components/Toast";
import React from "react";

function Stock() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]); // <--- Thêm state chứa danh sách kho
  const [totalPages, setTotalPages] = useState(1);

  // ===== IMPORT FORM ===== (Đã thêm warehouse_id)
  const [importForm, setImportForm] = useState({
    warehouse_id: "",
    product_id: "",
    quantity: "",
    reason: "",
  });

  // ===== EXPORT FORM ===== (Đã thêm warehouse_id)
  const [exportForm, setExportForm] = useState({
    warehouse_id: "",
    product_id: "",
    quantity: "",
    reason: "",
  });

  const getPageFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("page")) || 1;
  };

  const [page, setPage] = useState(getPageFromURL());

  // ================= FETCH =================
  const fetchProducts = async () => {
    try {
      const res = await fetch("api/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error(data.message);
        return;
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  // MỚI: Lấy danh sách kho
  const fetchWarehouses = async () => {
    try {
      const res = await fetch("api/stock/warehouses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStock = async () => {
    try {
      const res = await fetch(`api/stock?page=${page}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error(data.message);
        return;
      }
      setStocks(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page);
    window.history.replaceState({}, "", `?${params}`);
  }, [page]);

  useEffect(() => {
    fetchProducts();
    fetchWarehouses(); // <--- Gọi hàm lấy kho
    fetchStock();
  }, [page]);

  // ================= IMPORT =================
  const handleImport = async (e) => {
    e.preventDefault();

    if (!importForm.warehouse_id || !importForm.product_id || !importForm.quantity)
      return setToast({ message: "Thiếu dữ liệu (Kho, Sản phẩm hoặc Số lượng)", type: "danger" });
    if (!importForm.reason.trim())
      return setToast({ message: "Vui lòng nhập lý do", type: "danger" });

    const res = await fetch(`api/stock/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        warehouse_id: Number(importForm.warehouse_id), // Gửi kho xuống backend
        product_id: Number(importForm.product_id),
        quantity: Number(importForm.quantity),
        reason: importForm.reason,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      setToast({ message: data.message, type: "danger" });
      return;
    }

    setToast({ message: "Nhập kho thành công", type: "success" });
    setImportForm({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
    fetchStock();
  };

  // ================= EXPORT =================
  const handleExport = async (e) => {
    e.preventDefault();

    if (!exportForm.warehouse_id || !exportForm.product_id || !exportForm.quantity)
      return setToast({ message: "Thiếu dữ liệu (Kho, Sản phẩm hoặc Số lượng)", type: "danger" });
    if (!exportForm.reason.trim())
      return setToast({ message: "Vui lòng nhập lý do", type: "danger" });

    const res = await fetch("api/stock/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        warehouse_id: Number(exportForm.warehouse_id), // Gửi kho xuống backend
        product_id: Number(exportForm.product_id),
        quantity: Number(exportForm.quantity),
        reason: exportForm.reason,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setToast({ message: data.message || "Lỗi xuất kho", type: "danger" });
      return;
    }

    setToast({ message: "Xuất kho thành công", type: "success" });
    setExportForm({ warehouse_id: "", product_id: "", quantity: "", reason: "" });
    fetchStock();
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
      <div className="container-fluid pt-4 px-4">
        <StockForm
          title="Nhập kho"
          type="import"
          products={products}
          warehouses={warehouses} /* <--- Truyền danh sách kho vào Form */
          form={importForm}
          setForm={setImportForm}
          onSubmit={handleImport}
          buttonClass="btn-success"
        />

        {user?.role === "admin" && (
          <StockForm
            title="Xuất kho"
            type="export"
            products={products}
            warehouses={warehouses} /* <--- Truyền danh sách kho vào Form */
            form={exportForm}
            setForm={setExportForm}
            onSubmit={handleExport}
            buttonClass="btn-danger"
          />
        )}

        {/* ===== HISTORY TABLE ===== */}
        <StockHistory
          stocks={stocks}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
        />
      </div>
    </Layout>
  );
}

export default Stock;