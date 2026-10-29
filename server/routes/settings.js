const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { savePricing } = require("../utils/pricing");
const { getSettings, saveSettings } = require("../utils/settings");

const router = express.Router();

const staff = [requireAuth, requireRole("manager", "admin", "superadmin")];
const boss = [requireAuth, requireRole("admin", "superadmin")];

// What customers may see (used by the payment step later)
router.get("/public", (req, res) => {
  const s = getSettings();
  res.json({
    waitMessage: s.waitMessage,
    upiId: s.upiId,
    upiPayeeName: s.upiPayeeName,
    unpaidExpiryMinutes: s.unpaidExpiryMinutes,
  });
});

// All shop settings (staff can read, admin can change)
router.get("/shop", ...staff, (req, res) => res.json(getSettings()));

router.put("/shop", ...boss, async (req, res) => {
  try {
    res.json(await saveSettings(req.body, req.user.username));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/pricing", ...boss, async (req, res) => {
  try {
    res.json(await savePricing(req.body, req.user.username));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;