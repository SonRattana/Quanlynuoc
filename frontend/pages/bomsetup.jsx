import React, { useEffect, useState } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";

function BomSetup() {
    const [toast, setToast] = useState(null);
    const [products, setProducts] = useState([]);     // Danh sách nước thành phẩm
    const [allMaterialsDb, setAllMaterialsDb] = useState([]);
    const [allowedMaterials, setAllowedMaterials] = useState([]);

    const [selectedProductId, setSelectedProductId] = useState("");
    const [formula, setFormula] = useState([]);       // Mảng chứa công thức hiện tại
    const [isLoading, setIsLoading] = useState(false);
    const token = localStorage.getItem("token");

    // LẤY DANH SÁCH THÀNH PHẨM KHI MỞ TRANG
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 💡 ĐÃ SỬA: Gọi đồng thời 2 API để lấy trọn kho 
                const [prodRes, allMatsRes] = await Promise.all([
                    api.get("api/bom/products", { headers: { Authorization: `Bearer ${token}` } }),
                    api.get("api/products?limit=1000", { headers: { Authorization: `Bearer ${token}` } }) // Lấy toàn kho
                ]);

                setProducts(prodRes.data);

                // Lọc riêng rổ Nguyên vật liệu từ toàn kho
                const fullMaterials = (allMatsRes.data.data || allMatsRes.data).filter(p => p.item_type === 'nguyen_lieu');

                // 💡 LƯU KHO BÁU NÀY VÀO TRONG MÁY
                // (Sếp nhớ kéo lên đầu file, khai báo thêm state này: const [allMaterialsDb, setAllMaterialsDb] = useState([]); )
                setAllMaterialsDb(fullMaterials);

            } catch (error) {
                console.error("Lỗi tải dữ liệu BOM:", error);
                setToast({ message: "Lỗi tải dữ liệu từ máy chủ", type: "danger" });
            }
        };
        fetchInitialData();
    }, []);

    // KHI SẾP CHỌN 1 SẢN PHẨM -> TẢI CÔNG THỨC & NGUYÊN LIỆU ĐÚNG SIZE
    useEffect(() => {
        if (!selectedProductId) {
            setFormula([]);
            setAllowedMaterials([]);
            return;
        }

        const fetchDataForProduct = async () => {
            setIsLoading(true);
            try {
                // Chỉ cần gọi API lấy công thức thôi, không thèm xài materials-for nữa!
                const formulaRes = await api.get(`api/bom/${selectedProductId}`, { headers: { Authorization: `Bearer ${token}` } });

                const cleanFormula = (formulaRes.data || []).map(item => ({
                    ...item,
                    quantity: Number(item.quantity)
                }));
                setFormula(cleanFormula);

                // 💡 BỘ LỌC THÔNG MINH BẰNG FRONTEND:
                // Tìm ra dung tích của cái chai đang chọn
                const currentProd = products.find(p => String(p.id) === String(selectedProductId));
                const currentVol = currentProd ? (currentProd.volume >= 1000 ? `${currentProd.volume / 1000}L` : `${currentProd.volume}ml`) : "";

                // Lấy rổ chứa toàn bộ vật tư ra mà tự lọc
                const smartFilteredMaterials = allMaterialsDb.filter(m => {
                    // 💡 HÀNG RÀO BẢO VỆ CHUẨN XÁC DỰA VÀO ĐƠN VỊ TÍNH
                    const isReturnableBottle = currentProd && ['bình', 'binh'].includes(currentProd.unit?.toLowerCase());

                    if (isReturnableBottle) {
                        const matName = String(m.name || "").toLowerCase();
                        // Chặn đứng: Vỏ, Nhãn, và Nắp
                        if (matName.includes("vỏ") || matName.includes("vo") ||
                            matName.includes("nhãn") || matName.includes("nhan") ||
                            matName.includes("nắp") || matName.includes("nap")) {
                            return false;
                        }
                    }

                    const sg = String(m.size_group || "").toLowerCase();
                    if (sg === "chung" || sg === "cum_nho") return true;
                    if (sg.includes(currentVol.toLowerCase())) return true;
                    if (String(m.name).toLowerCase().includes(currentVol.toLowerCase())) return true;
                    return false;
                });

                setAllowedMaterials(smartFilteredMaterials);

            } catch (error) {
                setToast({ message: "Lỗi tải dữ liệu chi tiết sản phẩm", type: "danger" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchDataForProduct();
    }, [selectedProductId]);

    // CÁC HÀM XỬ LÝ TRÊN LƯỚI CÔNG THỨC
    const handleAddRow = () => {
        setFormula([...formula, { material_id: "", quantity: 1 }]);
    };

    const handleRemoveRow = (indexToRemove) => {
        setFormula(formula.filter((_, index) => index !== indexToRemove));
    };

    const handleRowChange = (index, field, value) => {
        const newFormula = [...formula];
        newFormula[index][field] = value;
        setFormula(newFormula);
    };

    // LƯU CÔNG THỨC
    const handleSave = async () => {
        if (!selectedProductId) return setToast({ message: "Vui lòng chọn sản phẩm!", type: "warning" });

        const isValid = formula.every(item => item.material_id && item.quantity > 0);
        if (!isValid) return setToast({ message: "Vui lòng chọn nguyên vật liệu và số lượng hợp lệ (>0)", type: "warning" });

        try {
            await api.post(`api/bom/${selectedProductId}`, { materials: formula }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setToast({ message: "Đã lưu định mức sản xuất thành công!", type: "success" });
        } catch (error) {
            setToast({ message: "Lỗi khi lưu định mức", type: "danger" });
        }
    };

    // 💡 TÌM RA SẢN PHẨM ĐANG ĐƯỢC CHỌN VÀ NHẬN DIỆN ĐV TÍNH
    const selectedProduct = products.find(p => String(p.id) === String(selectedProductId));
    const isPackOrBox = selectedProduct && ['loc', 'lốc', 'LOC', 'LỐC', 'thùng', 'thung', 'THÙNG', 'THUNG', 'binh', 'bình', 'BINH', 'BÌNH',
        'nap', 'nắp', 'NAP', 'NẮP', 'nhan', 'nhãn', 'NHAN', 'NHÃN'
    ].includes(selectedProduct.unit?.toLowerCase());

    // 👇 CHÈN THÊM ĐOẠN NÀY ĐỂ NHẬN DIỆN BÌNH 20L DỰA VÀO TÊN SẢN PHẨM 👇
    const productName = selectedProduct ? (selectedProduct.name || "").toLowerCase() : "";
    const is20LProduct = productName.includes("20l") || productName.includes("20 lít") || productName.includes("20 lit") || productName.includes("20L")
        || productName.includes("20lít") || productName.includes("20 l") || productName.includes("20lit") || productName.includes("20 L");

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="pt-4 px-4 w-100 pb-5">
                <div className="bg-white shadow-sm p-4 rounded">
                    <h4 className="fw-bold text-primary mb-4">⚙️ Cài đặt Định mức Sản xuất (BOM)</h4>

                    {/* KHU VỰC CHỌN SẢN PHẨM */}
                    <div className="row mb-4 bg-light p-3 rounded border">
                        <div className="col-md-6">
                            <label className="form-label fw-bold">1. Chọn Nước Sản Phẩm cần cài đặt</label>
                            <select
                                className="form-select border-primary shadow-sm fw-bold"
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                            >
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        📦 {p.name} ({p.volume >= 1000 ? `${p.volume / 1000}L` : `${p.volume}ml`})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* KHU VỰC CÔNG THỨC */}
                    {selectedProductId && selectedProduct && (
                        <div className="border rounded p-4">
                            <h5 className="fw-bold mb-3 text-secondary">
                                2. Công thức sản xuất (Để làm ra 1 đơn vị sản phẩm này cần:)
                            </h5>

                            {/* 💡 CHỐT CHẶN CẢNH BÁO CHO LỐC/THÙNG */}
                            {isPackOrBox && (
                                <div className="alert alert-warning border-warning shadow-sm d-flex align-items-center p-3 mb-4">
                                    <i className="fa fa-exclamation-triangle fs-2 text-danger me-3"></i>
                                    <div>
                                        <span className="fw-bold text-danger">⚠️ LƯU Ý QUAN TRỌNG:</span> Mặt hàng này tính bằng <strong>[{selectedProduct.unit.toUpperCase()}]</strong>.<br />
                                        Nhân viên nhập số lượng nắp/vỏ/nhãn... tiêu hao tương ứng để đúc ra <strong>1 {selectedProduct.unit}</strong> nhé (Ví dụ: 24, 12, hoặc 4). Đừng gõ nhầm số 1 là kho trừ sai ráng chịu!
                                    </div>
                                </div>
                            )}

                            {/* 💡 ĐÃ FIX: CHỐT CHẶN CẢNH BÁO RIÊNG CHO BÌNH 20L/5L (Bao bì luân chuyển) */}
                            {(selectedProduct.unit?.toLowerCase() === 'bình' || selectedProduct.unit?.toLowerCase() === 'binh') && (
                                <div className="alert alert-info border-info border-2 shadow-sm d-flex align-items-center mb-4 p-3 rounded-3" role="alert">
                                    <i className="fa fa-lightbulb fs-2 text-info me-3"></i>
                                    <div className="mb-0 text-dark small">
                                        Tuyệt đối <b className="text-danger">KHÔNG</b> đưa các nguyên vật liệu luân chuyển (Vỏ bình, Nhãn, Nắp,...) vào công thức này vì chúng được thu hồi VỎ, súc rửa và dùng lại liên tục. Chỉ thêm các nguyên vật liệu tiêu hao 100% (Màng co,...). <br />

                                        <div className="mt-2 p-2 bg-white rounded border border-info border-opacity-50">
                                            <span className="fw-bold text-primary"><i className="fa fa-question-circle me-1"></i> Vậy khi nào kho mới bị trừ Vỏ / Nhãn?</span>
                                            <ul className="mb-1 mt-1 ps-3" style={{ listStyleType: "disc" }}>
                                                <li>Vỏ bình cũ bị nứt, lủng, bẹp phải vứt đi ➡️ Lấy <b>vỏ mới</b> ra xài bù.</li>
                                                <li>Nhãn cũ bị rách, tróc ➡️ Lấy <b>nhãn mới</b> dán thay thế.</li>
                                                <li>Sản xuất lô nước bằng vỏ mới tinh lần đầu tiên.</li>
                                            </ul>
                                            <i className="text-danger fw-bold">👉 Cách làm:</i> <i>Khi xảy ra các vụ việc trên(Vỏ nứt, nhãn rách,...), thủ kho sang trang <b>Quản lý Kho</b> ➡️ <b>Phiếu Nhập/ Xuất/ Cấp Phát</b> ➡️ Dùng form <b>Điều Chuyển / Xuất Hủy</b>
                                                để trừ đi số nguyên vật liệu (vỏ, nhãn, nắp, màn co,...) tương ứng.</i>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLoading ? (
                                <p className="text-center text-muted"><i className="fa fa-spinner fa-spin me-2"></i>Đang tải dữ liệu...</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-bordered align-middle text-center table-mobile-cards">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: "50%" }}>Nguyên vật liệu (Vỏ, nắp, nhãn...)</th>
                                                <th style={{ width: "30%" }}>Số lượng tiêu hao</th>
                                                <th style={{ width: "20%" }}>Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formula.length === 0 ? (
                                                <tr>
                                                    {/* Dòng báo trống này không cần data-label */}
                                                    <td colSpan="3" className="text-muted py-3 text-center">
                                                        Chưa có định mức nào được cài. Bấm "Thêm nguyên vật liệu" để bắt đầu!
                                                    </td>
                                                </tr>
                                            ) : (
                                                formula.map((item, index) => (
                                                    <tr key={index}>

                                                        {/* 💡 1. Gắn nhãn Nguyên vật liệu */}
                                                        <td data-label="Nguyên vật liệu">
                                                            <select
                                                                className="form-select fw-bold text-primary border-primary"
                                                                value={item.material_id}
                                                                onChange={(e) => handleRowChange(index, "material_id", e.target.value ? Number(e.target.value) : "")}
                                                            >
                                                                <option value="" disabled>-- Chọn vật tư (Đã lọc theo kích cỡ) --</option>
                                                                {allowedMaterials.map(m => {
                                                                    // 💡 LOGIC CHỐNG TRÙNG LẶP: Quét xem vật tư này đã nằm ở dòng KHÁC chưa
                                                                    const isSelectedElsewhere = formula.some((row, rowIndex) => rowIndex !== index && row.material_id === m.id);

                                                                    return (
                                                                        <option
                                                                            key={m.id}
                                                                            value={m.id}
                                                                            disabled={isSelectedElsewhere} // Khóa luôn không cho bấm
                                                                        >
                                                                            {m.name} (Tồn theo: {m.unit}) {isSelectedElsewhere ? " ⚠️ (Nguyên vật liệu đã được thêm vào công thức!)" : ""}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </td>

                                                        {/* 💡 2. Gắn nhãn Số lượng */}
                                                        <td data-label="Số lượng tiêu hao">
                                                            <div className="input-group d-flex justify-content-end justify-content-md-center">
                                                                <input
                                                                    type="number"
                                                                    className="form-control text-center fw-bold text-danger"
                                                                    style={{ maxWidth: "150px" }}
                                                                    min="0.0001" step="any"

                                                                    // 👇 ĐÃ FIX FE: Bỏ Number() để cho phép gõ dấu chấm thập phân siêu nhỏ trơn tru
                                                                    value={item.quantity}

                                                                    onFocus={(e) => e.target.select()}
                                                                    onChange={(e) => handleRowChange(index, "quantity", e.target.value)}
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* 💡 3. Gắn nhãn Hành động */}
                                                        <td data-label="Hành động">
                                                            <button
                                                                className="btn btn-sm btn-outline-danger fw-bold"
                                                                onClick={() => handleRemoveRow(index)}
                                                            >
                                                                <i className="fa fa-times me-1"></i> Xóa
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* CÁC NÚT ĐIỀU KHIỂN */}
                            <div className="d-flex justify-content-between mt-3">
                                <button className="btn btn-success fw-bold shadow-sm" onClick={handleAddRow}>
                                    <i className="fa fa-plus me-1"></i> Thêm nguyên vật liệu
                                </button>

                                <button className="btn btn-primary px-5 fw-bold shadow-sm" onClick={handleSave}>
                                    <i className="fa fa-save me-1"></i> LƯU CÔNG THỨC
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default BomSetup;