require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db"); 
const path = require("path");
const app = express();

// 1. MỞ CỬA CORS CHO TẤT CẢ (Vì chạy chung nhà nên cứ mở toang ra cho thoáng)
app.use(cors({
    origin: "*", 
    credentials: true
}));
app.use(express.json());

const http = require('http'); 
const { Server } = require('socket.io');

// 2. BỌC EXPRESS LẠI BẰNG HTTP
const server = http.createServer(app);

// 3. KHỞI TẠO ĂNG-TEN SOCKET.IO (ĐÃ SỬA LẠI ORIGIN THÀNH MỌI NƠI)
const io = new Server(server, {
    cors: {
        origin: "*", // <-- MẤU CHỐT Ở ĐÂY: Đổi thành "*" để chạy LAN không bị chặn
        methods: ["GET", "POST"]
    }
});

// 4. TUYỆT CHIÊU: GẮN ĂNG-TEN VÀO req ĐỂ CÁC FILE KHÁC XÀI KÉ ĐƯỢC
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Test DB connection
db.getConnection()
  .then(() => console.log("MySQL connected"))
  .catch(err => console.log("DB Error:", err));

// ==========================================
// CÁC ROUTES API TẠI ĐÂY
// ==========================================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/stock", require("./routes/stock"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/invoice", require("./routes/invoice"));
app.use("/api/customers", require("./routes/customers"));
const depositsRouter = require("./routes/deposits");
app.use("/api/deposits", depositsRouter);
app.use("/api/users", require("./routes/users"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/logs", require("./routes/logs"));

// Thư mục chứa hình ảnh tĩnh
app.use('/uploads', express.static('uploads'));

// ==========================================
// CHO BACKEND "CÕNG" FRONTEND (ĐỂ DƯỚI CÙNG NHÉ SẾP)
// ==========================================
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// PHẢI LÀ DÒNG CUỐI CÙNG TRƯỚC server.listen

app.get(/^(?!\/api).+/, (req, res) => {

  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));

});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server chạy trên cổng ${PORT} (Đã cõng Frontend & Lắp Radar Socket.io)`);
});