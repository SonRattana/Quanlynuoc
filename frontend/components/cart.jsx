import React, { useState, useEffect } from "react";

export default function Cart({
    cart,
    increaseQty,
    decreaseQty,
    changeQty,
    removeFromCart,
    total, // Đây là tổng tiền nước ban đầu
    formatMoney,
    handleCheckout,
    selectedCustomer,
    customerDeposit
}) {
    // State lưu trữ số vỏ khách mang đổi (trả) cho từng sản phẩm theo ID
    const [returnedBottles, setReturnedBottles] = useState({});

    // Reset lại số vỏ đổi mỗi khi chọn khách hàng khác
    useEffect(() => {
        setReturnedBottles({});
    }, [selectedCustomer]);

    // Hàm cập nhật số vỏ đổi
    const handleReturnChange = (id, value, maxQty) => {
        let val = parseInt(value, 10);

        if (isNaN(val) || val < 0) {
            val = 0; // Chặn số âm và chữ
        } else if (val > maxQty) {
            val = maxQty; // Chặn nhập lố số lượng
        }

        setReturnedBottles(prev => ({
            ...prev,
            [id]: val
        }));
    };

    // Tính toán lại giỏ hàng (thêm logic cọc vỏ)
    let totalDeposit = 0;

    const cartWithDeposits = cart.map(item => {
        let returned = returnedBottles[item.id] || 0;

        // TÌM SỐ VỎ KHÁCH ĐANG NỢ (GIỮ Ở NHÀ) CỦA SẢN PHẨM NÀY
        const heldBottles = customerDeposit?.find(d => d.product_id === item.id)?.bottles || 0;

        // CHỐT SỐ LƯỢNG TỐI ĐA ĐƯỢC TRẢ: 
        // Phải nhỏ hơn hoặc bằng số lượng mua, VÀ nhỏ hơn hoặc bằng số vỏ đang mượn
        const maxAllowed = Math.min(item.quantity, heldBottles);

        // Ép lại số returned nếu nó vượt quá maxAllowed (trường hợp user giảm số lượng mua)
        if (returned > maxAllowed) returned = maxAllowed;

        // Số vỏ thiếu cần phải thu cọc (mua - trả). Không cho phép âm.
        const missingBottles = Math.max(0, item.quantity - returned);

        // Lấy giá cọc từ DB (nếu có), không thì mặc định 50.000đ
        const depositPrice = item.deposit_price || 50000;
        const depositFee = missingBottles * depositPrice;

        totalDeposit += depositFee;

        return {
            ...item,
            returned,
            missingBottles,
            depositFee,
            maxAllowed
        };
    });

    // Tổng tiền cuối cùng khách phải trả
    const grandTotal = total + totalDeposit;

    return (
        <div className="bg-white shadow-sm p-4">
            <h6 className="fw-bold mb-3">Giỏ hàng</h6>

            {cartWithDeposits.map((item) => (
                <div key={item.id} className="border-bottom pb-3 mb-3">
                    {/* Dòng 1: Thông tin sản phẩm */}
                    <div className="row align-items-center mb-2">
                        <div className="col-4 fw-bold">{item.name}</div>

                        <div className="col-4 d-flex align-items-center">
                            <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => decreaseQty(item.id)}
                            >
                                -
                            </button>
                            <input
                                type="number"
                                className="form-control form-control-sm text-center mx-2 fw-bold"
                                style={{ width: "60px", WebkitAppearance: "none" }}
                                min="1"
                                value={item.quantity}
                                onChange={(e) => changeQty(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                    // 1. Danh sách các phím ĐƯỢC PHÉP bấm
                                    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

                                    // 2. Chỉ cho phép các số từ 0 đến 9
                                    const isNumber = /^[0-9]$/.test(e.key);

                                    // 3. Cho phép xài phím tắt (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X)
                                    const isShortcut = e.ctrlKey || e.metaKey;

                                    // Nếu KHÔNG phải số, KHÔNG phải phím điều khiển, KHÔNG phải phím tắt -> CHẶN NGAY
                                    if (!isNumber && !allowedKeys.includes(e.key) && !isShortcut) {
                                        e.preventDefault();
                                    }
                                }}
                            />
                            <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => increaseQty(item.id)}
                            >
                                +
                            </button>
                        </div>

                        <div className="col-3 text-end">
                            {formatMoney(item.sell_price * (Number(item.quantity) || 0))}
                        </div>

                        <div className="col-1 text-end">
                            <button
                                className="btn btn-sm btn-danger"
                                onClick={() => removeFromCart(item.id)}
                            >
                                X
                            </button>
                        </div>
                    </div>

                    {/* Dòng 2: Ô nhập vỏ và báo phụ thu cọc */}
                    <div className="row align-items-center bg-light p-2 rounded mx-0">
                        <div className="col-8 text-secondary small">
                            Số vỏ khách mang đổi:
                            {item.maxAllowed === 0 && (
                                <span className="text-danger d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                    (Khách không có vỏ để đổi)
                                </span>
                            )}
                        </div>
                        <div className="col-4 p-0">
                            <input
                                type="number"
                                className="form-control form-control-sm text-center"
                                min="0"
                                max={item.maxAllowed}
                                value={item.returned === 0 ? "" : item.returned}
                                placeholder="0"
                                onChange={(e) => handleReturnChange(item.id, e.target.value, item.maxAllowed)}
                                onKeyDown={(e) => {
                                    if (["-", "+", "e", "E", ".", ","].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                disabled={item.maxAllowed === 0}
                            />
                        </div>

                        {/* Chỉ hiển thị dòng này nếu khách nợ vỏ */}
                        {item.depositFee > 0 && (
                            <div className="col-12 text-danger small mt-2 text-end fw-bold">
                                + Phụ thu cọc {item.missingBottles} vỏ: {formatMoney(item.depositFee)}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            <hr />

            {/* Chi tiết tổng tiền */}
            <div className="mt-3">
                <div className="d-flex justify-content-between mb-1 text-secondary">
                    <span>Tiền nước:</span>
                    <span>{formatMoney(total)}</span>
                </div>
                <div className="d-flex justify-content-between mb-2 text-danger">
                    <span>Tổng tiền cọc vỏ:</span>
                    <span>{formatMoney(totalDeposit)}</span>
                </div>
                <h5 className="fw-bold d-flex justify-content-between border-top pt-2">
                    <span>Tổng thanh toán:</span>
                    <span className="text-success">{formatMoney(grandTotal)}</span>
                </h5>
            </div>

            <button
                className="btn btn-success w-100 mt-3"
                disabled={!selectedCustomer || cart.length === 0}
                onClick={() => handleCheckout(cartWithDeposits, grandTotal)}
            >
                Thanh toán
            </button>
        </div>
    );
}