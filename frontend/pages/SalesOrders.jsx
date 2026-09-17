import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import OrderPrintModal from "../components/OrderPrintModal";
export default function SalesOrders() {
    const [toast, setToast] = useState(null);
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);

    // State cho Modal tạo đơn
    const [showModal, setShowModal] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [printOrderId, setPrintOrderId] = useState(null);
    // Cập nhật lại form gốc cho đầy đủ
    const [form, setForm] = useState({
        customer_id: "", customer_name: "", customer_phone: "", customer_address: "",
        shipper_name: "", delivery_fee: "", note: "", advance_payment: ""
    });
    const [items, setItems] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [showDetailModal, setShowDetailModal] = useState(false);
    // 💡 State cho luồng Xuất Giao Hàng
    const [warehouses, setWarehouses] = useState([]);
    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [deliverForm, setDeliverForm] = useState({ order_id: null, warehouse_id: "", delivery_fee: "", items: [] });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [editingId, setEditingId] = useState(null); // 💡 Thêm dòng này để đánh dấu Đơn đang sửa
    const [searchTerm, setSearchTerm] = useState("");
    const token = localStorage.getItem("token");
    // 💡 Lấy nguyên cục "user" ra, bóc lớp vỏ JSON, rồi thò tay vào lấy đúng cái "role"
    const userStr = localStorage.getItem("user");
    const userRole = userStr ? JSON.parse(userStr).role : "";
    // Thêm hàm lấy data khách hàng
    const fetchCustomers = async () => {
        try {
            const res = await api.get("api/customers", { headers: { Authorization: `Bearer ${token}` } });
            setCustomers(res.data.rows || res.data);
        } catch (error) { console.error(error); }
    };
    // Thêm hàm lấy danh sách Kho
    const fetchWarehouses = async () => {
        try {
            const res = await api.get("api/stock/warehouses", { headers: { Authorization: `Bearer ${token}` } });
            // Lọc bỏ kho nguyên vật liệu, chỉ lấy kho thành phẩm để bán
            setWarehouses(res.data.filter(w => !w.name.toLowerCase().includes("nguyên vật liệu")));
        } catch (error) { console.error(error); }
    };
    // 💡 Lọc danh sách theo từ khóa tìm kiếm (Bao gồm cả Mã đơn)
    const filteredOrders = orders.filter(row => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (row.order_code && row.order_code.toLowerCase().includes(searchLower)) ||
            (row.customer_name && row.customer_name.toLowerCase().includes(searchLower)) ||
            (row.customer_phone && row.customer_phone.includes(searchLower))
        );
    });
    // Lấy dữ liệu khi load trang
    useEffect(() => {
        fetchOrders();
        fetchProducts();
        fetchCustomers();
        fetchWarehouses();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await api.get("api/sales-orders", { headers: { Authorization: `Bearer ${token}` } });
            setOrders(res.data);
        } catch (error) { console.error(error); }
    };

    const handleEdit = async (order) => {
        // 💡 Mở khóa: Cho phép sửa khi đơn Đang chờ duyệt HOẶC Đã duyệt (Chờ SX)
        if (order.status !== 'cho_duyet' && order.status !== 'cho_san_xuat') {
            return setToast({ message: "Đơn hàng đã đưa vào sản xuất hoặc xuất giao, không thể sửa!", type: "danger" });
        }
        try {
            // Lấy chi tiết đơn hàng về đổ vào Form
            const res = await api.get(`api/sales-orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const orderData = res.data;

            setForm({
                customer_id: orderData.customer_id || "", customer_name: orderData.customer_name || "",
                customer_phone: orderData.customer_phone || "", customer_address: orderData.customer_address || "",
                shipper_name: orderData.shipper_name || "",
                note: orderData.note || "",

                // 💡 Bọc Number() để triệt tiêu vĩnh viễn đuôi .00 từ Database
                delivery_fee: orderData.delivery_fee ? Number(orderData.delivery_fee) : "",
                advance_payment: orderData.advance_payment ? Number(orderData.advance_payment) : ""
            });

            const mappedItems = orderData.details.map(d => ({
                product_id: d.product_id, name: d.product_name, unit: d.unit,
                unit_price: d.unit_price, quantity: d.ordered_quantity
            }));

            setItems(mappedItems);
            setEditingId(order.id); // Đánh dấu ID đang sửa
            setShowModal(true); // Mở form lên
        } catch (error) {
            setToast({ message: "Lỗi tải dữ liệu đơn hàng!", type: "danger" });
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn hàng này không?")) {
            try {
                const res = await api.delete(`api/sales-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                setToast({ message: res.data.message, type: "success" });
                fetchOrders(); // Load lại bảng
            } catch (error) {
                setToast({ message: error.response?.data?.message || "Lỗi xóa đơn", type: "danger" });
            }
        }
    };

    const handleApprove = async (id) => {
        if (window.confirm("Trưởng xưởng xác nhận DUYỆT đơn hàng này để đưa vào sản xuất?")) {
            try {
                const res = await api.put(`api/sales-orders/approve/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                setToast({ message: res.data.message, type: "success" });
                fetchOrders(); // Load lại bảng
            } catch (error) {
                setToast({ message: error.response?.data?.message || "Lỗi duyệt đơn", type: "danger" });
            }
        }
    };

    // 💡 HÀM MỚI: Dọn dẹp sạch sẽ data cũ rồi mới mở form Lập đơn
    const handleOpenCreateModal = () => {
        setForm({
            customer_id: "", customer_name: "", customer_phone: "", customer_address: "",
            shipper_name: "", delivery_fee: "", note: "", advance_payment: ""
        });
        setItems([]);
        setEditingId(null); // Cực kỳ quan trọng: Báo cho hệ thống biết đây là tạo mới chứ không phải sửa
        setSelectedProduct("");
        setShowModal(true);
    };

    const fetchProducts = async () => {
        try {
            // Chỉ lấy thành phẩm để bán
            const res = await api.get("api/products?limit=1000", { headers: { Authorization: `Bearer ${token}` } });
            const allProducts = res.data.data || res.data;

            const thanhPham = allProducts.filter(p => p.item_type === 'thanh_pham');

            // 💡 Tuyệt chiêu Lọc Trùng Lặp: Giữ lại duy nhất 1 sản phẩm cho mỗi ID
            const uniqueProducts = Array.from(new Map(thanhPham.map(p => [p.id, p])).values());

            setProducts(uniqueProducts);
        } catch (error) { console.error(error); }
    };

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);

    const handleViewDetails = async (id) => {
        try {
            const res = await api.get(`api/sales-orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setSelectedOrder(res.data);
            setShowDetailModal(true);
        } catch (error) {
            setToast({ message: "Lỗi tải chi tiết đơn hàng", type: "danger" });
        }
    };
    // ===================================
    // XỬ LÝ FORM TẠO ĐƠN
    // ===================================
    const handleAddItem = () => {
        if (!selectedProduct) return;
        const product = products.find(p => p.id === Number(selectedProduct));
        if (items.find(i => i.product_id === product.id)) {
            return setToast({ message: "Sản phẩm này đã có trong đơn!", type: "warning" });
        }
        setItems([...items, {
            product_id: product.id,
            name: product.name,
            unit: product.unit,
            unit_price: product.sell_price,
            // 💡 Lấy giá cọc và cờ báo từ DB lên y như bên POS
            deposit_price: product.deposit_price || 0,
            requires_deposit: product.requires_deposit || 0,
            quantity: 1,
            returned_bottles: 0 // 💡 Số vỏ khách hứa sẽ trả cho Shipper
        }]);
        setSelectedProduct("");
    };

    // 💡 Thêm hàm này ngay dưới handleQuantityChange để cập nhật số vỏ trả
    const handleReturnedChange = (index, val) => {
        const newItems = [...items];
        newItems[index].returned_bottles = Number(val);
        setItems(newItems);
    };

    const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));

    const handleQuantityChange = (index, val) => {
        const newItems = [...items];
        newItems[index].quantity = Number(val);
        setItems(newItems);
    };

    // 💡 Tự động tính tiền hàng, tiền cọc và phí ship
    const totalGoodsValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const expectedDeposit = items.reduce((sum, item) => {
        if (item.requires_deposit === 1) {
            const missing = Math.max(0, item.quantity - (item.returned_bottles || 0));
            return sum + (missing * item.deposit_price);
        }
        return sum;
    }, 0);

    const deliveryFee = Number(form.delivery_fee) || 0;
    const totalOrderValue = totalGoodsValue + expectedDeposit + deliveryFee;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Kiểm tra Giỏ hàng
        if (items.length === 0) return setToast({ message: "Đơn hàng phải có ít nhất 1 sản phẩm!", type: "warning" });

        // 2. Bắt buộc Tên khách hàng
        if (!form.customer_name || form.customer_name.trim() === "") {
            return setToast({ message: "Vui lòng nhập Tên người nhận!", type: "warning" });
        }

        // 3. Rào số điện thoại (Chỉ nhận 10 số chuẩn VN)
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!form.customer_phone || !phoneRegex.test(form.customer_phone)) {
            return setToast({ message: "SĐT không hợp lệ! Vui lòng nhập chuẩn 10 số (VD: 09...).", type: "warning" });
        }

        // 4. Bắt buộc Địa chỉ
        if (!form.customer_address || form.customer_address.trim() === "") {
            return setToast({ message: "Vui lòng nhập Địa chỉ giao hàng!", type: "warning" });
        }

        const hasInvalidQty = items.some(item => !item.quantity || Number(item.quantity) <= 0);
        if (hasInvalidQty) return setToast({ message: "Số lượng đặt phải lớn hơn 0!", type: "warning" });

        try {
            if (editingId) {
                // ĐANG SỬA ĐƠN
                await api.put(`api/sales-orders/${editingId}`, {
                    ...form, items, bottle_deposit: expectedDeposit, total_payment: totalOrderValue
                }, { headers: { Authorization: `Bearer ${token}` } });
                setToast({ message: "Cập nhật đơn hàng thành công!", type: "success" });
            } else {
                // ĐANG TẠO MỚI
                await api.post("api/sales-orders", {
                    ...form, items, bottle_deposit: expectedDeposit, total_payment: totalOrderValue
                }, { headers: { Authorization: `Bearer ${token}` } });
                setToast({ message: "Tạo đơn đặt hàng thành công!", type: "success" });
            }

            setShowModal(false);
            setEditingId(null); // Reset lại ID
            setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", shipper_name: "", delivery_fee: "", note: "", advance_payment: "" });
            setItems([]);
            fetchOrders();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi xử lý đơn hàng", type: "danger" });
        }
    };

    // ===================================
    // XỬ LÝ XUẤT GIAO HÀNG TỪ ĐƠN ĐẶT
    // ===================================
    const handleOpenDeliver = async (order) => {
        try {
            // Lấy chi tiết mới nhất của đơn hàng
            const res = await api.get(`api/sales-orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const orderData = res.data;

            // 💡 GỌI THÊM API: Lấy tồn kho thực tế của TẤT CẢ sản phẩm
            const inventoryRes = await api.get("api/stock/inventory", { headers: { Authorization: `Bearer ${token}` } });
            const allInventory = inventoryRes.data.data;

            // Lọc ra id của Kho Tổng (hoặc kho mặc định) để soi tồn kho
            const khoTong = warehouses.find(w => w.name.toLowerCase().includes("tổng") || w.name.toLowerCase().includes("xưởng")) || warehouses[0];
            const defaultWarehouseId = khoTong ? khoTong.id : null;

            // 💡 THUẬT TOÁN THÔNG MINH (ĐÃ FIX: Tính Kho Còn chuẩn xác từ Kho thực tế)
            const pendingItems = orderData.details.map(d => {
                const thieuKhach = (d.ordered_quantity || 0) - (d.delivered_quantity || 0);

                // 💡 TÌM TỒN KHO THỰC TẾ: Soi trong bảng Tồn Kho Chi Tiết
                let khoConThucTe = 0;
                if (defaultWarehouseId) {
                    const foundStock = allInventory.find(inv => inv.product_id === d.product_id && inv.warehouse_id === defaultWarehouseId);
                    if (foundStock) khoConThucTe = foundStock.quantity;
                }

                // Logic gợi ý số lượng giao (Ưu tiên giao đủ số nợ nếu kho còn đủ)
                let smart_deliver = 0;
                if (khoConThucTe > 0) {
                    smart_deliver = Math.min(khoConThucTe, thieuKhach);
                }

                return {
                    product_id: d.product_id,
                    product_name: d.product_name,
                    unit_price: d.unit_price,
                    max_deliver: thieuKhach,
                    xuong_da_lam: khoConThucTe, // 💡 Đổi cục này thành "Kho còn thực tế" để nó in ra Form màu tím cho chuẩn
                    deliver_qty: smart_deliver,
                    returned_bottles: 0
                };
            }).filter(d => d.max_deliver > 0);

            if (pendingItems.length === 0) {
                return setToast({ message: "Đơn này đã giao xong hết 100% rồi sếp ơi!", type: "warning" });
            }

            setDeliverForm({
                order_id: order.id,
                warehouse_id: defaultWarehouseId || "",
                delivery_fee: 0,
                shipper_name: orderData.shipper_name || "",
                items: pendingItems
            });
            setShowDeliverModal(true);
        } catch (error) {
            setToast({ message: "Lỗi tải dữ liệu đơn hàng", type: "danger" });
        }
    };

    const handleSubmitDeliver = async (e) => {
        e.preventDefault();
        if (!deliverForm.warehouse_id) return setToast({ message: "Vui lòng chọn Kho xuất hàng!", type: "warning" });

        // Kiểm tra xem có nhập lố số lượng không
        const isInvalid = deliverForm.items.some(i => i.deliver_qty < 0 || i.deliver_qty > i.max_deliver);
        if (isInvalid) return setToast({ message: "Số lượng giao không hợp lệ (không được âm hoặc lớn hơn số lượng còn nợ)!", type: "warning" });

        // 💡 CHỐT CHẶN BẢO MẬT: Hỏi xác nhận trước khi chạy API
        const isConfirmed = window.confirm(
            "⚠️ XÁC NHẬN CHỐT GIAO HÀNG:\n\nBạn có chắc chắn muốn xuất kho và chốt Hóa Đơn cho đợt giao này không?\n(Hệ thống sẽ lập tức trừ Tồn Kho và chốt Công Nợ Khách Hàng!)"
        );

        if (!isConfirmed) {
            return; // Nếu bấm Hủy (Cancel) thì dừng ngay lập tức, không làm gì cả
        }

        // Nếu bấm OK thì mới chạy tiếp phần dưới
        try {
            const res = await api.post(`api/sales-orders/${deliverForm.order_id}/export-invoice`, deliverForm, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: res.data.message, type: "success" });
            setShowDeliverModal(false);
            fetchOrders(); // Load lại bảng để cập nhật tiến độ
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi xuất giao hàng", type: "danger" });
        }
    };

    const renderStatus = (status) => {
        switch (status) {
            case 'cho_duyet': return <span className="badge bg-warning text-dark px-2 py-1"><i className="fa fa-clock me-1"></i>Chờ duyệt</span>;
            case 'cho_san_xuat': return <span className="badge bg-info text-dark px-2 py-1"><i className="fa fa-check-circle me-1"></i>Đã duyệt (Chờ SX)</span>;
            case 'dang_san_xuat': return <span className="badge bg-primary px-2 py-1">Đang sản xuất</span>;
            case 'hoan_thanh': return <span className="badge bg-success px-2 py-1">Hoàn thành</span>;
            default: return <span className="badge bg-secondary">{status}</span>;
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="pt-4 px-4 w-100 pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold text-primary"><i className="fa fa-clipboard-list me-2"></i>Quản lý Đơn Đặt Hàng</h4>
                    <div className="input-group" style={{ maxWidth: '350px' }}>
                        <span className="input-group-text bg-white border-end-0"><i className="fa fa-search text-muted"></i></span>
                        <input
                            type="text"
                            className="form-control border-start-0 ps-0 shadow-none"
                            placeholder="Tìm mã đơn, tên hoặc SĐT khách hàng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* 💡 Đã thay thế hàm onClick để dọn dẹp trước khi mở */}
                    <button className="btn btn-primary fw-bold shadow-sm" onClick={handleOpenCreateModal}>
                        <i className="fa fa-plus me-2"></i>Lập Đơn Đặt Hàng
                    </button>
                </div>

                {/* BẢNG DANH SÁCH ĐƠN HÀNG */}
                <div className="bg-white p-3 rounded shadow-sm border-top border-primary border-4">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Mã Đơn</th>
                                    <th>Ngày đặt</th>
                                    <th>Khách hàng</th>
                                    <th>Email</th>
                                    <th>Địa chỉ</th>
                                    <th>Phí ship</th>
                                    <th>Tổng tiền</th>
                                    <th>Đã cọc</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-4 text-muted">Chưa có đơn đặt hàng nào</td></tr>
                                ) : (
                                    filteredOrders.map(o => (
                                        <tr key={o.id}>
                                            <td className="fw-bold text-primary">{o.order_code}</td>
                                            <td className="text-muted small">{new Date(o.created_at).toLocaleString('vi-VN')}</td>
                                            <td className="fw-bold">{o.customer_name} <br /><span className="text-muted small">{o.customer_phone}</span></td>
                                            <td className="text-muted small">{o.customer_email || '---'}</td>
                                            <td className="text-start text-muted small" style={{ maxWidth: '200px', whiteSpace: 'normal' }}>
                                                {o.customer_address || '---'}
                                            </td>
                                            <td className="fw-bold text-info">{formatMoney(o.delivery_fee)}</td>
                                            <td className="fw-bold text-danger">{formatMoney(o.total_payment)}</td>
                                            <td className="fw-bold text-success">{formatMoney(o.advance_payment)}</td>
                                            <td>{renderStatus(o.status)}</td>
                                            <td>
                                                {/* 💡 Ổ khóa đã được làm cho thông minh hơn */}
                                                {o.status === 'cho_duyet' && (userRole === 'admin' || userRole === 'sanxuat') && (
                                                    <button className="btn btn-sm btn-success fw-bold shadow-sm me-1" title="Duyệt đơn" onClick={() => handleApprove(o.id)}>
                                                        <i className="fa fa-check"></i> Duyệt
                                                    </button>
                                                )}

                                                <button className="btn btn-sm btn-info text-white fw-bold shadow-sm me-1" title="Chi tiết" onClick={() => handleViewDetails(o.id)}>
                                                    <i className="fa fa-eye"></i>
                                                </button>

                                                {/* 💡 Mở khóa nút In cho cả những đơn đang giao dở dang nhiều đợt */}
                                                {o.status !== 'cho_duyet' && (
                                                    <button className="btn btn-sm btn-dark text-white fw-bold shadow-sm me-1" title="In phiếu giao" onClick={() => setPrintOrderId(o.id)}>
                                                        <i className="fa fa-print"></i>
                                                    </button>
                                                )}

                                                {/* 💡 Nút Giao Hàng (Màu Tím): Chỉ hiện khi đơn Đã Duyệt hoặc Đang Sản Xuất */}
                                                {(o.status === 'cho_san_xuat' || o.status === 'dang_san_xuat') && (
                                                    <button className="btn btn-sm btn-purple text-white fw-bold shadow-sm me-1" style={{ backgroundColor: '#6f42c1' }} title="Xuất giao hàng" onClick={() => handleOpenDeliver(o)}>
                                                        <i className="fa fa-truck"></i>
                                                    </button>
                                                )}

                                                {/* Nút Sửa/Xóa */}
                                                {(o.status === 'cho_duyet' || o.status === 'cho_san_xuat') && (
                                                    <>
                                                        <button className="btn btn-sm btn-warning text-dark fw-bold shadow-sm me-1" title="Sửa" onClick={() => handleEdit(o)}>
                                                            <i className="fa fa-edit"></i>
                                                        </button>
                                                        <button className="btn btn-sm btn-danger fw-bold shadow-sm" title="Xóa" onClick={() => handleDelete(o.id)}>
                                                            <i className="fa fa-trash"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* MODAL LẬP ĐƠN MỚI */}
                {showModal && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-xl">
                            <div className="modal-content">
                                <div className="modal-header bg-primary text-white">
                                    <h5 className="modal-title fw-bold">Lập Đơn Đặt Hàng Mới</h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                                </div>
                                <div className="modal-body row g-3">
                                    {/* Cột trái: Thông tin khách & Giao hàng */}
                                    <div className="col-md-4 border-end">
                                        <h6 className="fw-bold text-secondary mb-3"><i className="fa fa-truck me-2"></i>Thông tin Giao Hàng</h6>

                                        <div className="mb-2">
                                            <label className="small fw-bold text-primary">Chọn Khách Hàng (Từ hệ thống)</label>
                                            <select className="form-select shadow-sm border-primary" value={form.customer_id} onChange={(e) => {
                                                const cId = e.target.value;
                                                if (!cId) return setForm({ ...form, customer_id: "", customer_name: "", customer_phone: "", customer_address: "" });
                                                const c = customers.find(x => String(x.id) === cId);
                                                setForm({ ...form, customer_id: c.id, customer_name: c.name, customer_phone: c.phone, customer_address: c.address });
                                            }}>
                                                <option value="">-- Khách lẻ / Tự nhập --</option>
                                                {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                                            </select>
                                        </div>

                                        <div className="mb-2">
                                            <label className="small fw-bold">Tên người nhận <span className="text-danger">*</span></label>
                                            <input type="text" className="form-control" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
                                        </div>
                                        <div className="mb-2">
                                            <label className="small fw-bold">SĐT & Địa chỉ giao <span className="text-danger">*</span></label>
                                            <input
                                                type="text"
                                                className="form-control mb-1"
                                                placeholder="Số điện thoại (10 số)"
                                                maxLength="10"
                                                value={form.customer_phone}
                                                onChange={e => {
                                                    // 💡 Tuyệt chiêu chặn nhập chữ và số âm
                                                    const onlyNumbers = e.target.value.replace(/[^0-9]/g, '');
                                                    setForm({ ...form, customer_phone: onlyNumbers });
                                                }}
                                            />
                                            <textarea className="form-control" rows="2" placeholder="Số nhà, đường, phường/xã..." value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })}></textarea>
                                        </div>
                                        <div className="mb-2">
                                            <label className="small fw-bold">Email nhận Hóa đơn (Tùy chọn)</label>
                                            <input
                                                type="email"
                                                className="form-control"
                                                placeholder="VD: khachvanglai@gmail.com"
                                                value={form.customer_email || ""}
                                                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                                            />
                                        </div>

                                        <div className="mb-2">
                                            <label className="small fw-bold text-info">Đơn vị / Người Giao Hàng</label>
                                            <input type="text" className="form-control" placeholder="VD: Giao hàng tiết kiệm, Anh A..." value={form.shipper_name} onChange={e => setForm({ ...form, shipper_name: e.target.value })} />
                                        </div>
                                        <div className="mb-2">
                                            <label className="small fw-bold text-danger">Phí Giao Hàng (Cộng vào Bill)</label>
                                            {/* 💡 Đổi thành type text và ép chỉ nhận số bằng Regex */}
                                            <input
                                                type="text"
                                                pattern="[0-9]*"
                                                className="form-control fw-bold text-danger"
                                                placeholder="0"
                                                value={form.delivery_fee}
                                                onChange={e => setForm({ ...form, delivery_fee: e.target.value.replace(/[^0-9]/g, '') })}
                                            />
                                        </div>
                                        <div className="mb-2 mt-3 pt-3 border-top">
                                            <label className="small fw-bold text-success">Khách cọc trước (VNĐ)</label>
                                            {/* 💡 Chống số âm và loại bỏ số 0,00 lỗi */}
                                            <input
                                                type="text"
                                                pattern="[0-9]*"
                                                className="form-control fw-bold text-success"
                                                placeholder="0"
                                                value={form.advance_payment}
                                                onChange={e => setForm({ ...form, advance_payment: e.target.value.replace(/[^0-9]/g, '') })}
                                            />
                                        </div>
                                        <div className="mb-2">
                                            <label className="small fw-bold">Ghi chú thêm</label>
                                            <textarea className="form-control" rows="2" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}></textarea>
                                        </div>
                                    </div>

                                    {/* Cột phải: Chọn hàng */}
                                    <div className="col-md-8">
                                        <h6 className="fw-bold text-secondary mb-3">Danh sách mặt hàng</h6>
                                        <div className="d-flex gap-2 mb-3">
                                            <select className="form-select border-primary" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                                <option value="">-- Chọn sản phẩm --</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name} - {formatMoney(p.sell_price)}/{p.unit}</option>)}
                                            </select>
                                            <button className="btn btn-primary text-nowrap" onClick={handleAddItem}><i className="fa fa-plus"></i> Thêm</button>
                                        </div>

                                        <table className="table table-bordered text-center align-middle">
                                            <thead className="table-light small">
                                                <tr>
                                                    <th className="text-start">Sản phẩm</th>
                                                    <th>Đơn giá</th>
                                                    <th style={{ width: '100px' }}>S.Lượng Đặt</th>
                                                    <th style={{ width: '100px' }} title="Số vỏ khách hứa đưa cho shipper">Vỏ hứa trả</th>
                                                    <th>Thành tiền</th>
                                                    <th>Xóa</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.length === 0 ? <tr><td colSpan="6" className="text-muted fst-italic">Chưa có sản phẩm</td></tr> :
                                                    items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="text-start fw-bold" style={{ fontSize: '14px' }}>{item.name}</td>
                                                            <td>{formatMoney(item.unit_price)}</td>
                                                            <td>
                                                                <input type="number" className="form-control text-center fw-bold text-primary px-1" min="1" value={item.quantity} onChange={e => handleQuantityChange(idx, e.target.value)} />
                                                            </td>
                                                            {/* 💡 Ô nhập số vỏ hứa trả */}
                                                            <td>
                                                                {item.requires_deposit === 1 ? (
                                                                    <input type="number" className="form-control text-center fw-bold text-success px-1" min="0" max={item.quantity} value={item.returned_bottles} onChange={e => handleReturnedChange(idx, e.target.value)} />
                                                                ) : <span className="text-muted">-</span>}
                                                            </td>
                                                            <td className="fw-bold text-danger">
                                                                {formatMoney(item.quantity * item.unit_price)}
                                                            </td>
                                                            <td><button className="btn btn-sm btn-danger" onClick={() => handleRemoveItem(idx)}><i className="fa fa-trash"></i></button></td>
                                                        </tr>
                                                    ))
                                                }
                                            </tbody>
                                        </table>

                                        {/* 💡 Khung tổng tiền sắc nét */}
                                        <div className="text-end mt-3 border-top pt-3">
                                            <h6 className="text-muted mb-1">Tiền nước: {formatMoney(totalGoodsValue)}</h6>
                                            {expectedDeposit > 0 && (
                                                <h6 className="text-warning mb-1" title="Sẽ thu thực tế dựa trên số vỏ lúc giao hàng">
                                                    Dự kiến cọc vỏ: {formatMoney(expectedDeposit)}
                                                </h6>
                                            )}
                                            {deliveryFee > 0 && (
                                                <h6 className="text-info mb-1">Phí giao hàng: {formatMoney(deliveryFee)}</h6>
                                            )}
                                            <h4 className="fw-bold mt-2">Tổng phải thu (Dự kiến): <span className="text-danger">{formatMoney(totalOrderValue)}</span></h4>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                                    <button className="btn btn-primary fw-bold" onClick={handleSubmit}>Lưu Đơn Hàng</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================== */}
                {/* MODAL CHI TIẾT & THEO DÕI TIẾN ĐỘ SẢN XUẤT */}
                {/* ========================================== */}
                {showDetailModal && selectedOrder && (
                    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <div className="modal-dialog modal-xl">
                            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>
                                <div className="modal-header bg-info text-white">
                                    <h5 className="modal-title fw-bold">
                                        <i className="fa fa-chart-pie me-2"></i>Chi tiết tiến độ Đơn {selectedOrder.order_code}
                                    </h5>
                                    <button className="btn-close btn-close-white" onClick={() => setShowDetailModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="row mb-4 bg-light p-3 rounded">
                                        <div className="col-md-6 border-end">
                                            <h6 className="fw-bold text-secondary mb-2">Thông tin Khách hàng</h6>
                                            <div className="fs-5 fw-bold text-dark">{selectedOrder.customer_name}</div>
                                            <div><i className="fa fa-phone text-muted me-2"></i>{selectedOrder.customer_phone || "Không có"}</div>
                                            <div className="mt-2 text-muted fst-italic">Địa chỉ: {selectedOrder.customer_address || "Không có"}</div>
                                            <div className="mt-2 text-muted fst-italic">Email: {selectedOrder.customer_email || "Không có"}</div>
                                            <div className="mt-2 text-muted fst-italic">Ghi chú: {selectedOrder.note || "Không có"}</div>
                                        </div>
                                        <div className="col-md-6 ps-4">
                                            <h6 className="fw-bold text-secondary mb-2">Tài chính</h6>
                                            <div className="d-flex justify-content-between mb-1">
                                                <span>Tiền hàng & Cọc vỏ:</span>
                                                <span className="fw-bold">{formatMoney(selectedOrder.total_payment - (selectedOrder.delivery_fee || 0))}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1">
                                                <span>Phí giao hàng:</span>
                                                <span className="fw-bold text-info">+ {formatMoney(selectedOrder.delivery_fee)}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1 pt-1 border-top">
                                                <span>Tổng đơn hàng:</span>
                                                <span className="fw-bold text-danger">{formatMoney(selectedOrder.total_payment)}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1">
                                                <span>Khách đã cọc:</span>
                                                <span className="fw-bold text-success">- {formatMoney(selectedOrder.advance_payment)}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mt-2 pt-2 border-top">
                                                <span className="fw-bold">CÒN LẠI PHẢI THU:</span>
                                                <span className="fw-bold text-primary fs-5">{formatMoney(selectedOrder.total_payment - selectedOrder.advance_payment)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <h6 className="fw-bold text-dark mb-3"><i className="fa fa-box me-2"></i>Tiến độ Chuẩn bị & Giao Hàng</h6>
                                    <div className="table-responsive">
                                        <table className="table table-bordered align-middle">
                                            <thead className="table-secondary text-center">
                                                <tr>
                                                    <th className="text-start">Tên Sản Phẩm</th>
                                                    <th>SL Đặt</th>
                                                    {/* 💡 Đổi tiêu đề cho đúng bản chất: Có thể do xưởng SX hoặc bốc từ kho */}
                                                    <th style={{ width: '35%' }}>Tiến độ Chuẩn bị hàng (SX / Kho)</th>
                                                    <th style={{ width: '25%' }}>Đã Xuất Kho (Cho Shipper)</th>
                                                    <th>Đơn giá</th>
                                                    <th>Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedOrder.details?.map((item, idx) => {
                                                    // 💡 CÔNG THỨC THÔNG MINH MỚI: 
                                                    // Hàng sẵn sàng = Số lớn nhất giữa (Số Xưởng đã làm) và (Số đã lấy đi giao)
                                                    const effectiveReady = Math.max(item.produced_quantity || 0, item.delivered_quantity || 0);

                                                    // Tính toán % tiến độ dựa trên số đã sẵn sàng
                                                    const sxPercent = Math.min(100, Math.round((effectiveReady / item.ordered_quantity) * 100));
                                                    const giaoPercent = Math.min(100, Math.round((item.delivered_quantity / item.ordered_quantity) * 100));

                                                    // 💡 Số lượng còn thiếu = Số lượng đặt - Số lượng đã sẵn sàng
                                                    const thieuSX = item.ordered_quantity - effectiveReady;

                                                    return (
                                                        <tr key={idx}>
                                                            <td className="fw-bold text-start">{item.product_name}</td>
                                                            <td className="text-center fw-bold fs-5 text-dark">{item.ordered_quantity} <span className="badge bg-secondary fs-6">{item.unit}</span></td>

                                                            {/* CỘT TIẾN ĐỘ CHUẨN BỊ (Đã gộp logic SX và Kho) */}
                                                            <td>
                                                                <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                    <span className="text-success">Đã chuẩn bị: {effectiveReady}</span>
                                                                    <span className={thieuSX > 0 ? "text-danger" : "text-muted"}>
                                                                        {thieuSX > 0 ? `Cần thêm: ${thieuSX}` : "Đã đủ hàng"}
                                                                    </span>
                                                                </div>
                                                                <div className="progress" style={{ height: '20px' }}>
                                                                    <div
                                                                        className={`progress-bar progress-bar-striped progress-bar-animated ${sxPercent === 100 ? 'bg-success' : 'bg-warning text-dark'}`}
                                                                        role="progressbar"
                                                                        style={{ width: `${sxPercent}%` }}
                                                                    >
                                                                        {sxPercent}%
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* CỘT ĐÃ XUẤT KHO */}
                                                            <td>
                                                                <div className="d-flex justify-content-between small fw-bold mb-1">
                                                                    <span className="text-primary">Đã xuất kho: {item.delivered_quantity || 0}</span>
                                                                </div>
                                                                <div className="progress" style={{ height: '10px' }}>
                                                                    <div className={`progress-bar ${giaoPercent === 100 ? 'bg-primary' : 'bg-info'}`} style={{ width: `${giaoPercent}%` }}></div>
                                                                </div>
                                                            </td>

                                                            <td className="text-center">{formatMoney(item.unit_price)}</td>
                                                            <td className="text-center fw-bold text-danger">{formatMoney(item.total_price)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary fw-bold px-4" onClick={() => setShowDetailModal(false)}>Đóng</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* MODAL IN PHIẾU GIAO HÀNG */}
            {printOrderId && (
                <OrderPrintModal
                    orderId={printOrderId}
                    onClose={() => setPrintOrderId(null)}
                />
            )}

            {/* ========================================== */}
            {/* MODAL XUẤT GIAO HÀNG & TẠO HÓA ĐƠN */}
            {/* ========================================== */}
            {showDeliverModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '15px' }}>
                            <div className="modal-header text-white" style={{ backgroundColor: '#6f42c1' }}>
                                <h5 className="modal-title fw-bold"><i className="fa fa-truck-loading me-2"></i>Chốt Xuất Giao Hàng Hôm Nay</h5>
                                <button className="btn-close btn-close-white" onClick={() => setShowDeliverModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row mb-3">
                                    <div className="col-md-4">
                                        <label className="fw-bold small text-primary mb-1">Chọn Kho Xuất Trừ Hàng <span className="text-danger">*</span></label>
                                        <select className="form-select fw-bold border-primary bg-light" disabled value={deliverForm.warehouse_id} onChange={(e) => setDeliverForm({ ...deliverForm, warehouse_id: e.target.value })}>
                                            <option value="">-- Chọn Kho --</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="fw-bold small text-primary mb-1">Người Giao Hàng đợt này</label>
                                        <input
                                            type="text"
                                            className="form-control fw-bold border-info text-info"
                                            placeholder="Tên shipper..."
                                            value={deliverForm.shipper_name || ''}
                                            onChange={(e) => setDeliverForm({ ...deliverForm, shipper_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="fw-bold small text-primary mb-1">Phí Giao Hàng (Thu thêm Nếu Có)</label>
                                        <input
                                            type="text"
                                            pattern="[0-9]*"
                                            className="form-control fw-bold text-danger border-danger"
                                            placeholder="0"
                                            value={deliverForm.delivery_fee}
                                            onChange={(e) => setDeliverForm({ ...deliverForm, delivery_fee: e.target.value.replace(/[^0-9]/g, '') })}
                                        />
                                    </div>
                                </div>

                                <h6 className="fw-bold text-dark mb-2"><i className="fa fa-box me-2"></i>Hàng hóa xuất đi đợt này</h6>
                                <div className="table-responsive">
                                    <table className="table table-bordered align-middle text-center">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="text-start">Sản phẩm</th>
                                                <th title="Số lượng khách còn chờ">Khách chờ</th>
                                                <th className="text-warning text-dark" title="Số lượng xưởng đã làm xong">Kho còn</th>
                                                <th style={{ width: '130px' }} className="text-primary">Thực giao</th>
                                                <th style={{ width: '130px' }} className="text-success">Vỏ thu về</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deliverForm.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="text-start fw-bold">{item.product_name}</td>
                                                    <td className="fw-bold text-danger fs-5">{item.max_deliver}</td>
                                                    <td className="fw-bold text-warning text-dark fs-5">{item.xuong_da_lam}</td>
                                                    <td>
                                                        <input type="number" className="form-control text-center fw-bold border-primary text-primary" min="0" max={item.max_deliver} value={item.deliver_qty} onChange={(e) => {
                                                            const newItems = [...deliverForm.items];
                                                            newItems[idx].deliver_qty = Number(e.target.value);
                                                            setDeliverForm({ ...deliverForm, items: newItems });
                                                        }} />
                                                    </td>
                                                    <td>
                                                        <input type="number" className="form-control text-center fw-bold border-success text-success" min="0" value={item.returned_bottles} onChange={(e) => {
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
                                <div className="alert alert-info small mt-2 mb-0">
                                    <i className="fa fa-info-circle me-1"></i>Hệ thống sẽ tự động tạo Hóa Đơn, trừ Tồn kho và chốt Công nợ tiền/vỏ dựa trên số liệu thực tế anh em điền ở trên.
                                </div>
                            </div>
                            <div className="modal-footer bg-light">
                                <button className="btn btn-secondary fw-bold" onClick={() => setShowDeliverModal(false)}>Hủy</button>
                                <button className="btn text-white fw-bold" style={{ backgroundColor: '#6f42c1' }} onClick={handleSubmitDeliver}>
                                    <i className="fa fa-check-circle me-2"></i>Chốt Xuất & Tạo Hóa Đơn
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}