import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../src/utils/axios";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix lỗi tàng hình icon con trỏ của Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// ==========================================
// THẦN CHÚ LỚN: DI CHUYỂN MAPCONTROLLER RA NGOÀI (Tạm thời không dùng đến)
// ==========================================
const MapController = ({ mapCenter, setMapCenter, mapPosition, setMapPosition, setCustomerInfo, setErrors, setToast, setIsTyping }) => {
    const map = useMapEvents({
        async click(e) {
            setIsTyping(false);
            setMapPosition(e.latlng);
            setToast({ message: "Đã ghim tọa độ giao hàng!", type: "success" });

            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1&accept-language=vi`);
                const data = await res.json();

                if (data && data.display_name) {
                    setCustomerInfo(prev => {
                        if (prev.address && /\d/.test(prev.address)) {
                            return prev;
                        }
                        return { ...prev, address: data.display_name };
                    });
                    setErrors(prev => ({ ...prev, address: null }));
                }
            } catch (error) {
                console.error("Lỗi vệ tinh định vị:", error);
            }
        },
        locationfound(e) {
            setMapCenter([e.latlng.lat, e.latlng.lng]);
            setMapPosition(e.latlng);
            setToast({ message: "Đã tự động định vị vị trí của bạn!", type: "success" });

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1&accept-language=vi`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.display_name) {
                        setCustomerInfo(prev => ({ ...prev, address: data.display_name }));
                    }
                }).catch(err => console.error(err));
        },
        locationerror(e) {
            console.error("Lỗi GPS:", e.message);
        }
    });

    useEffect(() => {
        if (mapCenter) {
            map.flyTo(mapCenter, 16, { animate: true, duration: 1.5 });
        }
    }, [mapCenter, map]);

    useEffect(() => {
        map.locate({ setView: false, maxZoom: 16 });
    }, [map]);

    return mapPosition === null ? null : (
        <Marker position={mapPosition}>
            <Popup>Vị trí nhận nước của bạn!</Popup>
        </Marker>
    );
};

export default function PublicShop() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);

    // State cho Lọc và Tìm kiếm
    const [searchTerm, setSearchTerm] = useState("");
    const [filterUnit, setFilterUnit] = useState("ALL");
    const [sortBy, setSortBy] = useState("DEFAULT");

    // State cho Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const productListRef = useRef(null);

    // State cho Form và Hiệu ứng
    const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", email: "", address: "", note: "" });
    const [errors, setErrors] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    const BACKEND_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

    // State cho bản đồ
    const [mapCenter, setMapCenter] = useState([9.9242, 106.3399]);
    const [mapPosition, setMapPosition] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const mapRef = useRef(null);

    // ==========================================
    // BỘ CẢM BIẾN LUỒNG GÕ CHỮ (ĐÃ TẮT ĐỂ KHÔNG CHẠY NGẦM)
    // ==========================================
    useEffect(() => {
        // Tạm thời return để ngắt hoàn toàn việc gọi API map
        return;

        /* ĐOẠN CODE CŨ ĐƯỢC GIỮ LẠI BÊN DƯỚI ĐỂ DÀNH
        if (!isTyping || !customerInfo.address.trim()) return;
        const delaySearch = setTimeout(async () => {
            // ... logic gọi API ...
        }, 1500);
        return () => clearTimeout(delaySearch);
        */
    }, [customerInfo.address, isTyping]);

    const handleLocateMe = () => {
        if (mapRef.current) {
            setToast({ message: "Đang rà quét vệ tinh GPS...", type: "info" });
            mapRef.current.locate({ setView: false, maxZoom: 16 });
        }
    };

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);
                if (user.role === 'customer') {
                    setCustomerInfo(prev => ({
                        ...prev,
                        name: user.name || "",
                        email: user.email || "",
                        phone: user.phone || ""
                    }));
                }
            } catch (e) { console.error("Lỗi đọc user"); }
        }

        const fetchProducts = async () => {
            setIsLoading(true);
            try {
                const res = await api.get("api/products?limit=1000");
                const data = res.data;
                setProducts(data.data || data);
            } catch (error) {
                console.error("Lỗi lấy sản phẩm:", error);
                setToast({ message: "Không thể tải danh sách sản phẩm", type: "danger" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const handleLogout = () => {
        if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setCurrentUser(null);
            setCustomerInfo({ name: "", phone: "", email: "", address: "", note: "" });
        }
    };

    const uniqueUnits = [...new Set(products.map(p => p.unit).filter(Boolean))];

    let displayProducts = [...products];
    if (searchTerm) displayProducts = displayProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterUnit !== "ALL") displayProducts = displayProducts.filter(p => p.unit === filterUnit);

    if (sortBy === "PRICE_ASC") displayProducts.sort((a, b) => a.sell_price - b.sell_price);
    if (sortBy === "PRICE_DESC") displayProducts.sort((a, b) => b.sell_price - a.sell_price);
    if (sortBy === "NAME_ASC") displayProducts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "NAME_DESC") displayProducts.sort((a, b) => b.name.localeCompare(a.name));

    const totalPages = Math.ceil(displayProducts.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentProducts = displayProducts.slice(indexOfFirstItem, indexOfLastItem);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterUnit, sortBy]);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        if (productListRef.current) {
            productListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.product_id === product.id);
        if (existing) {
            if (existing.buyQty >= product.quantity) {
                setToast({ message: `Kho chỉ còn ${product.quantity} sản phẩm!`, type: "warning" });
                return;
            }
            setCart(cart.map(item => item.product_id === product.id ? { ...item, buyQty: item.buyQty + 1 } : item));
        } else {
            setCart([...cart, { ...product, product_id: product.id, buyQty: 1 }]);
        }
        setToast({ message: `Đã thêm ${product.name} vào giỏ`, type: "success" });
    };

    const updateCartQty = (id, delta) => {
        const existingItem = cart.find(item => item.product_id === id);
        if (!existingItem) return;
        const newQty = existingItem.buyQty + delta;

        if (newQty <= 0) {
            if (window.confirm("Bạn muốn xóa sản phẩm này khỏi giỏ hàng?")) removeCartItem(id);
            return;
        }
        if (newQty > existingItem.quantity) {
            setToast({ message: `Kho chỉ còn đúng ${existingItem.quantity} sản phẩm!`, type: "warning" });
            return;
        }
        setCart(cart.map(item => item.product_id === id ? { ...item, buyQty: newQty } : item));
    };

    const removeCartItem = (id) => setCart(cart.filter(item => item.product_id !== id));
    const formatMoney = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/\D/g, "");
        setCustomerInfo({ ...customerInfo, phone: value });
        if (errors.phone) setErrors({ ...errors, phone: null });
    };

    const handleOrder = async (e) => {
        e.preventDefault();
        if (cart.length === 0) {
            setToast({ message: "Giỏ hàng đang trống bạn ơi!", type: "warning" });
            return;
        }

        let newErrors = {};
        if (!customerInfo.name.trim()) newErrors.name = "Vui lòng nhập họ và tên.";
        if (!customerInfo.address.trim()) newErrors.address = "Vui lòng nhập địa chỉ giao hàng.";

        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        if (!customerInfo.phone) {
            newErrors.phone = "Vui lòng nhập số điện thoại.";
        } else if (!phoneRegex.test(customerInfo.phone)) {
            newErrors.phone = "Số điện thoại không hợp lệ (VD: 0912345678).";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!customerInfo.email.trim()) {
            newErrors.email = "Vui lòng nhập email.";
        } else if (!emailRegex.test(customerInfo.email)) {
            newErrors.email = "Email không đúng định dạng (VD: khachhang@gmail.com).";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await api.post("api/orders/online", {
                customer_name: customerInfo.name,
                phone: customerInfo.phone,
                email: customerInfo.email,
                shipping_address: customerInfo.address,
                note: customerInfo.note,
                items: cart
            });

            setToast({ message: "🚀 " + res.data.message, type: "success" });
            setCart([]);
            setCustomerInfo({ ...customerInfo, address: "", note: "" });
            navigate(`/tracking/${res.data.order_id}`);

        } catch (error) {
            console.error("Lỗi khi bắn đơn:", error);
            const errorMsg = error.response?.data?.message || "Không kết nối được với Server.";
            setToast({ message: "❌ Lỗi: " + errorMsg, type: "danger" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container-fluid bg-light min-vh-100 py-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style>{`
                .product-card { transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; border-radius: 12px; }
                .product-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.15); border-color: #0d6efd !important; }
                .img-container { position: relative; width: 100%; padding-top: 100%; background: #fff; overflow: hidden; border-radius: 12px 12px 0 0;}
                .img-container img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; padding: 15px; transition: transform 0.3s ease; }
                .product-card:hover .img-container img { transform: scale(1.05); }
                .out-of-stock { opacity: 0.6; filter: grayscale(80%); pointer-events: none; }
                .unit-badge { position: absolute; top: 10px; right: 10px; z-index: 2; font-size: 0.8rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                .cart-qty-btn { width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: all 0.2s;}
                .cart-qty-btn:hover { background-color: #e9ecef; }
                .input-error { border-color: #dc3545 !important; background-color: #fff8f8 !important; box-shadow: 0 0 0 0.2rem rgba(220,53,69,.25) !important;}
                .error-text { color: #dc3545; font-size: 0.85rem; margin-top: 4px; display: block; font-weight: 500;}
                .btn-submit-order { transition: all 0.3s; }
                .btn-submit-order:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(220,53,69,0.3); }
            `}</style>

            <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 shadow-sm rounded-3 border px-md-4" style={{ position: 'relative', zIndex: 1050 }}>
                <h2 className="text-primary fw-bold m-0" style={{ cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <i className="fa fa-shopping-cart text-primary me-2"></i> MitaFresh
                </h2>
                <div>
                    {currentUser ? (
                        <div className="dropdown">
                            <button
                                className="btn btn-outline-primary fw-bold dropdown-toggle shadow-sm"
                                type="button"
                                id="userDropdown"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                            >
                                <i className="fa fa-user-circle me-1"></i> Xin chào, {currentUser.name}
                            </button>

                            <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-2" aria-labelledby="userDropdown">
                                <li>
                                    <button className="dropdown-item py-2" onClick={() => navigate("/lookup")}>
                                        <i className="fa fa-search me-2 text-info"></i> Tra cứu đơn hàng
                                    </button>
                                </li>
                                <li>
                                    <button className="dropdown-item py-2" onClick={() => navigate("/change-password")}>
                                        <i className="fa fa-key me-2 text-secondary"></i> Đổi mật khẩu
                                    </button>
                                </li>

                                {(currentUser.role === 'admin' || currentUser.role === 'user') && (
                                    <>
                                        <li><hr className="dropdown-divider" /></li>
                                        <li>
                                            <button className="dropdown-item py-2" onClick={() => navigate(currentUser.role === 'admin' ? "/dashboard" : "/sales")}>
                                                <i className={`fa ${currentUser.role === 'admin' ? 'fa-tachometer-alt' : 'fa-desktop'} me-2 text-warning`}></i>
                                                {currentUser.role === 'admin' ? "Trang quản trị Admin" : "Quản lý cửa hàng"}
                                            </button>
                                        </li>
                                    </>
                                )}

                                <li><hr className="dropdown-divider" /></li>
                                <li>
                                    <button className="dropdown-item py-2 text-danger fw-bold" onClick={handleLogout}>
                                        <i className="fa fa-sign-out-alt me-2"></i> Đăng xuất
                                    </button>
                                </li>
                            </ul>
                        </div>
                    ) : (
                        <button className="btn btn-primary fw-bold shadow-sm" onClick={() => navigate("/login")}>
                            <i className="fa fa-user me-2"></i> Đăng nhập
                        </button>
                    )}
                </div>
            </div>

            <div className="row g-4 px-md-4" ref={productListRef}>
                <div className="col-lg-8">
                    <div className="row g-2 mb-4 bg-white p-3 rounded shadow-sm border">
                        <div className="col-md-5">
                            <div className="input-group">
                                <span className="input-group-text bg-light"><i className="fa fa-search"></i></span>
                                <input type="text" className="form-control" placeholder="Tìm tên sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select className="form-select" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
                                <option value="ALL">Tất cả loại</option>
                                {uniqueUnits.map((u, i) => <option key={i} value={u}>{u.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="DEFAULT">Sắp xếp mặc định</option>
                                <option value="PRICE_ASC">Giá: Thấp đến Cao</option>
                                <option value="PRICE_DESC">Giá: Cao đến Thấp</option>
                                <option value="NAME_ASC">Tên: A đến Z</option>
                                <option value="NAME_DESC">Tên: Z đến A</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                            <h5 className="mt-3 text-muted">Đang tải sản phẩm...</h5>
                        </div>
                    ) : currentProducts.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded shadow-sm border">
                            <i className="fa fa-box-open fa-3x text-muted mb-3"></i>
                            <h5 className="text-muted">Không tìm thấy sản phẩm nào phù hợp!</h5>
                            <button className="btn btn-outline-primary mt-2" onClick={() => { setSearchTerm(""); setFilterUnit("ALL"); }}>Xóa bộ lọc</button>
                        </div>
                    ) : (
                        <>
                            <div className="row g-3 mb-4">
                                {currentProducts.map(product => {
                                    const isOutOfStock = product.quantity <= 0;
                                    return (
                                        <div className="col-6 col-md-4 col-lg-3" key={product.id}>
                                            <div className={`card h-100 bg-white product-card border ${isOutOfStock ? 'out-of-stock' : ''}`}>
                                                <span className="badge bg-warning text-dark unit-badge">{product.unit?.toUpperCase()}</span>
                                                <div className="img-container border-bottom position-relative">
                                                    <img
                                                        src={product.image ? product.image : "/no-image.png"}
                                                        alt={product.name}
                                                        onError={(e) => { e.target.src = "/no-image.png" }}
                                                    />
                                                    {isOutOfStock && <div className="position-absolute top-50 start-50 translate-middle badge bg-danger fs-5 shadow">HẾT HÀNG</div>}
                                                </div>
                                                <div className="card-body d-flex flex-column p-3">
                                                    <h6 className="card-title fw-bold text-truncate mb-1" title={product.name}>{product.name}</h6>
                                                    <p className="text-muted fw-bold fs-6 mb-1">
                                                        <i className="fa fa-flask me-1"></i> Dung tích: {
                                                            !product.volume ? "Đang cập nhật" :
                                                                isNaN(product.volume)
                                                                    ? product.volume
                                                                    : (Number(product.volume) > 30 ? `${product.volume} ml` : `${product.volume} Lít`)
                                                        }
                                                    </p>
                                                    <p className="text-muted small mb-1"><i className="fa fa-cubes me-1"></i> Kho: {product.quantity}</p>
                                                    <p className="text-danger fw-bold fs-5 mb-3"> <i className="fa fa-tag me-1"> Giá: </i>{formatMoney(product.sell_price)}</p>
                                                    <button
                                                        className={`btn mt-auto w-100 ${isOutOfStock ? 'btn-secondary' : 'btn-outline-primary fw-bold'}`}
                                                        onClick={() => addToCart(product)} disabled={isOutOfStock}
                                                    >
                                                        {isOutOfStock ? "Tạm hết" : <><i className="fa fa-cart-plus me-1"></i> Thêm</>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <Pagination
                                    page={currentPage}
                                    totalPages={totalPages}
                                    setPage={handlePageChange}
                                />
                            )}
                        </>
                    )}
                </div>

                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 sticky-top" style={{ top: '20px' }}>
                        <div className="card-body p-4">
                            <h5 className="fw-bold mb-4 text-primary"><i className="fa fa-shopping-basket"></i> Giỏ hàng của bạn</h5>

                            {cart.length === 0 ? (
                                <p className="text-muted fst-italic text-center py-4 bg-light rounded">Giỏ hàng đang trống...</p>
                            ) : (
                                <ul className="list-group mb-3">
                                    {cart.map((item, index) => (
                                        <li key={index} className="list-group-item d-flex flex-column px-2 border-0 border-bottom">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <h6 className="my-0 text-truncate" style={{ maxWidth: '200px' }} title={item.name}>{item.name}</h6>
                                                <button onClick={() => removeCartItem(item.product_id)} className="btn btn-sm text-danger p-0 ms-2" title="Xóa"><i className="fa fa-trash"></i></button>
                                            </div>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="text-danger fw-bold">{formatMoney(item.sell_price)}</span>
                                                <div className="input-group input-group-sm" style={{ width: '90px' }}>
                                                    <button className="btn btn-outline-secondary cart-qty-btn" type="button" onClick={() => updateCartQty(item.product_id, -1)}>-</button>
                                                    <input type="text" className="form-control text-center fw-bold p-0" value={item.buyQty} readOnly style={{ backgroundColor: '#fff' }} />
                                                    <button className="btn btn-outline-secondary cart-qty-btn" type="button" onClick={() => updateCartQty(item.product_id, 1)}>+</button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                    <li className="list-group-item d-flex justify-content-between px-2 bg-light mt-3 border rounded shadow-sm py-3">
                                        <span className="fw-bold fs-5">TỔNG CỘNG:</span>
                                        <strong className="text-danger fs-5">
                                            {formatMoney(cart.reduce((total, item) => total + (item.sell_price * item.buyQty), 0))}
                                        </strong>
                                    </li>
                                </ul>
                            )}

                            <hr className="my-4" />
                            <h5 className="fw-bold mb-3">Thông tin nhận hàng</h5>
                            <form onSubmit={handleOrder} noValidate>
                                <div className="mb-3">
                                    <label className="fw-bold small mb-1">Tên người nhận <span className="text-danger">*</span></label>
                                    <input type="text"
                                        className={`form-control ${errors.name ? 'input-error' : ''}`}
                                        placeholder="Nhập họ và tên..."
                                        value={customerInfo.name}
                                        onChange={(e) => { setCustomerInfo({ ...customerInfo, name: e.target.value }); setErrors({ ...errors, name: null }); }}
                                    />
                                    {errors.name && <span className="error-text">{errors.name}</span>}
                                </div>

                                <div className="mb-3">
                                    <label className="fw-bold small mb-1">Số điện thoại <span className="text-danger">*</span></label>
                                    <input type="text"
                                        className={`form-control ${errors.phone ? 'input-error' : ''} ${currentUser?.role === 'customer' ? 'bg-light' : ''}`}
                                        placeholder="Ví dụ: 0912345678"
                                        value={customerInfo.phone}
                                        onChange={handlePhoneChange}
                                        maxLength="10"
                                        readOnly={currentUser?.role === 'customer'}
                                    />
                                    {errors.phone && <span className="error-text">{errors.phone}</span>}
                                </div>

                                <div className="mb-3">
                                    <label className="fw-bold small mb-1">Email <span className="text-danger">*</span></label>
                                    <input type="email"
                                        className={`form-control ${errors.email ? 'input-error' : ''}`}
                                        placeholder="Ví dụ: khachhang@gmail.com"
                                        value={customerInfo.email}
                                        onChange={(e) => { setCustomerInfo({ ...customerInfo, email: e.target.value }); setErrors({ ...errors, email: null }); }}
                                        readOnly={currentUser?.role === 'customer'}
                                    />
                                    {errors.email && <span className="error-text">{errors.email}</span>}
                                </div>

                                {/* KHU VỰC ĐỊA CHỈ */}
                                <div className="mb-3">
                                    <label className="fw-bold small mb-2">Địa chỉ giao nước<span className="text-danger">*</span></label>

                                    <input type="text"
                                        className={`form-control mb-2 ${errors.address ? 'input-error' : ''}`}
                                        placeholder="Ví dụ: 123 Nguyễn Thị Minh Khai..."
                                        value={customerInfo.address}
                                        onChange={(e) => {
                                            // Đã đóng luôn cái setIsTyping để tịt ngòi vụ gửi API
                                            // setIsTyping(true); 
                                            setCustomerInfo({ ...customerInfo, address: e.target.value });
                                            setErrors({ ...errors, address: null });
                                        }}
                                    />

                                    {/* =======================================
                                        TẠM ẨN BẢN ĐỒ ĐI(Trùm mền)
                                    ======================================= */}
                                    {/* <div className="border rounded overflow-hidden shadow-sm position-relative" style={{ height: "300px", width: "100%", zIndex: 0 }}>
                                        <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }} ref={mapRef}>
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            />
                                            <MapController
                                                mapCenter={mapCenter}
                                                setMapCenter={setMapCenter}
                                                mapPosition={mapPosition}
                                                setMapPosition={setMapPosition}
                                                setCustomerInfo={setCustomerInfo}
                                                setErrors={setErrors}
                                                setToast={setToast}
                                                setIsTyping={setIsTyping}
                                            />
                                        </MapContainer>
                                        <div className="position-absolute top-0 end-0 bg-white p-1 rounded-bottom shadow-sm text-muted" style={{ zIndex: 1000, fontSize: '0.75rem', opacity: 0.8 }}>
                                            <i className="fa fa-hand-pointer me-1"></i> Bấm để ghim
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-light shadow position-absolute"
                                            style={{ bottom: "20px", right: "10px", zIndex: 1000, borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justify: "center" }}
                                            onClick={handleLocateMe}
                                            title="Định vị vị trí của tôi"
                                        >
                                            <i className="fa fa-crosshairs text-primary fs-5"></i>
                                        </button>
                                    </div> 
                                    */}

                                    {errors.address && <span className="error-text">{errors.address}</span>}
                                </div>

                                <div className="mb-4">
                                    <label className="fw-bold small mb-1">Ghi chú (Tùy chọn)</label>
                                    <textarea className="form-control" rows="2"
                                        placeholder="Ví dụ: Giao sau 5h chiều..."
                                        value={customerInfo.note}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, note: e.target.value })}>
                                    </textarea>
                                </div>

                                <button type="submit" className="btn btn-danger w-100 py-3 fw-bold fs-5 shadow-sm btn-submit-order" disabled={cart.length === 0 || isSubmitting}>
                                    {isSubmitting ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Đang xử lý...</>
                                    ) : (
                                        <><i className="fa fa-paper-plane me-2"></i> XÁC NHẬN ĐẶT HÀNG</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}