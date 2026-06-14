import React, { useState, useMemo, useEffect } from "react";
import api from "../src/utils/axios";

export default function DepositModal({ customer, onClose, onSuccess }) {
    const [quantity, setQuantity] = useState(1);
    const [amountPerUnit, setAmountPerUnit] = useState(0);
    const [defaultAmount, setDefaultAmount] = useState(0); 
    const [note, setNote] = useState(""); 

    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem("token");
    const [deposits, setDeposits] = useState([]);
    const [productId, setProductId] = useState(null);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [isFetching, setIsFetching] = useState(true); // Thêm loading khi quét vỏ

    const formatMoney = (value) => {
        return Number(value).toLocaleString("vi-VN") + " đ";
    };

    const totalRefund = useMemo(() => {
        return quantity * amountPerUnit;
    }, [quantity, amountPerUnit]);

    useEffect(() => {
        if (!customer?.id) return;

        const fetchDeposits = async () => {
            setIsFetching(true);
            try {
                const res = await api.get(
                    `api/customers/${customer.id}/deposit`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                // 💡 LỌC SẠCH LỖI NaN: Chỉ lấy những loại vỏ còn nợ (số lượng > 0)
                const activeDeposits = res.data.filter(item => Number(item.bottles) > 0);
                
                setDeposits(activeDeposits);

                if (activeDeposits.length > 0) {
                    const firstProduct = activeDeposits[0];
                    const unitPrice = firstProduct.deposit_money / firstProduct.bottles;

                    setProductId(firstProduct.product_id);
                    setAmountPerUnit(unitPrice);
                    setDefaultAmount(unitPrice); 

                    const totalBalance = activeDeposits.reduce(
                        (sum, item) => sum + Number(item.deposit_money),
                        0
                    );
                    setCurrentBalance(totalBalance);
                } else {
                    setCurrentBalance(0);
                    setProductId(null);
                }
            } catch (err) {
                console.error("Lỗi lấy deposits");
            } finally {
                setIsFetching(false);
            }
        };

        fetchDeposits();
    }, [customer?.id, token]);

    const currentSelectedProduct = deposits.find(d => d.product_id === productId);
    const maxBottlesAllowed = currentSelectedProduct ? currentSelectedProduct.bottles : 0;

    const isPriceChanged = amountPerUnit !== defaultAmount;

    const isInvalid =
        !productId ||
        quantity <= 0 ||
        quantity > maxBottlesAllowed ||
        amountPerUnit < 0 || 
        totalRefund < 0 ||
        totalRefund > currentBalance || 
        (isPriceChanged && note.trim() === ""); 

    const handleRefund = async () => {
        if (isInvalid) return;

        try {
            setLoading(true);
            await api.post(
                "api/deposits/refund",
                {
                    customer_id: customer.id,
                    product_id: productId || null,
                    quantity: Number(quantity),
                    amount_per_unit: Number(amountPerUnit),
                    note: isPriceChanged ? note : "Hoàn vỏ bình thường"
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            // Cập nhật lại danh sách và đóng form
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            alert("Hoàn tiền thất bại");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal fade show d-block">
                <div className="modal-dialog modal-sm modal-dialog-centered">
                    <div className="modal-content shadow border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>

                        <div className="modal-header bg-primary text-white border-0">
                            <h5 className="modal-title fw-bold">Hoàn tiền vỏ</h5>
                            <button className="btn-close btn-close-white" onClick={onClose}></button>
                        </div>

                        {/* 💡 KIỂM TRA: NẾU ĐANG TẢI DỮ LIỆU */}
                        {isFetching ? (
                            <div className="modal-body text-center py-5">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="text-muted mt-2 small">Đang kiểm tra kho vỏ...</p>
                            </div>
                        ) : deposits.length === 0 ? (
                            /* 💡 GIAO DIỆN MỚI: NẾU KHÁCH KHÔNG NỢ VỎ HOẶC ĐÃ TRẢ HẾT */
                            <div>
                                <div className="modal-body text-center py-5">
                                    <i className="fa fa-check-circle text-success mb-3" style={{ fontSize: "4rem" }}></i>
                                    <h5 className="fw-bold text-success mb-1">Đã trả hết vỏ!</h5>
                                    <p className="text-muted small px-3">
                                        Khách hàng <strong>{customer.name}</strong> hiện không còn nợ vỏ bình nào.
                                    </p>
                                </div>
                                <div className="modal-footer border-0 bg-light justify-content-center">
                                    <button className="btn btn-secondary px-4 fw-bold shadow-sm" onClick={onClose}>
                                        Đóng cửa sổ
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* GIAO DIỆN CŨ: NẾU KHÁCH VẪN CÒN NỢ VỎ */
                            <div>
                                <div className="modal-body">
                                    <div className="mb-2">
                                        <strong>Khách:</strong> {customer.name}
                                    </div>

                                    <div className="mb-3">
                                        <strong>Số dư hiện tại:</strong>{" "}
                                        <span className="text-success fw-bold">
                                            {formatMoney(currentBalance)}
                                        </span>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Chọn loại vỏ khách trả</label>
                                        <select
                                            className="form-select border-primary"
                                            value={productId || ""}
                                            onChange={(e) => {
                                                const selectedId = Number(e.target.value);
                                                setProductId(selectedId);

                                                const selectedItem = deposits.find(d => d.product_id === selectedId);
                                                if (selectedItem) {
                                                    const unitPrice = selectedItem.deposit_money / selectedItem.bottles;
                                                    setAmountPerUnit(unitPrice);
                                                    setDefaultAmount(unitPrice); 
                                                    setQuantity(1);
                                                    setNote(""); 
                                                }
                                            }}
                                        >
                                            <option value="" disabled>-- Chọn vỏ cần trả --</option>
                                            {deposits.map((item, index) => (
                                                <option key={index} value={item.product_id}>
                                                    {item.name} (Đang giữ: {item.bottles} vỏ)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Số lượng trả</label>
                                        <input
                                            type="number"
                                            className="form-control fw-bold text-primary"
                                            min="1"
                                            max={maxBottlesAllowed}
                                            value={quantity}
                                            onChange={(e) => {
                                                const value = Number(e.target.value);
                                                setQuantity(value > 0 ? value : 1);
                                            }}
                                        />
                                        {quantity > maxBottlesAllowed && (
                                            <div className="text-danger small mt-1 fw-bold">
                                                <i className="fa fa-exclamation-circle me-1"></i>
                                                Khách chỉ nợ {maxBottlesAllowed} vỏ loại này.
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Tiền cọc mỗi bình</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="0"
                                            value={amountPerUnit}
                                            onChange={(e) => {
                                                const value = e.target.value; 
                                                if (value === "") {
                                                    setAmountPerUnit("");
                                                } else {
                                                    setAmountPerUnit(Number(value) >= 0 ? Number(value) : 0);
                                                }
                                            }}
                                        />
                                    </div>

                                    {isPriceChanged && (
                                        <div className="mb-3 p-2 bg-warning bg-opacity-10 border border-warning rounded">
                                            <label className="form-label text-danger fw-bold mb-1">
                                                Lý do thay đổi tiền cọc (*)
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control border-warning"
                                                placeholder="VD: Trừ 10k do móp vỏ..."
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="alert alert-info py-2 shadow-sm border-info">
                                        <strong className="text-dark">Tổng hoàn:</strong>{" "}
                                        <span className="fs-5 text-primary fw-bold">{formatMoney(totalRefund)}</span>
                                    </div>

                                    {totalRefund > currentBalance && (
                                        <div className="text-danger small fw-bold mt-2">
                                            <i className="fa fa-times-circle me-1"></i>
                                            Không được hoàn vượt quá số dư hiện tại!
                                        </div>
                                    )}

                                </div>

                                <div className="modal-footer bg-light border-0">
                                    <button className="btn btn-secondary fw-bold" onClick={onClose}>
                                        Hủy
                                    </button>

                                    <button
                                        className="btn btn-primary fw-bold px-4 shadow-sm"
                                        onClick={handleRefund}
                                        disabled={isInvalid || loading}
                                    >
                                        {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : null}
                                        {loading ? "Đang xử lý..." : "Xác nhận"}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <div className="modal-backdrop fade show" onClick={onClose}></div>
        </>
    );
}