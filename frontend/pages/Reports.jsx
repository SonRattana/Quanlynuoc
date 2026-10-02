import React, { useState } from "react";
import Layout from "../components/layout";
import Toast from "../components/Toast";
import api from "../src/utils/axios";
import * as XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
    const today = new Date().toISOString().split("T")[0];

    const [reportType, setReportType] = useState("actual_revenue");
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [data, setData] = useState([]);

    const [searchRegion, setSearchRegion] = useState("");

    const [pnlDetails, setPnlDetails] = useState([]);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);

    const setQuickDate = (type) => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth();

        const toDateString = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        if (type === 'today') {
            const dStr = toDateString(d);
            setStartDate(dStr); setEndDate(dStr);
        } else if (type === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(d.getFullYear(), d.getMonth(), diff);
            const end = new Date(d.getFullYear(), d.getMonth(), diff + 6);
            setStartDate(toDateString(start));
            setEndDate(toDateString(end));
        } else if (type === 'month') {
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);
            setStartDate(toDateString(start));
            setEndDate(toDateString(end));
        } else if (type === 'year') {
            setStartDate(`${year}-01-01`);
            setEndDate(`${year}-12-31`);
        } else {
            setStartDate(""); setEndDate("");
        }
        setData([]);
        setPnlDetails([]);
    };

    const fetchReport = async () => {
        if (startDate > endDate) {
            return setToast({ message: "Ngày bắt đầu không được lớn hơn ngày kết thúc", type: "warning" });
        }
        setLoading(true);
        try {
            let endpoint = "";
            if (reportType === "actual_revenue") endpoint = "/api/reports/actual-revenue";
            if (reportType === "pnl") endpoint = "/api/reports/pnl";
            if (reportType === "revenue") endpoint = "/api/reports/revenue";
            if (reportType === "revenue_by_product") endpoint = "/api/reports/revenue-by-product";
            if (reportType === "sales_by_region") endpoint = "/api/reports/sales-by-region";
            if (reportType === "bottles") endpoint = "/api/reports/bottles";
            if (reportType === "bottle_notes") endpoint = "/api/reports/bottle-notes";
            if (reportType === "customers") endpoint = "/api/reports/customers";
            if (reportType === "purchases") endpoint = "/api/reports/purchases";
            if (reportType === "wastage_report") endpoint = "/api/production/wastage-report";

            if (reportType === "inventory_products" || reportType === "inventory_materials") {
                endpoint = "/api/reports/inventory";
            }

            const res = await api.get(endpoint, {
                params: {
                    startDate,
                    endDate,
                    searchRegion: reportType === "sales_by_region" ? searchRegion : ""
                },
            });

            let resultData = res.data;

            if (reportType === "pnl") {
                if (resultData.summary || resultData.details) {
                    setData(resultData.summary ? [resultData.summary] : []);
                    setPnlDetails(resultData.details || []);
                } else {
                    setData(Array.isArray(resultData) ? resultData : [resultData]);
                    setPnlDetails([]);
                }
            } else {
                if (reportType === "inventory_products") {
                    resultData = resultData.filter(item => Number(item.sell_price) > 0);
                } else if (reportType === "inventory_materials") {
                    resultData = resultData.filter(item => Number(item.sell_price) === 0);
                }
                setData(resultData);
                setPnlDetails([]);
            }

            const isPnlEmpty = reportType === "pnl" && (!resultData.summary && (!resultData.details || resultData.details.length === 0));
            const isNormalEmpty = reportType !== "pnl" && resultData.length === 0;

            if (isPnlEmpty || isNormalEmpty) {
                setToast({ message: "Không có dữ liệu trong khoảng thời gian này", type: "info" });
            }
        } catch (err) {
            setToast({ message: "Lỗi khi lấy báo cáo", type: "danger" });
        } finally {
            setLoading(false);
        }
    };

    let processedRevenueData = [];
    let revenueFooterStats = { thanh_tien: 0, the_chan: 0, tong_tien: 0, unreturned: 0, actual_deposit: 0, actual_debt: 0, inv_total: 0, inv_paid: 0, inv_debt: 0 };

    if ((reportType === "revenue" || reportType === "actual_revenue") && Array.isArray(data) && data.length > 0) {
        const invoiceStats = {};
        data.forEach(item => {
            if (!invoiceStats[item.invoice_id]) {
                invoiceStats[item.invoice_id] = {
                    count: 0,
                    total_thanh_tien: 0,
                    total_the_chan: 0,
                    unreturned: Number(item.unreturned_bottles || 0),
                    actual_debt: 0,
                    actual_deposit: 0,
                    inv_total: Number(item.inv_total || 0),
                    inv_paid: Number(item.inv_paid || 0),
                    inv_debt: Number(item.inv_debt || 0)
                };
            }
            invoiceStats[item.invoice_id].count += 1;
            const amount = reportType === "actual_revenue" ? Number(item.subtotal || 0) : Number(item.thanh_tien || 0);
            invoiceStats[item.invoice_id].total_thanh_tien += amount;
            invoiceStats[item.invoice_id].total_the_chan += Number(item.the_chan || 0);
            invoiceStats[item.invoice_id].actual_debt += Number(item.actual_unreturned_bottles || 0);
            invoiceStats[item.invoice_id].actual_deposit += Number(item.actual_deposit_held || 0);
        });

        let currentId = null;
        processedRevenueData = data.map(item => {
            if (item.invoice_id !== currentId) {
                currentId = item.invoice_id;
                return {
                    ...item,
                    isFirst: true,
                    rowSpan: invoiceStats[item.invoice_id].count,
                    inv_thanh_tien: invoiceStats[item.invoice_id].total_thanh_tien,
                    inv_the_chan: invoiceStats[item.invoice_id].total_the_chan,
                    inv_tong_tien: invoiceStats[item.invoice_id].total_thanh_tien + invoiceStats[item.invoice_id].total_the_chan,
                    inv_unreturned: invoiceStats[item.invoice_id].unreturned,
                    inv_actual_debt: invoiceStats[item.invoice_id].actual_debt,
                    inv_actual_deposit: invoiceStats[item.invoice_id].actual_deposit,
                    inv_total: invoiceStats[item.invoice_id].inv_total,
                    inv_paid: invoiceStats[item.invoice_id].inv_paid,
                    inv_debt: invoiceStats[item.invoice_id].inv_debt
                };
            }
            return { ...item, isFirst: false, rowSpan: 0 };
        });

        data.forEach(item => {
            const amount = reportType === "actual_revenue" ? Number(item.subtotal || 0) : Number(item.thanh_tien || 0);
            revenueFooterStats.thanh_tien += amount;
        });
        Object.values(invoiceStats).forEach(stat => {
            revenueFooterStats.the_chan += stat.total_the_chan;
            revenueFooterStats.unreturned += stat.unreturned;
            revenueFooterStats.actual_deposit += stat.actual_deposit;
            revenueFooterStats.actual_debt += stat.actual_debt;
            revenueFooterStats.inv_total += stat.inv_total;
            revenueFooterStats.inv_paid += stat.inv_paid;
            revenueFooterStats.inv_debt += stat.inv_debt;
        });
        revenueFooterStats.tong_tien = revenueFooterStats.thanh_tien + revenueFooterStats.the_chan;
    }

    const formatMoney = (val) => new Intl.NumberFormat("vi-VN").format(Math.round(val || 0));

    const exportExcel = () => {
        if (!Array.isArray(data) || data.length === 0) return;

        let excelData = [];
        let worksheet;
        let fileName = "";
        let columnWidths = [];
        let printOrientation = 'portrait'; // 💡 Mặc định in giấy dọc

        if (reportType === "pnl") {
            excelData = data.map((item) => ({
                "TỔNG DOANH THU": Number(item.total_revenue),
                "TỔNG GIÁ VỐN": Number(item.total_cogs),
                "LỢI NHUẬN GỘP": Number(item.gross_profit),
                "CHI PHÍ HOẠT ĐỘNG": Number(item.total_expenses),
                "KHẤU HAO / THIỆT HẠI VỎ": Number(item.total_bottle_loss || 0),
                "LỢI NHUẬN RÒNG": Number(item.net_profit)
            }));
            // Ép cột
            columnWidths = [{ wpx: 130 }, { wpx: 130 }, { wpx: 140 }, { wpx: 130 }, { wpx: 140 }, { wpx: 140 }];
            printOrientation = 'landscape'; // Đẩy sang in ngang cho thoáng
            worksheet = XLSX.utils.json_to_sheet(excelData);
            fileName = `BaoCao_LaiLo_PNL_${startDate}.xlsx`;
        }
        else if (reportType === "revenue") {
            excelData = processedRevenueData.map((item) => ({
                "MÃ HĐ": item.isFirst ? `HD${item.invoice_id}` : "",
                "NGÀY": item.isFirst ? new Date(item.created_at).toLocaleDateString("vi-VN") : "",
                "NGƯỜI GIAO": item.isFirst ? (item.shipper_name || "") : "",
                "KHÁCH HÀNG": item.isFirst ? ((item.customer_name || "Khách lẻ") + (item.note ? `\n(${item.note})` : "")) : "",
                "SĐT": item.isFirst ? (item.phone || "") : "",
                "ĐỊA CHỈ": item.isFirst ? (item.address || item.customer_address || "") : "",
                "Hàng hóa": item.product_name,
                "ĐVT": item.unit || "",
                "Số Lượng": Number(item.quantity),
                "Đơn giá": Number(item.sell_price),
                "Thành tiền (SP)": Number(item.thanh_tien),
                "Thế chân (HĐ)": item.isFirst ? Number(item.inv_the_chan || 0) : "",
                "Tổng tiền HĐ": item.isFirst ? Number(item.inv_tong_tien || 0) : "",
                "Chưa trả (Vỏ)": item.isFirst ? Number(item.inv_unreturned || 0) : ""
            }));
            // Ép cột siêu hẹp để vừa 1 trang
            columnWidths = [{ wpx: 55 }, { wpx: 70 }, { wpx: 90 }, { wpx: 120 }, { wpx: 80 }, { wpx: 140 }, { wpx: 120 }, { wpx: 40 }, { wpx: 60 }, { wpx: 70 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 70 }];
            printOrientation = 'landscape';
            worksheet = XLSX.utils.json_to_sheet(excelData);

            const merges = [];
            let startRow = 1;
            for (let i = 0; i < processedRevenueData.length; i++) {
                const isLastRow = i === processedRevenueData.length - 1;
                const nextIsFirst = !isLastRow && processedRevenueData[i + 1].isFirst;
                if (isLastRow || nextIsFirst) {
                    if (i > startRow - 1) {
                        const colsToMerge = [0, 1, 2, 3, 4, 5, 11, 12, 13];
                        colsToMerge.forEach(colIndex => { merges.push({ s: { r: startRow, c: colIndex }, e: { r: i + 1, c: colIndex } }); });
                    }
                    startRow = i + 2;
                }
            }
            worksheet['!merges'] = merges;
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG TOÀN KỲ:", "", "", "", "", "", "", "", "", "", revenueFooterStats.thanh_tien, revenueFooterStats.the_chan, revenueFooterStats.tong_tien, revenueFooterStats.unreturned]], { origin: -1 });
            const totalRowIndex = processedRevenueData.length + 1;
            merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 9 } });
            fileName = `SoChiTietBanHang_${startDate}.xlsx`;
        }
        else if (reportType === "actual_revenue") {
            excelData = processedRevenueData.map((item) => ({
                "NGÀY": item.isFirst ? new Date(item.created_at).toLocaleDateString("vi-VN") : "",
                "MÃ HĐ": item.isFirst ? `HD${item.invoice_id}` : "",
                "NGƯỜI GIAO": item.isFirst ? (item.shipper_name || "") : "",
                "KHÁCH HÀNG": item.isFirst ? ((item.customer_name || "Khách lẻ") + (item.note ? `\n(${item.note})` : "")) : "",
                "SĐT": item.isFirst ? (item.phone || "") : "",
                "ĐỊA CHỈ": item.isFirst ? (item.customer_address || item.address || "") : "",
                "Hàng hóa": item.product_name,
                "SL": Number(item.quantity),
                "ĐƠN GIÁ": Number(item.sell_price),
                "THÀNH TIỀN (SP)": Number(item.subtotal || 0),
                "Thế Chân (HĐ)": item.isFirst ? Number(item.inv_actual_deposit || 0) : "",
                "Tổng Tiền": item.isFirst ? Number(item.inv_total || 0) : "",
                "Thực Thu": item.isFirst ? Number(item.inv_paid || 0) : "",
                "Công Nợ Tiền": item.isFirst ? Number(item.inv_debt || 0) : "",
                "Nợ Vỏ": item.isFirst ? Number(item.inv_actual_debt || 0) : ""
            }));
            // Ép cột siêu hẹp
            columnWidths = [{ wpx: 70 }, { wpx: 55 }, { wpx: 90 }, { wpx: 110 }, { wpx: 80 }, { wpx: 140 }, { wpx: 110 }, { wpx: 40 }, { wpx: 60 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 50 }];
            printOrientation = 'landscape';
            worksheet = XLSX.utils.json_to_sheet(excelData);

            const merges = [];
            let startRow = 1;
            for (let i = 0; i < processedRevenueData.length; i++) {
                const isLastRow = i === processedRevenueData.length - 1;
                const nextIsFirst = !isLastRow && processedRevenueData[i + 1].isFirst;
                if (isLastRow || nextIsFirst) {
                    if (i > startRow - 1) {
                        const colsToMerge = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14];
                        colsToMerge.forEach(colIndex => { merges.push({ s: { r: startRow, c: colIndex }, e: { r: i + 1, c: colIndex } }); });
                    }
                    startRow = i + 2;
                }
            }
            worksheet['!merges'] = merges;
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", "", "", "", "", "", "", "", "", revenueFooterStats.actual_deposit, revenueFooterStats.inv_total, revenueFooterStats.inv_paid, revenueFooterStats.inv_debt, revenueFooterStats.actual_debt]], { origin: -1 });
            const totalRowIndex = processedRevenueData.length + 1;
            merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 9 } });
            fileName = `DoanhThu_ThucTe_${startDate}.xlsx`;
        }
        else if (reportType === "revenue_by_product") {
            excelData = data.map((item) => ({
                "Sản phẩm": item.product_name,
                "Đơn giá (TB)": Number(item.total_revenue / item.total_quantity),
                "Số lượng bán": Number(item.total_quantity),
                "Doanh thu (VNĐ)": Number(item.total_revenue)
            }));
            columnWidths = [{ wpx: 250 }, { wpx: 120 }, { wpx: 120 }, { wpx: 150 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalQty = data.reduce((sum, item) => sum + Number(item.total_quantity), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG BÁN RA:", "", totalQty, totalRev]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 1 } }];
            fileName = `BaoCao_DoanhThu_TheoSP_${startDate}.xlsx`;
        }
        else if (reportType === "sales_by_region") {
            excelData = data.map((item) => ({
                "Khu Vực / Địa Chỉ": item.region,
                "Số Đơn Hàng": Number(item.total_orders),
                "Số Lượng SP Bán Ra": Number(item.total_products_sold),
                "Tổng Doanh Thu (VNĐ)": Number(item.total_revenue)
            }));
            columnWidths = [{ wpx: 300 }, { wpx: 100 }, { wpx: 130 }, { wpx: 150 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalProducts = data.reduce((sum, item) => sum + Number(item.total_products_sold), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG TOÀN KỲ:", totalOrders, totalProducts, totalRev]], { origin: -1 });
            fileName = `BaoCao_DoanhThu_KhuVuc_${startDate}.xlsx`;
        }
        else if (reportType === "bottles") {
            excelData = data.map((item) => ({
                "Khách Hàng": item.customer_name,
                "SĐT": item.phone || "",
                "Địa chỉ": item.customer_address || item.address || "",
                "Đã Mượn": Number(item.total_borrowed),
                "Đã Trả": Number(item.total_returned),
                "Đang Nợ (Vỏ)": Number(item.remaining_bottles),
                "Tiền Cọc (VNĐ)": Number(item.total_deposit)
            }));
            columnWidths = [{ wpx: 160 }, { wpx: 90 }, { wpx: 200 }, { wpx: 70 }, { wpx: 70 }, { wpx: 80 }, { wpx: 120 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalBot = data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0);
            const totalDep = data.reduce((sum, item) => sum + Number(item.total_deposit), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG ĐANG NỢ:", "", "", "", "", totalBot, totalDep]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 4 } }];
            fileName = `BaoCao_CongNo_VoBinh.xlsx`;
        }
        else if (reportType === "customers") {
            excelData = data.map((item) => ({
                "Khách Hàng": item.customer_name,
                "SĐT": item.phone || "",
                "Địa chỉ": item.customer_address || item.address || "",
                "Phân loại": Number(item.total_orders) >= 5 ? "Khách Cũ" : "Khách Mới",
                "Ngày đầu mua": new Date(item.first_purchase_date).toLocaleDateString("vi-VN"),
                "Số đơn": Number(item.total_orders),
                "Tổng tiền": Number(item.total_revenue)
            }));
            columnWidths = [{ wpx: 160 }, { wpx: 90 }, { wpx: 180 }, { wpx: 80 }, { wpx: 90 }, { wpx: 60 }, { wpx: 120 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalMoney = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", "", "", "", totalOrders, totalMoney]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 4 } }];
            fileName = `BaoCao_KhachHang_${startDate}.xlsx`;
        }
        else if (reportType === "bottle_notes") {
            excelData = data.map((item) => ({
                "Thời gian": new Date(item.created_at).toLocaleDateString("vi-VN"),
                "Khách Hàng": item.customer_name,
                "Loại vỏ": item.product_name || "Vỏ bình",
                "Số lượng": Number(item.quantity),
                "Tiền Hoàn": Number(item.deposit_amount),
                "Lý do": item.note || ""
            }));
            columnWidths = [{ wpx: 90 }, { wpx: 160 }, { wpx: 130 }, { wpx: 70 }, { wpx: 100 }, { wpx: 200 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalRefund = data.reduce((sum, item) => sum + Number(item.deposit_amount), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG TIỀN ĐÃ HOÀN:", "", "", "", totalRefund, ""]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 3 } }];
            fileName = `BaoCao_KhauHao_VoBinhTuKhach_${startDate}.xlsx`;
        }
        else if (reportType === "inventory_products") {
            excelData = data.map((item) => ({
                "Sản Phẩm": item.product_name,
                "Giá Bán": Number(item.sell_price),
                "Vỏ Khách Nợ": Number(item.bottles_with_customers),
                "Tồn Kho": Number(item.current_stock)
            }));
            columnWidths = [{ wpx: 220 }, { wpx: 120 }, { wpx: 120 }, { wpx: 120 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalDebt = data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG:", "", totalDebt, totalStock]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 1 } }];
            fileName = `BaoCao_TonKho_SanPham.xlsx`;
        }
        else if (reportType === "inventory_materials") {
            excelData = data.map((item) => ({
                "Nguyên Vật Liệu": item.product_name,
                "Tồn Kho Thực Tế": Number(item.current_stock)
            }));
            columnWidths = [{ wpx: 300 }, { wpx: 150 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG NGUYÊN VẬT LIỆU:", totalStock]], { origin: -1 });
            fileName = `BaoCao_TonKho_NVL.xlsx`;
        }
        else if (reportType === "wastage_report") {
            excelData = data.map((item) => ({
                "Tên Vật Tư (Nguyên liệu)": item.material_name,
                "ĐVT": item.unit || "",
                "Tổng Thực Dùng (Xưởng báo)": Number(item.used_qty),
                "Định Mức Chuẩn (Lý thuyết)": Number(item.standard_qty),
                "Số lượng Hao hụt": Number(item.wastage_qty),
                "Tiền Thất Thoát (Ước tính)": Number(item.wastage_cost)
            }));
            columnWidths = [{ wpx: 220 }, { wpx: 60 }, { wpx: 130 }, { wpx: 130 }, { wpx: 110 }, { wpx: 150 }];
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalLoss = data.reduce((sum, item) => sum + Number(item.wastage_cost), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG TIỀN THẤT THOÁT:", "", "", "", "", totalLoss]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 4 } }];
            fileName = `BaoCao_HaoHut_SanXuat_${startDate}.xlsx`;
        }
        else if (reportType === "purchases") {
            excelData = data.map((item) => ({
                "Ngày Nhập": new Date(item.created_at).toLocaleDateString("vi-VN"),
                "Mã PN": `PN#${item.id}`,
                "Nhà Cung Cấp": item.supplier_name || "Khách lẻ",
                "Mã HD": item.invoice_code || "",
                "Tiền Hàng": Number(item.total_goods_amount),
                "Thuế VAT": Number(item.vat_amount),
                "Phí Ship": Number(item.total_fee_amount),
                "Tổng Thanh Toán": Number(item.total_payment)
            }));
            columnWidths = [{ wpx: 80 }, { wpx: 70 }, { wpx: 200 }, { wpx: 100 }, { wpx: 110 }, { wpx: 100 }, { wpx: 100 }, { wpx: 130 }];
            printOrientation = 'landscape';
            worksheet = XLSX.utils.json_to_sheet(excelData);
            const totalGoods = data.reduce((sum, item) => sum + Number(item.total_goods_amount || 0), 0);
            const totalVAT = data.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);
            const totalFee = data.reduce((sum, item) => sum + Number(item.total_fee_amount || 0), 0);
            const totalPayment = data.reduce((sum, item) => sum + Number(item.total_payment || 0), 0);
            XLSX.utils.sheet_add_aoa(worksheet, [["TỔNG CỘNG TOÀN KỲ:", "", "", "", totalGoods, totalVAT, totalFee, totalPayment]], { origin: -1 });
            worksheet['!merges'] = [{ s: { r: data.length + 1, c: 0 }, e: { r: data.length + 1, c: 3 } }];
            fileName = `BaoCao_NhapHang_VAT_${startDate}.xlsx`;
        }

        if (worksheet) {
            worksheet['!cols'] = columnWidths.map(w => ({ wpx: w.wpx }));

            // 💡 CÀI ĐẶT TRANG IN TỰ ĐỘNG CHUẨN A4
            worksheet['!pageSetup'] = {
                paperSize: 9, // Giấy A4
                orientation: printOrientation, // Tự động xoay (Ngang/Dọc) tùy báo cáo
                fitToWidth: 1, // Ép vừa 1 trang bề ngang
                fitToHeight: 0 // Chiều dọc tự do nhảy trang
            };
            // Căn lề giấy siêu mỏng để chữ hiện to nhất có thể
            worksheet['!margins'] = { left: 0.1, right: 0.1, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 };

            // 💡 KẺ BẢNG VÀ TÔ MÀU
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = { c: C, r: R };
                    const cellRef = XLSX.utils.encode_cell(cellAddress);
                    if (!worksheet[cellRef]) continue;

                    // Kẻ viền (All Borders) và ngắt dòng (Wrap Text)
                    worksheet[cellRef].s = {
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        },
                        alignment: { vertical: "center", wrapText: true }
                    };

                    // Tiêu đề (Dòng đầu)
                    if (R === 0) {
                        worksheet[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
                        worksheet[cellRef].s.fill = { fgColor: { rgb: "0D6EFD" } };
                        worksheet[cellRef].s.alignment.horizontal = "center";
                    }
                    // Tổng cộng (Dòng cuối)
                    else if (R === range.e.r) {
                        worksheet[cellRef].s.font = { bold: true, color: { rgb: "DC3545" } };
                        worksheet[cellRef].s.fill = { fgColor: { rgb: "F8F9FA" } };
                        if (typeof worksheet[cellRef].v === 'string') {
                            worksheet[cellRef].s.alignment.horizontal = "right";
                        }
                    }
                    // Dữ liệu giữa (Căn giữa các số ngắn)
                    else {
                        if (typeof worksheet[cellRef].v === 'number' && worksheet[cellRef].v < 100000) {
                            worksheet[cellRef].s.alignment.horizontal = "center";
                        }
                    }
                }
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
            XLSX.writeFile(workbook, fileName);
        }
    };

    const exportPDF = async () => {
        if (!Array.isArray(data) || data.length === 0) return;
        const doc = new jsPDF({ orientation: (reportType === "revenue" || reportType === "actual_revenue" || reportType === "purchases") ? "landscape" : "portrait" });

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
            title = "SỔ CHI TIẾT BÁN HÀNG";
            tableCols = ["Ngày", "Mã HĐ", "Người giao", "Khách hàng", "SĐT", "Địa chỉ", "Hàng hóa", "SL", "Đơn giá", "Thành tiền", "Thế chân", "Tổng tiền"];
            tableRows = data.map(item => [
                new Date(item.created_at).toLocaleDateString("vi-VN"),
                `HD${item.invoice_id}`,
                item.shipper_name || "",
                (item.customer_name || "Khách lẻ") + (item.note ? `\n(${item.note})` : ""), // 💡 Đã chèn thêm ghi chú rớt dòng
                item.phone || "",
                item.customer_address || item.address || "",
                item.product_name,
                item.quantity,
                Number(item.sell_price).toLocaleString("vi-VN"),
                Number(item.thanh_tien).toLocaleString("vi-VN"),
                Number(item.the_chan).toLocaleString("vi-VN"),
                (Number(item.thanh_tien) + Number(item.the_chan)).toLocaleString("vi-VN")
            ]);
            footData = [
                { content: 'TỔNG CỘNG:', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: revenueFooterStats.thanh_tien.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } },
                { content: revenueFooterStats.the_chan.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [108, 117, 125] } },
                { content: revenueFooterStats.tong_tien.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [25, 135, 84] } }
            ];
            fileName = `SoChiTietBanHang_${startDate}.pdf`;
        }
        else if (reportType === "actual_revenue") {
            title = "BÁO CÁO DOANH THU THỰC TẾ (DÒNG TIỀN & VỎ BÌNH)";
            tableCols = ["Ngày", "Mã HĐ", "Người giao", "Khách hàng", "Hàng hóa", "SL", "Cọc Giữ", "Tổng Tiền", "Thực Thu", "Nợ Tiền", "Nợ Vỏ"];
            tableRows = processedRevenueData.map(item => [
                item.isFirst ? new Date(item.created_at).toLocaleDateString("vi-VN") : "",
                item.isFirst ? `HD${item.invoice_id}` : "",
                item.isFirst ? (item.shipper_name || "") : "",
                item.isFirst ? ((item.customer_name || "Khách lẻ") + (item.note ? `\n(${item.note})` : "")) : "", // 💡 Đã chèn thêm ghi chú rớt dòng
                item.product_name,
                item.quantity,
                item.isFirst ? Number(item.inv_actual_deposit || 0).toLocaleString("vi-VN") : "",
                item.isFirst ? Number(item.inv_total || 0).toLocaleString("vi-VN") : "",
                item.isFirst ? Number(item.inv_paid || 0).toLocaleString("vi-VN") : "",
                item.isFirst ? Number(item.inv_debt || 0).toLocaleString("vi-VN") : "",
                item.isFirst ? (item.inv_actual_debt > 0 ? item.inv_actual_debt.toString() : "0") : ""
            ]);
            footData = [
                { content: 'TỔNG CỘNG TOÀN KỲ:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: revenueFooterStats.actual_deposit.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [108, 117, 125] } },
                { content: revenueFooterStats.inv_total.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [33, 37, 41] } },
                { content: revenueFooterStats.inv_paid.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [25, 135, 84] } },
                { content: revenueFooterStats.inv_debt.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } },
                { content: revenueFooterStats.actual_debt > 0 ? revenueFooterStats.actual_debt.toString() + " vỏ" : "0 vỏ", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }
            ];
            fileName = `DoanhThu_ThucTe_${startDate}.pdf`;
        }
        else if (reportType === "pnl") {
            title = "BAO CAO LAI LO (P&L)";
            tableCols = ["Doanh Thu", "Giá Vốn", "Lợi Nhuận Gộp", "Chi Phí HĐ", "Hủy Vỏ Bình", "Lợi Nhuận Ròng"]; // 💡 Thêm cột cho PDF
            tableRows = data.map(item => [
                Number(item.total_revenue).toLocaleString("vi-VN") + " d",
                Number(item.total_cogs).toLocaleString("vi-VN") + " d",
                Number(item.gross_profit).toLocaleString("vi-VN") + " d",
                Number(item.total_expenses).toLocaleString("vi-VN") + " d",
                Number(item.total_bottle_loss || 0).toLocaleString("vi-VN") + " d",
                Number(item.net_profit).toLocaleString("vi-VN") + " d"
            ]);
            fileName = `BaoCao_LaiLo_PNL_${startDate}.pdf`;
        }
        else if (reportType === "revenue_by_product") {
            title = "BÁO CÁO DOANH THU THEO SẢN PHẨM";
            tableCols = ["Sản Phẩm", "Đơn Giá (TB)", "Số Lượng Bán", "Tổng Doanh Thu"];
            tableRows = data.map(item => [
                item.product_name, Number(item.total_revenue / item.total_quantity).toLocaleString("vi-VN") + " d", item.total_quantity, Number(item.total_revenue).toLocaleString("vi-VN") + " d"
            ]);
            const totalQty = data.reduce((sum, item) => sum + Number(item.total_quantity), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            footData = [{ content: 'TỔNG CỘNG:', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } }, { content: "", styles: {} }, { content: totalQty.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalRev.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_DoanhThu_TheoSP_${startDate}.pdf`;
        }
        else if (reportType === "sales_by_region") {
            title = "BÁO CÁO DOANH THU THEO KHU VỰC (ĐỊA CHỈ)";
            if (searchRegion) subtitle = `Tim kiem: ${searchRegion} | ` + subtitle;
            tableCols = ["Khu Vực / Địa Chỉ", "Số Đơn Hàng", "Sản Phẩm Đã Bán", "Tổng Doanh Thu"];
            tableRows = data.map(item => [
                item.region, item.total_orders, item.total_products_sold, Number(item.total_revenue).toLocaleString("vi-VN") + " d"
            ]);
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalProducts = data.reduce((sum, item) => sum + Number(item.total_products_sold), 0);
            const totalRev = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            footData = [{ content: 'TỔNG CỘNG:', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalOrders.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalProducts.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalRev.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_DoanhThu_KhuVuc_${startDate}.pdf`;
        }
        else if (reportType === "bottles") {
            title = "BÁO CÁO CÔNG NỢ VỎ BÌNH";
            subtitle = `Tính đến ngày: ${new Date().toLocaleDateString("vi-VN")}`;
            tableCols = ["Khách Hàng", "SĐT", "Địa Chỉ", "Mượn", "Trả", "Đang Nợ", "Tiền Cọc (VND)"];
            tableRows = data.map(item => [
                item.customer_name, item.phone || "", item.customer_address || item.address || "", item.total_borrowed, item.total_returned, item.remaining_bottles, Number(item.total_deposit).toLocaleString("vi-VN") + " d"
            ]);
            const totalBot = data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0);
            const totalDep = data.reduce((sum, item) => sum + Number(item.total_deposit), 0);
            footData = [{ content: 'TỔNG ĐANG NỢ:', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalBot.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalDep.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_CongNo_VoBinh_${today}.pdf`;
        }
        else if (reportType === "bottle_notes") {
            title = "BÁO CÁO KHẤU HAO / XUẤT HỦY VỎ TỪ KHÁCH";
            tableCols = ["Ngày", "Khách Hàng", "Loại vỏ", "SL", "Tiền Hoàn", "Lý do"];
            tableRows = data.map(item => [new Date(item.created_at).toLocaleDateString("vi-VN"), item.customer_name, item.product_name || "Vỏ bình", item.quantity, Number(item.deposit_amount).toLocaleString("vi-VN") + " d", item.note]);
            const totalRefund = data.reduce((sum, item) => sum + Number(item.deposit_amount), 0);
            footData = [{ content: 'TỔNG TIỀN ĐÃ HOÀN:', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalRefund.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, ""];
            fileName = `BaoCao_KhauHao_VoBinh_${startDate}.pdf`;
        }
        else if (reportType === "customers") {
            title = "BÁO CÁO KHÁCH HÀNG MỚI / CŨ";
            tableCols = ["Khách Hàng", "SĐT", "Địa chỉ", "Phân Loại", "Ngày đầu mua", "Số Đơn", "Tổng Tiền"];
            tableRows = data.map(item => [
                item.customer_name, item.phone || "", item.customer_address || item.address || "", Number(item.total_orders) >= 5 ? "Khách Cũ" : "Khách Mới", new Date(item.first_purchase_date).toLocaleDateString("vi-VN"), item.total_orders, Number(item.total_revenue).toLocaleString("vi-VN") + " d"
            ]);
            const totalOrders = data.reduce((sum, item) => sum + Number(item.total_orders), 0);
            const totalMoney = data.reduce((sum, item) => sum + Number(item.total_revenue), 0);
            footData = [{ content: 'TỔNG CỘNG:', colSpan: 5, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalOrders.toString(), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }, { content: totalMoney.toLocaleString("vi-VN") + " d", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_KhachHang_${startDate}.pdf`;
        }
        else if (reportType === "inventory_products") {
            title = "BÁO CÁO TỒN KHO SẢN PHẨM";
            subtitle = `Tính đến thời điểm hiện tại`;
            tableCols = ["Sản Phẩm", "Giá Bán", "Vỏ Khách Nợ", "Tồn Kho"];
            tableRows = data.map(item => [
                item.product_name, Number(item.sell_price).toLocaleString("vi-VN") + " d", item.bottles_with_customers, `${formatMoney(item.current_stock)} ${item.unit || ''}`.trim()
            ]);
            const totalDebt = data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            footData = [{ content: 'TONG CONG:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalDebt.toString() + " vo", styles: { fontStyle: 'bold', textColor: [220, 53, 69], halign: 'center' } }, { content: totalStock.toString(), styles: { fontStyle: 'bold', textColor: [25, 135, 84], halign: 'center' } }];
            fileName = `BaoCao_TonKho_SanPham_${today}.pdf`;
        }
        else if (reportType === "inventory_materials") {
            title = "BÁO CÁO TỒN KHO NGUYÊN VẬT LIỆU";
            subtitle = `Tính đến thời điểm hiện tại`;
            tableCols = ["Nguyên Vật Liệu", "Tồn Kho Thực Tế"];
            tableRows = data.map(item => [
                item.product_name, `${formatMoney(item.current_stock)} ${item.unit || ''}`.trim()
            ]);
            const totalStock = data.reduce((sum, item) => sum + Number(item.current_stock), 0);
            footData = [{ content: 'TỔNG CỘNG:', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalStock.toString(), styles: { fontStyle: 'bold', textColor: [33, 37, 41], halign: 'center' } }];
            fileName = `BaoCao_TonKho_NVL_${today}.pdf`;
        }
        else if (reportType === "wastage_report") {
            title = "BÁO CÁO HAO HỤT SẢN XUẤT (WASTAGE REPORT)";
            tableCols = ["Tên Vật Tư", "ĐVT", "Thực Dùng", "Định Mức", "Hao Hụt", "Tiền Thất Thoát"];
            tableRows = data.map(item => [
                item.material_name, item.unit || "", Number(item.used_qty), Number(item.standard_qty), item.wastage_qty > 0 ? `+${Number(item.wastage_qty)}` : "0", Number(item.wastage_cost).toLocaleString("vi-VN") + " đ"
            ]);
            const totalLoss = data.reduce((sum, item) => sum + Number(item.wastage_cost), 0);
            footData = [{ content: 'TỔNG TIỀN THẤT THOÁT:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalLoss.toLocaleString("vi-VN") + " đ", styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }];
            fileName = `BaoCao_HaoHut_SanXuat_${startDate}.pdf`;
        }
        else if (reportType === "purchases") {
            title = "BÁO CÁO NHẬP HÀNG & THUẾ VAT ĐẦU VÀO";
            tableCols = ["Ngày Nhập", "Mã PN", "Nhà Cung Cấp", "Mã HD", "Tiền Hàng", "Thuế VAT", "Phí Ship", "Tổng Thành Toán"];
            tableRows = data.map(item => [
                new Date(item.created_at).toLocaleDateString("vi-VN"), `PN#${item.id}`, item.supplier_name || "Khách lẻ", item.invoice_code || "", Number(item.total_goods_amount).toLocaleString("vi-VN"), Number(item.vat_amount).toLocaleString("vi-VN"), Number(item.total_fee_amount).toLocaleString("vi-VN"), Number(item.total_payment).toLocaleString("vi-VN")
            ]);
            const totalGoods = data.reduce((sum, item) => sum + Number(item.total_goods_amount || 0), 0);
            const totalVAT = data.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);
            const totalFee = data.reduce((sum, item) => sum + Number(item.total_fee_amount || 0), 0);
            const totalPayment = data.reduce((sum, item) => sum + Number(item.total_payment || 0), 0);
            footData = [
                { content: 'TỔNG CỘNG TOÀN KỲ:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalGoods.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [108, 117, 125] } }, { content: totalVAT.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [13, 202, 240] } }, { content: totalFee.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [255, 193, 7] } }, { content: totalPayment.toLocaleString("vi-VN"), styles: { fontStyle: 'bold', textColor: [220, 53, 69] } }
            ];
            fileName = `BaoCao_NhapHang_VAT_${startDate}.pdf`;
        }

        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(subtitle, 14, 22);

        let autoTableConfig = {
            head: [tableCols],
            body: tableRows,
            startY: 28,
            styles: { font: "Roboto" },
            headStyles: { fillColor: [13, 110, 253] },
            footStyles: { fillColor: [248, 249, 250], textColor: [33, 37, 41], fontStyle: "bold" }
        };

        if (footData.length > 0) autoTableConfig.foot = [footData];

        autoTable(doc, autoTableConfig);

        if (reportType === "pnl" && pnlDetails && pnlDetails.length > 0) {
            const finalY = doc.lastAutoTable.finalY || 40;
            doc.setFontSize(12); doc.setTextColor(13, 110, 253);
            doc.text("PHÂN TÍCH CHI TIẾT THEO SẢN PHẨM", 14, finalY + 15);
            const detailCols = ["STT", "Tên Sản Phẩm", "Số Lượng", "Doanh Thu", "Giá Vốn", "Lợi Nhuận Chưa Trừ CP", "Tỷ Suất"];
            const detailRows = pnlDetails.map((item, idx) => [
                idx + 1, item.product_name, item.total_sold, Number(item.total_revenue).toLocaleString("vi-VN") + " d", Number(item.total_cogs).toLocaleString("vi-VN") + " d", Number(item.gross_profit).toLocaleString("vi-VN") + " d", `${item.margin_percentage}%`
            ]);
            autoTable(doc, { head: [detailCols], body: detailRows, startY: finalY + 20, styles: { font: "Roboto" }, headStyles: { fillColor: [108, 117, 125] } });
        }

        doc.save(fileName);
        setToast({ message: "Xuất PDF thành công!", type: "success" });
    };

    // 📱 Hàm render Thẻ Card cho Giao diện Mobile
    const renderMobileCard = (item, index) => {
        if (reportType === "pnl") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                    <div className="card-body p-3">
                        <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom"><i className="bi bi-graph-up-arrow me-2"></i>Báo Cáo Lãi Lỗ (P&L)</h6>
                        <div className="d-flex justify-content-between mb-2"><span className="text-muted small">Doanh Thu:</span> <strong className="text-dark">{formatMoney(item.total_revenue)} đ</strong></div>
                        <div className="d-flex justify-content-between mb-2"><span className="text-muted small">Giá Vốn (COGS):</span> <strong className="text-secondary">{formatMoney(item.total_cogs)} đ</strong></div>
                        <div className="d-flex justify-content-between mb-2"><span className="text-muted small">Lợi Nhuận Gộp:</span> <strong className="text-primary">{formatMoney(item.gross_profit)} đ</strong></div>
                        <div className="d-flex justify-content-between mb-2"><span className="text-muted small">Chi Phí Hoạt Động Khác:</span> <strong className="text-danger">{formatMoney(item.total_expenses)} đ</strong></div>
                        {/* 💡 HIỂN THỊ CỘT THIỆT HẠI VỎ BÌNH LÊN ĐIỆN THOẠI */}
                        <div className="d-flex justify-content-between mb-2"><span className="text-muted small">Khấu Hao / Hủy Vỏ Bình:</span> <strong className="text-danger">{formatMoney(item.total_bottle_loss || 0)} đ</strong></div>

                        <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                            <span className="fw-bold text-dark">LỢI NHUẬN RÒNG:</span>
                            <strong className={`fs-5 ${item.net_profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatMoney(item.net_profit)} đ</strong>
                        </div>
                    </div>
                </div>
            );
        }
        if (reportType === "revenue" || reportType === "actual_revenue") {
            const amount = reportType === "actual_revenue" ? item.subtotal : item.thanh_tien;
            return (
                <div key={index} className={`card shadow-sm border-0 mb-3 rounded-4 bg-white ${item.isFirst ? 'mt-4 border-top border-primary border-4' : ''}`}>
                    {item.isFirst && (
                        <div className="card-header bg-light border-bottom p-3">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-bold text-primary fs-6">HĐ #{item.invoice_id}</span>
                                <span className="text-muted small">{new Date(item.created_at).toLocaleDateString("vi-VN")}</span>
                            </div>
                            <div className="fw-bold text-dark fs-5">{item.customer_name || "Khách lẻ"}</div>
                            <div className="small text-muted mb-1"><i className="bi bi-telephone-fill me-1"></i>{item.phone || "---"}</div>
                            <div className="small text-muted"><i className="bi bi-geo-alt-fill me-1 text-danger"></i>{item.customer_address || item.address || "---"}</div>
                        </div>
                    )}
                    <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-bold text-secondary">{item.product_name}</span>
                            <span className="badge bg-primary fs-6">{item.quantity} {item.unit}</span>
                        </div>
                        <div className="d-flex justify-content-between small text-muted">
                            <span>Đơn giá: {formatMoney(item.sell_price)}</span>
                            <strong className="text-danger fs-6">{formatMoney(amount)} đ</strong>
                        </div>
                    </div>
                    {item.isFirst && (
                        <div className="card-footer bg-white p-3 border-top border-dashed">
                            {reportType === "revenue" && (
                                <>
                                    <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Cọc vỏ:</span> <strong>{formatMoney(item.inv_the_chan)} đ</strong></div>
                                    <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Chưa trả vỏ:</span> <strong className="text-danger">{item.inv_unreturned > 0 ? `${item.inv_unreturned} vỏ` : "0"}</strong></div>
                                    <div className="d-flex justify-content-between mt-2 pt-2 border-top"><span className="fw-bold">TỔNG HÓA ĐƠN:</span> <strong className="text-success fs-5">{formatMoney(item.inv_tong_tien)} đ</strong></div>
                                </>
                            )}
                            {reportType === "actual_revenue" && (
                                <>
                                    <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Cọc vỏ:</span> <strong>{formatMoney(item.inv_actual_deposit)} đ</strong></div>
                                    <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Tổng Tiền Bill:</span> <strong className="text-dark">{formatMoney(item.inv_total)} đ</strong></div>
                                    <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Khách Trả (Thực thu):</span> <strong className="text-success">{formatMoney(item.inv_paid)} đ</strong></div>
                                    <div className="d-flex justify-content-between mt-2 pt-2 border-top"><span className="fw-bold">CÔNG NỢ (TIỀN):</span> <strong className={item.inv_debt > 0 ? "text-danger fs-5" : "text-success fs-5"}>{item.inv_debt > 0 ? formatMoney(item.inv_debt) + " đ" : "0 đ"}</strong></div>
                                    <div className="d-flex justify-content-between mt-1"><span className="fw-bold">NỢ VỎ (THỰC TẾ):</span> <strong className={item.inv_actual_debt > 0 ? "text-danger fs-5" : "text-success fs-5"}>{item.inv_actual_debt > 0 ? `${item.inv_actual_debt} vỏ` : "Đã trả đủ"}</strong></div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        if (reportType === "revenue_by_product") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                    <div className="card-body p-3">
                        <div className="fw-bold text-primary fs-5 mb-2">{item.product_name}</div>
                        <div className="d-flex justify-content-between small text-muted mb-1"><span>Đơn giá (TB):</span> <strong>{formatMoney(item.total_revenue / item.total_quantity)} đ</strong></div>
                        <div className="d-flex justify-content-between small text-muted mb-2 pb-2 border-bottom"><span>Số lượng bán:</span> <strong>{item.total_quantity}</strong></div>
                        <div className="d-flex justify-content-between"><span className="fw-bold text-dark">DOANH THU:</span> <strong className="text-danger fs-5">{formatMoney(item.total_revenue)} đ</strong></div>
                    </div>
                </div>
            );
        }
        if (reportType === "sales_by_region") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                    <div className="card-body p-3">
                        <div className="fw-bold text-dark fs-5 mb-2"><i className="bi bi-geo-alt-fill text-danger me-2"></i>{item.region}</div>
                        <div className="d-flex justify-content-between small text-muted mb-1"><span>Số đơn hàng:</span> <strong>{item.total_orders} đơn</strong></div>
                        <div className="d-flex justify-content-between small text-muted mb-2 pb-2 border-bottom"><span>Sản phẩm bán ra:</span> <strong className="text-info">{item.total_products_sold} SP</strong></div>
                        <div className="d-flex justify-content-between"><span className="fw-bold text-dark">DOANH THU:</span> <strong className="text-danger fs-5">{formatMoney(item.total_revenue)} đ</strong></div>
                    </div>
                </div>
            );
        }
        if (reportType === "bottles") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                    <div className="card-body p-3">
                        <div className="fw-bold text-primary fs-5 mb-1">{item.customer_name} <span className="small text-muted fw-normal">({item.customer_code})</span></div>
                        <div className="small text-muted mb-2 pb-2 border-bottom"><i className="bi bi-telephone-fill me-2"></i>{item.phone || "---"}</div>
                        <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Đã mượn / Đã trả:</span> <strong>{item.total_borrowed} / {item.total_returned}</strong></div>
                        <div className="d-flex justify-content-between mt-2 pt-2 border-top"><span className="fw-bold text-dark">ĐANG NỢ VỎ:</span> <strong className="text-danger fs-5">{item.remaining_bottles} vỏ</strong></div>
                        <div className="d-flex justify-content-between mt-1"><span className="fw-bold text-dark">CỌC ĐANG GIỮ:</span> <strong className="text-success fs-5">{formatMoney(item.total_deposit)} đ</strong></div>
                    </div>
                </div>
            );
        }
        if (reportType === "purchases") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                    <div className="card-header bg-light border-bottom p-3 d-flex justify-content-between">
                        <span className="fw-bold text-dark">PN#{item.id}</span>
                        <span className="text-muted small">{new Date(item.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                    <div className="card-body p-3">
                        <div className="fw-bold text-primary mb-1">{item.supplier_name || "Nhà cung cấp lẻ"}</div>
                        <div className="small text-muted mb-2 pb-2 border-bottom">Mã HĐ/CT: {item.invoice_code || "---"}</div>
                        <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Tiền Hàng:</span> <strong>{formatMoney(item.total_goods_amount)} đ</strong></div>
                        <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Thuế VAT:</span> <strong className="text-info">+{formatMoney(item.vat_amount)} đ</strong></div>
                        <div className="d-flex justify-content-between small mb-2 pb-2 border-bottom"><span className="text-muted">Phí Ship:</span> <strong className="text-warning">+{formatMoney(item.total_fee_amount)} đ</strong></div>
                        <div className="d-flex justify-content-between"><span className="fw-bold text-dark">TỔNG THANH TOÁN:</span> <strong className="text-danger fs-5">{formatMoney(item.total_payment)} đ</strong></div>
                    </div>
                </div>
            );
        }
        if (reportType === "wastage_report") {
            return (
                <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white border-start border-danger border-4">
                    <div className="card-body p-3">
                        <div className="fw-bold text-dark fs-5 mb-2">{item.material_name}</div>
                        {/* 💡 ĐÃ FIX: Tương tự, đổi tên biến và bọc Number() */}
                        <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Thực dùng / Định mức:</span> <strong>{Number(item.used_qty)} / {Number(item.standard_qty)}</strong></div>
                        <div className="d-flex justify-content-between mt-2 pt-2 border-top"><span className="fw-bold text-dark">SỐ LƯỢNG HAO HỤT:</span> <strong className="text-danger fs-5">{item.wastage_qty > 0 ? `+ ${Number(item.wastage_qty)}` : 0}</strong></div>
                        <div className="d-flex justify-content-between mt-1"><span className="fw-bold text-dark">TIỀN THẤT THOÁT:</span> <strong className="text-danger fs-5">{formatMoney(item.wastage_cost)} đ</strong></div>
                    </div>
                </div>
            );
        }
        // Thẻ mặc định cho các reportType còn lại
        return (
            <div key={index} className="card shadow-sm border-0 mb-3 rounded-4 bg-white">
                <div className="card-body p-3">
                    {Object.entries(item).map(([key, val], i) => (
                        <div key={i} className="d-flex justify-content-between small mb-1 border-bottom pb-1">
                            <span className="text-muted text-capitalize">{key.replace(/_/g, " ")}:</span>
                            <strong className="text-dark text-end" style={{ maxWidth: '60%' }}>{val}</strong>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="container-fluid py-4 px-2 px-md-4">

                {/* 🎨 KHU VỰC BỘ LỌC (Control Panel) */}
                <div className="bg-white shadow-sm p-3 p-md-4 mb-4 rounded-4 border-top border-primary border-4">
                    <h4 className="fw-bold mb-4 text-primary d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                            <i className="bi bi-bar-chart-fill"></i>
                        </div>
                        Trung Tâm Báo Cáo
                    </h4>

                    <div className="row g-3 align-items-end mb-3">
                        <div className="col-12 col-xl-3">
                            <label className="form-label fw-bold small text-secondary text-uppercase">Loại Báo Cáo</label>
                            <select className="form-select form-select-lg border-primary shadow-sm fw-bold text-primary bg-light text-truncate"
                                style={{
                                    maxWidth: '100%',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap', // Bắt buộc nằm trên 1 dòng
                                    overflow: 'hidden' // Cắt đi phần dư thừa
                                }}
                                value={reportType}
                                onChange={(e) => {
                                    setReportType(e.target.value);
                                    setData([]);
                                    setPnlDetails([]);
                                    setSearchRegion("");
                                }}>
                                <option value="actual_revenue">🚀 Báo cáo Doanh thu Thực tế</option>
                                <option value="revenue">💰 Báo cáo Doanh thu (Theo Hóa đơn)</option>
                                <option value="pnl">📈 Báo cáo Lãi Lỗ (P&L Kết Quả Kinh Doanh)</option>
                                <option value="revenue_by_product">📊 Báo cáo Doanh thu (Theo Sản phẩm)</option>
                                <option value="sales_by_region">📍 Báo cáo Doanh thu (Theo Khu vực)</option>
                                <option value="bottles">♻️ Báo cáo Công nợ Vỏ bình</option>
                                {/* 💡 SỬA LẠI TÊN CHO KHỎI NHẦM LẪN */}
                                <option value="bottle_notes">📝 Báo cáo Khấu hao / Hủy vỏ từ khách</option>
                                <option value="customers">👥 Báo cáo Khách hàng Mới / Cũ</option>
                                <option value="inventory_products">📦 Báo cáo Tồn kho Sản phẩm</option>
                                <option value="inventory_materials">🔧 Báo cáo Tồn kho NVL</option>
                                <option value="purchases">🛒 Báo cáo Nhập Hàng & Thuế VAT</option>
                                <option value="wastage_report">⚠️ Báo cáo Hao hụt Sản xuất</option>
                            </select>
                        </div>

                        {!reportType.startsWith("inventory") && (
                            <>
                                <div className="col-6 col-xl-2">
                                    <label className="form-label fw-bold small text-secondary text-uppercase">Từ ngày</label>
                                    <div className="input-group input-group-lg shadow-sm">
                                        {/* 💡 ĐÃ FIX: Thêm onClick gọi showPicker() để bung lịch khi bấm icon */}
                                        <span
                                            className="input-group-text bg-white text-primary"
                                            style={{ cursor: 'pointer' }}
                                            onClick={(e) => {
                                                const input = e.currentTarget.nextElementSibling;
                                                if (input && input.showPicker) input.showPicker();
                                            }}
                                            title="Chọn ngày"
                                        >
                                            <i className="bi bi-calendar-event"></i>
                                        </span>
                                        <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ cursor: 'pointer' }} />
                                    </div>
                                </div>
                                <div className="col-6 col-xl-2">
                                    <label className="form-label fw-bold small text-secondary text-uppercase">Đến ngày</label>
                                    <div className="input-group input-group-lg shadow-sm">
                                        {/* 💡 ĐÃ FIX: Tương tự cho ô Đến ngày */}
                                        <span
                                            className="input-group-text bg-white text-primary"
                                            style={{ cursor: 'pointer' }}
                                            onClick={(e) => {
                                                const input = e.currentTarget.nextElementSibling;
                                                if (input && input.showPicker) input.showPicker();
                                            }}
                                            title="Chọn ngày"
                                        >
                                            <i className="bi bi-calendar-check"></i>
                                        </span>
                                        <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ cursor: 'pointer' }} />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="col-12 col-xl-3 mt-3 mt-xl-0">
                            <button className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" onClick={fetchReport} disabled={loading}>
                                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-search me-2"></i>}
                                LẤY BÁO CÁO
                            </button>
                        </div>

                        <div className="col-6 col-xl-1 mt-3 mt-xl-0 d-none d-md-block">
                            <button className="btn btn-success btn-lg w-100 shadow-sm" onClick={exportExcel} disabled={!Array.isArray(data) || data.length === 0} title="Xuất Excel">
                                <i className="bi bi-file-earmark-excel fs-4"></i>
                            </button>
                        </div>
                        <div className="col-6 col-xl-1 mt-3 mt-xl-0 d-none d-md-block">
                            <button className="btn btn-danger btn-lg w-100 shadow-sm" onClick={exportPDF} disabled={!Array.isArray(data) || data.length === 0} title="Xuất PDF">
                                <i className="bi bi-file-earmark-pdf fs-4"></i>
                            </button>
                        </div>
                    </div>

                    {reportType === "sales_by_region" && (
                        <div className="row mt-3">
                            <div className="col-12 col-md-5">
                                <div className="input-group shadow-sm border border-info rounded-3 overflow-hidden">
                                    <span className="input-group-text bg-white text-info border-0"><i className="bi bi-geo-alt-fill"></i></span>
                                    <input type="text" className="form-control border-0 ps-0 shadow-none" placeholder="Tìm theo Phường, Khóm, Đường..." value={searchRegion} onChange={(e) => setSearchRegion(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {!reportType.startsWith("inventory") && (
                        <div className="mt-3 pt-3 border-top d-flex flex-wrap gap-2 align-items-center">
                            <span className="small fw-bold text-muted me-2"><i className="bi bi-lightning-charge-fill text-warning me-1"></i>Mốc thời gian:</span>
                            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setQuickDate('today')}>Hôm nay</button>
                            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setQuickDate('week')}>Tuần này</button>
                            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setQuickDate('month')}>Tháng này</button>
                            <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => setQuickDate('year')}>Năm nay</button>

                            <div className="d-flex d-md-none ms-auto gap-2">
                                <button className="btn btn-sm btn-success rounded-pill px-3 shadow-sm" onClick={exportExcel} disabled={!Array.isArray(data) || data.length === 0}><i className="bi bi-file-earmark-excel"></i> Excel</button>
                                <button className="btn btn-sm btn-danger rounded-pill px-3 shadow-sm" onClick={exportPDF} disabled={!Array.isArray(data) || data.length === 0}><i className="bi bi-file-earmark-pdf"></i> PDF</button>
                            </div>
                        </div>
                    )}
                </div>

                {reportType.startsWith("inventory") && (
                    <div className="alert alert-info border-info border-start border-4 mb-4 shadow-sm rounded-4 fw-bold">
                        <i className="bi bi-info-circle-fill me-2"></i> Báo cáo này hiển thị số lượng tồn kho thực tế ngay tại thời điểm hiện tại.
                    </div>
                )}

                {/* 💻 GIAO DIỆN BẢNG DÀNH CHO MÁY TÍNH */}
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden d-none d-lg-block">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light text-secondary text-center align-middle">
                                {reportType === "pnl" && (
                                    <tr>
                                        <th>Tổng Doanh Thu (A)</th>
                                        <th>Tổng Giá Vốn (B)</th>
                                        <th className="text-dark">Lợi Nhuận Gộp (C = A - B)</th>
                                        <th>Chi Phí HĐ (D)</th>
                                        {/* 💡 THÊM CỘT KHẤU HAO VỎ CHO P&L */}
                                        <th className="text-danger">Khấu Hao Vỏ (E)</th>
                                        <th className="text-white" style={{ backgroundColor: '#198754' }}>Lợi Nhuận Ròng (F = C - D - E)</th>
                                    </tr>
                                )}
                                {(reportType === "revenue" || reportType === "actual_revenue") && (
                                    <tr className="text-nowrap">
                                        <th>Mã HĐ</th><th>Ngày</th><th>Người giao</th><th className="text-start">Khách hàng</th><th>SĐT</th><th className="text-start">Địa chỉ</th><th>Hàng hóa</th><th>ĐVT</th><th>Số Lượng</th><th className="text-center">Đơn giá</th><th className="text-center">Thành tiền (SP)</th>
                                        {reportType === "revenue" && <><th>Thế chân (HĐ)</th><th>Tổng tiền HĐ</th><th>Chưa trả (Vỏ)</th></>}
                                        {reportType === "actual_revenue" && <><th>Thế Chân (HĐ)</th><th>Tổng Tiền</th><th>Thực Thu</th><th>Công Nợ</th><th>Nợ Vỏ Thực Tế</th></>}
                                    </tr>
                                )}
                                {reportType === "revenue_by_product" && (
                                    <tr><th className="text-start ps-4">Tên sản phẩm</th><th className="text-end">Đơn giá (TB)</th><th>Số lượng đã bán</th><th className="text-end pe-4">Tổng doanh thu</th></tr>
                                )}
                                {reportType === "sales_by_region" && (
                                    <tr><th className="text-start w-50 ps-4">Khu vực / Địa chỉ</th><th>Số đơn hàng</th><th>Số lượng SP bán ra</th><th className="text-end pe-4">Tổng doanh thu</th></tr>
                                )}
                                {reportType === "bottles" && (
                                    <tr><th className="text-start ps-4">Khách hàng</th><th>SĐT</th><th className="text-start">Địa chỉ</th><th>Mượn</th><th>Trả</th><th>Nợ vỏ</th><th className="text-end pe-4">Tiền cọc giữ</th></tr>
                                )}
                                {reportType === "bottle_notes" && (
                                    <tr><th className="ps-4">Thời gian</th><th className="text-start">Khách hàng</th><th>Loại vỏ</th><th>Số lượng</th><th className="text-end">Tiền hoàn</th><th className="text-start pe-4">Lý do</th></tr>
                                )}
                                {reportType === "customers" && (
                                    <tr><th className="text-start ps-4">Khách hàng</th><th>SĐT</th><th className="text-start">Địa chỉ</th><th>Phân loại</th><th>Ngày mua đầu tiên</th><th>Số đơn</th><th className="text-end pe-4">Tổng tiền</th></tr>
                                )}
                                {reportType === "inventory_products" && (
                                    <tr><th className="text-start ps-4">Sản phẩm</th><th className="text-end">Giá bán</th><th>Vỏ khách nợ</th><th className="pe-4">Tồn kho thực tế</th></tr>
                                )}
                                {reportType === "inventory_materials" && (
                                    <tr><th className="text-start w-50 ps-4">Nguyên vật liệu</th><th className="pe-4">Tồn kho thực tế</th></tr>
                                )}
                                {reportType === "purchases" && (
                                    <tr className="text-nowrap">
                                        <th className="ps-4">Ngày Nhập</th><th>Mã PN</th><th className="text-start">Nhà Cung Cấp</th><th>Mã HĐ/ CT</th><th className="text-end">Tiền Hàng</th><th className="text-end">Thuế VAT</th><th className="text-end">Phí Ship</th><th className="text-end pe-4">Tổng Thanh Toán</th>
                                    </tr>
                                )}
                                {reportType === "wastage_report" && (
                                    <tr><th className="text-start ps-4">Tên Nguyên Vật Liệu</th><th>ĐVT</th><th>Tổng Thực Dùng</th><th>Định Mức Chuẩn</th><th>Số lượng Hao hụt</th><th className="text-end pe-4">Tiền Thất Thoát</th></tr>
                                )}
                            </thead>

                            <tbody>
                                {Array.isArray(data) && data.length > 0 ? (
                                    (reportType === "revenue" || reportType === "actual_revenue") ? (
                                        processedRevenueData.map((item, index) => (
                                            <tr key={index} className="text-center align-middle">
                                                {item.isFirst && <td rowSpan={item.rowSpan} className="fw-bold align-middle bg-white border-end ps-3">HD{item.invoice_id}</td>}
                                                {item.isFirst && <td rowSpan={item.rowSpan} className="align-middle bg-white border-end text-muted small">{new Date(item.created_at).toLocaleDateString("vi-VN")}</td>}
                                                {item.isFirst && <td rowSpan={item.rowSpan} className="fw-bold text-info align-middle bg-white border-end">{item.shipper_name || ""}</td>}
                                                {item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className="text-start fw-bold text-primary align-middle bg-white border-end">
                                                        {item.customer_name || "Khách lẻ"}
                                                        {item.note && <span className="d-block small text-danger fw-normal fst-italic mt-1"><i className="bi bi-info-circle me-1"></i>{item.note}</span>}
                                                    </td>
                                                )}
                                                {item.isFirst && <td rowSpan={item.rowSpan} className="align-middle bg-white border-end">{item.phone || "---"}</td>}
                                                {item.isFirst && <td rowSpan={item.rowSpan} className="text-start small text-wrap align-middle bg-white border-end" style={{ maxWidth: '200px' }}>{item.customer_address || item.address || "---"}</td>}

                                                <td className="text-start border-start fw-bold">{item.product_name}</td>
                                                <td className="text-muted small">{item.unit}</td>
                                                <td className="fw-bold text-dark fs-6">{item.quantity}</td>
                                                <td className="text-muted">{formatMoney(item.sell_price)}</td>
                                                <td className="text-danger fw-bold">{formatMoney(reportType === "actual_revenue" ? (item.subtotal || 0) : (item.thanh_tien || 0))}</td>

                                                {reportType === "revenue" && item.isFirst && <td rowSpan={item.rowSpan} className="text-secondary fw-bold align-middle bg-white border-start border-end">{formatMoney(item.inv_the_chan)}</td>}
                                                {reportType === "revenue" && item.isFirst && <td rowSpan={item.rowSpan} className="text-success fw-bold fs-6 align-middle bg-white border-end">{formatMoney(item.inv_tong_tien)}</td>}
                                                {reportType === "revenue" && item.isFirst && <td rowSpan={item.rowSpan} className="fw-bold text-danger align-middle bg-white">{item.inv_unreturned > 0 ? item.inv_unreturned : ""}</td>}

                                                {reportType === "actual_revenue" && item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className="text-secondary fw-bold align-middle bg-white border-start border-end">
                                                        {item.inv_actual_deposit > 0 ? formatMoney(item.inv_actual_deposit) : "0"}
                                                    </td>
                                                )}
                                                {reportType === "actual_revenue" && item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className="text-dark fw-bold align-middle bg-light border-end fs-6">
                                                        {formatMoney(item.inv_total)}
                                                    </td>
                                                )}
                                                {reportType === "actual_revenue" && item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className="text-success fw-bold align-middle bg-white border-end fs-5">
                                                        {formatMoney(item.inv_paid)}
                                                    </td>
                                                )}
                                                {reportType === "actual_revenue" && item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className={`fw-bold align-middle border-end fs-5 ${item.inv_debt > 0 ? 'text-danger bg-danger bg-opacity-10' : 'text-success bg-white'}`}>
                                                        {item.inv_debt > 0 ? formatMoney(item.inv_debt) : "0"}
                                                    </td>
                                                )}
                                                {reportType === "actual_revenue" && item.isFirst && (
                                                    <td rowSpan={item.rowSpan} className="align-middle bg-white border-end fw-bold">
                                                        {item.inv_actual_debt > 0 ? <span className="text-danger">{item.inv_actual_debt} vỏ</span> : <span className="text-success"><i className="bi bi-check-circle me-1"></i>Đã trả</span>}
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    ) : (
                                        data.map((item, index) => (
                                            <tr key={index} className="text-center align-middle">
                                                {reportType === "pnl" && (
                                                    <>
                                                        <td className="fw-bold text-dark fs-5">{formatMoney(item.total_revenue)} đ</td>
                                                        <td className="fw-bold text-secondary fs-5">{formatMoney(item.total_cogs)} đ</td>
                                                        <td className="fw-bold text-primary fs-4 bg-light">{formatMoney(item.gross_profit)} đ</td>
                                                        <td className="fw-bold text-danger fs-5">{formatMoney(item.total_expenses)} đ</td>
                                                        {/* 💡 HIỂN THỊ CỘT THIỆT HẠI VỎ BÌNH TRÊN BẢNG */}
                                                        <td className="fw-bold text-danger fs-5">{formatMoney(item.total_bottle_loss || 0)} đ</td>
                                                        <td className={`fw-bold fs-3 ${item.net_profit >= 0 ? "text-success bg-success bg-opacity-10" : "text-danger bg-danger bg-opacity-10"}`}>
                                                            {formatMoney(item.net_profit)} đ
                                                        </td>
                                                    </>
                                                )}

                                                {reportType === "revenue_by_product" && (
                                                    <>
                                                        <td className="text-start fw-bold text-primary ps-4">{item.product_name}</td>
                                                        <td className="text-end fw-bold text-info">{formatMoney(item.total_revenue / item.total_quantity)} đ</td>
                                                        <td className="fw-bold fs-5 text-dark">{item.total_quantity}</td>
                                                        <td className="text-end fw-bold text-danger pe-4">{formatMoney(item.total_revenue)} đ</td>
                                                    </>
                                                )}

                                                {reportType === "sales_by_region" && (
                                                    <>
                                                        <td className="text-start fw-bold text-primary ps-4">{item.region}</td>
                                                        <td className="fw-bold fs-5">{item.total_orders}</td>
                                                        <td className="fw-bold text-info fs-5">{item.total_products_sold}</td>
                                                        <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(item.total_revenue)} đ</td>
                                                    </>
                                                )}

                                                {reportType === "bottles" && (
                                                    <>
                                                        <td className="text-start ps-4">
                                                            <span className="fw-bold d-block text-primary">{item.customer_name}</span>
                                                            <span className="small text-muted">{item.customer_code}</span>
                                                        </td>
                                                        <td>{item.phone || "---"}</td>
                                                        <td className="text-start small text-wrap" style={{ maxWidth: '200px' }}>{item.customer_address || item.address || "---"}</td>
                                                        <td className="fw-bold text-dark">{item.total_borrowed}</td>
                                                        <td className="fw-bold text-dark">{item.total_returned}</td>
                                                        <td><span className="badge bg-danger fs-6 rounded-pill">{item.remaining_bottles}</span></td>
                                                        <td className="text-end fw-bold pe-4">{formatMoney(item.total_deposit)} đ</td>
                                                    </>
                                                )}

                                                {reportType === "bottle_notes" && (
                                                    <>
                                                        <td className="ps-4 text-muted">{new Date(item.created_at).toLocaleDateString("vi-VN")}</td>
                                                        <td className="text-start fw-bold text-primary">{item.customer_name}</td>
                                                        <td>{item.product_name || "Vỏ bình"}</td>
                                                        <td className="fw-bold text-dark fs-5">{item.quantity}</td>
                                                        <td className="text-end fw-bold text-success">{formatMoney(item.deposit_amount)} đ</td>
                                                        <td className="text-start text-danger fst-italic pe-4">"{item.note}"</td>
                                                    </>
                                                )}

                                                {reportType === "customers" && (
                                                    <>
                                                        <td className="text-start fw-bold text-primary ps-4">{item.customer_name}</td>
                                                        <td>{item.phone || "---"}</td>
                                                        <td className="text-start small text-wrap" style={{ maxWidth: '200px' }}>{item.customer_address || item.address || "---"}</td>
                                                        <td className="fw-bold">
                                                            <span className={`badge px-3 py-2 rounded-pill ${Number(item.total_orders) >= 5 ? "bg-warning text-dark" : "bg-success"}`}>
                                                                {Number(item.total_orders) >= 5 ? "Khách Cũ" : "Khách Mới"}
                                                            </span>
                                                        </td>
                                                        <td className="fw-bold text-muted">{new Date(item.first_purchase_date).toLocaleDateString("vi-VN")}</td>
                                                        <td className="fw-bold fs-5 text-dark">{item.total_orders}</td>
                                                        <td className="text-end fw-bold text-danger pe-4">{formatMoney(item.total_revenue)} đ</td>
                                                    </>
                                                )}

                                                {reportType === "inventory_products" && (
                                                    <>
                                                        <td className="text-start fw-bold text-primary ps-4">{item.product_name}</td>
                                                        <td className="text-end text-muted">{formatMoney(item.sell_price)} đ</td>
                                                        <td className="fw-bold text-danger fs-5">{item.bottles_with_customers} <span className="small fw-normal text-muted">vỏ</span></td>
                                                        <td className="fw-bold text-success fs-5 pe-4">{formatMoney(item.current_stock)} <span className="small fw-normal text-muted">{item.unit || ''}</span></td>
                                                    </>
                                                )}

                                                {reportType === "inventory_materials" && (
                                                    <>
                                                        <td className="text-start fw-bold text-secondary ps-4">{item.product_name}</td>
                                                        <td className="fw-bold text-dark fs-5 pe-4">{formatMoney(item.current_stock)} <span className="small fw-normal text-muted">{item.unit || ''}</span></td>
                                                    </>
                                                )}

                                                {reportType === "purchases" && (
                                                    <>
                                                        <td className="ps-4 text-muted">{new Date(item.created_at).toLocaleDateString("vi-VN")}</td>
                                                        <td className="fw-bold text-secondary">PN#{item.id}</td>
                                                        <td className="text-start fw-bold text-dark">{item.supplier_name || "---"}</td>
                                                        <td className="text-primary fw-bold">{item.invoice_code || "---"}</td>
                                                        <td className="text-end text-secondary fw-bold">{formatMoney(item.total_goods_amount)} đ</td>
                                                        <td className="text-end text-info fw-bold">
                                                            {item.vat_amount > 0 ? `+${formatMoney(item.vat_amount)} đ` : "0 đ"}
                                                        </td>
                                                        <td className="text-end text-warning fw-bold">{item.total_fee_amount > 0 ? `+${formatMoney(item.total_fee_amount)} đ` : "0 đ"}</td>
                                                        <td className="text-end text-danger fw-bold fs-6 pe-4">{formatMoney(item.total_payment)} đ</td>
                                                    </>
                                                )}
                                                {reportType === "wastage_report" && (
                                                    <>
                                                        <td className="text-start fw-bold text-dark ps-4">{item.material_name}</td>
                                                        <td className="text-muted">{item.unit || "---"}</td>
                                                        <td className="text-primary fw-bold fs-5">{Number(item.used_qty)}</td>
                                                        <td className="text-success fw-bold fs-5">{Number(item.standard_qty)}</td>
                                                        <td className="text-danger fw-bold fs-5">{item.wastage_qty > 0 ? `+ ${Number(item.wastage_qty)}` : 0}</td>
                                                        <td className="text-end fw-bold text-danger pe-4">{formatMoney(item.wastage_cost)} đ</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))
                                    )
                                ) : (
                                    <tr>
                                        <td colSpan="15" className="text-center py-5 text-muted bg-light">
                                            <i className="bi bi-inboxes-fill fs-1 d-block mb-3 text-secondary opacity-25"></i>
                                            Chưa có dữ liệu thống kê. Vui lòng chọn mốc thời gian và bấm "Lấy Báo Cáo"
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {Array.isArray(data) && data.length > 0 && (
                                <tfoot>
                                    {(reportType === "revenue" || reportType === "actual_revenue") && (
                                        <tr className="text-nowrap align-middle" style={{ backgroundColor: "#f8f9fa", borderTop: "2px solid #0d6efd" }}>
                                            <td colSpan="10" className="text-end fw-bold text-dark fs-6 pe-3">TỔNG CỘNG TOÀN KỲ:</td>
                                            <td className="text-center fw-bold fs-5 text-danger">{formatMoney(revenueFooterStats.thanh_tien)}</td>

                                            {reportType === "revenue" && <td className="text-center fw-bold fs-5 text-secondary">{formatMoney(revenueFooterStats.the_chan)}</td>}
                                            {reportType === "revenue" && <td className="text-center fw-bold fs-5 text-success">{formatMoney(revenueFooterStats.tong_tien)}</td>}
                                            {reportType === "revenue" && <td className="text-center fw-bold fs-5 text-dark">{revenueFooterStats.unreturned > 0 ? revenueFooterStats.unreturned : ""}</td>}

                                            {reportType === "actual_revenue" && <td className="text-center fw-bold fs-5 text-secondary">{formatMoney(revenueFooterStats.actual_deposit)}</td>}
                                            {reportType === "actual_revenue" && <td className="text-center fw-bold fs-5 text-dark bg-light">{formatMoney(revenueFooterStats.inv_total)}</td>}
                                            {reportType === "actual_revenue" && <td className="text-center fw-bold fs-4 text-success">{formatMoney(revenueFooterStats.inv_paid)}</td>}
                                            {reportType === "actual_revenue" && <td className="text-center fw-bold fs-5 text-danger">{formatMoney(revenueFooterStats.inv_debt)}</td>}
                                            {reportType === "actual_revenue" && <td className="text-center fw-bold fs-5 text-danger">{revenueFooterStats.actual_debt > 0 ? `${revenueFooterStats.actual_debt} vỏ` : ""}</td>}
                                        </tr>
                                    )}
                                    {reportType === "revenue_by_product" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="2" className="text-end fw-bold pe-3">TỔNG BÁN RA:</td>
                                            <td className="text-center fw-bold fs-5 text-dark">{data.reduce((sum, item) => sum + Number(item.total_quantity), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_revenue), 0))} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "sales_by_region" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td className="text-end fw-bold pe-3">TỔNG CỘNG TOÀN KỲ:</td>
                                            <td className="text-center fw-bold fs-5">{data.reduce((sum, item) => sum + Number(item.total_orders), 0)}</td>
                                            <td className="text-center fw-bold text-info fs-5">{data.reduce((sum, item) => sum + Number(item.total_products_sold), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_revenue), 0))} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "bottles" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="5" className="text-end fw-bold pe-3">TỔNG ĐANG NỢ:</td>
                                            <td className="text-center fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.remaining_bottles), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_deposit), 0))} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "bottle_notes" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="4" className="text-end fw-bold pe-3">TỔNG TIỀN ĐÃ HOÀN:</td>
                                            <td className="text-end fw-bold text-danger fs-5">{formatMoney(data.reduce((sum, item) => sum + Number(item.deposit_amount), 0))} đ</td>
                                            <td></td>
                                        </tr>
                                    )}
                                    {reportType === "customers" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="5" className="text-end fw-bold pe-3">TỔNG CỘNG:</td>
                                            <td className="text-center fw-bold fs-5 text-dark">{data.reduce((sum, item) => sum + Number(item.total_orders), 0)}</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_revenue), 0))} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "inventory_products" && (
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="2" className="text-end fw-bold text-danger pe-3">TỔNG CỘNG:</td>
                                            <td className="text-center fw-bold text-danger fs-5">{data.reduce((sum, item) => sum + Number(item.bottles_with_customers), 0)} vỏ</td>
                                            <td className="text-center fw-bold text-success fs-5 pe-4">{data.reduce((sum, item) => sum + Number(item.current_stock), 0)}</td>
                                        </tr>
                                    )}
                                    {reportType === "inventory_materials" && (
                                        <tr className="table-light border-top border-2 border-secondary">
                                            <td className="text-end fw-bold text-dark pe-3">TỔNG CỘNG NGUYÊN VẬT LIỆU:</td>
                                            <td className="text-center fw-bold text-dark fs-5 pe-4">{data.reduce((sum, item) => sum + Number(item.current_stock), 0)}</td>
                                        </tr>
                                    )}
                                    {reportType === "purchases" && (
                                        <tr className="table-light border-top border-2 border-secondary">
                                            <td colSpan="4" className="text-end fw-bold pe-3">TỔNG CỘNG TOÀN KỲ:</td>
                                            <td className="text-end fw-bold text-secondary fs-5">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_goods_amount || 0), 0))} đ</td>
                                            <td className="text-end fw-bold text-info fs-5">{formatMoney(data.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0))} đ</td>
                                            <td className="text-end fw-bold text-warning fs-5">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_fee_amount || 0), 0))} đ</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.total_payment || 0), 0))} đ</td>
                                        </tr>
                                    )}
                                    {reportType === "wastage_report" && (
                                        <tr className="table-light border-top border-2 border-danger">
                                            <td colSpan="5" className="text-end fw-bold text-danger pe-3">TỔNG TIỀN THẤT THOÁT:</td>
                                            <td className="text-end fw-bold text-danger fs-5 pe-4">{formatMoney(data.reduce((sum, item) => sum + Number(item.wastage_cost), 0))} đ</td>
                                        </tr>
                                    )}
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {reportType === "pnl" && pnlDetails && pnlDetails.length > 0 && (
                        <div className="mt-5 mb-3 px-4">
                            <h5 className="fw-bold text-primary mb-3"><i className="bi bi-list-columns-reverse me-2"></i>Phân tích Lợi nhuận chi tiết theo Sản phẩm</h5>
                            <div className="table-responsive">
                                <table className="table table-bordered table-hover align-middle shadow-sm">
                                    <thead className="table-secondary text-center align-middle">
                                        <tr>
                                            <th style={{ width: "60px" }}>STT</th>
                                            <th className="text-start">Tên Sản Phẩm</th>
                                            <th>Số Lượng Bán</th>
                                            <th className="text-end">Doanh Thu (A)</th>
                                            <th className="text-end">Giá Vốn (B)</th>
                                            <th className="text-end bg-info text-dark">Lợi Nhuận Gộp (C)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pnlDetails.map((item, idx) => (
                                            <tr key={idx} className="text-center">
                                                <td className="text-muted">{idx + 1}</td>
                                                <td className="text-start fw-bold text-dark">{item.product_name}</td>
                                                <td><span className="badge bg-primary fs-6">{item.total_sold}</span></td>
                                                <td className="text-end fw-bold text-dark">{formatMoney(item.total_revenue)} đ</td>
                                                <td className="text-end text-secondary fw-bold">{formatMoney(item.total_cogs)} đ</td>
                                                <td className="text-end fw-bold text-success fs-5">{formatMoney(item.gross_profit)} đ</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="table-light border-top border-2 border-primary">
                                            <td colSpan="3" className="text-end fw-bold pe-3">TỔNG CỘNG:</td>
                                            <td className="text-end fw-bold text-dark fs-5">{formatMoney(pnlDetails.reduce((sum, item) => sum + Number(item.total_revenue), 0))} đ</td>
                                            <td className="text-end fw-bold text-secondary fs-5">{formatMoney(pnlDetails.reduce((sum, item) => sum + Number(item.total_cogs), 0))} đ</td>
                                            <td className="text-end fw-bold text-success fs-5">{formatMoney(pnlDetails.reduce((sum, item) => sum + Number(item.gross_profit), 0))} đ</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* 📱 GIAO DIỆN DẠNG THẺ (CARD VIEW) DÀNH CHO ĐIỆN THOẠI */}
                <div className="d-block d-lg-none">
                    {Array.isArray(data) && data.length > 0 ? (
                        (reportType === "revenue" || reportType === "actual_revenue")
                            ? processedRevenueData.map((item, index) => renderMobileCard(item, index))
                            : data.map((item, index) => renderMobileCard(item, index))
                    ) : (
                        <div className="text-center p-5 bg-white rounded-4 shadow-sm text-muted">
                            <i className="bi bi-inboxes-fill fs-1 d-block mb-3 opacity-25"></i>
                            Trống. Vui lòng lấy báo cáo.
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}