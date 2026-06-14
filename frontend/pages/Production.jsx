import React, { useState, useEffect } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

export default function Production() {
    const [toast, setToast] = useState(null);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [warehouseId, setWarehouseId] = useState("2");
    const [quantity, setQuantity] = useState("");
    const [isProducing, setIsProducing] = useState(false);
    const [bomPreview, setBomPreview] = useState([]);
    const [shift, setShift] = useState("Ca 1");
    const [note, setNote] = useState("");

    const [operatingCosts, setOperatingCosts] = useState({
        dien: "",
        nuoc: "",
        luong: "",
        baoTri: "",
        khac: "",
        ghiChuKhac: "" // 💡 Thêm biến lưu ghi chú cho chi phí khác
    });

    const token = localStorage.getItem("token");

    useEffect(() => {
        const fetchPreview = async () => {
            if (!selectedProduct || Number(quantity) <= 0) {
                setBomPreview([]);
                return;
            }
            try {
                const res = await api.get(`api/production/preview-bom/${selectedProduct}?qty=${quantity}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBomPreview(res.data);
            } catch (err) { console.error("Lỗi dự báo", err); }
        };

        const timeoutId = setTimeout(() => fetchPreview(), 500);
        return () => clearTimeout(timeoutId);
    }, [selectedProduct, quantity]);

    const fetchGoods = async () => {
        try {
            const res = await api.get("api/production/finished-goods", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFinishedGoods(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchGoods(); }, []);

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Math.round(val || 0));

    const formatInputNumber = (num) => {
        if (!num) return "";
        return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const selectedProdData = finishedGoods.find(p => String(p.id) === String(selectedProduct));
    const unitDisplay = selectedProdData ? selectedProdData.unit : "Bình / Lốc / Lít";

    const handleMaterialChange = (idx, val) => {
        const newData = [...bomPreview];
        newData[idx].required_qty = Number(val);
        setBomPreview(newData);
    };

    const handleCostChange = (field, val) => {
        const numericString = String(val).replace(/[^0-9]/g, "");
        setOperatingCosts(prev => ({ ...prev, [field]: numericString }));
    };

    const getCostNum = (val) => Number(val) || 0;

    const totalExtraCost = getCostNum(operatingCosts.dien) +
        getCostNum(operatingCosts.nuoc) +
        getCostNum(operatingCosts.luong) +
        getCostNum(operatingCosts.baoTri) +
        getCostNum(operatingCosts.khac);

    const handleProduce = async () => {
        if (!selectedProduct) return setToast({ message: "Vui lòng chọn sản phẩm!", type: "warning" });
        // if (!warehouseId) return setToast({ message: "Vui lòng chọn Kho chứa!", type: "warning" });
        if (Number(quantity) <= 0) return setToast({ message: "Số lượng phải lớn hơn 0!", type: "warning" });

        setIsProducing(true);
        try {
            // let costDetails = [];
            // if (getCostNum(operatingCosts.dien) > 0) costDetails.push(`Điện: ${formatMoney(getCostNum(operatingCosts.dien))}`);
            // if (getCostNum(operatingCosts.nuoc) > 0) costDetails.push(`Nước: ${formatMoney(getCostNum(operatingCosts.nuoc))}`);
            // if (getCostNum(operatingCosts.luong) > 0) costDetails.push(`Lương: ${formatMoney(getCostNum(operatingCosts.luong))}`);
            // if (getCostNum(operatingCosts.baoTri) > 0) costDetails.push(`Bảo trì: ${formatMoney(getCostNum(operatingCosts.baoTri))}`);

            // // 💡 Gắn thêm phần ghi chú tự nhập vào chi phí Khác
            // if (getCostNum(operatingCosts.khac) > 0) {
            //     const ghiChu = operatingCosts.ghiChuKhac ? ` (${operatingCosts.ghiChuKhac})` : "";
            //     costDetails.push(`Khác${ghiChu}: ${formatMoney(getCostNum(operatingCosts.khac))}`);
            // }

            // let finalNote = note;
            // if (totalExtraCost > 0) {
            //     const costText = `[Phí Vận Hành: ${formatMoney(totalExtraCost)} (${costDetails.join(" + ")})]`;
            //     finalNote = note ? `${note} | ${costText}` : costText;
            // }

            const res = await api.post("api/production", {
                product_id: selectedProduct,
                quantity: Number(quantity),
                materials: bomPreview,
                note: note
            }, { headers: { Authorization: `Bearer ${token}` } });

            setToast({
                message: `Thành công! Đã nhập ${res.data.produced_qty} ${unitDisplay}.`,
                type: "success"
            });

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
            <div className="pt-4 px-4 w-100 d-flex justify-content-center pb-5">
                <div className="card shadow-lg border-0 mt-5" style={{ maxWidth: '800px', width: '100%', borderRadius: '15px' }}>
                    <div className="card-header bg-primary text-white text-center py-3" style={{ borderRadius: '15px 15px 0 0' }}>
                        <h4 className="mb-0 fw-bold"><i className="bi bi-gear-wide-connected me-2"></i> LỆNH SẢN XUẤT</h4>
                    </div>

                    <div className="card-body p-4 bg-light">
                        <div className="mb-4">
                            <label className="fw-bold text-secondary mb-2">1. Chọn loại nước cần bơm (Sản phẩm):</label>
                            <select
                                className="form-select form-select-lg border-primary shadow-sm"
                                value={selectedProduct}
                                onChange={(e) => setQuantity("") || setSelectedProduct(e.target.value)}
                            >
                                <option value="">-- Chọn sản phẩm --</option>
                                {finishedGoods.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} - Tồn kho: {p.quantity} {p.unit} (Giá vốn HT: {formatMoney(p.cost_price)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedProduct && (
                            <>
                                <div className="mb-4">
                                    <label className="fw-bold text-secondary mb-2">2. Chọn kho cất giữ sau khi bơm:</label>
                                    <select
                                        className="form-select form-select-lg border-success shadow-sm fw-bold text-success"
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                    >
                                        <option value="2">🏭 Kho Tổng Sản Phẩm</option>
                                    </select>
                                </div>

                                <div className="mb-4">
                                    <label className="fw-bold text-secondary mb-2">3. Số lượng sản xuất đợt này:</label>
                                    <div className="input-group input-group-lg shadow-sm">
                                        <input
                                            type="number"
                                            className="form-control fw-bold text-primary text-center"
                                            placeholder="Nhập số lượng..."
                                            min="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            onKeyDown={(e) => { if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault(); }}
                                        />
                                        <span className="input-group-text bg-white fw-bold text-muted text-uppercase">{unitDisplay}</span>
                                    </div>
                                </div>

                                {bomPreview.length > 0 && (
                                    <div className="mt-3 p-3 bg-white border border-danger rounded shadow-sm mb-4">
                                        <h6 className="fw-bold text-danger mb-2"><i className="bi bi-eye-fill me-2"></i>Dự kiến vật tư sẽ bị trừ:</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-bordered mb-0 align-middle text-center table-mobile-cards">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th className="text-start">Nguyên liệu</th>
                                                        <th>Thực tế cần dùng</th>
                                                        <th>Tồn kho</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bomPreview.map((item, idx) => (
                                                        <tr key={idx} className={item.current_stock < item.required_qty ? "table-danger" : ""}>
                                                            <td data-label="Nguyên vật Liệu" className="text-start fw-bold">{item.material_name}</td>
                                                            <td data-label="Cần Dùng" style={{ width: '150px' }}>
                                                                <div className="input-group input-group-sm shadow-sm">
                                                                    <input
                                                                        type="number"
                                                                        className="form-control text-center fw-bold text-primary"
                                                                        value={Math.round(item.required_qty)}
                                                                        onChange={(e) => handleMaterialChange(idx, e.target.value)}
                                                                        min="1"
                                                                    />
                                                                    <span className="input-group-text bg-light">{item.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td data-label="Tồn Kho" className="fw-bold text-dark">{item.current_stock} {item.unit}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <label className="fw-bold text-secondary mb-2">4.Ghi chú hao hụt:</label>
                                    <div className="row g-2">
                                        {/* <div className="col-md-3">
                                            <select
                                                className="form-select border-secondary shadow-sm fw-bold text-dark"
                                                value={shift}
                                                onChange={(e) => setShift(e.target.value)}
                                            >
                                                <option value="Ca 1">Ca 1 (Sáng)</option>
                                                <option value="Ca 2">Ca 2 (Chiều)</option>
                                                <option value="Ca 3">Ca 3 (Tối)</option>
                                                <option value="Tăng ca">Tăng ca</option>
                                            </select>
                                        </div> */}
                                        <div className="mb-4">
                                            <input
                                                type="text"
                                                className="form-control border-secondary shadow-sm"
                                                placeholder="Ghi chú hao hụt (nếu có). VD: Máy kẹt rách 5 màng co..."
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* <div className="mb-4 p-3 border border-warning rounded bg-white shadow-sm">
                                    <label className="fw-bold text-warning mb-3">
                                        <i className="bi bi-cash-coin me-2"></i>5. Chi phí vận hành phát sinh trực tiếp (Tạm tính ban ngày):
                                    </label>

                                    <div className="row g-3">
                                        <div className="col-md-3">
                                            <label className="small fw-bold text-muted mb-1">⚡ Tiền điện</label>
                                            <div className="input-group input-group-sm shadow-sm">
                                                <input type="text" className="form-control border-warning fw-bold text-dark text-end" placeholder="0"
                                                    value={formatInputNumber(operatingCosts.dien)} onChange={(e) => handleCostChange('dien', e.target.value)} />
                                                <span className="input-group-text bg-light text-muted fw-bold">VNĐ</span>
                                            </div>
                                        </div>

                                        <div className="col-md-3">
                                            <label className="small fw-bold text-muted mb-1">💧 Tiền nước</label>
                                            <div className="input-group input-group-sm shadow-sm">
                                                <input type="text" className="form-control border-warning fw-bold text-dark text-end" placeholder="0"
                                                    value={formatInputNumber(operatingCosts.nuoc)} onChange={(e) => handleCostChange('nuoc', e.target.value)} />
                                                <span className="input-group-text bg-light text-muted fw-bold">VNĐ</span>
                                            </div>
                                        </div> */}

                                        {/* <div className="col-md-4">
                                            <label className="small fw-bold text-muted mb-1">👷 Lương nhân công</label>
                                            <div className="input-group input-group-sm shadow-sm">
                                                <input type="text" className="form-control border-warning fw-bold text-dark text-end" placeholder="0" 
                                                    value={formatInputNumber(operatingCosts.luong)} onChange={(e) => handleCostChange('luong', e.target.value)} />
                                                <span className="input-group-text bg-light text-muted fw-bold">VNĐ</span>
                                            </div>
                                        </div> */}

                                        {/* <div className="col-md-6">
                                            <label className="small fw-bold text-muted mb-1">🔧 Sửa chữa, bảo trì máy</label>
                                            <div className="input-group input-group-sm shadow-sm">
                                                <input type="text" className="form-control border-warning fw-bold text-dark text-end" placeholder="0" 
                                                    value={formatInputNumber(operatingCosts.baoTri)} onChange={(e) => handleCostChange('baoTri', e.target.value)} />
                                                <span className="input-group-text bg-light text-muted fw-bold">VNĐ</span>
                                            </div>
                                        </div> */}

                                        {/* Ô Nhập Phát Sinh Khác (Clean lại cho gọn trên 1 dòng) */}
                                        {/* <div className="col-md-12">
                                            <label className="small fw-bold text-muted mb-1">💰 Phát sinh khác (Nếu có)</label>
                                            <div className="input-group input-group-sm shadow-sm">
                                                <input type="text" className="form-control border-warning fw-bold text-dark text-end" style={{ maxWidth: "180px" }} placeholder="0"
                                                    value={formatInputNumber(operatingCosts.khac)} onChange={(e) => handleCostChange('khac', e.target.value)} />
                                                <span className="input-group-text bg-light text-muted fw-bold border-end-0">VNĐ</span>
                                                <input
                                                    type="text"
                                                    className="form-control border-warning text-dark fst-italic"
                                                    placeholder="Tự nhập ghi chú (VD: Tiền mua cồn, bao tay...)"
                                                    value={operatingCosts.ghiChuKhac}
                                                    onChange={(e) => setOperatingCosts({ ...operatingCosts, ghiChuKhac: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="text-warning my-3" />
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-bold text-dark fs-6">Tổng chi phí cộng vào Giá Vốn tạm tính:</span>
                                        <span className="fw-bold text-danger fs-5">{formatMoney(totalExtraCost)}</span>
                                    </div> */}

                                    {/* 💡 DÒNG GHI CHÚ BẢO MẬT HIỂN THỊ CHO THỢ */}
                                    {/* <div className="mt-3 p-2 bg-light border-start border-4 border-info rounded shadow-sm">
                                        <small className="text-muted d-block fst-italic" style={{ fontSize: "12px" }}>
                                            <i className="bi bi-info-circle-fill text-info me-1"></i>
                                            <strong>Lưu ý:</strong> Tiền lương nhân công và khấu hao máy móc đã được hệ thống ẩn đi để bảo mật. Kế toán sẽ tự động cộng thêm các khoản này vào giá vốn thực tế vào cuối ngày.
                                        </small>
                                    </div> */}
                                {/* </div> */}
                            </>
                        )}

                        <button
                            className="btn btn-success btn-lg w-100 fw-bold shadow"
                            disabled={!selectedProduct || !quantity || isProducing}
                            onClick={handleProduce}
                        >
                            {isProducing ? "ĐANG XỬ LÝ..." : "BẮT ĐẦU SẢN XUẤT"}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}