import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function Production() {
    const token = localStorage.getItem("token");

    const [toast, setToast] = useState(null);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [warehouseId, setWarehouseId] = useState("2");
    const [quantity, setQuantity] = useState("");
    const [isProducing, setIsProducing] = useState(false);
    const [bomPreview, setBomPreview] = useState([]);
    const [note, setNote] = useState("");
    const [pendingOrders, setPendingOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState("");
    const [orderInput, setOrderInput] = useState("");
    const [orderSearchTerm, setOrderSearchTerm] = useState("");
    // 💡 STATE MỚI: Ghi nhớ số lượng THỰC SỰ CÒN THIẾU của đơn hàng
    const [missingQty, setMissingQty] = useState(0);

    const fetchPendingOrders = async () => {
        try {
            const res = await api.get("api/sales-orders", { headers: { Authorization: `Bearer ${token}` } });
            const activeOrders = res.data.filter(o => o.status === 'cho_san_xuat' || o.status === 'dang_san_xuat');
            setPendingOrders(activeOrders);
        } catch (err) { console.error(err); }
    };

    const fetchGoods = async () => {
        try {
            const res = await api.get("api/production/finished-goods", { headers: { Authorization: `Bearer ${token}` } });
            setFinishedGoods(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchGoods();
        fetchPendingOrders();
    }, []);

    useEffect(() => {
        if (!selectedOrder) {
            setMissingQty(0);
            return;
        }
        const autoFillOrderData = async () => {
            try {
                const res = await api.get(`api/sales-orders/${selectedOrder}`, { headers: { Authorization: `Bearer ${token}` } });
                const details = res.data.details || [];

                if (details.length === 1) {
                    const item = details[0];
                    setSelectedProduct(String(item.product_id));
                    const effectiveReady = Math.max(item.produced_quantity || 0, item.delivered_quantity || 0);
                    const remainingQty = item.ordered_quantity - effectiveReady;

                    // 💡 Lưu lại số lượng còn thiếu để so sánh
                    setMissingQty(Math.max(0, remainingQty));

                    if (remainingQty > 0) {
                        setQuantity(String(remainingQty));
                    } else {
                        setQuantity("0");
                        setToast({ message: "Đơn này đã đủ hàng! Chỉ sản xuất thêm nếu cần BÙ HAO HỤT.", type: "info" });
                    }
                } else if (details.length > 1) {
                    setSelectedProduct("");
                    setQuantity("");
                    setMissingQty(0);
                }
            } catch (err) { console.error("Lỗi lấy chi tiết đơn:", err); }
        };
        autoFillOrderData();
    }, [selectedOrder]);

    useEffect(() => {
        const fetchPreview = async () => {
            if (!selectedProduct || Number(quantity) <= 0) {
                setBomPreview([]);
                return;
            }
            try {
                const res = await api.get(`api/production/preview-bom/${selectedProduct}?qty=${quantity}`, { headers: { Authorization: `Bearer ${token}` } });

                // 💡 FIX LỖI ,000: Ép qua Number để gọt sạch phần thập phân dư thừa của Database
                const cleanData = res.data.map(item => ({
                    ...item,
                    required_qty: Number(item.required_qty),
                    standard_qty: Number(item.required_qty)
                }));
                setBomPreview(cleanData);

            } catch (err) { console.error("Lỗi dự báo", err); }
        };
        const timeoutId = setTimeout(() => fetchPreview(), 500);
        return () => clearTimeout(timeoutId);
    }, [selectedProduct, quantity]);

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Math.round(val || 0));

    const selectedProdData = finishedGoods.find(p => String(p.id) === String(selectedProduct));
    const unitDisplay = selectedProdData ? selectedProdData.unit : "Bình / Lốc / Lít";

    const handleMaterialChange = (idx, val) => {
        const newData = [...bomPreview];
        // 💡 FIX LỖI GÕ SỐ LẺ: Chỉ lưu chuỗi val, để React tự hiểu, cho phép gõ 0.5 mượt mà
        newData[idx].required_qty = val;
        setBomPreview(newData);
    };

    // 💡 THÊM HÀM NÀY: Khi người dùng gõ xong và click chuột ra ngoài
    const handleMaterialBlur = (idx) => {
        const newData = [...bomPreview];
        const item = newData[idx];
        // Nếu để trống hoặc gõ số nhỏ hơn định mức chuẩn -> Ép về lại số chuẩn
        if (item.required_qty === "" || Number(item.required_qty) < Number(item.standard_qty)) {
            newData[idx].required_qty = item.standard_qty;
            setBomPreview(newData);
        }
    };

    const handleProduce = async () => {
        // Kiểm tra xem có vật tư nào bị sửa số lượng (Thực dùng khác Định mức) không
        // Sếp nhớ chỉnh lại tên biến m.required_qty và m.standard_qty cho khớp với code của sếp nhé
        const hasWastage = bomPreview.some(m => Number(m.required_qty) !== Number(m.standard_qty));

        if (hasWastage && (!note || note.trim() === "")) {
            return setToast({
                message: "Hệ thống phát hiện có hao hụt vật tư. Vui lòng nhập lý do vào ô GHI CHÚ!",
                type: "warning"
            });
        }

        if (!selectedProduct) return setToast({ message: "Vui lòng chọn sản phẩm!", type: "warning" });
        if (Number(quantity) <= 0) return setToast({ message: "Số lượng phải lớn hơn 0!", type: "warning" });

        // 💡 LƯỚI BẢO VỆ CHỐNG SẢN XUẤT LỐ / ÉP GHI CHÚ
        if (selectedOrder && Number(quantity) > missingQty) {
            const excess = Number(quantity) - missingQty;
            const isConfirmed = window.confirm(`⚠️ CẢNH BÁO LÀM BÙ:\n\nĐơn hàng này chỉ còn thiếu ${missingQty} ${unitDisplay}.\nBạn đang lệnh sản xuất ${quantity} ${unitDisplay} (Vượt mức ${excess}).\n\nBạn có chắc chắn đây là làm BÙ HAO HỤT / BỂ VỠ không?`);

            if (!isConfirmed) return; // Nếu bấm Hủy thì dừng luôn

            if (note.trim() === "") {
                return setToast({ message: `Đang làm dư ${excess} ${unitDisplay}. Vui lòng Ghi chú rõ lý do hao hụt/bể vỡ (ở Mục 4) để kế toán theo dõi!`, type: "danger" });
            }
        }

        setIsProducing(true);
        try {
            const res = await api.post("api/production", {
                product_id: selectedProduct,
                quantity: Number(quantity),
                materials: bomPreview,
                note: note,
                ref_sales_order_id: selectedOrder || null
            }, { headers: { Authorization: `Bearer ${token}` } });

            setToast({ message: `Thành công! Đã nhập ${res.data.produced_qty} ${unitDisplay}.`, type: "success" });
            setQuantity("");
            setSelectedProduct("");
            setNote("");
            fetchGoods();
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi sản xuất", type: "danger" });
        } finally {
            setIsProducing(false);
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="container-fluid py-4 px-2 px-md-4 d-flex justify-content-center">
                <div className="card shadow-sm border-0 w-100 rounded-4 overflow-hidden" style={{ maxWidth: '800px' }}>

                    <div className="card-header bg-primary text-white text-center py-3 border-0">
                        <h4 className="mb-0 fw-bold fs-4"><i className="bi bi-gear-wide-connected me-2"></i> LỆNH SẢN XUẤT MỚI</h4>
                    </div>

                    <div className="card-body p-3 p-md-4 bg-light">

                        {/* 💡 MỤC 1: ĐÃ NÂNG CẤP ĐỒNG BỘ HÓA TỰ ĐỘNG */}
                        <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border mb-4">
                            <h6 className="fw-bold text-info mb-3 text-uppercase small">
                                <i className="bi bi-file-earmark-text me-2"></i>1. Liên kết Đơn hàng (Tùy chọn)
                            </h6>

                            {/* Ô TÌM KIẾM ĐỘC LẬP (TỰ ĐỘNG ĐỒNG BỘ) */}
                            <div className="input-group mb-2 shadow-sm">
                                <span className="input-group-text bg-light text-info border-info"><i className="bi bi-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-info"
                                    placeholder="Gõ tìm mã đơn hoặc tên khách..."
                                    value={orderSearchTerm}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setOrderSearchTerm(val); // Cập nhật chữ hiển thị

                                        // 💡 LOGIC MỚI: TỰ ĐỘNG ĐỒNG BỘ
                                        if (val.trim() === "") {
                                            setSelectedOrder(""); // Xóa trắng thì tự về Dự trữ
                                        } else {
                                            // Lọc xem có ai khớp không
                                            const matchedOrders = pendingOrders.filter(o =>
                                                String(o.order_code).toLowerCase().includes(val.toLowerCase()) ||
                                                String(o.customer_name).toLowerCase().includes(val.toLowerCase())
                                            );

                                            if (matchedOrders.length > 0) {
                                                // Có kết quả -> ÉP ô select bên dưới tự động chọn thằng đầu tiên luôn!
                                                setSelectedOrder(matchedOrders[0].id);
                                            } else {
                                                setSelectedOrder(""); // Gõ sai không có ai thì về Dự trữ
                                            }
                                        }
                                    }}
                                />
                            </div>

                            {/* Ô DROPDOWN TRUYỀN THỐNG CHỐNG TRÀN VIỀN */}
                            <select
                                className="form-select form-select-lg border-info fw-bold text-dark shadow-sm bg-light"
                                value={selectedOrder}
                                onChange={(e) => setSelectedOrder(e.target.value)}
                                style={{ maxWidth: "100%", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
                            >
                                <option value="">-- Không có (Sản xuất dự trữ vô kho) --</option>

                                {pendingOrders
                                    .filter(o =>
                                        String(o.order_code).toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                                        String(o.customer_name).toLowerCase().includes(orderSearchTerm.toLowerCase())
                                    )
                                    .map(o => (
                                        <option key={o.id} value={o.id}>
                                            Đơn #{o.order_code} - Khách: {o.customer_name}
                                        </option>
                                    ))
                                }
                            </select>

                            <small className="text-muted fst-italic d-block mt-2"><i className="bi bi-info-circle me-1"></i>Hệ thống tự động điền loại nước và số lượng còn thiếu dựa trên đơn hàng.</small>
                        </div>

                        <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border mb-4">
                            <h6 className="fw-bold text-secondary mb-3 text-uppercase small"><i className="bi bi-box-seam me-2"></i>2. Thông tin mặt hàng</h6>

                            <div className="mb-3">
                                <label className="form-label small fw-bold text-muted">Loại nước cần sản xuất:</label>
                                <select className="form-select form-select-lg border-primary fw-bold text-dark shadow-sm" value={selectedProduct} onChange={(e) => { setQuantity(""); setSelectedProduct(e.target.value); }}>
                                    <option value="">-- Bấm chọn sản phẩm --</option>
                                    {finishedGoods.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Tồn kho: {Number(p.quantity)} {p.unit})</option>
                                    ))}
                                </select>
                            </div>

                            {selectedProduct && (
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Số lượng sản xuất:</label>
                                        <div className="input-group input-group-lg shadow-sm">
                                            <input type="number" className={`form-control fw-bold text-center ${selectedOrder && Number(quantity) > missingQty ? 'text-danger border-warning' : 'text-primary'}`} placeholder="Nhập SL..." min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => { if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault(); }} />
                                            <span className="input-group-text bg-light fw-bold text-muted text-uppercase">{unitDisplay}</span>
                                        </div>
                                        {/* 💡 HIỂN THỊ CẢNH BÁO NẾU GÕ LỐ SỐ LƯỢNG */}
                                        {selectedOrder && Number(quantity) > missingQty && (
                                            <div className="alert alert-warning mt-2 mb-0 py-2 px-3 small fw-bold shadow-sm border-warning">
                                                <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                                                Đơn chỉ thiếu <span className="text-danger">{missingQty}</span>. Đang làm dư <span className="text-danger">{Number(quantity) - missingQty}</span>. Hãy ghi rõ lý do hao hụt ở Mục 4!
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Kho cất giữ:</label>
                                        <select className="form-select form-select-lg border-success fw-bold text-success shadow-sm bg-light" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled>
                                            <option value="2">🏭 Kho Tổng Sản Phẩm</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedProduct && bomPreview.length > 0 && (
                            <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border border-danger mb-4">
                                <h6 className="fw-bold text-danger mb-3 text-uppercase small"><i className="bi bi-eye-fill me-2"></i>3. Dự kiến vật tư bị trừ kho</h6>
                                <div className="alert alert-info py-2 small mb-3 border-0 shadow-sm">
                                    <i className="fa fa-info-circle me-2"></i>
                                    <strong>Lưu ý:</strong> Bạn có thể nhấp vào các ô số màu xanh ở cột <b>Thực tế dùng</b> để điều chỉnh nếu có phát sinh hao hụt, bể vỡ trong quá trình làm.
                                </div>
                                <div className="d-none d-md-block table-responsive">
                                    <table className="table table-bordered mb-0 align-middle text-center">
                                        <thead className="table-light text-muted small">
                                            <tr>
                                                <th className="text-start">Tên vật tư (Nhãn, màng co...)</th>
                                                <th style={{ width: '150px' }}>Thực tế dùng</th>
                                                <th>Tồn kho hiện tại</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bomPreview.map((item, idx) => (
                                                <tr key={idx} className={item.current_stock < item.required_qty ? "table-danger" : (Number(item.required_qty) > Number(item.standard_qty) ? "table-warning fw-bold" : "")}>
                                                    <td className="text-start fw-bold text-dark">{item.material_name}</td>
                                                    <td>
                                                        <div className="input-group input-group-sm shadow-sm">
                                                            <input
                                                                type="number"
                                                                className="form-control text-center fw-bold text-primary bg-white"
                                                                value={item.required_qty}
                                                                step="any"
                                                                min={item.standard_qty} /* 💡 ĐÃ FIX: Không cho phép giảm xuống dưới mức chuẩn */
                                                                onChange={(e) => handleMaterialChange(idx, e.target.value)}
                                                                onBlur={(e) => handleMaterialBlur(idx)}
                                                                style={{ color: '#0d6efd' }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="fw-bold text-secondary">{Number(item.current_stock)} {item.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-block d-md-none">
                                    {bomPreview.map((item, idx) => (
                                        <div key={idx} className={`p-3 rounded-3 border mb-2 ${item.current_stock < item.required_qty ? "bg-danger bg-opacity-10 border-danger" : (Number(item.required_qty) > Number(item.standard_qty) ? "bg-warning bg-opacity-10 border-warning" : "bg-light")}`}>
                                            <div className="fw-bold text-dark mb-2">{item.material_name}</div>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="input-group input-group-sm shadow-sm w-50">
                                                    <input
                                                        type="number"
                                                        className="form-control text-center fw-bold text-primary bg-white"
                                                        value={item.required_qty}
                                                        step="any"
                                                        min={item.standard_qty} /* 💡 ĐÃ FIX: Không cho phép giảm xuống dưới mức chuẩn */
                                                        onChange={(e) => handleMaterialChange(idx, e.target.value)}
                                                        onBlur={(e) => handleMaterialBlur(idx)}
                                                        style={{ color: '#0d6efd' }}
                                                    />
                                                    <span className="input-group-text bg-white">{item.unit}</span>
                                                </div>
                                                <div className="small fw-bold text-muted">Tồn: {item.current_stock} {item.unit}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedProduct && (() => {
                            // 💡 ĐÃ FIX: Đổi !== thành > (Chỉ báo hao hụt khi Thực dùng LỚN HƠN Định mức)
                            const hasWastage = bomPreview.some(item => Number(item.required_qty) > Number(item.standard_qty));
                            const isNoteEmpty = !note || note.trim() === "";

                            return (
                                <div className={`bg-white p-3 p-md-4 rounded-4 shadow-sm border mb-4 ${hasWastage && isNoteEmpty ? 'border-danger border-2' : ''}`}>
                                    <h6 className={`fw-bold mb-3 text-uppercase small ${hasWastage && isNoteEmpty ? 'text-danger' : 'text-secondary'}`}>
                                        <i className="bi bi-pencil-square me-2"></i>4. Ghi chú (Hao hụt / Bể vỡ)
                                        {hasWastage && isNoteEmpty && <span className="ms-2 badge bg-danger text-white blink-text">BẮT BUỘC</span>}
                                    </h6>

                                    {hasWastage && isNoteEmpty && (
                                        <div className="alert alert-danger py-2 px-3 small fw-bold mb-3 border-0 shadow-sm d-flex align-items-center">
                                            <i className="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
                                            <div>Bạn vừa thay đổi vật tư thực tế. Hệ thống đã khóa nút Sản Xuất. <br />Vui lòng ghi rõ lý do hao hụt xuống ô bên dưới để mở khóa!</div>
                                        </div>
                                    )}

                                    <textarea
                                        className={`form-control shadow-sm ${hasWastage && isNoteEmpty ? 'border-danger bg-danger bg-opacity-10' : 'border-secondary bg-light'}`}
                                        rows="2"
                                        placeholder="VD: Sản xuất bù 2 bình rớt bể, rách 5 màng co..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    ></textarea>
                                </div>
                            );
                        })()}

                        {/* 💡 LƯỚI BẢO VỆ NHIỀU LỚP CỦA NÚT SẢN XUẤT */}
                        {(() => {
                            const isShortOfMaterial = bomPreview.some(item => Number(item.current_stock) < Number(item.required_qty));

                            // 💡 KIỂM TRA LỖI LOGIC: Có ô nào bị gõ nhỏ hơn định mức không?
                            const isBelowStandard = bomPreview.some(item => Number(item.required_qty) < Number(item.standard_qty));

                            const hasWastage = bomPreview.some(item => Number(item.required_qty) > Number(item.standard_qty));
                            const isNoteEmpty = !note || note.trim() === "";
                            const isBlockedByWastageNote = hasWastage && isNoteEmpty;

                            return (
                                <button
                                    className={`btn btn-lg w-100 fw-bold shadow py-3 rounded-4 fs-5 ${isShortOfMaterial || isBlockedByWastageNote || isBelowStandard ? 'btn-secondary' : 'btn-success'}`}
                                    disabled={!selectedProduct || !quantity || isProducing || isShortOfMaterial || isBlockedByWastageNote || isBelowStandard}
                                    onClick={handleProduce}
                                >
                                    {isProducing ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>ĐANG LƯU...</>
                                    ) : isShortOfMaterial ? (
                                        <><i className="bi bi-x-circle-fill me-2"></i>KHO KHÔNG ĐỦ VẬT TƯ</>
                                    ) : isBelowStandard ? (
                                        /* 💡 CHẶN ĐỨNG NẾU NHẬP LÙI SỐ */
                                        <><i className="bi bi-x-octagon-fill me-2"></i>LỖI: THỰC DÙNG ĐANG NHỎ HƠN ĐỊNH MỨC!</>
                                    ) : isBlockedByWastageNote ? (
                                        <><i className="bi bi-lock-fill me-2"></i>VUI LÒNG NHẬP GHI CHÚ HAO HỤT</>
                                    ) : (
                                        <><i className="bi bi-play-circle-fill me-2"></i>BẮT ĐẦU SẢN XUẤT</>
                                    )}
                                </button>
                            );
                        })()}

                    </div>
                </div>
            </div>
        </Layout>
    );
}