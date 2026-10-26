const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

const publicUser = (u) => ({ id: u._id, username: u.username, name: u.name, role: u.role });

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: String(username || "").toLowerCase() });

  const ok = user && user.active && (await bcrypt.compare(String(password || ""), user.passwordHash));
  if (!ok) return res.status(401).json({ error: "Wrong username or password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => res.json(publicUser(req.user)));

module.exports = router;