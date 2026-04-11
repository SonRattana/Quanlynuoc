import { useEffect, useState } from "react";
import Layout from "../components/layout";
import api from "../src/utils/axios";
import Cart from "../components/cart";
import ProductList from "../components/productlist";
import Toast from "../components/Toast";
import React from "react";
import InvoiceModal from "../components/InvoiceModal";

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
    // const [collectDeposit, setCollectDeposit] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [customerDeposit, setCustomerDeposit] = useState(null);
    const [invoiceId, setInvoiceId] = useState(null);

    const formatMoney = (value) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(value);
    };

    // ================= FETCH PRODUCTS =================
    const fetchProducts = async () => {
        try {
            // MỚI: Gắn thêm đuôi ?warehouse_id=1 để báo backend lấy kho cửa hàng
            const res = await api.get(
                "api/products?warehouse_id=1",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setProducts(res.data);
        } catch (err) {
            console.log(err);
        }
    };

    // ================= SEARCH CUSTOMERS =================
    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (value.trim() === "") {
            setFilteredCustomers([]); // Nếu để trống thì ẩn danh sách gợi ý
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
        console.log(res.data);
        setCustomers(res.data.rows);
    };

    useEffect(() => {
        fetchProducts();
        fetchCustomers();
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
            setCart(
                cart.map((i) =>
                    i.id === product.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            );
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const increaseQty = (id) => {
        const product = products.find((p) => p.id === id);
        const cartItem = cart.find((i) => i.id === id);

        if (cartItem.quantity >= product.quantity) {
            setToast({ message: "Không đủ hàng trong kho", type: "danger" });
            return;
        }

        setCart(
            cart.map((item) =>
                item.id === id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            )
        );
    };

    const decreaseQty = (id) => {
        setCart(
            cart
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: item.quantity - 1 }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const changeQty = (id, value) => {
        if (value === "") {
            // Cho phép xóa rỗng tạm thời để gõ số mới
            setCart(cart.map((item) => item.id === id ? { ...item, quantity: "" } : item));
            return;
        }

        let num = parseInt(value, 10);
        if (isNaN(num) || num < 1) num = 1; // Chặn số âm, chữ

        const product = products.find((p) => p.id === id);
        if (num > product.quantity) {
            setToast({ message: `Chỉ còn ${product.quantity} sản phẩm trong kho`, type: "danger" });
            num = product.quantity; // Ép về mức tồn kho tối đa
        }

        setCart(cart.map((item) => item.id === id ? { ...item, quantity: num } : item));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter((item) => item.id !== id));
    };

    const total = cart.reduce(
        (sum, item) => sum + item.sell_price * item.quantity,
        0
    );

    // ================= CUSTOMER CHANGE =================
    const handleCustomerChange = async (e) => {
        const id = e.target.value;

        setSelectedCustomer(id);
        // localStorage.setItem("selectedCustomer", id);

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

    // ================= CHECKOUT MỚI =================
    // Lưu ý: Nhận thêm 2 tham số truyền từ component Cart.jsx sang
    const handleCheckout = async (cartWithDeposits, grandTotal) => {
        if (!selectedCustomer) {
            setToast({ message: "Vui lòng chọn khách hàng", type: "danger" });
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
                    // Truyền cục data mới: Gồm thông tin mua và thông tin cọc vỏ
                    items: cartWithDeposits.map((i) => ({
                        product_id: i.id,
                        quantity: i.quantity, // Số nước mua
                        sell_price: i.sell_price, // <--- BẮT BUỘC THÊM LẠI DÒNG NÀY ĐỂ TÍNH TIỀN NƯỚC
                        returned_bottles: i.returned, // Số vỏ khách đem trả
                        missing_bottles: i.missingBottles, // Số vỏ nợ thêm
                        deposit_fee: i.depositFee // Tiền cọc thu thêm
                    })),
                    customer_id: selectedCustomer,
                    total_amount: grandTotal // Tổng tiền phải thu (Nước + Cọc)
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const newInvoiceId = res.data.invoice_id;
            setInvoiceId(newInvoiceId);
            setToast({ message: "Thanh toán thành công", type: "success" });

            setCart([]);
            localStorage.removeItem("cart");
            setSelectedCustomer("");
            localStorage.removeItem("selectedCustomer");
            setCustomerDeposit(null);

            fetchProducts();

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
                    <div className="col-md-7">
                        {selectedCustomer ? (
                            <ProductList
                                products={products}
                                addToCart={addToCart}
                                formatMoney={formatMoney}
                            />) : (
                            <div className="text-center py-5">
                                <p className="text-muted" style={{ fontSize: '30px' }}>Vui lòng chọn khách hàng để hiển thị sản phẩm</p>
                            </div>
                        )}
                    </div>

                    {/* CART */}
                    <div className="col-md-5">

                        {/* <select
                            className="form-select mb-3"
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                        >


                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} - {c.phone}
                                </option>
                            ))}
                        </select> */}

                        <div className="mb-3 position-relative">
                            <div className="input-group shadow-sm">
                                <span className="input-group-text bg-primary text-white border-primary">
                                    <i className="bi bi-search"></i> {/* Đảm bảo anh đã cài bootstrap-icons */}
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


                            {/* Kết quả gợi ý (Dropdown mượt mà) */}
                            {filteredCustomers.length > 0 && (
                                <ul className="list-group position-absolute w-100 shadow-lg mt-1" style={{ zIndex: 1050, maxHeight: '250px', overflowY: 'auto' }}>
                                    {filteredCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                            style={{ cursor: 'pointer', padding: '12px' }}
                                            onClick={() => {
                                                // Giả lập sự kiện change cho handleCustomerChange
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
                            className="form-select mb-3 shadow-sm border-primary"
                            value={selectedCustomer}
                            onChange={handleCustomerChange}
                        >
                            <option value="">-- Chọn khách hàng --</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.customer_code} - {c.name} - {c.phone}
                                </option>
                            ))}
                        </select>
                        {selectedCustomer && (
                            <>
                                {customerDeposit && customerDeposit.length > 0 && (
                                    <div className="deposit-box mb-3">
                                        <details className="border rounded bg-light p-2 shadow-sm">
                                            <summary
                                                className="fw-bold text-primary"
                                                style={{ cursor: "pointer", userSelect: "none" }}
                                            >
                                                {/* Tự động đếm tổng số vỏ và số loại sản phẩm khách đang giữ */}
                                                Khách đang giữ {customerDeposit.reduce((sum, item) => sum + Number(item.bottles), 0)} vỏ ({customerDeposit.length} loại)
                                            </summary>

                                            <div className="mt-2 pt-2 border-top">
                                                {customerDeposit.map((item, index) => (
                                                    <div
                                                        key={index}
                                                        className={`d-flex justify-content-between align-items-center ${index !== customerDeposit.length - 1 ? 'mb-2 pb-2 border-bottom' : ''}`}
                                                    >
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
                                />
                            </>
                        )}
                    </div>

                </div>
            </div>
        </Layout>
    );
}