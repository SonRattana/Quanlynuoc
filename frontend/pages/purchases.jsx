import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import { formatMoneyRounded, formatMoneyExact } from "../src/utils/moneyFormat";

export default function Purchases() {
    const [toast, setToast] = useState(null);
    const [products, setProducts] = useState([]);
    const [items, setItems] = useState([]);

    const [activeTab, setActiveTab] = useState("create");

    const [history, setHistory] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedPo, setSelectedPo] = useState(null);
    const [poDetails, setPoDetails] = useState([]);

    const [searchHistory, setSearchHistory] = useState("");
    const [searchBatch, setSearchBatch] = useState("");
    const [searchProductTerm, setSearchProductTerm] = useState("");
    const [filteredSearchProducts, setFilteredSearchProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [form, setForm] = useState({ supplier_name: "", invoice_code: "", total_fee_amount: "", note: "", warehouse_id: "", vat_rate: "0" });
    const token = localStorage.getItem("token");
    const [editModal, setEditModal] = useState({ isOpen: false, data: {} });

    useEffect(() => {
        const fetchInitData = async () => {
            try {
                const [prodRes, whRes] = await Promise.all([
                    api.get("api/purchases/raw-materials", { headers: { Authorization: `Bearer ${token}` } }),
                    api.get("api/stock/warehouses", { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);

                const whData = whRes.data || [];
                setWarehouses(whData);

                const nvlWarehouse = whData.find(w =>
                    w.name.toLowerCase().includes("nguyên vật liệu") ||
                    w.name.toLowerCase().includes("nvl") ||
                    w.name.toLowerCase().includes("vật tư")
                );
                if (nvlWarehouse) {
                    setForm(prev => ({ ...prev, warehouse_id: nvlWarehouse.id }));
                }

            } catch (err) { console.error(err); }
        };
        fetchInitData();
    }, []);

    useEffect(() => {
        if (activeTab === "history") {
            fetchHistoryAndBatches();
        }
    }, [activeTab]);

    const fetchHistoryAndBatches = async () => {
        try {
            const [hisRes, batRes] = await Promise.all([
                api.get("api/purchases/history", { headers: { Authorization: `Bearer ${token}` } }),
                api.get("api/purchases/batches", { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setHistory(hisRes.data);
            setBatches(batRes.data);
        } catch (err) {
            setToast({ message: "Lỗi tải lịch sử kho", type: "danger" });
        }
    };

    const fetchPoDetails = async (poId) => {
        try {
            const res = await api.get(`api/purchases/history/${poId}`, { headers: { Authorization: `Bearer ${token}` } });
            setPoDetails(res.data);
            setSelectedPo(poId);
        } catch (err) { setToast({ message: "Lỗi tải chi tiết", type: "danger" }); }
    };

    const handleAddItem = (productId) => {
        if (!productId) return;
        const product = products.find(p => p.id === Number(productId));
        if (items.find(i => i.product_id === product.id)) return setToast({ message: "Sản phẩm đã có trong danh sách", type: "warning" });
        setItems([...items, { product_id: product.id, name: product.name, unit: product.unit, quantity: 1, unit_price: Number(product.cost_price) || 0 }]);
    };

    // ĐÃ SỬA: Ép kiểu về số nguyên để dọn sạch sẽ phần thập phân (.00) từ Database
    const formatInputNumber = (num) => {
        if (num === null || num === undefined || num === "") return "";
        // Chuyển thành số nguyên (bỏ phần thập phân) trước khi thêm dấu chấm
        const cleanNum = Math.trunc(Number(num));
        return String(cleanNum).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const handleItemChange = (index, field, rawValue) => {
        const newItems = [...items];
        const numericString = String(rawValue).replace(/[^0-9]/g, "");
        newItems[index][field] = numericString === "" ? "" : Number(numericString);
        setItems(newItems);
    };
    const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));

    const totalGoods = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalFee = Number(form.total_fee_amount) || 0;
    const vatRate = Number(form.vat_rate) || 0;
    const vatAmount = (totalGoods * vatRate) / 100;
    const totalPayment = totalGoods + totalFee + vatAmount;

    const handleSubmit = async () => {
        if (items.length === 0) return setToast({ message: "Vui lòng chọn ít nhất 1 sản phẩm", type: "warning" });
        if (items.some(i => i.quantity <= 0)) return setToast({ message: "Số lượng nhập phải lớn hơn 0", type: "warning" });
        if (!form.warehouse_id) return setToast({ message: "Hệ thống chưa nhận diện được Kho Nguyên Vật Liệu. Vui lòng tạo kho trước!", type: "warning" });

        try {
            await api.post("api/purchases", {
                supplier_name: form.supplier_name,
                invoice_code: form.invoice_code,
                total_fee_amount: totalFee,
                vat_rate: vatRate,
                note: form.note,
                items: items,
                warehouse_id: form.warehouse_id
            }, { headers: { Authorization: `Bearer ${token}` } });

            setToast({ message: "Nhập kho thành công!", type: "success" });
            setItems([]);
            setForm(prev => ({ ...prev, supplier_name: "", invoice_code: "", total_fee_amount: "", note: "", vat_rate: "0" }));
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi nhập kho", type: "danger" });
        }
    };

    const formatMoney = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString("vi-VN");

    const handleSearchProduct = (e) => {
        const value = e.target.value;
        setSearchProductTerm(value);

        if (value.trim() === "") {
            setFilteredSearchProducts([]);
            return;
        }

        const results = products.filter(p =>
            p.name.toLowerCase().includes(value.toLowerCase()) ||
            (p.unit && p.unit.toLowerCase().includes(value.toLowerCase()))
        );
        setFilteredSearchProducts(results);
    };
    const filteredHistory = history
        .filter(h =>
            (h.supplier_name && h.supplier_name.toLowerCase().includes(searchHistory.toLowerCase())) ||
            (h.invoice_code && h.invoice_code.toLowerCase().includes(searchHistory.toLowerCase())) ||
            h.id.toString().includes(searchHistory)
        )
        .slice(0, 50);

    const filteredBatches = batches.filter(b =>
        b.name.toLowerCase().includes(searchBatch.toLowerCase()) ||
        (b.supplier_name && b.supplier_name.toLowerCase().includes(searchBatch.toLowerCase())) ||
        (b.invoice_code && b.invoice_code.toLowerCase().includes(searchBatch.toLowerCase())) ||
        b.po_id.toString().includes(searchBatch)
    );

    const handleEdit = async (h) => {
        try {
            const res = await api.get(`api/purchases/details/${h.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditModal({
                isOpen: true,
                data: { ...h },
                details: res.data
            });
        } catch (err) {
            console.error("Lỗi:", err);
            setToast({ message: "Không lấy được chi tiết phiếu!", type: "danger" });
        }
    };

    const handleUpdate = async () => {
        try {
            if (!editModal.data.id) return;

            await api.put(`api/purchases/update/${editModal.data.id}`, {
                ...editModal.data,
                details: editModal.details
            }, { headers: { Authorization: `Bearer ${token}` } });

            setToast({ message: "Đã lưu phiếu thành công!", type: "success" });
            setEditModal({ isOpen: false, data: {}, details: [] });
            fetchHistoryAndBatches();
        } catch (err) {
            console.error(err);
            setToast({ message: "Lỗi lưu phiếu nhập!", type: "danger" });
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="pt-4 px-4 w-100 pb-5">

                {/* 💡 MODAL SỬA ĐƯỢC NÂNG CẤP NGĂN SỐ ÂM & FORMAT HÀNG NGÀN */}
                {editModal.isOpen && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-xl">
                            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '15px' }}>
                                <div className="modal-header bg-warning text-dark">
                                    <h5 className="modal-title fw-bold">Chỉnh sửa phiếu nhập PN#{editModal.data.id}</h5>
                                    <button className="btn-close" onClick={() => setEditModal({ isOpen: false, data: {}, details: [] })}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <label className="fw-bold small text-muted">Nhà cung cấp:</label>
                                            <input className="form-control" value={editModal.data.supplier_name || ""}
                                                onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, supplier_name: e.target.value } })} />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="fw-bold small text-muted">Mã HĐ:</label>
                                            <input className="form-control" value={editModal.data.invoice_code || ""}
                                                onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, invoice_code: e.target.value } })} />
                                        </div>
                                        {/* 💡 SỬA LỖI HIỂN THỊ VAT: Ép kiểu Number() để đưa "8.00" từ DB về số 8 chuẩn */}
                                        <div className="col-md-2">
                                            <label className="fw-bold small text-muted">Thuế VAT (%):</label>
                                            <select
                                                className="form-select fw-bold text-info"
                                                value={Number(editModal.data.vat_rate) || 0}
                                                onChange={(e) => {
                                                    const newVatRate = Number(e.target.value);
                                                    const currentTotalGoods = editModal.details ? editModal.details.reduce((sum, item) => sum + (item.quantity_used * item.unit_cost), 0) : (editModal.data.total_goods_amount || 0);
                                                    const currentFee = editModal.data.total_fee_amount || 0;

                                                    const newVatAmount = (currentTotalGoods * newVatRate) / 100;

                                                    setEditModal({
                                                        ...editModal,
                                                        data: {
                                                            ...editModal.data,
                                                            vat_rate: newVatRate,
                                                            vat_amount: newVatAmount,
                                                            total_payment: currentTotalGoods + currentFee + newVatAmount
                                                        }
                                                    });
                                                }}
                                            >
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="8">8%</option>
                                                <option value="10">10%</option>
                                            </select>
                                            <div className="text-info mt-1 fw-bold text-end" style={{ fontSize: '12px' }}>
                                                + {formatInputNumber(editModal.data.vat_amount || 0)} đ
                                            </div>
                                        </div>

                                        {/* 💡 Ô PHÍ SHIP CŨNG SẼ TỰ ĐỘNG CỘNG VÀO TỔNG TIỀN */}
                                        <div className="col-md-2">
                                            <label className="fw-bold small text-muted">Phí Ship (đ):</label>
                                            <input
                                                type="text"
                                                className="form-control fw-bold text-warning text-end"
                                                value={formatInputNumber(editModal.data.total_fee_amount || 0)}
                                                onChange={(e) => {
                                                    const numericString = String(e.target.value).replace(/[^0-9]/g, "");
                                                    const newFee = numericString === "" ? 0 : Number(numericString);

                                                    const currentTotalGoods = editModal.details ? editModal.details.reduce((sum, item) => sum + (item.quantity_used * item.unit_cost), 0) : (editModal.data.total_goods_amount || 0);
                                                    const currentVatAmount = editModal.data.vat_amount || 0;

                                                    setEditModal({
                                                        ...editModal,
                                                        data: {
                                                            ...editModal.data,
                                                            total_fee_amount: newFee,
                                                            total_payment: currentTotalGoods + newFee + currentVatAmount
                                                        }
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="fw-bold small text-muted">Tổng tiền thanh toán:</label>
                                            <input
                                                type="text"
                                                className="form-control fw-bold text-danger text-end"
                                                value={formatInputNumber(editModal.data.total_payment || 0)}
                                                onChange={(e) => {
                                                    const numericString = String(e.target.value).replace(/[^0-9]/g, ""); // Chỉ lấy số
                                                    setEditModal({
                                                        ...editModal,
                                                        data: { ...editModal.data, total_payment: numericString === "" ? 0 : Number(numericString) }
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <h6 className="fw-bold text-primary mb-2">Danh sách Nguyên vật liệu:</h6>
                                    {editModal.details && editModal.details.length > 0 ? (
                                        <table className="table table-bordered align-middle text-center table-mobile-cards">
                                            <thead className="table-light">
                                                <tr>
                                                    <th className="text-start">Tên NVL</th><th>Số lượng</th><th>Đơn giá</th><th>Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editModal.details.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td data-label="Tên NVL" className="text-start">{item.material_name}</td>
                                                        <td data-label="Số Lượng" style={{ width: "150px" }}>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm text-center fw-bold text-primary"
                                                                value={formatInputNumber(item.quantity_used)}
                                                                onChange={(e) => {
                                                                    const numericString = String(e.target.value).replace(/[^0-9]/g, "");
                                                                    const newDetails = [...editModal.details];
                                                                    newDetails[idx].quantity_used = numericString === "" ? 0 : Number(numericString);
                                                                    setEditModal({ ...editModal, details: newDetails });
                                                                }}
                                                            />
                                                        </td>
                                                        <td data-label="Đơn Giá" style={{ width: "200px" }}>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm text-end fw-bold text-danger"
                                                                value={formatInputNumber(item.unit_cost)}
                                                                onChange={(e) => {
                                                                    const numericString = String(e.target.value).replace(/[^0-9]/g, "");
                                                                    const newDetails = [...editModal.details];
                                                                    newDetails[idx].unit_cost = numericString === "" ? 0 : Number(numericString);
                                                                    setEditModal({ ...editModal, details: newDetails });
                                                                }}
                                                            />
                                                        </td>
                                                        <td data-label="Thao Tác" style={{ width: "100px" }}>
                                                            <button className="btn btn-sm btn-danger shadow-sm" onClick={() => {
                                                                const newDetails = editModal.details.filter((_, i) => i !== idx);
                                                                setEditModal({ ...editModal, details: newDetails });
                                                            }}><i className="fa fa-trash"></i></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-muted fst-italic">Đang tải chi tiết hoặc không có nguyên vật liệu...</p>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setEditModal({ isOpen: false, data: {}, details: [] })}>Hủy</button>
                                    <button className="btn btn-warning fw-bold text-dark px-4" onClick={handleUpdate}>Lưu trọn gói</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ul className="nav nav-pills mb-4 gap-2">
                    <li className="nav-item">
                        <button className={`nav-link fw-bold px-4 ${activeTab === 'create' ? 'active bg-primary' : 'bg-white border text-dark'}`} onClick={() => setActiveTab('create')}>
                            <i className="bi bi-cart-plus me-2"></i>Lập Phiếu Nhập
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className={`nav-link fw-bold px-4 ${activeTab === 'history' ? 'active bg-success' : 'bg-white border text-dark'}`} onClick={() => setActiveTab('history')}>
                            <i className="bi bi-clock-history me-2"></i>Lịch sử & Tồn kho Lô
                        </button>
                    </li>
                </ul>

                {activeTab === 'create' && (
                    <div className="row">
                        {/* CỘT TRÁI - CHỌN HÀNG */}
                        <div className="col-md-8">
                            <div className="bg-white p-3 rounded shadow-sm mb-3 border-top border-primary border-4">
                                <div className="mb-3 position-relative">
                                    <label className="fw-bold text-muted small mb-1">Chọn nhanh hàng hóa cần nhập:</label>

                                    <div className="input-group shadow-sm">
                                        <span className="input-group-text bg-white text-primary border-primary">
                                            <i className="bi bi-search"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-primary border-start-0 border-end-0 ps-0"
                                            placeholder="Gõ để tìm hoặc click mũi tên để chọn..."
                                            value={searchProductTerm}
                                            onChange={handleSearchProduct}
                                            onFocus={() => {
                                                // Khi vừa click vào ô, nếu chưa gõ gì thì xổ toàn bộ danh sách ra
                                                if (!searchProductTerm) setFilteredSearchProducts(products);
                                            }}
                                            onBlur={() => {
                                                // Tự động ẩn danh sách khi click ra ngoài (độ trễ 200ms để kịp nhận lệnh click chọn hàng)
                                                setTimeout(() => setFilteredSearchProducts([]), 200);
                                            }}
                                            style={{ fontWeight: '500', boxShadow: 'none' }}
                                        />
                                        {/* Nút mũi tên giả lập thẻ Select */}
                                        <span
                                            className="input-group-text bg-white text-muted border-primary"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => {
                                                if (filteredSearchProducts.length > 0) {
                                                    setFilteredSearchProducts([]); // Đóng nếu đang mở
                                                } else {
                                                    setFilteredSearchProducts(products); // Mở full nếu đang đóng
                                                }
                                            }}
                                        >
                                            <i className="bi bi-chevron-down"></i>
                                        </span>
                                    </div>

                                    {/* Bảng xổ xuống thông minh */}
                                    {filteredSearchProducts.length > 0 && (
                                        <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto', top: '100%', marginTop: '4px' }}>
                                            {filteredSearchProducts.map(p => (
                                                <li
                                                    key={p.id}
                                                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center border-bottom"
                                                    style={{ cursor: 'pointer', padding: '10px 15px' }}
                                                    // 💡 Dùng onMouseDown thay vì onClick để nó chạy trước khi sự kiện onBlur của thẻ input kích hoạt
                                                    onMouseDown={() => {
                                                        handleAddItem(p.id);
                                                        setSearchProductTerm("");
                                                        setFilteredSearchProducts([]);
                                                    }}
                                                >
                                                    <div className="fw-bold text-dark">{p.name}</div>
                                                    <span className="badge bg-secondary rounded-pill">{p.unit}</span>
                                                </li>
                                            ))}

                                            {/* Cảnh báo khi gõ sai */}
                                            {searchProductTerm && filteredSearchProducts.length === 0 && (
                                                <li className="list-group-item text-muted fst-italic text-center py-3 bg-light">
                                                    ❌ Không tìm thấy hàng hóa nào!
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-bordered align-middle text-center table-mobile-cards">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="text-start">Hàng hóa</th><th style={{ width: "120px" }}>Số lượng</th><th style={{ width: "150px" }}>Đơn giá nhập</th><th>Thành tiền</th><th>Xóa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.length === 0 ? (
                                                <tr><td colSpan="5" className="text-muted py-4">Chưa có sản phẩm nào được chọn</td></tr>
                                            ) : (
                                                items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td data-label="Hàng Hóa" className="text-start fw-bold text-primary">{item.name} <span className="badge bg-secondary ms-1">{item.unit}</span></td>
                                                        <td data-label=" Số lượng"><input type="text" className="form-control text-center fw-bold" value={formatInputNumber(item.quantity)} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} /></td>
                                                        <td data-label="Đơn Giá Nhập"><input type="text" className="form-control text-end fw-bold text-danger" value={formatInputNumber(item.unit_price)} onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)} /></td>
                                                        <td data-label="Thành Tiền" className="fw-bold text-success">{formatMoney(item.quantity * item.unit_price)}</td>
                                                        <td data-label="Xóa"><button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveItem(idx)}><i className="fa fa-trash"></i></button></td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* CỘT PHẢI - THÔNG TIN PHIẾU */}
                        <div className="col-md-4">
                            <div className="bg-white p-4 rounded shadow-sm border-top border-warning border-4">
                                <h6 className="fw-bold mb-3 text-secondary">Thông tin phiếu nhập</h6>

                                <div className="mb-3 border border-success rounded p-2 bg-light">
                                    <label className="form-label small fw-bold text-success">Kho đích (Mặc định)</label>
                                    <div className="form-control border-success fw-bold text-success bg-white d-flex align-items-center">
                                        <i className="bi bi-building me-2"></i>
                                        {warehouses.find(w => w.id === form.warehouse_id)?.name || "Đang tải dữ liệu kho..."}
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-dark">Mã hóa đơn / Số chứng từ <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control border-secondary shadow-sm" placeholder="VD: HD-001234..." value={form.invoice_code} onChange={(e) => setForm({ ...form, invoice_code: e.target.value })} required />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Nhà cung cấp / Nơi bán</label>
                                    <input type="text" className="form-control" placeholder="Tên đối tác..." value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
                                </div>

                                <div className="mb-3 p-2 border border-info rounded bg-light">
                                    <label className="form-label small fw-bold text-info">Thuế VAT (%)</label>
                                    <select className="form-select border-info fw-bold text-info shadow-sm" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}>
                                        <option value="0">0% (Không xuất hóa đơn VAT)</option>
                                        <option value="5">5%</option>
                                        <option value="8">8%</option>
                                        <option value="10">10%</option>
                                    </select>
                                    <small className="text-muted fst-italic mt-1 d-block" style={{ fontSize: "11px" }}>*VAT sẽ được tính và cộng trực tiếp vào Giá Vốn nhập kho của từng sản phẩm.</small>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-warning">Chi phí phát sinh (Ship, bốc vác...)</label>
                                    <input type="text" className="form-control border-warning fw-bold text-warning" placeholder="0" value={formatInputNumber(form.total_fee_amount)}
                                        onChange={(e) => { const numericString = String(e.target.value).replace(/[^0-9]/g, ""); setForm({ ...form, total_fee_amount: numericString === "" ? "" : Number(numericString) }); }} />
                                    <small className="text-muted fst-italic" style={{ fontSize: "11px" }}>*Hệ thống sẽ tự băm đều phí ship này vào giá vốn từng sản phẩm.</small>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold">Ghi chú</label>
                                    <textarea className="form-control" rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}></textarea>
                                </div>
                                <hr />

                                <div className="d-flex justify-content-between mb-2"><span className="text-muted fw-bold">Tổng tiền hàng:</span><span className="fw-bold text-dark">{formatMoney(totalGoods)}</span></div>
                                {vatAmount > 0 && (
                                    <div className="d-flex justify-content-between mb-2"><span className="text-muted fw-bold">Thuế VAT ({vatRate}%):</span><span className="fw-bold text-info">+{formatMoney(vatAmount)}</span></div>
                                )}
                                {totalFee > 0 && (
                                    <div className="d-flex justify-content-between mb-2"><span className="text-muted fw-bold">Phí phát sinh:</span><span className="fw-bold text-warning">+{formatMoney(totalFee)}</span></div>
                                )}

                                <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                                    <span className="fw-bold fs-5">TỔNG PHẢI TRẢ:</span>
                                    <span className="fw-bold fs-5 text-danger">{formatMoneyExact(totalPayment)}</span>
                                </div>
                                <button className="btn btn-primary w-100 mt-4 fw-bold fs-5 shadow-sm" onClick={handleSubmit}>NHẬP KHO</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="row">
                        {/* 💡 CỘT TRÁI - CÁC LÔ NVL ĐANG TỒN CÓ Ô TÌM KIẾM */}
                        <div className="col-md-4">
                            <div className="bg-white p-3 rounded shadow-sm border-top border-success border-4 h-100">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="fw-bold text-success mb-0"><i className="fa fa-layer-group me-2"></i>Tồn kho chi tiết (Theo Lô)</h6>
                                </div>

                                {/* Ô TÌM KIẾM LÔ HÀNG */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm border-success shadow-sm"
                                        placeholder="🔍 Tên NVL, Nhà CC, Mã PN..."
                                        value={searchBatch}
                                        onChange={(e) => setSearchBatch(e.target.value)}
                                    />
                                </div>

                                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                    <table className="table table-hover align-middle small table-mobile-cards">
                                        <thead className="table-success" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th>Nguyên Vật Liệu</th>
                                                <th className="text-center">Tồn / Lô</th>
                                                <th className="text-end">Giá Vốn</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBatches.length === 0 ? <tr><td colSpan="3" className="text-center py-3 text-muted fst-italic">Không tìm thấy lô hàng phù hợp</td></tr> :
                                                filteredBatches.map(b => (
                                                    <tr key={b.id} className={Number(b.quantity_remaining) === 0 ? "table-secondary opacity-75" : ""}>
                                                        <td className="fw-bold">
                                                            {b.name}
                                                            <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                                                <span className="badge bg-info text-dark me-2" title={`Nhà cung cấp: ${b.supplier_name}`}>
                                                                    PN#{b.po_id}
                                                                </span>
                                                                {formatDate(b.created_at)}
                                                                {b.invoice_code && (
                                                                    <div className="text-primary mt-1 fw-bold" style={{ fontSize: '11px' }}>
                                                                        <i className="fa fa-file-invoice me-1"></i>HĐ: {b.invoice_code}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="text-center fw-bold text-primary">
                                                            {Number(b.quantity_remaining) === 0
                                                                ? <span className="text-danger">Đã hết</span>
                                                                : `${Number(b.quantity_remaining)} ${b.unit}`
                                                            }
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="fw-bold text-danger">{formatMoneyExact(b.cost_price)}</div>
                                                            <div className="text-muted fst-italic mt-1" style={{ fontSize: '11px' }}>
                                                                (Gốc: {formatMoneyExact(b.unit_price)} + Ship: {formatMoneyExact(b.allocated_fee)}
                                                                {(b.cost_price - b.unit_price - b.allocated_fee) > 0.01
                                                                    ? ` + VAT: ${formatMoneyExact(b.cost_price - b.unit_price - b.allocated_fee)}`
                                                                    : ""}
                                                                )
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* CỘT PHẢI - LỊCH SỬ NHẬP HÀNG */}
                        <div className="col-md-8">
                            <div className="bg-white p-3 rounded shadow-sm border-top border-info border-4 h-100">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="fw-bold text-info mb-0"><i className="fa fa-receipt me-2"></i>Lịch sử Nhập hàng</h6>
                                    <div style={{ width: "230px" }}>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm border-info shadow-sm fw-bold"
                                            placeholder="🔍 Tìm Nhà CC, Mã phiếu..."
                                            value={searchHistory}
                                            onChange={(e) => setSearchHistory(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                    <table className="table table-hover align-middle small text-center table-mobile-cards">
                                        <thead className="table-info" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th>Mã & Ngày</th>
                                                <th className="text-start">Đối tác / HĐ</th>
                                                <th className="text-end">Tiền Hàng</th>
                                                <th className="text-end">Thuế VAT</th>
                                                <th className="text-end">Phí Ship</th>
                                                <th className="text-end">Tổng Trả NCC</th>
                                                <th>Xem</th>
                                                <th>Thao Tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHistory.length === 0 ? <tr><td colSpan="7" className="text-center py-3 text-muted fst-italic">Không tìm thấy hóa đơn nào hợp lệ</td></tr> :
                                                filteredHistory.map(h => (
                                                    <React.Fragment key={h.id}>
                                                        <tr>
                                                            <td data-label="Mã & Ngày">
                                                                <div className="fw-bold text-dark">PN#{h.id}</div>
                                                                <div className="text-muted" style={{ fontSize: '11px' }}>{formatDate(h.created_at)}</div>
                                                            </td>
                                                            <td data-label="Đối tác / HĐ" className="text-start">
                                                                <div className="fw-bold text-dark">{h.supplier_name}</div>
                                                                {h.invoice_code && (
                                                                    <div className="text-primary mt-1" style={{ fontSize: '12px' }}>
                                                                        <i className="fa fa-file-invoice me-1"></i>{h.invoice_code}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td data-label="Tiền Hàng" className="text-end fw-bold text-secondary">{formatMoney(h.total_goods_amount)}</td>
                                                            <td data-label="Thuế VAT" className="text-end fw-bold text-info">
                                                                {h.vat_amount > 0 ? (
                                                                    <>
                                                                        +{formatMoney(h.vat_amount)}
                                                                        <div className="small text-muted" style={{ fontSize: '10px' }}>({h.vat_rate}%)</div>
                                                                    </>
                                                                ) : "-"}
                                                            </td>
                                                            <td data-label="Phí Ship" className="text-end fw-bold text-warning">{h.total_fee_amount > 0 ? `+${formatMoney(h.total_fee_amount)}` : "-"}</td>
                                                            <td data-label="Tổng Trả NCC" className="text-end fw-bold text-danger fs-6">{formatMoney(h.total_payment)}</td>
                                                            <td data-label="Xem">
                                                                <button className="btn btn-sm btn-info text-white shadow-sm" onClick={() => selectedPo === h.id ? setSelectedPo(null) : fetchPoDetails(h.id)}>
                                                                    <i className={`fa ${selectedPo === h.id ? 'fa-chevron-up' : 'fa-eye'}`}></i>
                                                                </button>
                                                            </td>
                                                            <td data-label="Thao Tác">
                                                                <button className="btn btn-sm btn-outline-warning shadow-sm" onClick={() => handleEdit(h)}>
                                                                    <i className="fa fa-edit"></i>
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        {selectedPo === h.id && (
                                                            <tr>
                                                                <td colSpan="8" className="bg-light p-3">
                                                                    <strong className="text-primary d-block mb-2"><i className="fa fa-box-open me-2"></i>Chi tiết hàng nhập Phiếu #{h.id}:</strong>
                                                                    <table className="table table-sm table-bordered bg-white mb-1 text-center table-mobile-cards">
                                                                        <thead className="table-secondary">
                                                                            <tr><th className="text-start">Tên hàng</th><th>Số lượng</th><th>Giá mua gốc</th><th>Phí Ship/cái</th><th>Giá Vốn (Đưa vào Tồn kho)</th></tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {poDetails.map(d => (
                                                                                <tr key={d.id}>
                                                                                    <td data-label="Tên Hàng" className="text-start fw-bold">{d.name}</td>
                                                                                    <td data-label="Số Lượng" className="fw-bold text-primary">{Number(d.quantity_initial)}</td>
                                                                                    <td data-label="Giá Mua Gốc"> {formatMoneyExact(d.unit_price)}</td>
                                                                                    <td data-label="Phí Ship/Cái" className="text-warning">{formatMoneyExact(d.allocated_fee)}</td>
                                                                                    <td data-label="Giá Vốn (Đưa vào Tồn kho)" className="fw-bold text-danger">
                                                                                        {formatMoneyExact(d.cost_price)}
                                                                                        {(d.cost_price - d.unit_price - d.allocated_fee) > 0.01 && (
                                                                                            <div className="text-muted fw-normal mt-1" style={{ fontSize: '10px' }}>
                                                                                                (+ VAT: {formatMoneyExact(d.cost_price - d.unit_price - d.allocated_fee)})
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                    <div className="fst-italic text-muted mt-2" style={{ fontSize: '12px' }}>
                                                                        *Giá vốn nhập kho = Giá mua gốc + Phí Ship chia đều + Thuế VAT.
                                                                    </div>
                                                                    {h.note && <div className="fst-italic text-muted mt-1" style={{ fontSize: '12px' }}>- Ghi chú: {h.note}</div>}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}