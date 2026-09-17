import { Link } from 'react-router-dom';
import React, { useEffect, useState } from "react";
import Layout from "../components/layout";
import axios from "axios";
import InvoiceModal from "../components/InvoiceModal";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import UpdatePaymentModal from "../components/UpdatePaymentModal";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";

function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [selectedInvoiceDetailId, setSelectedInvoiceDetailId] = useState(null);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [pendingExports, setPendingExports] = useState([]);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [toast, setToast] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const token = localStorage.getItem("token");
    const fetchPendingExports = async () => {
        try {
            const res = await axios.get('/api/invoice/pending-exports', { headers: { Authorization: `Bearer ${token}` } });
            setPendingExports(res.data);
        } catch (error) { console.error("Lỗi lấy phiếu xuất:", error); }
    };
    const formatMoney = (value) => {
        return Number(value || 0).toLocaleString("vi-VN") + " đ";
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 7);
        return date.toLocaleString("vi-VN");
    };

    const fetchInvoices = async () => {
        try {
            const res = await axios.get(`/api/invoice?page=${page}&limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvoices(res.data.data || []);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) {
            console.error("Lỗi lấy danh sách hóa đơn:", error);
        }
    };

    // 💡 Động cơ lọc siêu cấp: Quét tên, mã HĐ, mã Đơn và Trạng thái tiền
    const filteredInvoices = invoices.filter(inv => {
        const searchLower = searchTerm.toLowerCase();
        const idMatch = String(inv.id).includes(searchLower);
        const nameMatch = inv.customer_name && inv.customer_name.toLowerCase().includes(searchLower);
        const noteMatch = inv.note && inv.note.toLowerCase().includes(searchLower);
        const orderCodeMatch = inv.order_code && inv.order_code.toLowerCase().includes(searchLower); // 💡 Bắt chính xác bằng mã Đơn

        const matchSearch = idMatch || nameMatch || noteMatch || orderCodeMatch;

        let matchFilter = true;
        if (filterStatus === 'debt') {
            matchFilter = (inv.payment_status === 'unpaid' || inv.payment_status === 'partial');
        } else if (filterStatus === 'paid') {
            matchFilter = inv.payment_status === 'paid';
        }

        return matchSearch && matchFilter;
    });

    useEffect(() => {
        fetchInvoices();
        fetchPendingExports();
    }, [page]);

    const handleCreateInvoiceFromExport = async (exportId) => {
        if (!window.confirm("Xác nhận lập Hóa Đơn cho Phiếu Xuất này?")) return;
        setIsCreatingInvoice(true);
        try {
            const res = await axios.post('/api/invoice/from-export', { export_id: exportId }, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: "Xuất hóa đơn thành công!", type: "success" });
            fetchPendingExports(); // Tải lại danh sách chờ
            fetchInvoices(); // Cập nhật lại bảng lịch sử hóa đơn
        } catch (error) {
            setToast({ message: error.response?.data?.message || "Lỗi tạo hóa đơn", type: "danger" });
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="container-fluid pt-4 px-4 pb-5">
                <div className="bg-white p-4 shadow-sm rounded border">
                    <h4 className="fw-bold mb-4"><i className="bi bi-receipt me-2"></i>Lịch sử giao dịch (Hóa đơn)</h4>
                    <div className="d-flex gap-2">
                        {/* 💡 Dropdown Lọc trạng thái tiền */}
                        <select
                            className="form-select border-warning fw-bold text-dark shadow-sm"
                            style={{ width: '160px' }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Tất cả Bill</option>
                            <option value="debt">⚠️ Còn nợ tiền</option>
                            <option value="paid">✅ Đã thu đủ</option>
                        </select>

                        {/* 💡 Ô tìm kiếm Đa năng */}
                        <div className="input-group shadow-sm" style={{ width: '280px' }}>
                            <span className="input-group-text bg-white border-end-0"><i className="fa fa-search text-muted"></i></span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0 shadow-none"
                                placeholder="Mã HĐ, Mã đơn, Tên..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* BẢNG THÔNG BÁO XUẤT HÓA ĐƠN TỪ PHIẾU XUẤT (ERP) */}
                    {pendingExports.length > 0 && (
                        <div className="alert alert-warning shadow-sm border-warning mb-4 animate__animated animate__fadeIn">
                            <h6 className="fw-bold text-danger mb-3"><i className="bi bi-bell-fill me-2"></i>Có {pendingExports.length} Phiếu Xuất Kho đang chờ xuất Hóa Đơn:</h6>
                            <div className="table-responsive">
                                <table className="table table-sm table-bordered bg-white text-center align-middle mb-0">
                                    <thead className="table-warning text-dark">
                                        <tr>
                                            <th>Mã PX</th>
                                            <th>Từ Đơn Đặt Hàng</th>
                                            <th className="text-start">Khách Hàng</th>
                                            <th className="text-start">Sản Phẩm Đã Giao</th>
                                            <th>SL Giao</th>
                                            <th>Thành Tiền</th>
                                            <th>Thao Tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingExports.map((px) => (
                                            <tr key={px.export_id}>
                                                <td className="fw-bold">PX-{px.export_id}</td>
                                                <td><span className="badge bg-secondary">{px.order_code}</span></td>
                                                <td className="text-start fw-bold text-dark">{px.customer_name}</td>
                                                <td className="text-start text-primary fw-bold">{px.product_name}</td>
                                                <td><span className="badge bg-success fs-6">{px.quantity}</span></td>
                                                <td className="fw-bold text-danger">{formatMoney(px.quantity * px.sell_price)}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-danger fw-bold shadow-sm"
                                                        disabled={isCreatingInvoice}
                                                        onClick={() => handleCreateInvoiceFromExport(px.export_id)}
                                                    >
                                                        {isCreatingInvoice ? "Đang xử lý..." : "Xuất Hóa Đơn Ngay"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="table-responsive">
                        <table className="table table-hover align-middle table-mobile-cards text-center">
                            <thead className="table-light">
                                <tr>
                                    <th>Mã HĐ</th>
                                    <th>Thời gian</th>
                                    <th className="text-start">Khách hàng</th>
                                    <th className="text-end">Tiền hàng</th>
                                    <th className="text-end">Tiền cọc vỏ</th>
                                    <th className="text-end">Phí ship</th>
                                    <th>Trạng thái</th> {/* 💡 ĐÃ BỔ SUNG CỘT TRẠNG THÁI */}
                                    <th className="text-danger fw-bold text-end">Tổng cộng</th>
                                    <th className="text-center">Chi tiết</th>
                                    <th className="text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.length > 0 ? (
                                    filteredInvoices.map((inv) => {
                                        const tongCong = Number(inv.total_amount) || 0;
                                        const tienCoc = Number(inv.deposit_amount) || 0;
                                        const phiGiaoHang = Number(inv.delivery_fee) || 0;
                                        const tienHang = tongCong - tienCoc - phiGiaoHang;

                                        return (
                                            <tr key={inv.id}>
                                                <td data-label="Mã HĐ" className="fw-bold text-primary">#{inv.id}</td>
                                                <td data-label="Thời gian">{formatDate(inv.created_at)}</td>
                                                <td data-label="Khách Hàng" className="text-start">
                                                    {inv.customer_name ? (
                                                        <span className="fw-bold text-dark">{inv.customer_name}</span>
                                                    ) : (
                                                        <span className="text-muted fst-italic">Khách lẻ</span>
                                                    )}

                                                    {/* 💡 CHỐNG ĐẠN 100%: Dùng thẳng mã Đơn từ Database, khỏi phụ thuộc Ghi chú */}
                                                    {inv.order_code && (
                                                        <div className="mt-1">
                                                            <Link
                                                                to={`/sales-orders?search=${inv.order_code}`}
                                                                className="badge bg-primary text-white text-decoration-none shadow-sm"
                                                                title="Bấm để xem lại Đơn Đặt Hàng gốc"
                                                            >
                                                                <i className="fa fa-link me-1"></i>
                                                                {inv.order_code}
                                                            </Link>
                                                        </div>
                                                    )}
                                                </td>
                                                <td data-label="Tiền Hàng" className="text-end">{formatMoney(tienHang)}</td>
                                                <td data-label="Tiền Cọc" className="text-end">{formatMoney(tienCoc)}</td>
                                                <td data-label="Phí Ship" className="text-end">{formatMoney(phiGiaoHang)}</td>
                                                <td data-label="Trạng Thái">
                                                    {/* 💡 FIX TÊN BIẾN THÀNH inv.payment_status */}
                                                    {inv.payment_status === 'paid' ? (
                                                        <span className="badge bg-success">Đã thu đủ</span>
                                                    ) : inv.payment_status === 'partial' ? (
                                                        <span className="badge bg-warning text-dark">Nợ một phần</span>
                                                    ) : (
                                                        <span className="badge bg-danger">Khách nợ bill</span>
                                                    )}
                                                </td>
                                                <td data-label="Tổng Cộng" className="text-danger fw-bold text-end">{formatMoney(tongCong)}</td>
                                                <td data-label="Chi Tiết" className="text-center">
                                                    <button className="btn btn-sm btn-info text-white me-2 shadow-sm" onClick={() => setSelectedInvoiceDetailId(inv.id)}>
                                                        Chi tiết
                                                    </button>
                                                </td>
                                                <td data-label="Thao Tác" className="text-center">
                                                    <button
                                                        className="btn btn-warning btn-sm fw-bold"
                                                        onClick={() => setEditingInvoice(inv)}
                                                    >
                                                        Sửa tiền nợ
                                                    </button>
                                                    <button className="btn btn-sm btn-success shadow-sm" onClick={() => setSelectedInvoiceId(inv.id)}>
                                                        Xem/In lại
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td data-label colSpan="10" className="text-center text-muted py-4">Chưa có hóa đơn nào</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </div>
            </div>

            {selectedInvoiceId && <InvoiceModal invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />}
            {selectedInvoiceDetailId && <InvoiceDetailModal invoiceId={selectedInvoiceDetailId} onClose={() => setSelectedInvoiceDetailId(null)} />}
            {editingInvoice && (
                <UpdatePaymentModal
                    invoice={editingInvoice}
                    onClose={() => setEditingInvoice(null)}
                    onSuccess={() => {
                        setEditingInvoice(null);
                        fetchInvoices(); // Load lại danh sách hóa đơn
                    }}
                />
            )}
        </Layout>
    );
}

export default Invoices;