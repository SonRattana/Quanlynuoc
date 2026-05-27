import React from "react";

export default function ProductList({ products, addToCart, formatMoney }) {
    return (
        <div className="bg-white shadow-sm p-4 rounded-3 border">
            <h6 className="fw-bold mb-4 text-primary d-flex align-items-center">
                <i className="bi bi-grid-3x3-gap-fill me-2 fs-5"></i>
                DANH SÁCH SẢN PHẨM
            </h6>

            <div className="d-flex flex-wrap gap-3 justify-content-start">
                {products && products.length > 0 ? (
                    products.map((p) => {
                        const isOutOfStock = p.quantity <= 0;
                        
                        return (
                            <button
                                key={p.id}
                                className="btn btn-light border p-2 text-start position-relative d-flex flex-column align-items-center product-item-btn"
                                style={{ 
                                    width: "155px", 
                                    borderRadius: '12px',
                                    transition: "all 0.25s ease",
                                    backgroundColor: isOutOfStock ? '#fdfdfe' : '#fff',
                                    border: '1px solid #eee'
                                }}
                                onClick={() => addToCart(p)}
                                disabled={isOutOfStock}
                            >
                                {/* KHUNG HIỂN THỊ ẢNH */}
                                <div style={{ 
                                    width: '100%', 
                                    height: '110px', 
                                    overflow: 'hidden', 
                                    borderRadius: '8px',
                                    backgroundColor: '#f8f9fa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        // src={p.image ? `${import.meta.env.VITE_BASE_URL}${p.image}` : "https://via.placeholder.com/120?text=No+Image"} 
                                        src={p.image ? p.image : "https://via.placeholder.com/120?text=No+Image"} 
                                        alt={p.name}
                                        style={{
                                            maxWidth: '100%', 
                                            maxHeight: '100%', 
                                            objectFit: 'contain', 
                                            filter: isOutOfStock ? 'grayscale(1) opacity(0.5)' : 'none'
                                        }}
                                        onError={(e) => { e.target.src = "https://via.placeholder.com/120?text=Error"; }}
                                    />
                                </div>

                                {/* THÔNG TIN CHI TIẾT */}
                                <div className="fw-bold text-center w-100 text-truncate mt-2 px-1" title={p.name} style={{ fontSize: '0.95rem', color: '#333' }}>
                                    {p.name}
                                </div>

                                <div className="small text-muted text-center w-100 mb-1">
                                    {p.volume >= 1000 ? `${p.volume / 1000}L` : `${p.volume}ml`} - <span className="text-uppercase">{p.unit}</span>
                                </div>

                                <div className={`badge ${isOutOfStock ? 'bg-danger' : 'bg-info text-dark'} mb-2`} style={{ fontSize: '0.75rem' }}>
                                    {isOutOfStock ? "HẾT HÀNG" : `Kho: ${p.quantity}`}
                                </div>

                                <div className="fw-bold text-danger mt-auto" style={{ fontSize: '1.15rem' }}>
                                    {formatMoney(p.sell_price)}
                                </div>
                                
                                {/* NHÃN PHỤ GÓC TRÊN */}
                                {isOutOfStock && (
                                     <div className="position-absolute top-0 end-0 bg-danger text-white px-2 py-1 shadow-sm" 
                                          style={{ fontSize: '0.65rem', borderTopRightRadius: '10px', borderBottomLeftRadius: '10px', fontWeight: 'bold' }}>
                                         HẾT
                                     </div>
                                )}
                            </button>
                        );
                    })
                ) : (
                    <div className="text-center w-100 py-5 bg-light rounded-3 border border-dashed">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted fw-bold">Đang tải danh sách nước uống, bạn xíu nhé.</p>
                    </div>
                )}
            </div>

            {/* STYLE ĐỘ THÊM CHO MƯỢT */}
            <style>{`
                .product-item-btn:hover:not(:disabled) {
                    border-color: #0d6efd !important;
                    box-shadow: 0 8px 15px rgba(13, 110, 253, 0.15) !important;
                    transform: translateY(-5px);
                }
                .product-item-btn:active:not(:disabled) {
                    transform: scale(0.92);
                }
                .product-item-btn:disabled {
                    cursor: not-allowed;
                    border-color: #ddd !important;
                }
            `}</style>
        </div>
    );
}