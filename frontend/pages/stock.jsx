import { useEffect, useState } from "react";
import Layout from "../components/layout";

const numberGuard = (e) => {
  if (e.key === "-" || e.key === "e") e.preventDefault();
};

function Stock() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);

  // ===== IMPORT FORM =====
  const [importForm, setImportForm] = useState({
    product_id: "",
    quantity: "",
  });

  // ===== EXPORT FORM =====
  const [exportForm, setExportForm] = useState({
    product_id: "",
    quantity: "",
  });

  const [page, setPage] = useState(1);

  // ================= FETCH =================
  const fetchProducts = async () => {
    const res = await fetch("http://localhost:3000/api/products", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setProducts(await res.json());
  };

  const fetchStock = async () => {
    const res = await fetch(
      `http://localhost:3000/api/stock?page=${page}&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    setStocks(await res.json());
  };

  useEffect(() => {
    fetchProducts();
    fetchStock();
  }, [page]);

  // ================= IMPORT =================
  const handleImport = async (e) => {
    e.preventDefault();

    if (!importForm.product_id || !importForm.quantity)
      return alert("Thiếu dữ liệu");

    await fetch("http://localhost:3000/api/stock/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: Number(importForm.product_id),
        quantity: Number(importForm.quantity),
      }),
    });

    setImportForm({ product_id: "", quantity: "" });
    fetchStock();
  };

  // ================= EXPORT =================
  const handleExport = async (e) => {
    e.preventDefault();

    if (!exportForm.product_id || !exportForm.quantity)
      return alert("Thiếu dữ liệu");

    await fetch("http://localhost:3000/api/stock/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: Number(exportForm.product_id),
        quantity: Number(exportForm.quantity),
      }),
    });

    setExportForm({ product_id: "", quantity: "" });
    fetchStock();
  };

  return (
    <Layout>
      <div className="container-fluid pt-4 px-4">

        {/* ===== IMPORT BOX ===== */}
        <div className="bg-white p-4 shadow-sm mb-4">
          <h5 className="fw-bold text-success mb-3">Nhập kho</h5>

          <form className="row g-3" onSubmit={handleImport}>
            <div className="col-md-4">
              <select
                className="form-select"
                value={importForm.product_id}
                onChange={(e) =>
                  setImportForm({
                    ...importForm,
                    product_id: e.target.value,
                  })
                }
              >
                <option value="">Chọn sản phẩm</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <input
                type="number"
                min="1"
                className="form-control"
                placeholder="Số lượng"
                onKeyDown={numberGuard}
                value={importForm.quantity}
                onChange={(e) =>
                  setImportForm({
                    ...importForm,
                    quantity: e.target.value,
                  })
                }
              />
            </div>

            <div className="col-md-2">
              <button className="btn btn-success w-100">
                Import
              </button>
            </div>
          </form>
        </div>

        {/* ===== EXPORT BOX (ADMIN ONLY) ===== */}
        {user?.role === "admin" && (
          <div className="bg-white p-4 shadow-sm mb-4">
            <h5 className="fw-bold text-danger mb-3">Xuất kho</h5>

            <form className="row g-3" onSubmit={handleExport}>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={exportForm.product_id}
                  onChange={(e) =>
                    setExportForm({
                      ...exportForm,
                      product_id: e.target.value,
                    })
                  }
                >
                  <option value="">Chọn sản phẩm</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="Số lượng"
                  onKeyDown={numberGuard}
                  value={exportForm.quantity}
                  onChange={(e) =>
                    setExportForm({
                      ...exportForm,
                      quantity: e.target.value,
                    })
                  }
                />
              </div>

              <div className="col-md-2">
                <button className="btn btn-danger w-100">
                  Export
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===== HISTORY TABLE ===== */}
        <div className="bg-white p-4 shadow-sm">
          <h5 className="fw-bold mb-3">Lịch sử nhập xuất</h5>

          <table className="table table-hover">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Sản phẩm</th>
                <th>Loại</th>
                <th>Số lượng</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.product_name}</td>
                  <td>
                    <span
                      className={`badge ${
                        s.type === "import"
                          ? "bg-success"
                          : "bg-danger"
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td>{s.quantity}</td>
                  <td>
                    {new Date(s.created_at).toLocaleString()}
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

export default Stock;