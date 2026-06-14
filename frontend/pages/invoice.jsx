import React, { useEffect, useState } from "react";
import Layout from "../components/layout";
import axios from "axios";
import InvoiceModal from "../components/InvoiceModal";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import UpdatePaymentModal from "../components/UpdatePaymentModal";
import Pagination from "../components/Pagination";

function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [selectedInvoiceDetailId, setSelectedInvoiceDetailId] = useState(null);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const token = localStorage.getItem("token");

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

    useEffect(() => {
        fetchInvoices();
    }, [page]);

    return (
        <Layout>
            <div className="container-fluid pt-4 px-4 pb-5">
                <div className="bg-white p-4 shadow-sm rounded border">
                    <h4 className="fw-bold mb-4"><i className="bi bi-receipt me-2"></i>Lịch sử giao dịch (Hóa đơn)</h4>

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
                                {invoices.length > 0 ? (
                                    invoices.map((inv) => {
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