import React, { useEffect, useState } from "react";
import axios from "axios";

export default function InvoiceModal({ invoiceId, onClose }) {

    const [invoices, setInvoices] = useState(null);

    const token = localStorage.getItem("token");

    const formatMoney = (value) => {
        return Number(value).toLocaleString("vi-VN") + " đ";
    };

    const customerName = invoices?.customer_name || "Khách lẻ";
    useEffect(() => {
        const fetchInvoice = async () => {
            const res = await axios.get(`/api/invoice/${invoiceId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(res.data)
            setInvoices(res.data);
        };

        fetchInvoice();
    }, [invoiceId]);

    // ===== BƯỚC 2: HÀM IN ẤN CHUYÊN NGHIỆP =====
    const handlePrint = () => {
        const printContent = document.getElementById("printable-invoice").innerHTML;
        const originalContent = document.body.innerHTML;

        // Tráo đổi nội dung: Tạm thời xóa sạch màn hình, chỉ để lại mỗi cái Hóa đơn
        document.body.innerHTML = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                ${printContent}
            </div>
        `;
        
        window.print(); // Gọi lệnh In (Lúc này màn hình chỉ có hóa đơn)

        // In xong thì trả lại giao diện gốc
        document.body.innerHTML = originalContent;
        window.location.reload(); // Tải lại nhẹ trang để React nhận diện lại DOM
    };
    // ============================================

    if (!invoices) {
        return <div>Loading...</div>;
    }

    const { items } = invoices;

    let total = 0;

    items.forEach(i => {
        total += i.quantity * i.sell_price;
    });

    const deposit = Number(invoices.deposit_amount) || 0;

    return (
        <>
            <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                <div className="modal-dialog">
                    {/* BƯỚC 1: Đặt ID cho cái cục Hóa đơn này */}
                    <div className="modal-content" id="printable-invoice">

                        {/* Thêm class d-print-none của Bootstrap để lúc In nó tự giấu cái header chứa nút X này đi */}
                        <div className="modal-header d-print-none">
                            <h5>Hóa đơn</h5>
                            <button className="btn-close" onClick={onClose}></button>
                        </div>

                        <div className="modal-body p-4">

                            <h5 className="text-center fw-bold mb-4">HÓA ĐƠN BÁN HÀNG</h5>

                            <div className="mb-1">Mã hóa đơn: <b>{invoiceId}</b></div>
                            <div className="mb-1">Mã khách hàng: {invoices.customer_code}</div>
                            <div className="mb-1">Tên khách hàng: {customerName}</div>
                            <div className="mb-1">Số điện thoại: {invoices.phone}</div>
                            <div className="mb-3">Ngày: {new Date(invoices.created_at).toLocaleString('vi-VN')}</div>

                            <hr style={{ borderStyle: 'dashed' }} />

                            {items.map((item, i) => (
                                <div key={i} className="d-flex justify-content-between mb-2">
                                    <div>{item.product_name} <b>x{item.quantity}</b></div>
                                    <div>{formatMoney(item.sell_price * item.quantity)}</div>
                                </div>
                            ))}

                            <hr style={{ borderStyle: 'dashed' }} />

                            <div className="d-flex justify-content-between mb-2">
                                <span>Tiền hàng</span>
                                <b>{formatMoney(total)}</b>
                            </div>

                            <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
                                <span>Tiền cọc vỏ</span>
                                <b>{formatMoney(deposit)}</b>
                            </div>

                            <div className="d-flex justify-content-between fs-5 mt-2">
                                <span><b>TỔNG CỘNG</b></span>
                                <b className="text-danger">{formatMoney(total + deposit)}</b>
                            </div>

                            <div className="text-center mt-4 text-muted fst-italic" style={{ fontSize: '12px' }}>
                                Xin cảm ơn quý khách!
                            </div>

                        </div>

                        {/* Thêm class d-print-none để lúc In nó tự giấu 2 cái nút bấm này đi */}
                        <div className="modal-footer d-print-none">
                            <button
                                className="btn btn-primary px-4"
                                onClick={handlePrint} /* <--- Gọi hàm In xịn xò ở trên */
                            >
                                In hóa đơn
                            </button>

                            <button
                                className="btn btn-secondary px-4"
                                onClick={onClose}
                            >
                                Đóng
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Bỏ class d-block đi, giữ nguyên theo chuẩn Bootstrap để không bị đè màu */}
            <div className="modal-backdrop fade show"></div>
        </>
    );
}