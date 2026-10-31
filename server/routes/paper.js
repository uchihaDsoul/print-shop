const express = require("express");
const Order = require("../models/Order");
const photo = require("../utils/photo");
const { TYPES, getLoadedPaper, setLoadedPaper } = require("../utils/paper");
const { requireAuth, requireRole } = require("../middleware/auth");
const wrap = require("../utils/wrap");

const router = express.Router();
const staff = [requireAuth, requireRole("manager", "admin", "superadmin")];

// What paper is loaded, and how many orders are waiting for each kind
router.get("/", ...staff, wrap(async (req, res) => {
  const state = await getLoadedPaper();
  const filters = {
    document: { orderType: { $in: ["document", null] }, doubleSided: false },
    photo_a4: { orderType: "photo_a4" },
    passport: { orderType: "passport" },
  };

  const counts = {};
  for (const [type, f] of Object.entries(filters)) {
    counts[type] = {
      queued: await Order.countDocuments({ ...f, status: "queued", paid: true, legacy: { $ne: true } }),
      printing: await Order.countDocuments({ ...f, status: "printing" }),
    };
  }

  // how many passport sheets the waiting orders need, for each paper
  const passportSheets = { a4: 0, "4x6": 0 };
  const waiting = await Order.find({ orderType: "passport", status: "queued", paid: true }).select(
    "passportSize passportPieces"
  );
  for (const o of waiting) {
    for (const paper of ["a4", "4x6"]) {
      const per = photo.capacity(paper, o.passportSize).perSheet;
      if (per) passportSheets[paper] += Math.ceil(o.passportPieces / per);
    }
  }

  res.json({ ...state, counts, passportSheets });
}));

// The manager says which paper is now in the printer
router.post("/loaded", ...staff, wrap(async (req, res) => {
  const paper = req.body.paper;
  if (!TYPES.includes(paper)) return res.status(400).json({ error: "Unknown paper type" });
  const passportPaper = req.body.passportPaper === "4x6" ? "4x6" : "a4";

  if (await Order.exists({ status: "printing" })) {
    return res.status(409).json({ error: "A job is printing right now. Wait until it finishes, then change the paper." });
  }
  await setLoadedPaper({ loaded: paper, passportPaper }, req.user.username);
  res.json(await getLoadedPaper());
}));

module.exports = router;