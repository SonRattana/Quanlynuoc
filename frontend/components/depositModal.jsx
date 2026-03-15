import React, { useState, useMemo, useEffect } from "react";
import api from "../src/utils/axios";

export default function DepositModal({ customer, onClose, onSuccess }) {
    const [quantity, setQuantity] = useState(1);
    const [amountPerUnit, setAmountPerUnit] = useState(0);
    const [defaultAmount, setDefaultAmount] = useState(0); // THÊM: Lưu giá gốc để so sánh
    const [note, setNote] = useState(""); // THÊM: Lưu ghi chú lý do đổi giá

    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem("token");
    const [deposits, setDeposits] = useState([]);
    const [productId, setProductId] = useState(null);
    const [currentBalance, setCurrentBalance] = useState(0);

    const formatMoney = (value) => {
        return Number(value).toLocaleString("vi-VN") + " đ";
    };

    const totalRefund = useMemo(() => {
        return quantity * amountPerUnit;
    }, [quantity, amountPerUnit]);

    useEffect(() => {
        if (!customer?.id) return;

        const fetchDeposits = async () => {
            try {
                const res = await api.get(
                    `api/customers/${customer.id}/deposit`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                setDeposits(res.data);

                if (res.data.length > 0) {
                    const firstProduct = res.data[0];
                    const unitPrice = firstProduct.deposit_money / firstProduct.bottles;

                    setProductId(firstProduct.product_id);
                    setAmountPerUnit(unitPrice);
                    setDefaultAmount(unitPrice); // Lưu giá gốc

                    const totalBalance = res.data.reduce(
                        (sum, item) => sum + Number(item.deposit_money),
                        0
                    );
                    setCurrentBalance(totalBalance);
                }
            } catch (err) {
                console.error("Lỗi lấy deposits");
            }
        };

        fetchDeposits();
    }, [customer?.id, token]);

    // Tìm xem khách đang giữ bao nhiêu vỏ của loại đang chọn
    const currentSelectedProduct = deposits.find(d => d.product_id === productId);
    const maxBottlesAllowed = currentSelectedProduct ? currentSelectedProduct.bottles : 0;

    // Kiểm tra xem giá có bị sửa khác với giá gốc không
    const isPriceChanged = amountPerUnit !== defaultAmount;

    const isInvalid =
        !productId ||
        quantity <= 0 ||
        quantity > maxBottlesAllowed ||
        amountPerUnit < 0 || // Cho phép = 0 (khách không lấy lại cọc)
        totalRefund < 0 ||
        totalRefund > currentBalance;
    (isPriceChanged && note.trim() === ""); // BẮT BUỘC: Nếu đổi giá thì phải có ghi chú

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
                    // note: isPriceChanged ? (note.trim() !== "" ? note : "Đổi giá cọc không ghi lý do") : "Hoàn vỏ bình thường"
                    note: isPriceChanged ? note : "Hoàn vỏ bình thường"
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            onSuccess();
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
                <div className="modal-dialog modal-sm">
                    <div className="modal-content shadow">

                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title">Hoàn tiền vỏ</h5>
                            <button className="btn-close btn-close-white" onClick={onClose}></button>
                        </div>

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
                                    className="form-select"
                                    value={productId || ""}
                                    onChange={(e) => {
                                        const selectedId = Number(e.target.value);
                                        setProductId(selectedId);

                                        const selectedItem = deposits.find(d => d.product_id === selectedId);
                                        if (selectedItem) {
                                            const unitPrice = selectedItem.deposit_money / selectedItem.bottles;
                                            setAmountPerUnit(unitPrice);
                                            setDefaultAmount(unitPrice); // Cập nhật lại giá gốc
                                            setQuantity(1);
                                            setNote(""); // Reset ghi chú
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
                                    className="form-control"
                                    min="1"
                                    max={maxBottlesAllowed}
                                    value={quantity}
                                    onChange={(e) => {
                                        const value = Number(e.target.value);
                                        setQuantity(value > 0 ? value : 1);
                                    }}
                                />
                                {quantity > maxBottlesAllowed && (
                                    <div className="text-danger small mt-1">
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
                                        const value = e.target.value; // Lấy giá trị chuỗi thô

                                        // Nếu người dùng xóa hết, cho phép nó thành ô trống
                                        if (value === "") {
                                            setAmountPerUnit("");
                                        } else {
                                            // Nếu có nhập số thì kiểm tra để không bị số âm
                                            setAmountPerUnit(Number(value) >= 0 ? Number(value) : 0);
                                        }
                                    }}
                                    // disabled
                                />
                            </div>

                            {/* TỰ ĐỘNG HIỆN Ô LÝ DO NẾU ĐỔI GIÁ */}
                            {isPriceChanged && (
                                <div className="mb-3">
                                    <label className="form-label text-danger fw-bold">
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

                            <div className="alert alert-info py-2">
                                <strong>Tổng hoàn:</strong>{" "}
                                {formatMoney(totalRefund)}
                            </div>

                            {totalRefund > currentBalance && (
                                <div className="text-danger small fw-bold">
                                    Không được hoàn vượt quá số dư hiện tại!
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={onClose}
                            >
                                Hủy
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={handleRefund}
                                disabled={isInvalid || loading}
                            >
                                {loading ? "Đang xử lý..." : "Xác nhận"}
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <div
                className="modal-backdrop fade show"
                onClick={onClose}
            ></div>
        </>
    );
}