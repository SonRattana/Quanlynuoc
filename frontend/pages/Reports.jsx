import React, { useState } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
    const today = new Date().toISOString().split("T")[0];

    const [reportType, setReportType] = useState("revenue");
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [data, setData] = useState([]);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);

    // LẤY DỮ LIỆU TỪ BACKEND
    const fetchReport = async () => {
        if (startDate > endDate) {
            return setToast({ message: "Ngày bắt đầu không được lớn hơn ngày kết thúc", type: "warning" });
        }
        setLoading(true);
        try {
            let endpoint = "";
            if (reportType === "revenue") endpoint = "api/reports/revenue";
            if (reportType === "revenue_by_product") endpoint = "api/reports/revenue-by-product";
            if (reportType === "bottles") endpoint = "api/reports/bottles";
            if (reportType === "bottle_notes") endpoint = "api/reports/bottle-notes";
            if (reportType === "customers") endpoint = "api/reports/customers";
            if (reportType === "inventory") endpoint = "api/reports/inventory";

            const res = await api.get(endpoint, {
                params: { startDate, endDate },
            });
            setData(res.data);
            if (res.data.length === 0) {
                setToast({ message: "Không có dữ liệu trong khoảng thời gian này", type: "info" });
            }
        } catch (err) {
            setToast({ message: "Lỗi khi lấy báo cáo", type: "danger" });
        } finally {
            setLoading(false);
        }
    };

    // ================= XUẤT EXCEL =================
    const exportExcel = () => {
        if (!Array.isArray(data) || data.length === 0) return;

        let excelData = [];
        let worksheet;
        let fileName = "";

        if (reportType === "revenue") {
            excelData = data.map((item) => ({
                "Mã Hóa Đơn": `HD${item.invoice_id}`,
                "Ngày Bán": new Date(item.created_at).toLocaleString("vi-VN"),
                "Khách Hàng": item.customer_name || "Khách lẻ",
                "Doanh Thu (VNĐ)": Number(item.total_amount)
            }));
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", "", totalRev]], { origin: -1 });
            fileName = `BaoCao_DoanhThu_TheoHD_${startDate}_den_${endDate}.xlsx`;
        }
        else if (reportType === "revenue_by_product") {
            excelData = data.map((item) => ({
                "Sản phẩm": item.product_name,
                "Số lượng bán": Number(item.total_quantity),
                "Doanh thu (VNĐ)": Number(item.total_revenue)
            }));
            const totalQty = data.reduce((sum, item) => sum + Number(item.total_quantity), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", totalQty, totalRev]], { origin: -1 });
            fileName = `BaoCao_DoanhThu_TheoSP_${startDate}_den_${endDate}.xlsx`;
        }
        else if (reportType === "bottles") {
            excelData = data.map((item) => ({
                "Mã KH": item.customer_code,
                "Khách Hàng": item.customer_name,
                "SĐT": item.phone || "",
                "Đã Mượn": Number(item.total_borrowed),
                "Đã Trả": Number(item.total_returned),
                "Đang Nợ (Vỏ)": Number(item.remaining_bottles),
                "Tiền Cọc Giữ (VNĐ)": Number(item.total_deposit)
            }));
            const totalBot = data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0);
            const totalDep = data.reduce((sum, item) => sum + Number(item.total_deposit), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG ĐANG NỢ:", "", "", "", "", totalBot, totalDep]], { origin: -1 });
            fileName = `BaoCao_CongNo_VoBinh_${today}.xlsx`;
        }
        else if (reportType === "bottle_notes") {
            excelData = data.map((item) => ({
                "Ngày": new Date(item.created_at).toLocaleString("vi-VN"),
                "Khách Hàng": item.customer_name,
                "SĐT": item.phone || "",
                "Loại vỏ": item.product_name || "Vỏ bình",
                "Số lượng": Number(item.quantity),
                "Tiền thực hoàn (VNĐ)": Number(item.deposit_amount),
                "Lý do": item.note
            }));
            const totalRefund = data.reduce((sum, item) => sum + Number(item.deposit_amount), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG TIỀN ĐÃ HOÀN:", "", "", "", "", totalRefund, ""]], { origin: -1 });
            fileName = `BaoCao_KhauHao_VoBinh_${startDate}_den_${endDate}.xlsx`;
        }
        else if (reportType === "customers") {
            excelData = data.map((item) => ({
                "Khách Hàng": item.customer_name,
                "SĐT": item.phone || "",
                "Phân loại": item.customer_type,
                "Số đơn mua": Number(item.total_orders),
                "Tổng tiền mua (VNĐ)": Number(item.total_revenue)
            }));
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalMoney = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", "", totalOrders, totalMoney]], { origin: -1 });
            fileName = `BaoCao_KhachHang_${startDate}_den_${endDate}.xlsx`;
        }
        else if (reportType === "inventory") {
            excelData = data.map((item) => ({
                "Sản phẩm": item.product_name,
                "Giá bán (VNĐ)": Number(item.sell_price),
                "Vỏ khách nợ": Number(item.bottles_with_customers),
                "Tồn kho thực tế": Number(item.current_stock)
            }));
            const totalDebt = data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", totalDebt, totalStock]], { origin: -1 });
            fileName = `BaoCao_TonKho_${today}.xlsx`;
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
        XLSX.writeFile(workbook, fileName);
    };

    // ================= XUẤT PDF =================
    const exportPDF = async () => {
        if (!Array.isArray(data) || data.length === 0) return;
        const doc = new jsPDF();

        try {
            const loadFont = async (url) => {
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                return window.btoa(binary);
            };
            const regularFont = await loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf");
            doc.addFileToVFS("Roboto-Regular.ttf", regularFont);
            doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
            const boldFont = await loadFont("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf");
            doc.addFileToVFS("Roboto-Medium.ttf", boldFont);
            doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
            doc.setFont("Roboto");
        } catch (error) {
            console.warn("Lỗi tải font PDF", error);
        }

        let title = "";
        let subtitle = `Tu ngay: ${startDate} - Den ngay: ${endDate}`;
        let tableCols = [];
        let tableRows = [];
        let footData = [];
        let fileName = "";

        if (reportType === "revenue") {
            title = "BAO CAO DOANH THU THEO HOA DON";
            tableCols = ["Ma HD", "Ngay Ban", "Khach Hang", "Doanh Thu"];
            tableRows = data.map(item => [`HD${item.invoice_id}`, new Date(item.created_at).toLocaleDateString("vi-VN"), item.customer_name || "Khách lẻ", Number(item.total_amount).toLocaleString("vi-VN") + " d"]);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
            footData = [{ content: 'TONG CONG:', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalRev.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_DoanhThu_TheoHD_${startDate}.pdf`;
        }
        else if (reportType === "revenue_by_product") {
            title = "BAO CAO DOANH THU THEO SAN PHAM";
            tableCols = ["San Pham", "So Luong Ban", "Tong Doanh Thu"];
            tableRows = data.map(item => [item.product_name, item.total_quantity, Number(item.total_revenue).toLocaleString("vi-VN") + " d"]);
            const totalQty = data.reduce((sum, item) => sum + Number(item.total_quantity), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            footData = [{ content: 'TONG CONG:', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalQty.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalRev.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_DoanhThu_TheoSP_${startDate}.pdf`;
        }
        else if (reportType === "bottles") {
            title = "BAO CAO CONG NO VO BINH";
            subtitle = `Tinh den ngay: ${new Date().toLocaleDateString("vi-VN")}`;
            tableCols = ["Khach Hang", "SDT", "Muon", "Tra", "Dang No", "Tien Coc (VND)"];
            tableRows = data.map(item => [item.customer_name, item.phone || "", item.total_borrowed, item.total_returned, item.remaining_bottles, Number(item.total_deposit).toLocaleString("vi-VN") + " d"]);
            const totalBot = data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0);
            const totalDep = data.reduce((sum, item) => sum + Number(item.total_deposit), 0);
            footData = [{ content: 'TONG DANG NO:', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalBot.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalDep.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_CongNo_VoBinh_${today}.pdf`;
        }
        else if (reportType === "bottle_notes") {
            title = "BAO CAO KHAU HAO / THAT THOAT VO";
            tableCols = ["Ngay", "Khach Hang", "Loai vo", "SL", "Tien Hoan", "Ly do"];
            tableRows = data.map(item => [new Date(item.created_at).toLocaleDateString("vi-VN"), item.customer_name, item.product_name || "Vỏ bình", item.quantity, Number(item.deposit_amount).toLocaleString("vi-VN") + " d", item.note]);
            const totalRefund = data.reduce((sum, item) => sum + Number(item.deposit_amount), 0);
            footData = [{ content: 'TONG TIEN DA HOAN:', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalRefund.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, ""];
            fileName = `BaoCao_KhauHao_${startDate}.pdf`;
        }
        else if (reportType === "customers") {
            title = "BAO CAO KHACH HANG MOI / CU";
            tableCols = ["Khach Hang", "SDT", "Phan Loai", "So Don", "Tong Tien"];
            tableRows = data.map(item => [item.customer_name, item.phone || "", item.customer_type, item.total_orders, Number(item.total_revenue).toLocaleString("vi-VN") + " d"]);
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalMoney = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            footData = [{ content: 'TONG CONG:', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalOrders.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalMoney.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_KhachHang_${startDate}.pdf`;
        }
        else if (reportType === "inventory") {
            title = "BAO CAO TON KHO THUC TE";
            subtitle = `Tinh den thoi diem hien tai`;
            tableCols = ["San Pham", "Gia Ban", "Vo Dang No", "Ton Kho"];
            tableRows = data.map(item => [item.product_name, Number(item.sell_price).toLocaleString("vi-VN") + " d", item.bottles_with_customers, item.current_stock]);
            const totalDebt = data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            footData = [{ content: 'TONG CONG:', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalDebt.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalStock.toString(), styles: { fontStyle: 'bold', textColor: [35, 136, 35] } }];
            fileName = `BaoCao_TonKho_${today}.pdf`;
        }

        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(subtitle, 14, 22);

        let autoTableConfig = {
            head: [tableCols],
            body: tableRows,
            startY: 28,
            styles: { font: "Roboto" },
            headStyles: { fillColor: [13, 110, 253] }
        };

        if (footData.length > 0) {
            autoTableConfig.foot = [footData];
        }

        autoTable(doc, autoTableConfig);
        doc.save(fileName);
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="bg-white shadow-sm p-3 p-md-4 mb-4 rounded border-top border-primary border-4">
                <h4 className="fw-bold mb-4 text-primary"><i className="bi bi-bar-chart-fill me-2"></i>Hệ Thống Báo Cáo</h4>

                {/* Thanh công cụ lọc */}
                <div className="row g-2 g-md-3 mb-4 align-items-end bg-light p-3 rounded">
                    <div className="col-12 col-md-3">
                        <label className="form-label fw-bold small text-secondary">Chọn loại báo cáo</label>
                        <select className="form-select border-primary shadow-sm"
                            value={reportType}
                            onChange={(e) => { setReportType(e.target.value); setData([]); }}>
                            <option value="revenue">💰 Báo cáo Doanh thu (Theo Hóa đơn)</option>
                            <option value="revenue_by_product">📊 Báo cáo Doanh thu (Theo Sản phẩm)</option>
                            <option value="bottles">♻️ Báo cáo Công nợ Vỏ bình</option>
                            <option value="bottle_notes">📝 Báo cáo Khấu hao / Thất thoát</option>
                            <option value="customers">👥 Báo cáo Khách hàng Mới / Cũ</option>
                            <option value="inventory">📦 Báo cáo Tồn kho thực tế</option>
                        </select>
                    </div>

                    {/* Chỉ hiện chọn ngày nếu KHÔNG phải báo cáo Tồn kho */}
                    {reportType !== "inventory" && (
                        <>
                            <div className="col-12 col-md-2">
                                <label className="form-label fw-bold small text-secondary">Từ ngày</label>
                                <input type="date" className="form-control shadow-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>

                            <div className="col-12 col-md-2">
                                <label className="form-label fw-bold small text-secondary">Đến ngày</label>
                                <input type="date" className="form-control shadow-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </>
                    )}

                    <div className="col-12 col-md-3 mt-auto">
                        <button className="btn btn-primary w-100 fw-bold shadow-sm" onClick={fetchReport} disabled={loading}>
                            {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-search me-2"></i>}
                            Xem Báo Cáo
                        </button>
                    </div>

                    {/* Nút Xuất file */}
                    <div className="col-6 col-md-1 mt-auto">
                        <button className="btn btn-success w-100 shadow-sm" onClick={exportExcel} disabled={!Array.isArray(data) || data.length === 0} title="Xuất Excel">
                            <i className="bi bi-file-earmark-excel fs-5"></i>
                        </button>
                    </div>
                    <div className="col-6 col-md-1 mt-auto">
                        <button className="btn btn-danger w-100 shadow-sm" onClick={exportPDF} disabled={!Array.isArray(data) || data.length === 0} title="Xuất PDF">
                            <i className="bi bi-file-earmark-pdf fs-5"></i>
                        </button>
                    </div>
                </div>

                {/* THÔNG BÁO CHO BÁO CÁO TỒN KHO */}
                {reportType === "inventory" && (
                    <div className="alert alert-info border-info border-start border-4 mb-3">
                        <i className="bi bi-info-circle-fill me-2"></i>
                        Báo cáo này hiển thị số lượng tồn kho thực tế ngay tại thời điểm hiện tại.
                    </div>
                )}

                {/* KHU VỰC HIỂN THỊ BẢNG (DÙNG CHUNG GIAO DIỆN CHUẨN) */}
                <div className="table-responsive">
                    <table className="table table-bordered table-hover align-middle shadow-sm">
                        {/* HEADER CHUẨN MÀU XANH DƯƠNG */}
                        <thead className="table-primary text-center align-middle">
                            {reportType === "revenue" && (
                                <tr>
                                    <th>Mã HĐ</th>
                                    <th>Ngày bán</th>
                                    <th className="text-start">Khách hàng</th>
                                    <th className="text-end">Doanh thu</th>
                                </tr>
                            )}
                            {reportType === "revenue_by_product" && (
                                <tr>
                                    <th className="text-start">Tên sản phẩm</th>
                                    <th>Số lượng đã bán</th>
                                    <th className="text-end">Tổng doanh thu</th>
                                </tr>
                            )}
                            {reportType === "bottles" && (
                                <tr>
                                    <th className="text-start">Khách hàng</th>
                                    <th>SĐT</th>
                                    <th>Mượn</th>
                                    <th>Trả</th>
                                    <th>Nợ vỏ</th>
                                    <th className="text-end">Tiền cọc giữ</th>
                                </tr>
                            )}
                            {reportType === "bottle_notes" && (
                                <tr>
                                    <th>Thời gian</th>
                                    <th className="text-start">Khách hàng</th>
                                    <th>Loại vỏ</th>
                                    <th>Số lượng</th>
                                    <th className="text-end">Tiền hoàn</th>
                                    <th className="text-start">Lý do</th>
                                </tr>
                            )}
                            {reportType === "customers" && (
                                <tr>
                                    <th className="text-start">Khách hàng</th>
                                    <th>SĐT</th>
                                    <th>Phân loại</th>
                                    <th>Số đơn</th>
                                    <th className="text-end">Tổng tiền</th>
                                </tr>
                            )}
                            {reportType === "inventory" && (
                                <tr>
                                    <th className="text-start">Sản phẩm</th>
                                    <th className="text-end">Giá bán</th>
                                    <th>Vỏ khách nợ</th>
                                    <th>Tồn kho thực tế</th>
                                </tr>
                            )}
                        </thead>

                        {/* BODY */}
                        <tbody>
                            {Array.isArray(data) && data.length > 0 ? (
                                <>
                                    {data.map((item, index) => (
                                        <tr key={index} className="text-center">
                                            {/* Doanh Thu Theo Hóa Đơn */}
                                            {reportType === "revenue" && (
                                                <>
                                                    <td className="fw-bold">HD{item.invoice_id}</td>
                                                    <td>{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                                                    <td className="text-start">
                                                        <span className="fw-bold d-block text-primary">{item.customer_name || "Khách lẻ"}</span>
                                                        <span className="small text-muted">{item.customer_code}</span>
                                                    </td>
                                                    <td className="text-end fw-bold text-danger">{Number(item.total_amount).toLocaleString("vi-VN")} đ</td>
                                                </>
                                            )}

                                            {/* Doanh Thu Theo Sản Phẩm */}
                                            {reportType === "revenue_by_product" && (
                                                <>
                                                    <td className="text-start fw-bold text-primary">{item.product_name}</td>
                                                    <td className="fw-bold fs-5 text-dark">{item.total_quantity} bình</td>
                                                    <td className="text-end fw-bold text-danger">{Number(item.total_revenue).toLocaleString("vi-VN")} đ</td>
                                                </>
                                            )}

                                            {/* Vỏ Bình */}
                                            {reportType === "bottles" && (
                                                <>
                                                    <td className="text-start">
                                                        <span className="fw-bold d-block text-primary">{item.customer_name}</span>
                                                        <span className="small text-muted">{item.customer_code}</span>
                                                    </td>
                                                    <td>{item.phone || "---"}</td>
                                                    <td className="fw-bold text-dark">{item.total_borrowed}</td>
                                                    <td className="fw-bold text-success">{item.total_returned}</td>
                                                    <td className="fw-bold text-danger fs-5">{item.remaining_bottles}</td>
                                                    <td className="text-end fw-bold">{Number(item.total_deposit).toLocaleString("vi-VN")} đ</td>
                                                </>
                                            )}

                                            {/* Khấu Hao */}
                                            {reportType === "bottle_notes" && (
                                                <>
                                                    <td>{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                                                    <td className="text-start fw-bold text-primary">{item.customer_name}</td>
                                                    <td>{item.product_name || "Vỏ bình"}</td>
                                                    <td className="fw-bold">{item.quantity}</td>
                                                    <td className="text-end fw-bold text-success">{Number(item.deposit_amount).toLocaleString("vi-VN")} đ</td>
                                                    <td className="text-start text-danger fst-italic">"{item.note}"</td>
                                                </>
                                            )}

                                            {/* Khách Mới Cũ */}
                                            {reportType === "customers" && (
                                                <>
                                                    <td className="text-start fw-bold text-primary">{item.customer_name}</td>
                                                    <td>{item.phone || "---"}</td>
                                                    <td className="fw-bold"><span className={`badge ${item.customer_type.includes("Mới") ? "bg-success" : "bg-secondary"}`}>{item.customer_type}</span></td>
                                                    <td className="fw-bold fs-5">{item.total_orders}</td>
                                                    <td className="text-end fw-bold text-danger">{Number(item.total_revenue).toLocaleString("vi-VN")} đ</td>
                                                </>
                                            )}

                                            {/* Tồn Kho */}
                                            {reportType === "inventory" && (
                                                <>
                                                    <td className="text-start fw-bold text-primary">{item.product_name}</td>
                                                    <td className="text-end">{Number(item.sell_price).toLocaleString("vi-VN")} đ</td>
                                                    <td className="fw-bold text-danger fs-5">{item.bottles_with_customers} <span className="small fw-normal">vỏ</span></td>
                                                    <td className="fw-bold text-success fs-5">{item.current_stock} <span className="small fw-normal">bình</span></td>
                                                </>
                                            )}
                                        </tr>
                                    ))}

                                    {/* FOOTER TÍNH TỔNG DÙNG CHUNG MÀU XÁM NHẠT (table-light) */}
                                    {reportType === "revenue" && (
                                        <tr className="table-light">
                                            <td colSpan="3" className="text-end fw-bold">TỔNG DOANH THU:</td>
                                            <td className="text-end fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.total_amount || 0), 0).toLocaleString("vi-VN")} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "revenue_by_product" && (
                                        <tr className="table-light">
                                            <td className="text-end fw-bold">TỔNG BÁN RA:</td>
                                            <td className="text-center fw-bold fs-5">{data.reduce((sum, item) => sum + Number(item.total_quantity), 0)} bình</td>
                                            <td className="text-end fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.total_revenue), 0).toLocaleString("vi-VN")} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "bottles" && (
                                        <tr className="table-light">
                                            <td colSpan="4" className="text-end fw-bold">TỔNG ĐANG NỢ:</td>
                                            <td className="text-center fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.total_deposit), 0).toLocaleString("vi-VN")} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "bottle_notes" && (
                                        <tr className="table-light">
                                            <td colSpan="4" className="text-end fw-bold">TỔNG TIỀN ĐÃ HOÀN:</td>
                                            <td className="text-end fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.deposit_amount), 0).toLocaleString("vi-VN")} đ</td>
                                            <td></td>
                                        </tr>
                                    )}
                                    {reportType === "customers" && (
                                        <tr className="table-light">
                                            <td colSpan="3" className="text-end fw-bold">TỔNG CỘNG:</td>
                                            <td className="text-center fw-bold fs-5">{data.reduce((sum, item) => sum + Number(item.total_orders), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.total_revenue), 0).toLocaleString("vi-VN")} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "inventory" && (
                                        <tr className="table-light">
                                            <td colSpan="2" className="text-end fw-bold">TỔNG CỘNG HÀNG HÓA:</td>
                                            <td className="text-center fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0)} vỏ</td>
                                            <td className="text-center fw-bold text-success fs-5">{data.reduce((sum, item) => sum + Number(item.current_stock), 0)} bình</td>
                                        </tr>
                                    )}
                                </>
                            ) : (
                                <tr>
                                    <td colSpan="10" className="text-center py-5 text-muted bg-light">
                                        <i className="bi bi-inboxes-fill fs-1 d-block mb-3 text-secondary"></i>
                                        Chưa có dữ liệu thống kê. Vui lòng chọn ngày và bấm "Xem Báo Cáo"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}