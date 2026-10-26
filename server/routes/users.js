const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("superadmin", "admin"));

const MANAGEABLE = {
  superadmin: ["admin", "manager"],
  admin: ["manager"],
};

const safe = (u) => ({
  id: u._id,
  username: u.username,
  name: u.name,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
});

// Find a target user and make sure the logged-in user may manage them
async function getManageable(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  if (!MANAGEABLE[req.user.role].includes(target.role)) {
    res.status(403).json({ error: "You cannot manage this user" });
    return null;
  }
  return target;
}

router.get("/", async (req, res) => {
  const users = await User.find({ role: { $in: MANAGEABLE[req.user.role] } }).sort({ createdAt: -1 });
  res.json(users.map(safe));
});

router.post("/", async (req, res) => {
  try {
    const { username, name, password, role } = req.body;
    if (!MANAGEABLE[req.user.role].includes(role)) {
      return res.status(403).json({ error: "You cannot create this role" });
    }
    if (!username || !name || !password || String(password).length < 8) {
      return res.status(400).json({ error: "Username, name and a password of 8+ characters are required" });
    }
    const user = await User.create({
      username,
      name,
      role,
      passwordHash: await bcrypt.hash(String(password), 10),
    });
    res.status(201).json(safe(user));
  } catch (err) {
    const msg = err.code === 11000 ? "That username is already taken" : err.message;
    res.status(400).json({ error: msg });
  }
});

router.patch("/:id", async (req, res) => {
  const target = await getManageable(req, res);
  if (!target) return;

  if (typeof req.body.active === "boolean") target.active = req.body.active;
  if (req.body.name) target.name = req.body.name;
  if (req.body.password) {
    if (String(req.body.password).length < 8) {
      return res.status(400).json({ error: "Password must be 8+ characters" });
    }
    target.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  await target.save();
  res.json(safe(target));
});

router.delete("/:id", async (req, res) => {
  const target = await getManageable(req, res);
  if (!target) return;
  await target.deleteOne();
  res.json({ ok: true });
});

module.exports = router;