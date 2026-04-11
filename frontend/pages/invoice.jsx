import React, { useEffect, useState } from "react";
import Layout from "../components/layout";
import axios from "axios";
import InvoiceModal from "../components/InvoiceModal";
import Pagination from "../components/Pagination";

function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null); // Trạng thái lưu ID hóa đơn đang muốn xem/in

    const token = localStorage.getItem("token");

    const formatMoney = (value) => {
        return Number(value || 0).toLocaleString("vi-VN") + " đ";
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString("vi-VN");
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
                <div className="bg-white p-4 shadow-sm rounded">
                    <h4 className="fw-bold mb-4">Lịch sử giao dịch (Hóa đơn)</h4>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Mã HĐ</th>
                                    <th>Thời gian</th>
                                    <th>Khách hàng</th>
                                    <th>Tiền hàng</th>
                                    <th>Tiền cọc vỏ</th>
                                    <th className="text-danger fw-bold">Tổng cộng</th>
                                    <th className="text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length > 0 ? (
                                    invoices.map((inv) => {
                                        const tienHang = Number(inv.total_amount) || 0;
                                        const tienCoc = Number(inv.deposit_amount) || 0;
                                        const tongCong = tienHang + tienCoc;

                                        return (
                                            <tr key={inv.id}>
                                                <td className="fw-bold text-primary">#{inv.id}</td>
                                                <td>{formatDate(inv.created_at)}</td>
                                                <td>
                                                    {inv.customer_name ? (
                                                        <span className="badge bg-info text-dark">{inv.customer_name}</span>
                                                    ) : (
                                                        <span className="text-muted fst-italic">Khách lẻ</span>
                                                    )}
                                                </td>
                                                <td>{formatMoney(tienHang)}</td>
                                                <td>{formatMoney(tienCoc)}</td>
                                                <td className="text-danger fw-bold">{formatMoney(tongCong)}</td>
                                                <td className="text-center">
                                                    {/* Nút gọi Modal In Hóa Đơn */}
                                                    <button 
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => setSelectedInvoiceId(inv.id)}
                                                    >
                                                        Xem / In lại
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center text-muted py-4">Chưa có hóa đơn nào</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ===== PHÂN TRANG ===== */}
                    <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                </div>
            </div>

            {/* Gọi Modal Chi tiết Hóa Đơn nếu có selectedInvoiceId */}
            {selectedInvoiceId && (
                <InvoiceModal 
                    invoiceId={selectedInvoiceId} 
                    onClose={() => setSelectedInvoiceId(null)} 
                />
            )}
        </Layout>
    );
}

export default Invoices;