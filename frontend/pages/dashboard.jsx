import { useEffect, useState } from "react";
import Layout from "../components/layout";
import React from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";

function Dashboard() {
  const token = localStorage.getItem("token");

  // ===== STATES =====
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalInvoices: 0,
  });
  const [customerStats, setCustomerStats] = useState({
    total_customers: 0,
    new_this_month: 0,
    old_customers: 0,
  });

  // States mới cho Vỏ bình và Biểu đồ Tròn
  const [bottleStats, setBottleStats] = useState({
    totalBottlesOut: 0,
    totalDepositHeld: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [categoryData, setCategoryData] = useState([]); // Cho Pie Chart

  const formatMoney = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value || 0);
  };

  // Bảng màu cho Pie Chart
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Lấy API tổng hợp
    axios
      .get(`api/dashboard?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setSummary({
          totalRevenue: res.data.totalRevenue || 0,
          totalProfit: res.data.totalProfit || 0,
          totalInvoices: res.data.totalInvoices || 0,
        });

        setBottleStats({
          totalBottlesOut: res.data.totalBottlesOut || 0,
          totalDepositHeld: res.data.totalDepositHeld || 0,
        });

        setRevenueData(res.data.revenueByDay || []);

        // ÉP KIỂU VÀ MỒI MÀU CHO BIỂU ĐỒ CỘT
        const TOP_COLORS = ["#0d6efd", "#20c997", "#ffc107", "#dc3545", "#6f42c1"];
        const formattedTopProducts = (res.data.topProducts || []).map((item, index) => ({
          ...item,
          total_sold: Number(item.total_sold),
          fill: TOP_COLORS[index % TOP_COLORS.length]
        }));
        setTopProducts(formattedTopProducts);

        // ÉP KIỂU VÀ MỒI MÀU CHO BIỂU ĐỒ TRÒN
        const formattedCategoryData = (res.data.revenueByCategory || []).map((item, index) => ({
          name: item.name,
          value: Number(item.value),
          fill: COLORS[index % COLORS.length]
        }));
        setCategoryData(formattedCategoryData);
      })
      .catch((err) => console.log(err));

    // Lấy API khách hàng
    axios
      .get("/api/customers/stats/summary", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCustomerStats(res.data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <Layout>
      <div className="container-fluid pt-4 px-4 pb-5">
        <h4 className="fw-bold mb-4">Tổng quan tháng này</h4>

        {/* ===== HÀNG 1: DOANH THU & HÓA ĐƠN ===== */}
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="bg-white p-3 shadow-sm rounded border-start border-success border-4">
              <h6 className="text-muted">Doanh thu</h6>
              <h4 className="text-success fw-bold">{formatMoney(summary.totalRevenue)}</h4>
            </div>
          </div>
          <div className="col-md-4">
            <div className="bg-white p-3 shadow-sm rounded border-start border-primary border-4">
              <h6 className="text-muted">Lợi nhuận</h6>
              <h4 className="text-primary fw-bold">{formatMoney(summary.totalProfit)}</h4>
            </div>
          </div>
          <div className="col-md-4">
            <div className="bg-white p-3 shadow-sm rounded border-start border-danger border-4">
              <h6 className="text-muted">Số hóa đơn</h6>
              <h4 className="text-danger fw-bold">{summary.totalInvoices} <span className="fs-6 text-muted fw-normal">đơn</span></h4>
            </div>
          </div>
        </div>

        {/* ===== HÀNG 2: VỎ BÌNH & KHÁCH HÀNG ===== */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="bg-white p-3 shadow-sm rounded">
              <h6 className="fw-bold border-bottom pb-2 mb-3">Tình trạng vỏ bình (Nợ khách)</h6>
              <div className="d-flex justify-content-between">
                <div>
                  <p className="text-muted mb-1">Vỏ đang cho mượn</p>
                  <h4 className="text-warning fw-bold">{bottleStats.totalBottlesOut} <span className="fs-6 text-muted fw-normal">vỏ</span></h4>
                </div>
                <div className="text-end">
                  <p className="text-muted mb-1">Tổng cọc đang giữ</p>
                  <h4 className="text-dark fw-bold">{formatMoney(bottleStats.totalDepositHeld)}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="bg-white p-3 shadow-sm rounded">
              <h6 className="fw-bold border-bottom pb-2 mb-3">Phát triển khách hàng</h6>
              <div className="d-flex justify-content-between text-center">
                <div>
                  <p className="text-muted mb-1">Tổng tệp</p>
                  <h5 className="text-dark fw-bold">{customerStats.total_customers}</h5>
                </div>
                <div>
                  <p className="text-muted mb-1">Khách mới</p>
                  <h5 className="text-success fw-bold">+{customerStats.new_this_month}</h5>
                </div>
                <div>
                  <p className="text-muted mb-1">Khách cũ</p>
                  <h5 className="text-primary fw-bold">{customerStats.old_customers}</h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== HÀNG 3: BIỂU ĐỒ DOANH THU & TỶ TRỌNG ===== */}
        <div className="row mb-4">
          <div className="col-md-8">
            <div className="bg-white p-3 shadow-sm rounded h-100">
              <h6 className="fw-bold mb-3">Doanh thu & Lợi nhuận theo ngày</h6>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip formatter={(value) => formatMoney(value)} labelFormatter={(label) => new Date(label).toLocaleDateString("vi-VN")} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#28a745" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#007bff" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-md-4">
            <div className="bg-white p-3 shadow-sm rounded h-100">
              <h6 className="fw-bold mb-3">Cơ cấu doanh thu (Chai/Bình)</h6>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      label
                    />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  Chưa có dữ liệu
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== HÀNG 4: TOP SẢN PHẨM ===== */}
        <div className="row">
          <div className="col-md-12">
            <div className="bg-white p-3 shadow-sm rounded">
              <h6 className="fw-bold mb-3">Top 5 sản phẩm bán chạy nhất</h6>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis dataKey="name" type="category" width={100} />
                  <YAxis type="number" />
                  <Tooltip />
                  <Bar dataKey="total_sold" name="Số lượng bán" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
      
    </Layout>
  );
}

export default Dashboard;