import { useEffect, useState, useRef } from "react";
import Layout from "../components/layout";
import api from "../src/utils/axios";
import Cart from "../components/cart";
import Toast from "../components/Toast";
import React from "react";
import InvoiceModal from "../components/InvoiceModal";
import Pagination from "../components/Pagination";

export default function Sales() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem("cart");
        return savedCart ? JSON.parse(savedCart) : [];
    });
    const [toast, setToast] = useState(null);
    const token = localStorage.getItem("token");
    const [customers, setCustomers] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [shipper, setShipper] = useState("");
    const [unreturned, setUnreturned] = useState(0);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [customerDeposit, setCustomerDeposit] = useState(null);
    const [invoiceId, setInvoiceId] = useState(null);
    const [sortBy, setSortBy] = useState("DEFAULT");
    const [filterUnit, setFilterUnit] = useState("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const productListRef = useRef(null);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState("");

    const formatMoney = (value) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(value);
    };

    const uniqueUnits = [...new Set(products.map(p => p.unit).filter(Boolean))];
    let displayProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (filterUnit === "ALL" || p.unit === filterUnit)
    );
    if (sortBy === "PRICE_ASC") displayProducts.sort((a, b) => a.sell_price - b.sell_price);
    if (sortBy === "PRICE_DESC") displayProducts.sort((a, b) => b.sell_price - a.sell_price);
    if (sortBy === "NAME_ASC") displayProducts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "NAME_DESC") displayProducts.sort((a, b) => b.name.localeCompare(a.name));

    const totalPages = Math.ceil(displayProducts.length / itemsPerPage);
    const currentProducts = displayProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // ================= FETCH PRODUCTS =================
    const fetchProducts = async (warehouseId) => {
        try {
            if (!warehouseId) {
                setProducts([]);
                return;
            }
            const res = await api.get(`api/products?warehouse_id=${warehouseId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const sellableProducts = res.data.filter(p => Number(p.sell_price) > 0);
            setProducts(sellableProducts);
        } catch (err) {
            console.log(err);
            setToast({ message: "Lỗi tải hàng hóa theo kho!", type: "danger" });
        }
    };

    useEffect(() => {
        if (selectedWarehouse) {
            fetchProducts(selectedWarehouse);
        }
    }, [selectedWarehouse]);

    // ================= SEARCH CUSTOMERS =================
    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (value.trim() === "") {
            setFilteredCustomers([]);
            return;
        }

        const results = customers.filter(c =>
            c.name.toLowerCase().includes(value.toLowerCase()) ||
            c.phone.includes(value)
        );
        setFilteredCustomers(results);
    };

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cart));
    }, [cart]);

    // ================= FETCH CUSTOMERS =================
    const fetchCustomers = async () => {
        const res = await api.get("api/customers", {
            headers: { Authorization: `Bearer ${token}` },
        });
        setCustomers(res.data.rows);
    };

    const fetchWarehouses = async () => {
        const res = await api.get("api/stock/warehouses", { headers: { Authorization: `Bearer ${token}` } });
        const salesWarehouses = res.data.filter(w => {
            const name = (w.name || "").toLowerCase();
            return !name.includes("nguyên vật liệu") && !name.includes("tổng");
        });
        setWarehouses(salesWarehouses);
    };

    useEffect(() => {
        fetchProducts();
        fetchCustomers();
        fetchWarehouses();
    }, []);

    // ================= CART =================
    const addToCart = (product) => {
        if (product.quantity === 0) {
            setToast({ message: "Sản phẩm đã hết hàng", type: "danger" });
            return;
        }
        const exist = cart.find((i) => i.id === product.id);
        if (exist && exist.quantity >= product.quantity) {
            setToast({ message: "Số lượng vượt quá tồn kho", type: "danger" });
            return;
        }
        if (exist) {
            setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setCart([...cart, { ...product, quantity: 1, requires_deposit: product.requires_deposit }]);
        }
    };

    const increaseQty = (id) => {
        const product = products.find((p) => p.id === id);
        const cartItem = cart.find((i) => i.id === id);
        if (cartItem.quantity >= product.quantity) {
            setToast({ message: "Không đủ hàng trong kho", type: "danger" });
            return;
        }
        setCart(cart.map((item) => item.id === id ? { ...item, quantity: item.quantity + 1 } : item));
    };

    const decreaseQty = (id) => {
        setCart(cart.map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item).filter((item) => item.quantity > 0));
    };

    const changeQty = (id, value) => {
        if (value === "") {
            setCart(cart.map((item) => item.id === id ? { ...item, quantity: "" } : item));
            return;
        }
        let num = parseInt(value, 10);
        if (isNaN(num) || num < 1) num = 1;
        const product = products.find((p) => p.id === id);
        if (num > product.quantity) {
            setToast({ message: `Chỉ còn ${product.quantity} sản phẩm trong kho`, type: "danger" });
            num = product.quantity;
        }
        setCart(cart.map((item) => item.id === id ? { ...item, quantity: num } : item));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter((item) => item.id !== id));
    };

    const total = cart.reduce((sum, item) => {
        const isWholesale = item.wholesale_min_quantity > 0 && item.quantity >= item.wholesale_min_quantity;
        const appliedPrice = isWholesale ? item.wholesale_price : item.sell_price;
        return sum + (appliedPrice * item.quantity);
    }, 0);

    const handleCustomerChange = async (e) => {
        const id = e.target.value;
        setSelectedCustomer(id);
        if (!id) {
            setCustomerDeposit(null);
            return;
        }
        try {
            const res = await api.get(`api/customers/${id}/deposit`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomerDeposit(res.data);
        } catch (err) {
            console.log(err);
        }
    };

    // 💡 TÌM RA KHÁCH HÀNG ĐANG ĐƯỢC CHỌN (TRÁNH LỖI MÀN HÌNH TRẮNG)
    const customerInfo = customers.find(c => String(c.id) === String(selectedCustomer)) || null;

    // 💡 HỨNG THÊM BIẾN deliveryFee TỪ GIỎ HÀNG
    const handleCheckout = async (cartWithDeposits, grandTotal, totalUnreturned, deliveryFee, paidAmount) => {
        if (!selectedCustomer) {
            setToast({ message: "Vui lòng chọn khách hàng", type: "danger" });
            return;
        }
        if (!selectedWarehouse) {
            setToast({ message: "Vui lòng chọn Kho xuất bán!", type: "danger" });
            return;
        }
        if (cart.length === 0) {
            setToast({ message: "Giỏ hàng trống", type: "danger" });
            return;
        }

        try {
            const res = await api.post(
                "api/sales",
                {
                    items: cartWithDeposits.map((i) => {
                        const isWholesale = i.wholesale_min_quantity > 0 && i.quantity >= i.wholesale_min_quantity;
                        const appliedPrice = isWholesale ? i.wholesale_price : i.sell_price;
                        return {
                            product_id: i.id,
                            product_name: i.name,
                            quantity: i.quantity,
                            sell_price: appliedPrice,
                            returned_bottles: i.returned,
                            missing_bottles: i.missingBottles,
                            deposit_fee: i.depositFee
                        };
                    }),
                    customer_id: selectedCustomer,
                    customer_name: customerInfo?.name || "Quý khách",
                    email: customerInfo?.email || "",
                    address: customerInfo?.address || "",
                    shipper_name: shipper,
                    unreturned_bottles: totalUnreturned,
                    total_amount: grandTotal,
                    warehouse_id: selectedWarehouse, // Lấy đúng ID kho đang chọn
                    delivery_fee: deliveryFee, // 👈 GỬI PHÍ GIAO HÀNG LÊN API
                    paid_amount: paidAmount,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const newInvoiceId = res.data.invoice_id;
            setInvoiceId(newInvoiceId);
            setToast({ message: "Thanh toán thành công!", type: "success" });

            setCart([]);
            localStorage.removeItem("cart");
            setSelectedCustomer("");
            setCustomerDeposit(null);
            setShipper("");

            fetchProducts(selectedWarehouse); // Tải lại hàng kho hiện tại

        } catch (err) {
            setToast({
                message: err.response?.data?.message || "Lỗi thanh toán",
                type: "danger"
            });
        }
    };

    return (
        <Layout>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            {invoiceId && (
                <InvoiceModal
                    invoiceId={invoiceId}
                    onClose={() => setInvoiceId(null)}
                />
            )}
            <div className="pt-4 px-4 w-100">
                <h5 className="fw-bold mb-4">Bán hàng</h5>

                <div className="row">
                    {/* PRODUCT */}
                    <div className="col-md-7" ref={productListRef}>
                        {selectedCustomer ? (
                            <>
                                <div className="row g-2 mb-3 bg-white p-2 rounded shadow-sm border">
                                    <div className="col-md-6">
                                        <input type="text" className="form-control" placeholder="Tìm tên sản phẩm..."
                                            onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                    <div className="col-md-3">
                                        <select className="form-select" onChange={(e) => setFilterUnit(e.target.value)}>
                                            <option value="ALL">Loại</option>
                                            {uniqueUnits.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <select className="form-select" onChange={(e) => setSortBy(e.target.value)}>
                                            <option value="DEFAULT">Sắp xếp</option>
                                            <option value="NAME_ASC">Tên: A đến Z</option>
                                            <option value="NAME_DESC">Tên: Z đến A</option>
                                            <option value="PRICE_ASC">Giá tăng</option>
                                            <option value="PRICE_DESC">Giá giảm</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row g-2 mb-4">
                                    {currentProducts.map(product => {
                                        const isOutOfStock = product.quantity <= 0;
                                        return (

                                            <div className="col-12 col-md-4 col-lg-3" key={product.id}>
                                                <div
                                                    className={`card h-100 bg-white product-card border ${isOutOfStock ? 'out-of-stock' : ''}`}
                                                    style={{ transition: 'transform 0.2s, box-shadow 0.2s', borderRadius: '8px', cursor: isOutOfStock ? 'not-allowed' : 'pointer', overflow: 'hidden' }}
                                                >
                                                    <span className="badge bg-warning text-dark position-absolute top-0 end-0 m-1 z-index-2" style={{ fontSize: '10px' }}>{product.unit?.toUpperCase()}</span>

                                                    {/* 💡 ÉP CHIỀU CAO ẢNH CỐ ĐỊNH ĐỂ KHÔNG BỊ LỆCH FORM */}
                                                    <div className="img-container border-bottom position-relative" style={{ height: '110px', backgroundColor: '#fcfcfc' }}>
                                                        <img
                                                            src={product.image ? product.image : "/no-image.png"}
                                                            alt={product.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }}
                                                            onError={(e) => { e.target.src = "/no-image.png" }}
                                                        />
                                                        {isOutOfStock && <div className="position-absolute top-50 start-50 translate-middle badge bg-danger shadow" style={{ fontSize: '10px', width: '80%', whiteSpace: 'nowrap' }}>HẾT HÀNG</div>}
                                                    </div>

                                                    <div className="card-body d-flex flex-column p-2">
                                                        {/* 💡 ÉP TÊN SẢN PHẨM TỐI ĐA 2 DÒNG, CÒN LẠI BIẾN THÀNH DẤU ... */}
                                                        <div className="fw-bold mb-1" title={product.name} style={{
                                                            fontSize: '13px',
                                                            lineHeight: '1.4',
                                                            height: '36px',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {product.name}
                                                        </div>

                                                        {/* 💡 DÀN NGANG DUNG TÍCH VÀ TỒN KHO CHO ĐỠ TỐN CHỖ */}
                                                        <div className="d-flex justify-content-between align-items-center mb-1 mt-1">
                                                            <span className="text-muted small" style={{ fontSize: '11px' }}>
                                                                <i className="fa fa-flask"></i> {
                                                                    !product.volume ? "--" :
                                                                        isNaN(product.volume) ? product.volume :
                                                                            (Number(product.volume) > 30 ? `${product.volume}ml` : `${product.volume}L`)
                                                                }
                                                            </span>
                                                            <span className="text-muted small" style={{ fontSize: '11px' }}>
                                                                <i className="fa fa-cubes"></i> Tồn: {product.quantity}
                                                            </span>
                                                        </div>

                                                        <p className="text-danger fw-bold mb-2 mt-1" style={{ fontSize: '14px' }}>{formatMoney(product.sell_price)}</p>

                                                        {/* 💡 NÚT THÊM ÉP FULL 100% CHIỀU NGANG ĐỂ DỄ BẤM BẰNG NGÓN TAY */}
                                                        <button
                                                            className={`btn mt-auto w-100 ${isOutOfStock ? 'btn-secondary' : 'btn-outline-primary fw-bold'}`}
                                                            onClick={() => !isOutOfStock && addToCart(product)}
                                                            disabled={isOutOfStock}
                                                            style={{ padding: '6px 0', fontSize: '13px' }}
                                                        >
                                                            {isOutOfStock ? "Tạm hết" : <><i className="fa fa-cart-plus me-1"></i>Thêm</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-3">
                                    <Pagination page={currentPage} totalPages={totalPages} setPage={setCurrentPage} />
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-5">
                                <p className="text-muted" style={{ fontSize: '20px' }}>Vui lòng chọn khách hàng để hiển thị sản phẩm</p>
                            </div>
                        )}
                    </div>

                    {/* CART AREA */}
                    <div className="col-md-5">
                        <div className="mb-3 position-relative">
                            <div className="input-group shadow-sm">
                                <span className="input-group-text bg-primary text-white border-primary">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-primary"
                                    placeholder="Tìm tên hoặc SĐT khách..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    style={{ fontWeight: '500' }}
                                />
                                {searchTerm && (
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => { setSearchTerm(""); setFilteredCustomers([]); }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {filteredCustomers.length > 0 && (
                                <ul className="list-group position-absolute w-100 shadow-lg mt-1" style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto' }}>
                                    {filteredCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                            style={{ cursor: 'pointer', padding: '12px' }}
                                            onClick={() => {
                                                handleCustomerChange({ target: { value: c.id } });
                                                setSearchTerm(c.name);
                                                setFilteredCustomers([]);
                                            }}
                                        >
                                            <div>
                                                <div className="fw-bold text-dark">{c.name}</div>
                                                <small className="text-muted">{c.phone} • {c.customer_code}</small>
                                            </div>
                                            <span className="badge bg-primary rounded-pill">Chọn</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <select
                            className="form-select mb-3 shadow-sm border-danger fw-bold text-danger"
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                        >
                            <option value="">-- CHỌN KHO XUẤT HÀNG --</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select mb-3 shadow-sm border-primary"
                            value={selectedCustomer}
                            onChange={handleCustomerChange}
                        >
                            <option value="">-- Chọn khách hàng --</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.customer_code || `KH${c.id}`} - {c.name} - {c.phone}
                                </option>
                            ))}
                        </select>

                        {selectedCustomer && (
                            <>
                                {customerDeposit && customerDeposit.length > 0 && (
                                    <div className="deposit-box mb-3">
                                        <details className="border rounded bg-light p-2 shadow-sm">
                                            <summary className="fw-bold text-primary" style={{ cursor: "pointer", userSelect: "none" }}>
                                                Khách đang giữ {customerDeposit.reduce((sum, item) => sum + Number(item.bottles), 0)} vỏ ({customerDeposit.length} loại)
                                            </summary>

                                            <div className="mt-2 pt-2 border-top">
                                                {customerDeposit.map((item, index) => (
                                                    <div key={index} className={`d-flex justify-content-between align-items-center ${index !== customerDeposit.length - 1 ? 'mb-2 pb-2 border-bottom' : ''}`}>
                                                        <div>
                                                            <span className="fw-bold d-block text-dark">{item.name}</span>
                                                            <span className="text-muted small">Đang giữ: {item.bottles} vỏ</span>
                                                        </div>
                                                        <div className="text-danger fw-bold small">
                                                            {formatMoney(item.deposit_money)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    </div>
                                )}

                                {/* 💡 ĐÃ TRUYỀN THÊM BIẾN customerInfo VÀO CART */}
                                <Cart
                                    cart={cart}
                                    increaseQty={increaseQty}
                                    decreaseQty={decreaseQty}
                                    changeQty={changeQty}
                                    removeFromCart={removeFromCart}
                                    total={total}
                                    formatMoney={formatMoney}
                                    handleCheckout={handleCheckout}
                                    selectedCustomer={selectedCustomer}
                                    customerDeposit={customerDeposit}
                                    shipper={shipper} setShipper={setShipper}
                                    unreturned={unreturned} setUnreturned={setUnreturned}
                                    customerInfo={customerInfo}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}