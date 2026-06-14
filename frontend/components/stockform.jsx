import React from "react";
export default function StockForm({
  title, type, products, warehouses, form, setForm, onSubmit, buttonClass,
}) {
  // Danh sách các khoa mồi sẵn
  const departments = [
    "Khoa Cấp Cứu", "Khoa Khám Bệnh", "Khoa Hồi Sức Cấp Cứu", "Phòng Mổ",
    "Khoa Nội", "Khoa Ngoại", "Khoa Nhi", "Khoa Sản",
    "Khoa Xét Nghiệm", "X-Quang", "Phòng Kế Hoạch-Tổng Hợp", "Phòng Giám Đốc", "Khác..."
  ];

  return (
    <div className="bg-white p-4 shadow-sm mb-4 border rounded border-top border-3" style={{ borderTopColor: type === 'internal' ? '#0dcaf0' : type === 'import' ? '#198754' : '#dc3545' }}>
      <h5 className={`fw-bold mb-3 ${type === "import" ? "text-success" : type === "export" ? "text-danger" : "text-info"}`}>
        {type === "internal" && <i className="fa fa-hand-holding-medical me-2"></i>}
        {title}
      </h5>

      <form className="row g-3 align-items-end" onSubmit={onSubmit}>
        {/* === CHỌN KHO === */}
        <div className="col-md-2">
          <label className="form-label fw-bold">Kho <span className="text-danger">*</span></label>
          <select className="form-select border-primary" required value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            <option value="">-- Chọn Kho --</option>
            {warehouses && warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
          </select>
        </div>

        {/* === ĐẾN KHO (CHỈ DÀNH CHO XUẤT) === */}
        {type === "export" && (
          <div className="col-md-2">
            <label className="form-label fw-bold small">Đến kho (Trống = Hủy)</label>
            <select className="form-select border-warning" value={form.target_warehouse_id || ""} onChange={(e) => setForm({ ...form, target_warehouse_id: e.target.value })}>
              <option value="">-- Xuất hủy --</option>
              {warehouses.filter(w => w.id != form.warehouse_id).map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>
        )}

        {/* === KHOA NHẬN (CHỈ DÀNH CHO CẤP PHÁT) === */}
        {type === "internal" && (
          <div className="col-md-2">
            <label className="form-label fw-bold text-info">Khoa nhận <span className="text-danger">*</span></label>
            <select className="form-select border-info fw-bold" required value={form.department_name || ""} onChange={(e) => setForm({ ...form, department_name: e.target.value })}>
              <option value="">-- Chọn Khoa --</option>
              {departments.map((dept, idx) => (<option key={idx} value={dept}>{dept}</option>))}
            </select>
          </div>
        )}

        {/* === SẢN PHẨM === */}
        <div className={type === "import" ? "col-md-4" : "col-md-3"}>
          <label className="form-label fw-bold">Sản phẩm <span className="text-danger">*</span></label>
          <select
            className="form-select"
            required
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            // 💡 THÊM DÒNG NÀY: Khóa ô SP nếu là form xuất/điều chuyển mà chưa chọn Kho
            disabled={(type === "export" || type === "internal") && !form.warehouse_id}
          >
            <option value="">
              {/* Thay đổi text linh hoạt cho chuyên nghiệp */}
              {(type === "export" || type === "internal") && !form.warehouse_id
                ? "Vui lòng chọn Kho trước..."
                : "Chọn sản phẩm"}
            </option>
            {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>

        {/* === SỐ LƯỢNG === */}
        <div className="col-md-1">
          <label className="form-label fw-bold">Số lượng <span className="text-danger">*</span></label>
          <input type="number" min="1" className="form-control text-center fw-bold fs-5 text-primary" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            onKeyDown={(e) => {
              const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
              const isNumber = /^[0-9]$/.test(e.key);
              const isShortcut = e.ctrlKey || e.metaKey;
              if (!isNumber && !allowedKeys.includes(e.key) && !isShortcut) e.preventDefault();
            }}
          />
        </div>

        {/* === LÝ DO / GHI CHÚ === */}
        <div className={type === "import" ? "col-md-3" : "col-md-2"}>
          <label className="form-label fw-bold">Ghi chú <span className="text-danger">*</span></label>
          <input type="text" className="form-control" required value={form.reason} placeholder={type === "internal" ? "Tên người nhận..." : "Lý do..."} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>

        {/* === NÚT XÁC NHẬN === */}
        <div className="col-md-2 d-flex align-items-end">
          <button className={`btn ${buttonClass} w-100 fw-bold shadow-sm`}>
            {type === "import" ? "Nhập kho" : type === "internal" ? "Xác nhận Cấp" : "Xuất kho"}
          </button>
        </div>
      </form>
    </div>
  );
}