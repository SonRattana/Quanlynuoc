require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db"); // thêm dòng này

const app = express();

app.use(cors());
app.use(express.json());

// Test DB connection
db.getConnection()
  .then(() => console.log("MySQL connected"))
  .catch(err => console.log("DB Error:", err));

app.use("/api/auth", require("./routes/auth"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});