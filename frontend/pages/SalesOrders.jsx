import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import OrderPrintModal from "../components/OrderPrintModal";

export default function SalesOrders() {
    const [toast, setToast] = useState(null);
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [printOrderId, setPrintOrderId] = useState(null);

    const [form, setForm] = useState({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", shipper_name: "", delivery_fee: "", note: "", advance_payment: "" });
    const [items, setItems] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [showDetailModal, setShowDetailModal] = useState(false);

    const [warehouses, setWarehouses] = useState([]);
    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [deliverForm, setDeliverForm] = useState({ order_id: null, warehouse_id: "", delivery_fee: "", items: [] });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    // 💡 ĐÃ FIX: Thêm state để lưu từ khóa gõ tìm khách hàng
    const [customerSearch, setCustomerSearch] = useState("");

    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    const userRole = userStr ? JSON.parse(userStr).role : "";

    const fetchCustomers = async () => { try { const res = await api.get("api/customers", { headers: { Authorization: `Bearer ${token}` } }); setCustomers(res.data.rows || res.data); } catch (error) { console.error(error); } };
    const fetchWarehouses = async () => { try { const res = await api.get("api/stock/warehouses", { headers: { Authorization: `Bearer ${token}` } }); setWarehouses(res.data.filter(w => !w.name.toLowerCase().includes("nguyên vật liệu"))); } catch (error) { console.error(error); } };

    const filteredOrders = orders.filter(row => {
        const searchLower = searchTerm.toLowerCase();
        return (row.order_code && row.order_code.toLowerCase().includes(searchLower)) || (row.customer_name && row.customer_name.toLowerCase().includes(searchLower)) || (row.customer_phone && row.customer_phone.includes(searchLower));
    });

    useEffect(() => { fetchOrders(); fetchProducts(); fetchCustomers(); fetchWarehouses(); }, []);

    const fetchOrders = async () => { try { const res = await api.get("api/sales-orders", { headers: { Authorization: `Bearer ${token}` } }); setOrders(res.data); } catch (error) { console.error(error); } };

    const handleEdit = async (order) => {
        if (order.status !== 'cho_duyet' && order.status !== 'cho_san_xuat') return setToast({ message: "Đơn này không thể sửa nữa!", type: "danger" });
        try {
            const res = await api.get(`api/sales-orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const orderData = res.data;
            // 💡 ĐÃ FIX: Thêm thuộc tính customer_email vào form để nó fill lên ô input
            setForm({
                customer_id: orderData.customer_id || "",
                customer_name: orderData.customer_name || "",
                customer_phone: orderData.customer_phone || "",
                customer_address: orderData.customer_address || "",
                customer_email: orderData.customer_email || "",
                shipper_name: orderData.shipper_name || "",
                note: orderData.note || "",
                delivery_fee: orderData.delivery_fee ? Number(orderData.delivery_fee) : "",
                advance_payment: orderData.advance_payment ? Number(orderData.advance_payment) : ""
            });
            // 💡 ĐÃ FIX: Bổ sung logic móc giá cọc và mặc định Đổi vỏ = Số lượng mua
            const mappedItems = orderData.details.map(d => {
                const prod = products.find(p => p.id === d.product_id);
                const reqDeposit = prod ? prod.requires_deposit : 0;

                return {
                    product_id: d.product_id,
                    name: d.product_name,
                    unit: d.unit,
                    unit_price: d.unit_price,
                    quantity: d.ordered_quantity,
                    deposit_price: prod ? prod.deposit_price : 0,
                    requires_deposit: reqDeposit,
                    // 💡 ĐÃ FIX: Chỉ gán số lượng đổi vỏ bằng số mua nếu là bình có cọc
                    returned_bottles: reqDeposit === 1 ? d.ordered_quantity : 0
                };
            });
            setItems(mappedItems); setEditingId(order.id); setShowModal(true);
        } catch (error) { setToast({ message: "Lỗi tải dữ liệu!", type: "danger" }); }
    };

    const handleDelete = async (id) => {
        if (window.confirm("CẢNH BÁO: Xóa vĩnh viễn đơn hàng này?")) {
            try { const res = await api.delete(`api/sales-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setToast({ message: res.data.message, type: "success" }); fetchOrders(); } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi xóa", type: "danger" }); }
        }
    };

    const handleApprove = async (id) => {
        if (window.confirm("Xác nhận DUYỆT đưa vào sản xuất?")) {
            try { const res = await api.put(`api/sales-orders/approve/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } }); setToast({ message: res.data.message, type: "success" }); fetchOrders(); } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi duyệt", type: "danger" }); }
        }
    };

    const handleOpenCreateModal = () => { setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", shipper_name: "", delivery_fee: "", note: "", advance_payment: "" }); setItems([]); setEditingId(null); setSelectedProduct(""); setShowModal(true); };

    const fetchProducts = async () => { try { const res = await api.get("api/products?limit=1000", { headers: { Authorization: `Bearer ${token}` } }); const allProducts = res.data.data || res.data; const thanhPham = allProducts.filter(p => p.item_type === 'thanh_pham'); const uniqueProducts = Array.from(new Map(thanhPham.map(p => [p.id, p])).values()); setProducts(uniqueProducts); } catch (error) { console.error(error); } };

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);

    const handleViewDetails = async (id) => { try { const res = await api.get(`api/sales-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setSelectedOrder(res.data); setShowDetailModal(true); } catch (error) { setToast({ message: "Lỗi", type: "danger" }); } };

    const handleAddItem = () => {
        if (!selectedProduct) return;
        const product = products.find(p => p.id === Number(selectedProduct));
        if (items.find(i => i.product_id === product.id)) return setToast({ message: "Đã có trong đơn!", type: "warning" });

        const reqDeposit = product.requires_deposit || 0;

        setItems([...items, {
            product_id: product.id,
            name: product.name,
            unit: product.unit,
            unit_price: product.sell_price,
            deposit_price: product.deposit_price || 0,
            requires_deposit: reqDeposit,
            quantity: 1,
            // 💡 ĐÃ FIX: Chỉ mặc định hứa trả = 1 nếu sản phẩm ĐÓ LÀ BÌNH CẦN ĐỔI VỎ
            returned_bottles: reqDeposit === 1 ? 1 : 0
        }]);
        setSelectedProduct("");
    };

    const handleReturnedChange = (index, val) => { const newItems = [...items]; newItems[index].returned_bottles = Number(val); setItems(newItems); };
    const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));
    const handleQuantityChange = (index, val) => {
        const newItems = [...items];
        const newQty = Number(val);
        newItems[index].quantity = newQty;

        // 💡 ĐÃ FIX: Tự động đồng bộ ô Đổi vỏ NẾU SẢN PHẨM ĐÓ LÀ BÌNH (requires_deposit === 1)
        if (newItems[index].requires_deposit === 1) {
            newItems[index].returned_bottles = newQty;
        }

        setItems(newItems);
    };

    const totalGoodsValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const expectedDeposit = items.reduce((sum, item) => { if (item.requires_deposit === 1) { const missing = Math.max(0, item.quantity - (item.returned_bottles || 0)); return sum + (missing * item.deposit_price); } return sum; }, 0);
    const deliveryFee = Number(form.delivery_fee) || 0;
    const totalOrderValue = totalGoodsValue + expectedDeposit + deliveryFee;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.length === 0) return setToast({ message: "Chưa có sản phẩm!", type: "warning" });
        if (!form.customer_name) return setToast({ message: "Nhập Tên người nhận!", type: "warning" });
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!form.customer_phone || !phoneRegex.test(form.customer_phone)) return setToast({ message: "SĐT không hợp lệ!", type: "warning" });
        if (!form.customer_address) return setToast({ message: "Nhập Địa chỉ!", type: "warning" });

        try {
            if (editingId) { await api.put(`api/sales-orders/${editingId}`, { ...form, items, bottle_deposit: expectedDeposit, total_payment: totalOrderValue }, { headers: { Authorization: `Bearer ${token}` } }); setToast({ message: "Cập nhật thành công!", type: "success" }); } else { await api.post("api/sales-orders", { ...form, items, bottle_deposit: expectedDeposit, total_payment: totalOrderValue }, { headers: { Authorization: `Bearer ${token}` } }); setToast({ message: "Tạo đơn thành công!", type: "success" }); }
            setShowModal(false); setEditingId(null); setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", shipper_name: "", delivery_fee: "", note: "", advance_payment: "" }); setItems([]); fetchOrders();
        } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi xử lý", type: "danger" }); }
    };

    const handleOpenDeliver = async (order) => {
        try {
            const res = await api.get(`api/sales-orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const orderData = res.data;
            const inventoryRes = await api.get("api/stock/inventory", { headers: { Authorization: `Bearer ${token}` } });
            const allInventory = inventoryRes.data.data;
            const khoTong = warehouses.find(w => w.name.toLowerCase().includes("tổng") || w.name.toLowerCase().includes("xưởng")) || warehouses[0];
            const defaultWarehouseId = khoTong ? khoTong.id : null;

            const pendingItems = orderData.details.map(d => {
                const thieuKhach = (d.ordered_quantity || 0) - (d.delivered_quantity || 0);
                let khoConThucTe = 0;
                if (defaultWarehouseId) { const foundStock = allInventory.find(inv => inv.product_id === d.product_id && inv.warehouse_id === defaultWarehouseId); if (foundStock) khoConThucTe = foundStock.quantity; }
                let smart_deliver = khoConThucTe > 0 ? Math.min(khoConThucTe, thieuKhach) : 0;
                return { product_id: d.product_id, product_name: d.product_name, unit_price: d.unit_price, max_deliver: thieuKhach, xuong_da_lam: khoConThucTe, deliver_qty: smart_deliver, returned_bottles: 0 };
            }).filter(d => d.max_deliver > 0);

            if (pendingItems.length === 0) return setToast({ message: "Đơn này giao xong hết rồi!", type: "warning" });
            setDeliverForm({ order_id: order.id, warehouse_id: defaultWarehouseId || "", delivery_fee: 0, shipper_name: orderData.shipper_name || "", items: pendingItems });
            setShowDeliverModal(true);
        } catch (error) { setToast({ message: "Lỗi tải dữ liệu", type: "danger" }); }
    };

    const handleSubmitDeliver = async (e) => {
        e.preventDefault();
        if (!deliverForm.warehouse_id) return setToast({ message: "Chọn Kho xuất hàng!", type: "warning" });
        if (deliverForm.items.some(i => i.deliver_qty < 0 || i.deliver_qty > i.max_deliver)) return setToast({ message: "Số lượng giao không hợp lệ!", type: "warning" });
        if (!window.confirm("XÁC NHẬN CHỐT GIAO HÀNG? Hệ thống sẽ trừ Tồn Kho và chốt Công Nợ!")) return;
        try {
            const res = await api.post(`api/sales-orders/${deliverForm.order_id}/export-invoice`, deliverForm, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: res.data.message, type: "success" }); setShowDeliverModal(false); fetchOrders();
        } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi xuất giao", type: "danger" }); }
    };

    const renderStatus = (status) => {
        switch (status) {
            case 'cho_duyet': return <span className="badge bg-warning text-dark px-2 py-1 rounded-2"><i className="fa fa-clock me-1"></i>Chờ duyệt</span>;
            case 'cho_san_xuat': return <span className="badge bg-info text-dark px-2 py-1 rounded-2"><i className="fa fa-check-circle me-1"></i>Chờ SX</span>;
            case 'dang_san_xuat': return <span className="badge bg-primary px-2 py-1 rounded-2"><i className="fa fa-spinner fa-spin me-1"></i>Đang làm</span>;
            case 'hoan_thanh': return <span className="badge bg-success px-2 py-1 rounded-2"><i className="fa fa-check-double me-1"></i>Hoàn thành</span>;
            default: return <span className="badge bg-secondary px-2 py-1 rounded-2">{status}</span>;
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="container-fluid py-3 py-md-4 px-2 px-md-4">
                {/* Header Mobile */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 mb-md-4 gap-3">
                    <h4 className="fw-bold text-primary mb-0 text-center text-md-start"><i className="fa fa-clipboard-list me-2"></i>Đơn Đặt Hàng</h4>
                    <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch w-100" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div className="input-group shadow-sm flex-grow-1">
                            <span className="input-group-text bg-white border-0"><i className="fa fa-search text-muted"></i></span>
                            <input type="text" className="form-control border-0 bg-white" placeholder="Mã đơn,Tên Khách Hàng, SĐT..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button className="btn btn-primary fw-bold shadow-sm py-2 rounded-3 text-nowrap" onClick={handleOpenCreateModal}>
                            <i className="fa fa-plus me-2"></i>Lập Đơn Hàng Mới
                        </button>
                    </div>
                </div>

                {/* 💻 BẢNG MÁY TÍNH */}
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden d-none d-xl-block">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light text-secondary">
                                <tr>
                                    <th className="py-3 ps-4">Mã Đơn</th>
                                    <th>Thời gian</th>
                                    <th>Khách hàng</th>
                                    <th>Email</th>
                                    <th>Địa chỉ & Phí ship</th>
                                    <th>Tổng tiền</th>
                                    <th>Đã cọc</th>
                                    <th>Trạng thái</th>
                                    <th className="text-center pe-4">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length === 0 ? <tr><td colSpan="8" className="text-center py-5 text-muted">Trống</td></tr> :
                                    filteredOrders.map(o => (
                                        <tr key={o.id}>
                                            <td className="ps-4 fw-bold text-primary">#{o.order_code}</td>
                                            <td className="text-muted small">{new Date(o.created_at).toLocaleDateString('vi-VN')} <br /><span className="opacity-75">{new Date(o.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span></td>
                                            <td><div className="fw-bold text-dark">{o.customer_name}</div><div className="small text-muted"><i className="fa fa-phone-alt me-1" style={{ fontSize: '10px' }}></i>{o.customer_phone}</div></td>
                                            <td><div className="small text-truncate" style={{ maxWidth: '180px' }} title={o.customer_email}>{o.customer_email || '---'}</div></td>
                                            <td><div className="small text-truncate" style={{ maxWidth: '180px' }} title={o.customer_address}><i className="fa fa-map-marker-alt text-danger me-1"></i>{o.customer_address || '---'}</div>{o.delivery_fee > 0 && <div className="small fw-bold text-info mt-1">+ {formatMoney(o.delivery_fee)} ship</div>}</td>
                                            <td className="fw-bold text-danger">{formatMoney(o.total_payment)}</td>
                                            <td className="fw-bold text-success">{formatMoney(o.advance_payment)}</td>
                                            <td>{renderStatus(o.status)}</td>
                                            <td className="text-center pe-4">
                                                <div className="btn-group shadow-sm rounded-3">
                                                    {o.status === 'cho_duyet' && (userRole === 'admin' || userRole === 'sanxuat') && <button className="btn btn-sm btn-outline-success" title="Duyệt đơn hàng" onClick={() => handleApprove(o.id)}><i className="fa fa-check"></i></button>}
                                                    <button className="btn btn-sm btn-outline-info" title="Xem chi tiết" onClick={() => handleViewDetails(o.id)}><i className="fa fa-eye"></i></button>
                                                    {o.status !== 'cho_duyet' && <button className="btn btn-sm btn-outline-dark" title="In đơn hàng" onClick={() => setPrintOrderId(o.id)}><i className="fa fa-print"></i></button>}
                                                    {/* 💡 ĐÃ FIX: Chặn hiển thị nút chốt xuất đơn đối với kế toán và sale */}
                                                    {(o.status === 'cho_san_xuat' || o.status === 'dang_san_xuat') && !['ketoan', 'nhanvien'].includes(userRole) && <button className="btn btn-sm btn-purple text-white" style={{ backgroundColor: '#6f42c1' }} title="Chốt xuất đơn hàng" onClick={() => handleOpenDeliver(o)}><i className="fa fa-truck"></i></button>}
                                                    {(o.status === 'cho_duyet' || o.status === 'cho_san_xuat') && ['admin', 'nhanvien'].includes(userRole) && <><button className="btn btn-sm btn-outline-warning" title="Sửa đơn hàng" onClick={() => handleEdit(o)}><i className="fa fa-edit"></i></button><button className="btn btn-sm btn-outline-danger" title="Xóa đơn hàng" onClick={() => handleDelete(o.id)}><i className="fa fa-trash"></i></button></>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 📱 THẺ MOBILE APP */}
                <div className="d-block d-xl-none">
                    {filteredOrders.length === 0 ? <div className="text-center p-5 text-muted bg-white rounded-4 shadow-sm">Chưa có đơn hàng</div> :
                        filteredOrders.map(o => (
                            <div className="card shadow-sm border-0 mb-3 rounded-4" key={o.id}>
                                <div className="card-header bg-white border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
                                    <span className="fw-bold fs-6 text-primary">#{o.order_code}</span>
                                    {renderStatus(o.status)}
                                </div>
                                <div className="card-body p-3">
                                    <div className="mb-2 pb-2 border-bottom">
                                        <div className="fw-bold text-dark fs-5">{o.customer_name}</div>
                                        <div className="d-flex align-items-center text-muted small mt-1">
                                            <i className="fa fa-phone-alt me-2 text-secondary"></i>{o.customer_phone}
                                        </div>
                                        <div className="d-flex align-items-center text-muted small mt-1">
                                            <i className="fa fa-envelope me-2 text-secondary"></i>{o.customer_email}
                                        </div>
                                        <div className="d-flex align-items-start text-muted small mt-1">
                                            <i className="fa fa-map-marker-alt me-2 text-danger mt-1"></i>
                                            <span className="text-truncate d-inline-block" style={{ maxWidth: '85%' }}>{o.customer_address || '---'}</span>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between bg-light p-2 rounded-3 mb-3 border">
                                        <div className="text-start">
                                            <span className="small text-muted d-block" style={{ fontSize: '11px' }}>Tổng tiền {o.delivery_fee > 0 && "(gồm ship)"}</span>
                                            <span className="fw-bold text-danger fs-6">{formatMoney(o.total_payment)}</span>
                                        </div>
                                        <div className="text-end border-start ps-3">
                                            <span className="small text-muted d-block" style={{ fontSize: '11px' }}>Đã cọc trước</span>
                                            <span className="fw-bold text-success fs-6">{formatMoney(o.advance_payment)}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons Tối ưu chạm */}
                                    <div className="d-flex flex-wrap gap-2 justify-content-end">
                                        <button className="btn btn-outline-info rounded-3 flex-grow-1" onClick={() => handleViewDetails(o.id)}><i className="fa fa-eye me-1"></i> Chi tiết</button>

                                        {o.status === 'cho_duyet' && (userRole === 'admin' || userRole === 'sanxuat') && <button className="btn btn-success rounded-3 flex-grow-1" onClick={() => handleApprove(o.id)}><i className="fa fa-check me-1"></i> Duyệt</button>}

                                        {o.status !== 'cho_duyet' && <button className="btn btn-dark rounded-3" onClick={() => setPrintOrderId(o.id)}><i className="fa fa-print"></i></button>}

                                        {/* 💡 ĐÃ FIX: Chặn hiển thị nút trên giao diện điện thoại */}
                                        {(o.status === 'cho_san_xuat' || o.status === 'dang_san_xuat') && !['ketoan', 'nhanvien'].includes(userRole) && <button className="btn text-white rounded-3 w-100 mt-1 fw-bold py-2" style={{ backgroundColor: '#6f42c1' }} onClick={() => handleOpenDeliver(o)}><i className="fa fa-truck me-2"></i> CHỐT GIAO HÀNG</button>}

                                        {(o.status === 'cho_duyet' || o.status === 'cho_san_xuat') && ['admin', 'nhanvien'].includes(userRole) && (
                                            <div className="d-flex gap-2 w-100 mt-1">
                                                <button className="btn btn-outline-warning rounded-3 flex-grow-1" onClick={() => handleEdit(o)}><i className="fa fa-edit me-1"></i>Sửa</button>
                                                <button className="btn btn-outline-danger rounded-3 flex-grow-1" onClick={() => handleDelete(o.id)}><i className="fa fa-trash me-1"></i>Xóa</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div>

                {/* MODAL LẬP ĐƠN MỚI (Tối ưu full viền Mobile) */}
                {showModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable m-2 m-md-auto">
                            <div className="modal-content border-0 shadow-lg rounded-4 h-100">
                                <div className="modal-header bg-primary text-white border-0 p-3 p-md-4">
                                    <h5 className="modal-title fw-bold fs-5"><i className="fa fa-cart-plus me-2"></i>{editingId ? "Sửa Đơn Hàng" : "Lập Đơn Đặt Hàng"}</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body p-3 p-md-4 bg-light">
                                    <div className="row g-3 g-md-4">
                                        <div className="col-12 col-xl-4">
                                            <div className="card border-0 shadow-sm rounded-4">
                                                <div className="card-body p-3 p-md-4">
                                                    <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom"><i className="fa fa-info-circle me-2"></i>Giao Hàng</h6>

                                                    {/* 💡 ĐÃ FIX: Nâng cấp thành Dropdown có thanh tìm kiếm thông minh */}
                                                    <div className="mb-3 position-relative">
                                                        <div className="dropdown">
                                                            <button className="btn btn-light border w-100 text-start d-flex justify-content-between align-items-center shadow-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false" onClick={() => setCustomerSearch("")}>
                                                                <span className="text-truncate fw-bold text-primary">
                                                                    {form.customer_id ? `${form.customer_name} - ${form.customer_phone}` : "-- Khách tự do --"}
                                                                </span>
                                                                <i className="fa fa-chevron-down text-muted"></i>
                                                            </button>
                                                            <div className="dropdown-menu w-100 p-2 shadow-lg" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                                <input
                                                                    type="text"
                                                                    className="form-control mb-2 border-primary"
                                                                    placeholder="🔍 Gõ tên hoặc SĐT để tìm nhanh..."
                                                                    value={customerSearch}
                                                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()} // 💡 Cực kỳ quan trọng: Giữ menu không bị tắt khi bấm vào ô gõ tìm kiếm
                                                                />
                                                                <button className="dropdown-item text-primary fw-bold border-bottom pb-2 mb-1" type="button" onClick={() => {
                                                                    setForm({ ...form, customer_id: "", customer_name: "", customer_phone: "", customer_address: "", customer_email: "", note: "" });
                                                                }}>
                                                                    -- Khách tự do --
                                                                </button>
                                                                {customers
                                                                    .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
                                                                    .map(c => (
                                                                        <button key={c.id} className="dropdown-item py-2" type="button" onClick={() => {
                                                                            setForm({ ...form, customer_id: c.id, customer_name: c.name, customer_phone: c.phone, customer_address: c.address, customer_email: c.email || "" });
                                                                        }}>
                                                                            <span className="fw-bold text-dark">{c.name}</span> <span className="text-muted small">- {c.phone}</span>
                                                                        </button>
                                                                    ))
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mb-2"><input type="text" className="form-control" placeholder="Tên người nhận *" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
                                                    <div className="mb-2"><input type="tel" className="form-control" maxLength="10" placeholder="SĐT liên hệ *" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                                                    <div className="mb-2"><textarea className="form-control" rows="2" placeholder="Địa chỉ giao *" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })}></textarea></div>
                                                    <div className="mb-2">
                                                        <input type="email" className="form-control" placeholder="Email nhận Hóa đơn (Tùy chọn)" value={form.customer_email || ""} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                                                    </div>
                                                    <div className="mb-2">
                                                        <textarea className="form-control bg-light" rows="2" placeholder="Ghi chú đơn hàng (Tùy chọn)" value={form.note || ""} onChange={e => setForm({ ...form, note: e.target.value })}></textarea>
                                                    </div>
                                                    <hr className="my-3 text-muted" />
                                                    <div className="mb-2"><input type="text" className="form-control" placeholder="Tên Shipper" value={form.shipper_name} onChange={e => setForm({ ...form, shipper_name: e.target.value })} /></div>
                                                    <div className="mb-2">
                                                        <div className="input-group">
                                                            <span className="input-group-text bg-light text-danger"><i className="fa fa-truck"></i></span>
                                                            {/* 💡 ĐÃ FIX: Thêm || "" vào value để số 0 biến mất, nhường chỗ cho placeholder */}
                                                            <input type="text" pattern="[0-9]*" className="form-control fw-bold text-danger" placeholder="Phí Ship (Nếu có)" value={form.delivery_fee || ""} onChange={e => setForm({ ...form, delivery_fee: e.target.value.replace(/[^0-9]/g, '') })} />
                                                        </div>
                                                    </div>

                                                    <div className="mb-2">
                                                        <div className="input-group">
                                                            <span className="input-group-text bg-light text-success"><i className="fa fa-money-bill"></i></span>
                                                            {/* 💡 ĐÃ FIX: Thêm || "" vào value */}
                                                            <input type="text" pattern="[0-9]*" className="form-control fw-bold text-success" placeholder="Khách trả tiền trước" value={form.advance_payment || ""} onChange={e => setForm({ ...form, advance_payment: e.target.value.replace(/[^0-9]/g, '') })} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-12 col-xl-8">
                                            <div className="card border-0 shadow-sm rounded-4 h-100">
                                                <div className="card-body p-3 p-md-4 d-flex flex-column">
                                                    <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom"><i className="fa fa-box-open me-2"></i>Giỏ Hàng</h6>
                                                    <div className="d-flex flex-column flex-sm-row gap-2 mb-3 bg-light p-2 p-md-3 rounded-3 border">
                                                        <select className="form-select fw-bold" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}><option value="">-- Chọn Mua --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} - {formatMoney(p.sell_price)}</option>)}</select>
                                                        <button className="btn btn-primary px-4 fw-bold shadow-sm" onClick={handleAddItem}><i className="fa fa-plus me-1"></i></button>
                                                    </div>

                                                    <div className="table-responsive flex-grow-1" style={{ maxHeight: '250px' }}>
                                                        <table className="table table-hover align-middle">
                                                            <thead className="table-light small">
                                                                <tr>
                                                                    <th style={{ minWidth: '120px' }}>Sản phẩm</th>
                                                                    <th style={{ width: '80px' }}>SL</th>
                                                                    <th style={{ width: '80px' }}>Đổi vỏ</th>
                                                                    <th>Xóa</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {items.length === 0 ? <tr><td colSpan="4" className="text-center py-4 text-muted small">Giỏ trống</td></tr> :
                                                                    items.map((item, idx) => (
                                                                        <tr key={idx}>
                                                                            <td className="fw-bold text-dark small">{item.name}<div className="text-muted" style={{ fontSize: '10px' }}>{formatMoney(item.unit_price)}</div></td>
                                                                            <td><input type="number" className="form-control text-center fw-bold text-primary px-0 p-1 bg-light" min="1" value={item.quantity} onFocus={(e) => e.target.select()} onChange={e => handleQuantityChange(idx, e.target.value)} /></td>
                                                                            <td>{item.requires_deposit === 1 ? <input type="number" className="form-control text-center fw-bold text-success px-0 p-1 bg-light" min="0" max={item.quantity} value={item.returned_bottles} onChange={e => handleReturnedChange(idx, e.target.value)} /> : <span className="text-center d-block">-</span>}</td>
                                                                            <td className="text-center"><button className="btn btn-sm btn-outline-danger p-1 px-2" onClick={() => handleRemoveItem(idx)}><i className="fa fa-times"></i></button></td>
                                                                        </tr>
                                                                    ))
                                                                }
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="bg-light p-3 p-md-4 rounded-4 mt-3 border">
                                                        <div className="d-flex justify-content-between mb-1 small text-muted"><span>Tiền hàng:</span><span className="fw-bold">{formatMoney(totalGoodsValue)}</span></div>
                                                        {expectedDeposit > 0 && <div className="d-flex justify-content-between mb-1 small text-warning text-dark"><span>Phí thế chân vỏ bình:</span><span className="fw-bold">+ {formatMoney(expectedDeposit)}</span></div>}
                                                        {deliveryFee > 0 && <div className="d-flex justify-content-between mb-1 small text-info text-dark"><span>Ship:</span><span className="fw-bold">+ {formatMoney(deliveryFee)}</span></div>}
                                                        <hr className="my-2" />
                                                        <div className="d-flex justify-content-between align-items-center"><span className="fw-bold text-dark">TỔNG:</span><span className="fw-bold fs-4 text-danger">{formatMoney(totalOrderValue)}</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-3 p-md-4 bg-white">
                                    <button className="btn btn-light w-100 mb-2 d-block d-md-none fw-bold border" onClick={() => setShowModal(false)}>Hủy</button>
                                    <button className="btn btn-primary w-100 fw-bold py-2 fs-5 shadow-sm" onClick={handleSubmit}><i className="fa fa-save me-2"></i>LƯU ĐƠN HÀNG</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL CHI TIẾT & THEO DÕI TIẾN ĐỘ SẢN XUẤT */}
                {showDetailModal && selectedOrder && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-xl modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg rounded-4">
                                <div className="modal-header bg-dark text-white border-0 p-4">
                                    <h5 className="modal-title fw-bold fs-5">
                                        <i className="fa fa-search-location me-2"></i>Chi tiết & Tiến độ Đơn <span className="text-warning">#{selectedOrder.order_code}</span>
                                    </h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowDetailModal(false)}></button>
                                </div>
                                <div className="modal-body p-4 bg-light">
                                    <div className="row mb-4">
                                        <div className="col-md-6">
                                            <div className="card h-100 border-0 shadow-sm rounded-4">
                                                <div className="card-body p-4">
                                                    <h6 className="fw-bold text-secondary mb-3 pb-2 border-bottom"><i className="fa fa-user me-2"></i>Khách hàng</h6>
                                                    <div className="fs-5 fw-bold text-primary mb-1">{selectedOrder.customer_name}</div>
                                                    <div className="text-dark fw-bold mb-2"><i className="fa fa-phone-alt text-muted me-2"></i>{selectedOrder.customer_phone || "---"}</div>
                                                    <div className="text-muted small mb-1"><i className="fa fa-map-marker-alt me-2"></i>{selectedOrder.customer_address || "---"}</div>
                                                    <div className="text-muted small mb-1"><i className="fa fa-envelope me-2"></i>{selectedOrder.customer_email || "---"}</div>
                                                    {selectedOrder.note && <div className="alert alert-warning py-2 px-3 mt-3 mb-0 small fw-bold fst-italic border-0"><i className="fa fa-comment-dots me-2"></i>Note: {selectedOrder.note}</div>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="card h-100 border-0 shadow-sm rounded-4">
                                                <div className="card-body p-4 bg-white rounded-4">
                                                    <h6 className="fw-bold text-secondary mb-3 pb-2 border-bottom"><i className="fa fa-wallet me-2"></i>Tài chính</h6>
                                                    <div className="d-flex justify-content-between mb-2 text-muted">
                                                        <span>Tiền hàng & Cọc vỏ:</span>
                                                        <span className="fw-bold text-dark">{formatMoney(selectedOrder.total_payment - (selectedOrder.delivery_fee || 0))}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-2 text-muted">
                                                        <span>Phí giao hàng:</span>
                                                        <span className="fw-bold text-info">+ {formatMoney(selectedOrder.delivery_fee)}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-2 pt-2 border-top">
                                                        <span className="fw-bold text-dark">Tổng bill:</span>
                                                        <span className="fw-bold text-danger">{formatMoney(selectedOrder.total_payment)}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <span className="text-muted">Khách trả trước:</span>
                                                        <span className="fw-bold text-success">- {formatMoney(selectedOrder.advance_payment)}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mt-3 pt-3 border-top border-2">
                                                        <span className="fw-bold fs-5 text-dark">CÒN PHẢI THU:</span>
                                                        <span className="fw-bold text-primary fs-4">{formatMoney(selectedOrder.total_payment - selectedOrder.advance_payment)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card border-0 shadow-sm rounded-4">
                                        <div className="card-body p-3 p-md-4">
                                            <h6 className="fw-bold text-dark mb-3 mb-md-4"><i className="fa fa-truck-loading me-2 text-primary"></i>Tiến độ Xử lý hàng hóa</h6>

                                            {/* 💻 BẢNG MÁY TÍNH (Sẽ ẩn đi khi dùng điện thoại) */}
                                            <div className="table-responsive d-none d-md-block">
                                                <table className="table align-middle">
                                                    <thead className="table-light text-secondary">
                                                        <tr>
                                                            <th className="ps-3">Sản Phẩm</th>
                                                            <th className="text-center">Số lượng</th>
                                                            <th style={{ width: '35%' }}>Tiến độ</th>
                                                            <th style={{ width: '25%' }}>Đã xuất kho giao</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedOrder.details?.map((item, idx) => {
                                                            const effectiveReady = Math.max(item.produced_quantity || 0, item.delivered_quantity || 0);
                                                            const sxPercent = Math.min(100, Math.round((effectiveReady / item.ordered_quantity) * 100));
                                                            const giaoPercent = Math.min(100, Math.round((item.delivered_quantity / item.ordered_quantity) * 100));
                                                            const thieuSX = item.ordered_quantity - effectiveReady;

                                                            return (
                                                                <tr key={idx}>
                                                                    <td className="fw-bold text-dark ps-3">{item.product_name}</td>
                                                                    <td className="text-center fw-bold fs-5 text-primary">{item.ordered_quantity} <span className="fs-6 text-muted">{item.unit}</span></td>
                                                                    <td>
                                                                        <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                            <span className="text-success">{effectiveReady} đã chuẩn bị</span>
                                                                            <span className={thieuSX > 0 ? "text-danger" : "text-muted"}>{thieuSX > 0 ? `Thiếu ${thieuSX}` : "Đủ hàng"}</span>
                                                                        </div>
                                                                        <div className="progress rounded-pill bg-light border" style={{ height: '12px' }}>
                                                                            <div className={`progress-bar progress-bar-striped progress-bar-animated ${sxPercent === 100 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${sxPercent}%` }}></div>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                            <span className="text-primary">{item.delivered_quantity || 0} đã đi giao</span>
                                                                        </div>
                                                                        <div className="progress rounded-pill bg-light border" style={{ height: '12px' }}>
                                                                            <div className={`progress-bar ${giaoPercent === 100 ? 'bg-primary' : 'bg-info'}`} style={{ width: `${giaoPercent}%` }}></div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* 📱 GIAO DIỆN THẺ MOBILE (Sẽ ẩn trên máy tính) */}
                                            <div className="d-block d-md-none">
                                                {selectedOrder.details?.map((item, idx) => {
                                                    const effectiveReady = Math.max(item.produced_quantity || 0, item.delivered_quantity || 0);
                                                    const sxPercent = Math.min(100, Math.round((effectiveReady / item.ordered_quantity) * 100));
                                                    const giaoPercent = Math.min(100, Math.round((item.delivered_quantity / item.ordered_quantity) * 100));
                                                    const thieuSX = item.ordered_quantity - effectiveReady;

                                                    return (
                                                        <div key={idx} className="bg-white p-3 rounded-3 shadow-sm border mb-3">
                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                                <span className="fw-bold text-dark fs-6">{item.product_name}</span>
                                                                <span className="badge bg-primary px-2 py-1 fs-6">{item.ordered_quantity} <span className="small fw-normal">{item.unit}</span></span>
                                                            </div>

                                                            <div className="mb-3">
                                                                <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                    <span className="text-success"><i className="fa fa-box me-1"></i> {effectiveReady} hàng trong kho</span>
                                                                    <span className={thieuSX > 0 ? "text-danger" : "text-muted"}>{thieuSX > 0 ? `Thiếu ${thieuSX}` : "Đủ hàng"}</span>
                                                                </div>
                                                                <div className="progress rounded-pill bg-light border" style={{ height: '10px' }}>
                                                                    <div className={`progress-bar progress-bar-striped progress-bar-animated ${sxPercent === 100 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${sxPercent}%` }}></div>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                    <span className="text-primary"><i className="fa fa-motorcycle me-1"></i> {item.delivered_quantity || 0} đã đi giao</span>
                                                                </div>
                                                                <div className="progress rounded-pill bg-light border" style={{ height: '10px' }}>
                                                                    <div className={`progress-bar ${giaoPercent === 100 ? 'bg-primary' : 'bg-info'}`} style={{ width: `${giaoPercent}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* KẾT THÚC GIAO DIỆN MOBILE */}

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL XUẤT GIAO HÀNG & TẠO HÓA ĐƠN */}
                {showDeliverModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-lg modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg rounded-4">
                                <div className="modal-header border-0 p-4" style={{ backgroundColor: '#6f42c1', color: 'white' }}>
                                    <h5 className="modal-title fw-bold fs-4"><i className="fa fa-shipping-fast me-2"></i>Chốt Xuất Giao Hàng</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowDeliverModal(false)}></button>
                                </div>
                                <div className="modal-body p-4 bg-light">
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <div className="bg-white p-3 rounded-3 shadow-sm border h-100">
                                                <label className="fw-bold small text-muted mb-2 text-uppercase">Kho Xuất Hàng</label>
                                                <select className="form-select fw-bold bg-light" disabled value={deliverForm.warehouse_id} onChange={(e) => setDeliverForm({ ...deliverForm, warehouse_id: e.target.value })}>
                                                    <option value="">-- Chọn Kho --</option>
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="bg-white p-3 rounded-3 shadow-sm border h-100">
                                                <label className="fw-bold small text-info mb-2 text-uppercase"><i className="fa fa-motorcycle me-1"></i>Người Giao Đợt Này</label>
                                                <input type="text" className="form-control fw-bold text-primary" placeholder="Tên shipper..." value={deliverForm.shipper_name || ''} onChange={(e) => setDeliverForm({ ...deliverForm, shipper_name: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="bg-white p-3 rounded-3 shadow-sm border h-100">
                                                <label className="fw-bold small text-danger mb-2 text-uppercase"><i className="fa fa-plus me-1"></i>Phí Ship (Thu thêm)</label>
                                                <div className="input-group">
                                                    <input type="text" pattern="[0-9]*" className="form-control fw-bold text-danger" placeholder="0" value={deliverForm.delivery_fee} onChange={(e) => setDeliverForm({ ...deliverForm, delivery_fee: e.target.value.replace(/[^0-9]/g, '') })} />
                                                    <span className="input-group-text bg-light">đ</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card border-0 shadow-sm rounded-4">
                                        <div className="card-body p-0">
                                            <div className="table-responsive">
                                                <table className="table align-middle text-center mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th className="text-start ps-4 py-3">Sản phẩm</th>
                                                            <th className="text-danger" title="Khách chờ">Nợ Khách</th>
                                                            <th className="text-warning text-dark" title="Kho đang có sẵn">Hàng có sẵn trong kho</th>
                                                            <th style={{ width: '130px' }} className="text-primary">Thực giao</th>
                                                            <th style={{ width: '130px' }} className="text-success">Vỏ thu về</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {deliverForm.items.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td className="text-start ps-4 fw-bold text-dark">{item.product_name}</td>
                                                                <td className="fw-bold text-danger fs-5">{item.max_deliver}</td>
                                                                <td className="fw-bold text-warning text-dark fs-5">{Number(item.xuong_da_lam).toLocaleString('vi-VN')}</td>
                                                                <td className="p-2">
                                                                    <input type="number" className="form-control text-center fw-bold border-primary text-primary shadow-sm" min="0" max={item.max_deliver} value={item.deliver_qty} onChange={(e) => {
                                                                        const newItems = [...deliverForm.items];
                                                                        newItems[idx].deliver_qty = Number(e.target.value);
                                                                        setDeliverForm({ ...deliverForm, items: newItems });
                                                                    }} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" className="form-control text-center fw-bold border-success text-success shadow-sm" min="0" value={item.returned_bottles} onChange={(e) => {
                                                                        const newItems = [...deliverForm.items];
                                                                        newItems[idx].returned_bottles = Number(e.target.value);
                                                                        setDeliverForm({ ...deliverForm, items: newItems });
                                                                    }} />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="alert alert-purple mt-3 mb-0 border-0 shadow-sm small fw-bold" style={{ backgroundColor: '#e2d6f5', color: '#4a1599' }}>
                                        <i className="fa fa-info-circle me-2 fs-6"></i>Hệ thống tự động Tạo Hóa Đơn, Trừ Tồn Kho và Chốt Công Nợ (Tiền/Vỏ) ngay khi bấm xác nhận.
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-4 bg-white rounded-bottom-4">
                                    <button className="btn btn-light px-4 fw-bold border shadow-sm" onClick={() => setShowDeliverModal(false)}>Hủy bỏ</button>
                                    <button className="btn text-white px-5 fw-bold shadow-sm" style={{ backgroundColor: '#6f42c1' }} onClick={handleSubmitDeliver}>
                                        <i className="fa fa-check-circle me-2"></i>CHỐT XUẤT ĐƠN NÀY
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {printOrderId && <OrderPrintModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />}
        </Layout>
    );
}