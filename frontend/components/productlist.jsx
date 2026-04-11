import React from "react";
export default function ProductList({ products, addToCart, formatMoney }) {
    return (
        <div className="bg-white shadow-sm p-4">
            <h6 className="fw-bold mb-3">Danh sách sản phẩm</h6>

            {products.map((p) => (
                <button
                    key={p.id}
                    className="btn btn-light border m-2 p-3 text-start"
                    style={{ width: "200px" }}
                    onClick={() => addToCart(p)}
                    disabled={p.quantity === 0}
                >
                    <div className="fw-bold">{p.name}</div>

                    <div className="small text-muted">
                        {p.volume} ml - {p.unit}
                    </div>

                    <div
                        className={
                            p.quantity === 0
                                ? "text-danger fw-bold"
                                : "text-muted"
                        }
                    >
                        Tồn kho: {p.quantity}
                    </div>

                    <div className="fw-bold text-success mt-2">
                        {formatMoney(p.sell_price)}
                    </div>
                </button>
            ))}
        </div>
    );
}