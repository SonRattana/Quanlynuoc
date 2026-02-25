require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db"); 

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});