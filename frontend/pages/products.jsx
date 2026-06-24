import { useEffect, useState } from "react";
import React from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";
import api from "../src/utils/axios";

function Products() {
    const getPageFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return Number(params.get("page")) || 1;
    };

    const [toast, setToast] = useState(null);
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(getPageFromURL());
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    const [filterType, setFilterType] = useState("all");
    const [showTrash, setShowTrash] = useState(false);
    const [trashList, setTrashList] = useState([]);
    const [searchProduct, setSearchProduct] = useState("");
    const [searchMaterial, setSearchMaterial] = useState("");

    const [expandedRows, setExpandedRows] = useState([]);
    const [batchesData, setBatchesData] = useState({});
    const [loadingBatches, setLoadingBatches] = useState({});

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set("page", page);
        window.history.replaceState({}, "", `?${params}`);
    }, [page]);

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Math.round(val || 0));
    const formatNumber = (val) => new Intl.NumberFormat("vi-VN").format(val || 0);

    const VOLUME_MAPPING = {
        chai: [250, 330, 350, 500, 700, 1000, 1200, 1500],
        loc: [250, 330, 350, 500, 1500],
        thung: [330, 350, 500, 700, 1500, 4000, 5000],
        binh: [4000, 5000, 19000, 20000],
        lon: [320, 330]
    };

    const formatVolumeToSizeGroup = (vol) => {
        return vol >= 1000 ? `${vol / 1000}L` : `${vol}ml`;
    };

    const token = localStorage.getItem("token");

    // ================= STATE & LOGIC THÊM SẢN PHẨM =================
    const [addForm, setAddForm] = useState({
        name: "", volume: 330, unit: "chai", sell_price: "", deposit_price: "", image: null, item_type: "thanh_pham", size_group: "330ml", wholesale_price: "", wholesale_min_quantity: ""
    });

    const handleAddTypeChange = (e) => {
        const type = e.target.value;
        const isNVL = type === "nguyen_lieu";
        setAddForm({
            ...addForm,
            item_type: type,
            unit: isNVL ? "cái" : "chai",
            volume: isNVL ? 1 : 330,
            sell_price: isNVL ? 0 : "",
            deposit_price: isNVL ? 0 : "",
            wholesale_price: isNVL ? 0 : "",
            wholesale_min_quantity: isNVL ? 0 : "",
            size_group: isNVL ? "330ml" : "330ml"
        });
    };

    const handleAddUnitChange = (e) => {
        const selectedUnit = e.target.value;
        if (addForm.item_type === "thanh_pham") {
            const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
            setAddForm({
                ...addForm,
                unit: selectedUnit,
                volume: defaultVolume,
                size_group: formatVolumeToSizeGroup(defaultVolume)
            });
        } else {
            setAddForm({ ...addForm, unit: selectedUnit });
        }
    };

    const handleAddVolumeChange = (e) => {
        const newVolume = Number(e.target.value);
        setAddForm({ ...addForm, volume: newVolume, size_group: formatVolumeToSizeGroup(newVolume) });
    }

    // ================= STATE & LOGIC SỬA SẢN PHẨM =================
    const [editForm, setEditForm] = useState({
        name: "", volume: "", unit: "chai", sell_price: "", deposit_price: "", image: null, item_type: "thanh_pham", size_group: "", wholesale_price: "", wholesale_min_quantity: ""
    });
    const [editingId, setEditingId] = useState(null);
    const [showEdit, setShowEdit] = useState(false);

    const handleEditTypeChange = (e) => {
        const type = e.target.value;
        const isNVL = type === "nguyen_lieu";
        setEditForm({
            ...editForm,
            item_type: type,
            unit: isNVL ? "cái" : "chai",
            volume: isNVL ? 1 : 330,
            sell_price: isNVL ? 0 : editForm.sell_price,
            deposit_price: isNVL ? 0 : editForm.deposit_price,
            wholesale_price: isNVL ? 0 : editForm.wholesale_price,
            wholesale_min_quantity: isNVL ? 0 : editForm.wholesale_min_quantity,
            size_group: isNVL ? "330ml" : "330ml"
        });
    };

    const handleEditUnitChange = (e) => {
        const selectedUnit = e.target.value;
        if (editForm.item_type === "thanh_pham") {
            const defaultVolume = VOLUME_MAPPING[selectedUnit] ? VOLUME_MAPPING[selectedUnit][0] : "";
            setEditForm({ ...editForm, unit: selectedUnit, volume: defaultVolume, size_group: formatVolumeToSizeGroup(defaultVolume) });
        } else {
            setEditForm({ ...editForm, unit: selectedUnit });
        }
    };

    const handleEditVolumeChange = (e) => {
        const newVolume = Number(e.target.value);
        setEditForm({ ...editForm, volume: newVolume, size_group: formatVolumeToSizeGroup(newVolume) });
    }

    const fetchProducts = async () => {
        try {
            const res = await api.get(`api/products?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
            setProducts(res.data.data ? res.data.data : res.data);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) { setToast({ message: "Lỗi kết nối", type: "danger" }); }
    };

    const fetchTrash = async () => {
        try {
            const res = await api.get("api/products/trash/list", { headers: { Authorization: `Bearer ${token}` } });
            setTrashList(res.data);
        } catch (error) { setToast({ message: "Lỗi tải thùng rác", type: "danger" }); }
    };

    useEffect(() => { fetchProducts(); }, [page]);

    const toggleTrashView = () => {
        if (!showTrash) fetchTrash();
        else fetchProducts();
        setShowTrash(!showTrash);
    };

    const dataSource = showTrash ? trashList : products;
    const tpList = dataSource.filter(p => p.item_type === 'thanh_pham');
    const nvlList = dataSource.filter(p => p.item_type === 'nguyen_lieu');

    const handleAdd = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("name", addForm.name);
        formData.append("item_type", addForm.item_type);
        formData.append("unit", addForm.unit);
        formData.append("volume", addForm.item_type === 'nguyen_lieu' ? 1 : addForm.volume);
        formData.append("size_group", addForm.size_group);
        formData.append("cost_price", 0);
        formData.append("sell_price", addForm.item_type === 'nguyen_lieu' ? 0 : addForm.sell_price);
        formData.append("wholesale_price", addForm.item_type === 'nguyen_lieu' ? 0 : addForm.wholesale_price);
        formData.append("wholesale_min_quantity", addForm.item_type === 'nguyen_lieu' ? 0 : addForm.wholesale_min_quantity);
        formData.append("deposit_price", addForm.item_type === 'nguyen_lieu' ? 0 : addForm.deposit_price);
        formData.append("requires_deposit", addForm.requires_deposit);
        if (addForm.image) formData.append("image", addForm.image);

        try {
            await api.post("api/products", formData, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Thêm thành công", type: "success" });
            setAddForm({ name: "", volume: 330, unit: "chai", sell_price: "", deposit_price: "", image: null, item_type: "thanh_pham", size_group: "330ml", wholesale_price: "", wholesale_min_quantity: "" });
            const fileInput = document.getElementById('addFileInput');
            if (fileInput) fileInput.value = "";
            fetchProducts();
        } catch (error) {
            setToast({ message: "Lỗi khi thêm", type: "danger" });
        }
    };

    const handleEdit = (product) => {
        let safeSizeGroup = (product.size_group || "").replace(/\s/g, "");

        // 💡 BẮT DUNG TÍCH THÔNG MINH BẰNG REGEX (AI THÊM 4L, 10L HAY 100L VÀO TÊN NÓ CŨNG TỰ BẮT ĐƯỢC)
        if (!safeSizeGroup && product.item_type === 'nguyen_lieu') {
            const nameLower = (product.name || "").toLowerCase();

            // Tìm con số (kể cả số thập phân như 1.5) đứng trước chữ ml, l, hoặc lít
            const match = nameLower.match(/(\d+(?:\.\d+)?)\s*(ml|l|lít)/);

            if (match) {
                const number = match[1]; // Bốc con số ra (VD: 4, 1.5, 500)
                const unit = (match[2] === 'lít' || match[2] === 'l') ? 'L' : 'ml'; // Chuẩn hóa đơn vị
                safeSizeGroup = number + unit; // Ghép lại thành "4L", "1.5L", "500ml"
            } else {
                safeSizeGroup = "250ml"; // Nếu tên rỗng không có dung tích thì về mặc định
            }
        }

        setEditForm({
            ...product,
            size_group: safeSizeGroup || "250ml",
            sell_price: Math.round(Number(product.sell_price || 0)),
            deposit_price: Math.round(Number(product.deposit_price || 0)),
            wholesale_price: Math.round(Number(product.wholesale_price || 0)),
            wholesale_min_quantity: Math.round(Number(product.wholesale_min_quantity || 0)),
            image: product.image || null
        });
        setEditingId(product.id);
        setShowEdit(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("name", editForm.name);
        formData.append("item_type", editForm.item_type);
        formData.append("unit", editForm.unit);
        formData.append("volume", editForm.item_type === 'nguyen_lieu' ? 1 : editForm.volume);
        formData.append("size_group", editForm.size_group);
        formData.append("cost_price", editForm.cost_price || 0);
        formData.append("sell_price", editForm.item_type === 'nguyen_lieu' ? 0 : editForm.sell_price);
        formData.append("wholesale_price", editForm.item_type === 'nguyen_lieu' ? 0 : editForm.wholesale_price);
        formData.append("wholesale_min_quantity", editForm.item_type === 'nguyen_lieu' ? 0 : editForm.wholesale_min_quantity);
        formData.append("deposit_price", editForm.item_type === 'nguyen_lieu' ? 0 : editForm.deposit_price);
        formData.append("requires_deposit", editForm.requires_deposit);
        if (editForm.image) formData.append("image", editForm.image);

        try {
            await api.put(`api/products/${editingId}`, formData, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Cập nhật thành công", type: "success" });
            setShowEdit(false);
            fetchProducts();
        } catch (error) {
            setToast({ message: "Lỗi khi cập nhật", type: "danger" });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Xóa sản phẩm này?")) return;
        try {
            await api.delete(`api/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Đã đưa vào thùng rác", type: "success" });
            fetchProducts();
        } catch (error) { setToast({ message: error.response?.data?.message || "Lỗi khi xóa", type: "danger" }); }
    };

    const handleRestore = async (id) => {
        if (!window.confirm("Khôi phục sản phẩm này?")) return;
        try {
            await api.put(`api/products/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Đã khôi phục!", type: "success" });
            fetchTrash();
        } catch (error) { setToast({ message: "Lỗi khôi phục", type: "danger" }); }
    };

    const handleForceDelete = async (id) => {
        if (!window.confirm("CẢNH BÁO: Bạn đang xóa VĨNH VIỄN sản phẩm này khỏi hệ thống. Hành động này không thể hoàn tác! Bạn chắc chứ?")) return;
        if (!window.confirm("Xác nhận xóa vĩnh viễn lần cuối?")) return;

        try {
            await api.delete(`api/products/${id}/force`, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Đã xóa vĩnh viễn!", type: "success" });
            fetchTrash();
        } catch (error) {
            setToast({ message: "Lỗi xóa vĩnh viễn: " + (error.response?.data?.message || "Lỗi server"), type: "danger" });
        }
    };

    const filteredTpList = tpList.filter(p =>
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.id.toString().includes(searchProduct)
    );

    const filteredNvlList = nvlList.filter(p =>
        p.name.toLowerCase().includes(searchMaterial.toLowerCase()) ||
        p.id.toString().includes(searchMaterial)
    );

    const toggleRowExpand = async (productId) => {
        const isExpanded = expandedRows.includes(productId);
        if (isExpanded) {
            setExpandedRows(expandedRows.filter(id => id !== productId));
        } else {
            setExpandedRows([...expandedRows, productId]);
            if (!batchesData[productId]) {
                setLoadingBatches(prev => ({ ...prev, [productId]: true }));
                try {
                    const res = await api.get(`api/products/${productId}/batches`, { headers: { Authorization: `Bearer ${token}` } });
                    setBatchesData(prev => ({ ...prev, [productId]: res.data }));
                } catch (err) {
                    setBatchesData(prev => ({ ...prev, [productId]: [] }));
                } finally {
                    setLoadingBatches(prev => ({ ...prev, [productId]: false }));
                }
            }
        }
    };

    // 💡 BẢNG XỔ XUỐNG CÓ THÊM CỘT "VỊ TRÍ KHO"
    const renderBatchesSubTable = (productId) => {
        const batches = batchesData[productId];
        const isLoading = loadingBatches[productId];

        if (isLoading) return <div className="text-center p-3 text-muted fst-italic"><i className="fa fa-spinner fa-spin me-2"></i>Đang lấy dữ liệu các lô FIFO...</div>;
        if (!batches || batches.length === 0) return <div className="text-center p-3 text-danger fst-italic">Sản phẩm này hiện tại đã hết hàng (chưa có lô tồn kho nào).</div>;

        return (
            <div className="p-3 bg-white border border-info rounded shadow-sm m-2 position-relative">
                <div className="position-absolute top-0 start-0 bg-info text-white px-3 py-1" style={{ borderBottomRightRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                    <i className="fa fa-layer-group me-1"></i> CHI TIẾT TỒN KHO THEO LÔ (FIFO)
                </div>
                <table className="table table-sm table-bordered mt-4 mb-0 align-middle text-center bg-white table-mobile-cards">
                    <thead className="table-info">
                        <tr>
                            <th style={{ width: '80px' }}>Thứ tự xuất</th>
                            <th>Lệnh SX / Mã Phiếu Nhập</th>
                            {/* CỘT KHO MỚI */}
                            <th>Vị trí Kho</th>
                            <th>Ngày Tạo Lô</th>
                            <th>Tồn kho lô</th>
                            <th>Giá vốn lô này</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batches.map((b, index) => (
                            <tr key={index} className={index === 0 ? "table-warning fw-bold" : ""}>
                                <td data-label="Thứ tự xuất">
                                    {index === 0 ? <span className="badge bg-danger">Ưu tiên 1</span> : index + 1}
                                </td>
                                <td data-label="Mã Phiếu Nhập">
                                    {b.production_order_id ? (
                                        <span className="text-primary fw-bold"><i className="fa fa-industry me-1"></i>Lệnh SX #{b.production_order_id}</span>
                                    ) : b.po_id ? (
                                        <span className="text-success fw-bold"><i className="fa fa-truck me-1"></i>Phiếu Nhập #{b.po_id}</span>
                                    ) : (
                                        <span className="text-secondary fw-bold">Lô #{b.id}</span>
                                    )}
                                </td>
                                {/* HIỂN THỊ KHO BÊN TRONG LÔ */}
                                <td data-label="Vị trí Kho"><span className="badge bg-secondary"><i className="fa fa-warehouse me-1"></i>{b.warehouse_name || "Kho Tổng"}</span></td>
                                <td data-label="Ngày Tạo Lô" className="small text-muted">{new Date(b.created_at).toLocaleString('vi-VN')}</td>
                                <td data-label="Tồn kho lô"><span className="badge bg-primary fs-6">{formatNumber(b.quantity_remaining)}</span></td>
                                <td data-label="Giá vốn lô này" className="text-danger fw-bold fs-6">{formatMoney(b.cost_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="pt-4 px-4 w-100">

                {/* ===== FORM THÊM MỚI ===== */}
                {!showTrash && (
                    <div className="bg-white shadow-sm p-4 mb-4 rounded-3 border">
                        <h5 className="fw-bold mb-3 text-primary"><i className="bi bi-plus-circle me-2"></i>Thêm Hàng Hóa Mới</h5>
                        <form onSubmit={handleAdd} className="row g-3 align-items-center">
                            <div className="col-md-2">
                                <label className="small text-muted fw-bold mb-1">Loại Hàng Hóa</label>
                                <select className="form-select border-primary fw-bold bg-light" value={addForm.item_type} onChange={handleAddTypeChange}>
                                    <option value="thanh_pham">📦 Sản phẩm (Bán)</option>
                                    <option value="nguyen_lieu">🛠️ Nguyên vật liệu (SX)</option>
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="small text-muted fw-bold mb-1">Tên mặt hàng</label>
                                <input className="form-control" placeholder="Nhập tên..." value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
                            </div>

                            <div className="col-md-1">
                                <label className="small text-muted fw-bold mb-1">ĐV Tính</label>
                                <select className="form-select" value={addForm.unit} onChange={handleAddUnitChange}>
                                    {addForm.item_type === "thanh_pham" ? (
                                        <>
                                            <option value="chai">Chai</option>
                                            <option value="loc">Lốc</option>
                                            <option value="thung">Thùng</option>
                                            <option value="binh">Bình</option>
                                            <option value="lon">Lon</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="cái">Cái</option>
                                            {/* <option value="kg">Kg</option>
                                            <option value="cuộn">Cuộn</option>
                                            <option value="mét">Mét</option> */}
                                        </>
                                    )}
                                </select>
                            </div>

                            {addForm.item_type === "thanh_pham" ? (
                                <div className="col-md-2">
                                    <label className="small text-muted fw-bold mb-1">Dung tích</label>
                                    <select className="form-select" value={addForm.volume} onChange={handleAddVolumeChange} required>
                                        {VOLUME_MAPPING[addForm.unit]?.map((vol) => (
                                            <option key={`add-${vol}`} value={vol}>{vol >= 1000 ? `${vol / 1000} L` : `${vol} ml`}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="col-md-2">
                                    <label className="small text-muted fw-bold mb-1 text-info">Thuộc Kích Cỡ</label>
                                    <select className="form-select border-info fw-bold text-dark" value={addForm.size_group} onChange={(e) => setAddForm({ ...addForm, size_group: e.target.value })}>
                                        <option value="250ml">250 ml</option>
                                        <option value="330ml">330 ml</option>
                                        <option value="350ml">350 ml</option>
                                        <option value="500ml">500 ml</option>
                                        <option value="1.5L">1.5 Lít</option>
                                        <option value="4L">4 Lít</option>
                                        <option value="5L">5 Lít</option>
                                        <option value="20L">20 Lít</option>
                                    </select>
                                </div>
                            )}

                            {addForm.item_type === "thanh_pham" && (
                                <>
                                    <div className="col-md-2">
                                        <label className="small text-muted fw-bold mb-1">Giá bán Lẻ</label>
                                        <input type="number" className="form-control text-danger fw-bold" placeholder="0" value={addForm.sell_price} onChange={(e) => setAddForm({ ...addForm, sell_price: e.target.value })} required />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="small text-muted fw-bold mb-1">Giá Sỉ</label>
                                        <input type="number" className="form-control text-primary fw-bold" placeholder="Tùy chọn" value={addForm.wholesale_price} onChange={(e) => setAddForm({ ...addForm, wholesale_price: e.target.value })} />
                                    </div>
                                    <div className="col-md-2 offset-md-6 mt-2">
                                        <label className="small text-muted fw-bold mb-1">Mốc Số Lượng Sỉ</label>
                                        <input type="number" className="form-control text-info fw-bold" placeholder="VD: 10 lốc" value={addForm.wholesale_min_quantity} onChange={(e) => setAddForm({ ...addForm, wholesale_min_quantity: e.target.value })} />
                                    </div>
                                    <div className="col-md-2 mt-2">
                                        <label className="small text-muted fw-bold mb-1">Tiền cọc vỏ</label>
                                        <input type="number" className="form-control text-warning" placeholder="0" value={addForm.deposit_price} onChange={(e) => setAddForm({ ...addForm, deposit_price: e.target.value })} />
                                    </div>
                                    <div className="form-check col-md-2 d-flex align-items-center">
                                        <input
                                            type="checkbox"
                                            // 💡 Thêm border-2 border-dark để viền ô vuông dày và đen đậm
                                            className="form-check-input border border-2 border-dark shadow-sm"
                                            // 💡 Phóng to ô vuông lên 1.3 lần cho dễ bấm
                                            style={{ transform: "scale(1.3)", cursor: "pointer", marginTop: "0" }}
                                            checked={addForm.requires_deposit === 1}
                                            onChange={(e) => setAddForm({ ...addForm, requires_deposit: e.target.checked ? 1 : 0 })}
                                            id="check-coc-vo" // Thêm id để xài chung với label
                                        />
                                        <label
                                            className="form-check-label ms-3 fw-bold text-dark"
                                            htmlFor="check-coc-vo" // Bấm vào chữ nó cũng tự tick vào ô vuông
                                            style={{ cursor: "pointer" }}
                                        >
                                            Sản phẩm này có cọc vỏ (Bình 20L/5L)
                                        </label>
                                    </div>
                                </>
                            )}

                            {addForm.item_type === "thanh_pham" && (
                                <div className="col-md-8 mt-2">
                                    <label className="small text-muted fw-bold mb-1">Ảnh sản phẩm</label>
                                    <input id="addFileInput" type="file" className="form-control" accept="image/*" onChange={(e) => setAddForm({ ...addForm, image: e.target.files[0] })} />
                                </div>
                            )}
                            <div className={`col-md-2 mt-3 ${addForm.item_type === 'nguyen_lieu' ? 'offset-md-10' : 'mt-4 pt-3'}`}>
                                <button className="btn btn-primary w-100 fw-bold"><i className="fa fa-save me-1"></i> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ===== MODAL EDIT ===== */}
                {showEdit && (
                    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-lg">
                            <div className="modal-content">
                                <div className="modal-header bg-warning">
                                    <h5 className="modal-title fw-bold">Chỉnh sửa hàng hóa</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowEdit(false)}></button>
                                </div>
                                <form onSubmit={handleUpdate}>
                                    <div className="modal-body row g-3">
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold">Phân loại</label>
                                            <select className="form-select bg-light" value={editForm.item_type} onChange={handleEditTypeChange}>
                                                <option value="thanh_pham">📦 Sản phẩm</option>
                                                <option value="nguyen_lieu">🛠️ Nguyên vật liệu</option>
                                            </select>
                                        </div>
                                        <div className="col-md-8">
                                            <label className="form-label fw-bold">Tên sản phẩm</label>
                                            <input type="text" className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label">Đơn vị tính</label>
                                            <select className="form-select" value={editForm.unit} onChange={handleEditUnitChange}>
                                                {editForm.item_type === "thanh_pham" ? (
                                                    <>
                                                        <option value="chai">Chai</option>
                                                        <option value="loc">Lốc</option>
                                                        <option value="thung">Thùng</option>
                                                        <option value="binh">Bình</option>
                                                        <option value="lon">Lon</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="cái">Cái</option>
                                                        {/* <option value="kg">Kg</option>
                                                        <option value="cuộn">Cuộn</option>
                                                        <option value="mét">Mét</option> */}
                                                    </>
                                                )}
                                            </select>
                                        </div>

                                        {editForm.item_type === "thanh_pham" ? (
                                            <div className="col-md-6">
                                                <label className="small text-muted fw-bold mb-1">Dung tích</label>
                                                <select className="form-select" value={editForm.volume} onChange={handleEditVolumeChange} required>
                                                    {VOLUME_MAPPING[editForm.unit]?.map((vol) => (
                                                        <option key={`edit-${vol}`} value={vol}>{vol >= 1000 ? `${vol / 1000} L` : `${vol} ml`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="col-md-6">
                                                <label className="small text-muted fw-bold mb-1 text-info">Thuộc Kích Cỡ</label>
                                                <select className="form-select border-info fw-bold text-dark" value={editForm.size_group} onChange={(e) => setEditForm({ ...editForm, size_group: e.target.value })}>
                                                    <option value="250ml">250 ml</option>
                                                    <option value="330ml">330 ml</option>
                                                    <option value="350ml">350 ml</option>
                                                    <option value="500ml">500 ml</option>
                                                    <option value="1.5L">1.5 Lít</option>
                                                    <option value="4L">4 Lít</option>
                                                    <option value="5L">5 Lít</option>
                                                    <option value="20L">20 Lít</option>
                                                </select>
                                            </div>
                                        )}

                                        {editForm.item_type === "thanh_pham" && (
                                            <>
                                                <div className="col-md-3">
                                                    <label className="form-label">Giá bán Lẻ</label>
                                                    <input type="number" className="form-control text-danger fw-bold" value={editForm.sell_price} onChange={(e) => setEditForm({ ...editForm, sell_price: e.target.value })} />
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label">Giá Sỉ</label>
                                                    <input type="number" className="form-control text-primary fw-bold" value={editForm.wholesale_price} onChange={(e) => setEditForm({ ...editForm, wholesale_price: e.target.value })} />
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label">Mốc Số Lượng Sỉ</label>
                                                    <input type="number" className="form-control text-info fw-bold" value={editForm.wholesale_min_quantity} onChange={(e) => setEditForm({ ...editForm, wholesale_min_quantity: e.target.value })} />
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label">Tiền cọc vỏ</label>
                                                    <input type="number" className="form-control text-warning" value={editForm.deposit_price} onChange={(e) => setEditForm({ ...editForm, deposit_price: e.target.value })} />
                                                </div>
                                                <div className="col-12 mt-3">
                                                    <div className="form-check">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            checked={editForm.requires_deposit === 1}
                                                            onChange={(e) => setEditForm({ ...editForm, requires_deposit: e.target.checked ? 1 : 0 })}
                                                        />
                                                        <label className="form-check-label">Sản phẩm này có cọc vỏ (Bình 20L/5L)</label>
                                                    </div>
                                                </div>
                                                <div className="col-12 mt-3">
                                                    <label className="form-label fw-bold">Thay ảnh mới</label>
                                                    <input type="file" className="form-control" accept="image/*" onChange={(e) => setEditForm({ ...editForm, image: e.target.files[0] })} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Hủy</button>
                                        <button type="submit" className="btn btn-warning fw-bold">Lưu Cập Nhật</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white shadow-sm p-4 rounded-3 border">
                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
                        <div className="d-flex gap-2">
                            <button className={`btn ${filterType === "all" ? "btn-primary" : "btn-outline-secondary"} fw-bold`} onClick={() => setFilterType("all")}>
                                <i className="fa fa-list me-1"></i> Tất cả
                            </button>
                            <button className={`btn ${filterType === "thanh_pham" ? "btn-success" : "btn-outline-secondary"} fw-bold`} onClick={() => setFilterType("thanh_pham")}>
                                📦 Sản phẩm
                            </button>
                            <button className={`btn ${filterType === "nguyen_lieu" ? "btn-warning text-dark" : "btn-outline-secondary"} fw-bold`} onClick={() => setFilterType("nguyen_lieu")}>
                                🛠️ Nguyên vật liệu
                            </button>
                        </div>
                        <button className={`btn ${showTrash ? 'btn-primary' : 'btn-danger'} fw-bold`} onClick={toggleTrashView}>
                            {showTrash ? <><i className="fa fa-arrow-left me-2"></i>Quay lại</> : <><i className="fa fa-trash me-2"></i>Thùng rác</>}
                        </button>
                    </div>

                    <div className="mt-4">
                        {(filterType === "all" || filterType === "thanh_pham") && (
                            <div className="mb-5">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="fw-bold text-success mb-0">📦 Danh sách Sản Phẩm</h5>
                                    <div className="input-group shadow-sm" style={{ width: '300px' }}>
                                        <span className="input-group-text bg-white text-muted border-success"><i className="fa fa-search"></i></span>
                                        <input
                                            type="text"
                                            className="form-control border-success border-start-0 ps-0"
                                            placeholder="Tìm tên hoặc ID sản phẩm..."
                                            value={searchProduct}
                                            onChange={(e) => { setSearchProduct(e.target.value); setPage(1); }}
                                        />
                                    </div>
                                </div>
                                <div className="table-responsive border rounded">
                                    <table className="table table-hover align-middle mb-0 table-mobile-cards">
                                        <thead className="table-success text-nowrap">
                                            <tr>
                                                <th>Ảnh</th>
                                                <th>Tên Sản Phẩm</th>
                                                <th>Dung tích / ĐV</th>
                                                <th>Giá vốn (Lô đang xuất)</th>
                                                <th>Giá bán (Lẻ/Sỉ)</th>
                                                <th>Tiền cọc</th>
                                                {/* 💡 ĐỔI TÊN CỘT TRÊN BẢNG CHÍNH */}
                                                <th>Tồn Kho (Vị trí)</th>
                                                <th className="text-center">Thao Tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTpList.length === 0 ? (
                                                <tr><td colSpan="8" className="text-center py-4 text-muted fst-italic">Không có sản phẩm nào</td></tr>
                                            ) : (
                                                filteredTpList.map((p) => (
                                                    <React.Fragment key={p.id}>
                                                        <tr>
                                                            <td data-label="Ảnh">
                                                                <img src={p.image ? p.image : "/no-image.png"} alt="Img" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '5px', filter: showTrash ? 'grayscale(1)' : 'none' }} onError={(e) => { e.target.src = "/no-image.png" }} />
                                                            </td>
                                                            <td data-label="Tên Sản Phẩm" className="fw-bold">{p.name} <div className="text-muted small">ID: {p.id}</div></td>
                                                            <td data-label="Dung tích">
                                                                {(p.volume >= 1000 ? `${p.volume / 1000} L` : `${p.volume} ml`)}
                                                                <span className="badge bg-secondary ms-1">{p.unit}</span>
                                                            </td>
                                                            <td data-label="Giá Vốn (Lô đang xuất)" className="text-muted fw-bold">{formatMoney(p.cost_price)}</td>
                                                            <td data-label="Giá Bán (Lẻ/Sỉ)">
                                                                <div className="fw-bold text-danger">{formatMoney(p.sell_price)}</div>
                                                                {p.wholesale_min_quantity > 0 && (
                                                                    <div className="text-muted fst-italic mt-1" style={{ fontSize: '11px' }}>
                                                                        Sỉ: <span className="text-primary fw-bold">{formatMoney(p.wholesale_price)}</span> (từ {p.wholesale_min_quantity} {p.unit})
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td data-label="Tiền cọc" className="fw-bold text-warning">{formatMoney(p.deposit_price)}</td>

                                                            {/* 💡 HIỂN THỊ KHO VÀ ĐỊNH DẠNG LẠI SỐ LƯỢNG */}
                                                            <td data-label="Tồn Kho">
                                                                <div className="fw-bold fs-5 text-primary">{formatNumber(p.quantity)}</div>
                                                                <div className="text-muted small fw-bold">
                                                                    <i className="fa fa-warehouse me-1"></i>
                                                                    {p.warehouse_name || p.warehouse || p.ten_kho || p.kho || "Chưa rõ kho"}
                                                                </div>
                                                            </td>

                                                            <td data-label="Thao Tác" className="text-center">
                                                                {showTrash ? (
                                                                    <>
                                                                        <button className="btn btn-sm btn-success fw-bold" onClick={() => handleRestore(p.id)}><i className="fa fa-undo me-1"></i>Khôi Phục</button>
                                                                        <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => handleForceDelete(p.id)}>
                                                                            <i className="fa fa-times me-1"></i>Xóa hẳn
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button className="btn btn-info btn-sm text-white fw-bold me-2 shadow-sm" onClick={() => toggleRowExpand(p.id)} title="Xem chi tiết các Lô đang tồn">
                                                                            <i className={`fa ${expandedRows.includes(p.id) ? 'fa-chevron-up' : 'fa-list-ul'}`}></i> Lô
                                                                        </button>
                                                                        <button className="btn btn-warning btn-sm me-2 fw-bold" onClick={() => handleEdit(p)}><i className="fa fa-edit"></i></button>
                                                                        <button className="btn btn-danger btn-sm fw-bold" onClick={() => handleDelete(p.id)}><i className="fa fa-trash"></i></button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {/* BẢNG XỔ XUỐNG BÊN DƯỚI DÒNG SẢN PHẨM */}
                                                        {expandedRows.includes(p.id) && (
                                                            <tr className="table-light">
                                                                <td colSpan="8" className="p-0 border-bottom border-info border-3">
                                                                    {renderBatchesSubTable(p.id)}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {(filterType === "all" || filterType === "nguyen_lieu") && (
                            <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="fw-bold text-warning text-dark mb-0">🛠️ Danh sách Nguyên Vật Liệu</h5>
                                    <div className="input-group shadow-sm" style={{ width: '300px' }}>
                                        <span className="input-group-text bg-white text-muted border-warning"><i className="fa fa-search"></i></span>
                                        <input
                                            type="text"
                                            className="form-control border-warning border-start-0 ps-0"
                                            placeholder="Tìm tên hoặc ID vật tư..."
                                            value={searchMaterial}
                                            onChange={(e) => { setSearchMaterial(e.target.value); setPage(1); }}
                                        />
                                    </div>
                                </div>
                                <div className="table-responsive border rounded">
                                    <table className="table table-hover align-middle mb-0 table-mobile-cards">
                                        <thead className="table-warning text-nowrap">
                                            <tr>
                                                <th>Tên Nguyên vật Liệu</th>
                                                <th>Đơn Vị Tính</th>
                                                <th>Giá vốn (Lô đang xuất)</th>
                                                {/* <th>Thuộc loại kích cỡ</th> */}
                                                {/* 💡 ĐỔI TÊN CỘT BÊN BẢNG NVL */}
                                                <th>Tồn Kho (Vị trí)</th>
                                                <th className="text-center">Thao Tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredNvlList.length === 0 ? (
                                                <tr><td colSpan="6" className="text-center py-4 text-muted fst-italic">Không có nguyên vật liệu nào</td></tr>
                                            ) : (
                                                filteredNvlList.map((p) => (
                                                    <React.Fragment key={p.id}>
                                                        <tr>
                                                            <td data-label="Tên Nguyên vật Liệu" className="fw-bold">{p.name} <div className="text-muted small">ID: {p.id}</div></td>
                                                            <td data-label="Đơn Vị Tính"><span className="badge bg-secondary">{p.unit}</span></td>
                                                            <td data-label="Giá vốn (Lô đang xuất)" className="text-muted fw-bold">{formatMoney(p.cost_price)}</td>
                                                            {/* <td data-label className="text-info fw-bold">{p.size_group}</td> */}

                                                            {/* 💡 HIỂN THỊ KHO VÀ ĐỊNH DẠNG LẠI SỐ LƯỢNG (NVL) */}
                                                            <td data-label="Tồn Kho (Vị trí)">
                                                                <div className="fw-bold fs-5 text-primary">{formatNumber(p.quantity)}</div>
                                                                <div className="text-muted small fw-bold">
                                                                    <i className="fa fa-warehouse me-1"></i>
                                                                    {p.warehouse_name || p.warehouse || p.ten_kho || p.kho || "Chưa rõ kho"}
                                                                </div>
                                                            </td>

                                                            <td data-label="Thao Tác" className="text-center">
                                                                {showTrash ? (
                                                                    <>
                                                                        <button className="btn btn-sm btn-success fw-bold" onClick={() => handleRestore(p.id)}><i className="fa fa-undo me-1"></i>Khôi Phục</button>
                                                                        <button className="btn btn-sm btn-outline-danger fw-bold" onClick={() => handleForceDelete(p.id)}>
                                                                            <i className="fa fa-times me-1"></i>Xóa hẳn
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button className="btn btn-info btn-sm text-white fw-bold me-2 shadow-sm" onClick={() => toggleRowExpand(p.id)} title="Xem chi tiết các Lô đang tồn">
                                                                            <i className={`fa ${expandedRows.includes(p.id) ? 'fa-chevron-up' : 'fa-list-ul'}`}></i> Lô
                                                                        </button>
                                                                        <button className="btn btn-warning btn-sm me-2 fw-bold" onClick={() => handleEdit(p)}><i className="fa fa-edit"></i></button>
                                                                        <button className="btn btn-danger btn-sm fw-bold" onClick={() => handleDelete(p.id)}><i className="fa fa-trash"></i></button>
                                                                    </>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {/* BẢNG XỔ XUỐNG BÊN DƯỚI DÒNG SẢN PHẨM NVL */}
                                                        {expandedRows.includes(p.id) && (
                                                            <tr className="table-light">
                                                                <td colSpan="6" className="p-0 border-bottom border-info border-3">
                                                                    {renderBatchesSubTable(p.id)}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {!showTrash && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default Products;