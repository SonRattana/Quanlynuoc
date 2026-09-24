const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306, // 💡 BỔ SUNG DÒNG NÀY ĐỂ ÉP ĐI ĐÚNG CỔNG
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "+07:00"
});

// 💡 Sếp lưu ý: mysql2/promise thường dùng pool.on thay vì pool.pool.on nhé
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+07:00';");
});

module.exports = pool;