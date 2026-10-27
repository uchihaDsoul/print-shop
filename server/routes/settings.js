const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { savePricing } = require("../utils/pricing");

const router = express.Router();

// Admin and super admin only
router.put(
  "/pricing",
  requireAuth,
  requireRole("admin", "superadmin"),
  async (req, res) => {
    try {
      res.json(await savePricing(req.body, req.user.username));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
