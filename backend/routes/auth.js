const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

// LOGIN
router.post("/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
    const { username, password } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = rows[0];

    // const validPassword = await bcrypt.compare(password, user.password);

    // if (!validPassword)
    //   return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;