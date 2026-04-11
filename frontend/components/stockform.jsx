
import React from "react";
export default function StockForm({
  title, type, products, warehouses, form, setForm, onSubmit, buttonClass,
}) {
  return (
    <div className="bg-white p-4 shadow-sm mb-4 border rounded">
      <h5 className={`fw-bold mb-3 ${type === "import" ? "text-success" : "text-danger"}`}>
        {title}
      </h5>

      <form className="row g-3" onSubmit={onSubmit}>
        {/* === MỚI: CHỌN KHO === */}
        <div className="col-md-3">
          <label className="form-label fw-bold">Kho <span className="text-danger">*</span></label>
          <select
            className="form-select border-primary"
            required
            value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
          >
            <option value="">-- Chọn Kho --</option>
            {warehouses && warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {type === "export" && (
          <div className="col-md-3">
            <label className="form-label fw-bold">Đến kho (Không chọn = Xuất hủy)</label>
            <select
              className="form-select border-info"
              value={form.target_warehouse_id || ""}
              onChange={(e) => setForm({ ...form, target_warehouse_id: e.target.value })}
            >
              <option value="">-- Xuất ra khỏi hệ thống --</option>
              {warehouses.filter(w => w.id != form.warehouse_id).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* CHỌN SẢN PHẨM */}
        <div className="col-md-3">
          <label className="form-label fw-bold">Sản phẩm <span className="text-danger">*</span></label>
          <select
            className="form-select" required
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
          >
            <option value="">Chọn sản phẩm</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* NHẬP SỐ LƯỢNG */}
        <div className="col-md-2">
          <label className="form-label fw-bold">Số lượng <span className="text-danger">*</span></label>
          <input
            type="number" min="1" className="form-control" required
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            onKeyDown={(e) => {
              // 1. Danh sách các phím ĐƯỢC PHÉP bấm
              const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

              // 2. Chỉ cho phép các số từ 0 đến 9
              const isNumber = /^[0-9]$/.test(e.key);

              // 3. Cho phép xài phím tắt (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)
              const isShortcut = e.ctrlKey || e.metaKey;

              // Nếu KHÔNG phải số, KHÔNG phải phím điều khiển, KHÔNG phải phím tắt -> CHẶN NGAY
              if (!isNumber && !allowedKeys.includes(e.key) && !isShortcut) {
                e.preventDefault();
              }
            }}
          />
        </div>

        {/* LÝ DO */}
        <div className="col-md-2">
          <label className="form-label fw-bold">Lý do <span className="text-danger">*</span></label>
          <input
            type="text" className="form-control" required
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </div>

        <div className="col-md-2 d-flex align-items-end">
          <button className={`btn ${buttonClass} w-100 fw-bold shadow-sm`}>
            {type === "import" ? "Nhập vào kho" : "Xuất khỏi kho"}
          </button>
        </div>
      </form>
    </div>
  );
}