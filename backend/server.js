
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db"); 
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());

// Test DB connection
db.getConnection()
  .then(() => console.log("MySQL connected"))
  .catch(err => console.log("DB Error:", err));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/stock", require("./routes/stock"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/invoice", require("./routes/invoice"));
app.use("/api/customers", require("./routes/customers"));
const depositsRouter = require("./routes/deposits");
app.use("/api/deposits", depositsRouter);
app.use("/api/users", require("./routes/users"));
app.use("/api/reports", require("./routes/reports"));

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});