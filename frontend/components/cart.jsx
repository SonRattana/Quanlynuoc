import React, { useState, useEffect } from "react";

export default function Cart({
    cart,
    increaseQty,
    decreaseQty,
    changeQty,
    removeFromCart,
    total,
    formatMoney,
    handleCheckout,
    selectedCustomer,
    customerDeposit,
    shipper,
    setShipper,
    unreturned,
    setUnreturned,
    customerInfo
}) {
    const [returnedBottles, setReturnedBottles] = useState({});
    // Cứ khách mua bao nhiêu thì mặc định điền sẵn bấy nhiêu, thu ngân có thể sửa lại
    const [amountPaid, setAmountPaid] = useState("");

    // 💡 STATE LƯU PHÍ SHIP VÀ HÌNH THỨC NHẬN HÀNG (Cho phép thu ngân tự đổi)
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [deliveryType, setDeliveryType] = useState("pickup"); // Mặc định là tự lấy

    // Reset và Lấy mặc định khi đổi khách hàng
    useEffect(() => {
        setReturnedBottles({});
        setDeliveryFee(0);
        setShipper("");

        // Tự động gán hình thức theo DB của khách, nhưng thu ngân vẫn có thể tự chọn lại
        if (customerInfo && customerInfo.delivery_method === "giao_hang") {
            setDeliveryType("delivery");
        } else {
            setDeliveryType("pickup");
        }
    }, [selectedCustomer, customerInfo]);

    // Hàm cập nhật số vỏ đổi
    const handleReturnChange = (id, value, maxQty) => {
        let val = parseInt(value, 10);
        if (isNaN(val) || val < 0) {
            val = 0;
        } else if (val > maxQty) {
            val = maxQty;
        }
        setReturnedBottles(prev => ({ ...prev, [id]: val }));
    };

    let totalDeposit = 0;

    const cartWithDeposits = cart.map(item => {
        let returned = returnedBottles[item.id] || 0;
        if (item.requires_deposit !== 1) {
            return { ...item, returned: 0, missingBottles: 0, depositFee: 0, maxAllowed: 0 };
        }
        const heldBottles = customerDeposit?.find(d => d.product_id === item.id)?.bottles || 0;
        const maxAllowed = Math.min(item.quantity, heldBottles);

        if (returned > maxAllowed) returned = maxAllowed;

        const missingBottles = Math.max(0, item.quantity - returned);
        const depositPrice = item.deposit_price || 50000;
        const depositFee = missingBottles * depositPrice;

        totalDeposit += depositFee;

        return { ...item, returned, missingBottles, depositFee, maxAllowed };
    });

    // 💡 KIỂM TRA HÌNH THỨC THU NGÂN CHỌN ĐỂ TÍNH TIỀN
    const isDelivery = deliveryType === "delivery";
    const finalDeliveryFee = isDelivery ? (Number(deliveryFee) || 0) : 0;

    // Tổng tiền cuối cùng = Tiền nước + Tiền cọc + Phí giao hàng
    const grandTotal = total + totalDeposit + finalDeliveryFee;
    useEffect(() => {
        if (grandTotal > 0) {
            setAmountPaid(grandTotal);
        } else {
            setAmountPaid("");
        }
    }, [grandTotal]);
    return (
        <div className="bg-white shadow-sm p-4 border rounded">

            {/* 💡 Ô CHO PHÉP THU NGÂN TỰ CHỌN HÌNH THỨC GIAO HÀNG */}
            <div className="mb-3 bg-light p-2 rounded border-start border-4 border-primary">
                <label className="fw-bold text-secondary mb-1">Hình thức nhận hàng:</label>
                <select
                    className="form-select border-primary fw-bold text-primary"
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                >
                    <option value="pickup">🚶 Khách tự đến lấy (Không phí ship)</option>
                    <option value="delivery">🛵 Giao hàng tận nơi (Có phí ship)</option>
                </select>
            </div>

            <h6 className="fw-bold mb-3">Giỏ hàng</h6>

            {cartWithDeposits.map((item) => (
                <div key={item.id} className="border-bottom pb-3 mb-3">
                    <div className="row align-items-center mb-2">
                        <div className="col-4 fw-bold">{item.name}</div>

                        <div className="col-4 d-flex align-items-center">
                            <button className="btn btn-sm btn-secondary" onClick={() => decreaseQty(item.id)}>-</button>
                            <input
                                type="number"
                                className="form-control form-control-sm text-center mx-2 fw-bold"
                                style={{ width: "60px", WebkitAppearance: "none" }}
                                min="1"
                                value={item.quantity}
                                onChange={(e) => changeQty(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
                                    const isNumber = /^[0-9]$/.test(e.key);
                                    const isShortcut = e.ctrlKey || e.metaKey;
                                    if (!isNumber && !allowedKeys.includes(e.key) && !isShortcut) {
                                        e.preventDefault();
                                    }
                                }}
                            />
                            <button className="btn btn-sm btn-secondary" onClick={() => increaseQty(item.id)}>+</button>
                        </div>

                        <div className="col-3 text-end">
                            {formatMoney(item.sell_price * (Number(item.quantity) || 0))}
                        </div>

                        <div className="col-1 text-end">
                            <button className="btn btn-sm btn-danger" onClick={() => removeFromCart(item.id)}>X</button>
                        </div>
                    </div>

                    {item.requires_deposit === 1 && (
                        <div className="row align-items-center bg-light p-2 rounded mx-0 mt-2">
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
                                />
                            </div>

                            {item.depositFee > 0 && (
                                <div className="col-12 text-danger small mt-2 text-end fw-bold">
                                    + Phụ thu cọc {item.missingBottles} vỏ: {formatMoney(item.depositFee)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            <hr />

            <div className="mt-3">
                <div className="d-flex justify-content-between mb-1 text-secondary">
                    <span>Tiền nước:</span>
                    <span>{formatMoney(total)}</span>
                </div>

                {totalDeposit > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                        <span>Tổng tiền cọc vỏ:</span>
                        <span>{formatMoney(totalDeposit)}</span>
                    </div>
                )}

                {/* 💡 Ô NHẬP PHÍ GIAO HÀNG (Chỉ hiện ra khi hộp chọn ở trên là Giao hàng) */}
                {isDelivery && (
                    <div className="d-flex justify-content-between mb-2 text-primary align-items-center">
                        <span className="fw-bold">Phí giao hàng:</span>
                        <input
                            type="number"
                            className="form-control form-control-sm text-end fw-bold border-primary shadow-sm"
                            style={{ width: '120px' }}
                            value={deliveryFee === 0 ? "" : deliveryFee}
                            placeholder="0 đ"
                            onChange={(e) => setDeliveryFee(e.target.value)}
                        />
                    </div>
                )}

                <h5 className="fw-bold d-flex justify-content-between border-top pt-2 mt-2">
                    <span>Tổng thanh toán:</span>
                    <span className="text-success">{formatMoney(grandTotal)}</span>
                </h5>

                {/* 💡 1. CẢNH BÁO NỢ CŨ CỦA KHÁCH HÀNG */}
                {customerInfo && Number(customerInfo.debt_balance) > 0 && (
                    <div className="alert alert-danger p-2 mt-2 mb-2 border-danger border-start border-4 d-flex align-items-center shadow-sm">
                        <i className="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
                        <div>
                            <span className="d-block fw-bold" style={{ fontSize: '0.85rem' }}>KHÁCH ĐANG CÓ NỢ CŨ:</span>
                            <span className="fs-5 fw-bold">{formatMoney(customerInfo.debt_balance)}</span>
                        </div>
                    </div>
                )}

                {/* 💡 2. KHU VỰC NHẬP SỐ TIỀN KHÁCH ĐƯA */}
                <div className="bg-light p-2 rounded mt-2 border border-secondary shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold text-dark">Khách đưa:</span>
                        <input
                            type="number"
                            className="form-control form-control-sm text-end fw-bold text-primary border-primary"
                            style={{ width: '130px', fontSize: '1.1rem' }}
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            onClick={(e) => e.target.select()} // Bấm vào tự bôi đen để gõ đè cho nhanh
                        />
                    </div>

                    {/* 💡 3. TỰ ĐỘNG TÍNH TIỀN THỪA HOẶC TIỀN THIẾU (GHI NỢ) */}
                    {amountPaid !== "" && Number(amountPaid) >= grandTotal ? (
                        <div className="d-flex justify-content-between align-items-center text-success">
                            <span className="small fw-bold">Tiền thối lại:</span>
                            <span className="fw-bold">{formatMoney(Number(amountPaid) - grandTotal)}</span>
                        </div>
                    ) : (
                        <div className="d-flex justify-content-between align-items-center text-danger">
                            <span className="small fw-bold">Còn thiếu (Ghi nợ):</span>
                            <span className="fw-bold">{formatMoney(grandTotal - Number(amountPaid))}</span>
                        </div>
                    )}
                </div>

                <div className="bg-light p-3 rounded mb-3 border mt-3">
                    {isDelivery && (
                        <div className="mb-2">
                            <label className="small fw-bold text-muted">Người giao hàng:</label>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Tên nhân viên..."
                                value={shipper}
                                onChange={(e) => setShipper(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label className="small fw-bold text-muted">Tổng vỏ khách nợ đơn này:</label>
                        <div className="form-control form-control-sm bg-light fw-bold text-danger">
                            {cartWithDeposits.reduce((sum, item) => sum + item.missingBottles, 0)} vỏ
                        </div>
                    </div>
                </div>

                {/* 💡 4. TRUYỀN THÊM amountPaid VÀO HÀM CHECKOUT ĐỂ BACKEND LƯU */}
                <button
                    className="btn btn-success w-100 mt-2 fw-bold fs-5 shadow-sm py-2"
                    disabled={!selectedCustomer || cart.length === 0}
                    onClick={() => {
                        const totalUnreturned = cartWithDeposits.reduce((sum, item) => sum + item.missingBottles, 0);
                        // Nhét thêm amountPaid vào cuối hàm handleCheckout
                        handleCheckout(cartWithDeposits, grandTotal, totalUnreturned, finalDeliveryFee, Number(amountPaid) || 0);
                    }}
                >
                    <i className="bi bi-cart-check-fill me-2"></i>Thanh toán hóa đơn
                </button>
            </div>
        </div>
    );
}
