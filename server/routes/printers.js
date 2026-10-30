const express = require("express");
const Printer = require("../models/Printer");
const Setting = require("../models/Setting");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isOnline } = require("../utils/printerRouting");
const wrap = require("../utils/wrap");

const router = express.Router();
router.use(requireAuth); // every route needs a logged-in staff member

const isBoss = (user) => ["admin", "superadmin"].includes(user.role);
const bossOnly = requireRole("admin", "superadmin");

async function managersCanPause() {
  const doc = await Setting.findOne({ key: "shop" });
  const v = doc && doc.value && doc.value.managersCanPausePrinters;
  return v === undefined ? true : !!v; // default: yes
}

function shape(p) {
  return {
    _id: p._id,
    windowsName: p.windowsName,
    displayName: p.displayName || p.windowsName,
    portName: p.portName,
    driverName: p.driverName,
    connection: p.connection,
    isVirtual: p.isVirtual,
    testPrinter: p.testPrinter,
    status: p.status,
    supportsColor: p.supportsColor,
    duplexMode: p.duplexMode,
    isDefault: p.isDefault,
    dailyLimit: p.dailyLimit,
    dailyPages: p.dailyPages,
    requestedBy: p.requestedBy,
    computerName: p.computer && p.computer.name,
    computerOnline: isOnline(p.computer),
    lastSeenAt: p.lastSeenAt,
  };
}

async function load(req, res) {
  const p = await Printer.findById(req.params.id).populate("computer");
  if (!p) res.status(404).json({ error: "Printer not found" });
  return p;
}

// List. Managers do not see hidden (ignored) printers.
router.get("/", wrap(async (req, res) => {
  const filter = isBoss(req.user) ? {} : { status: { $ne: "ignored" } };
  const list = await Printer.find(filter).populate("computer").sort({ createdAt: 1 });
  res.json(list.map(shape));
}));

// Admin enables a printer directly (also how a virtual test printer is enabled)
router.post("/:id/enable", bossOnly, wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  if (!["detected", "waiting_approval", "ignored"].includes(p.status)) {
    return res.status(400).json({ error: "This printer cannot be enabled from its current state" });
  }
  if (p.isVirtual) p.testPrinter = true;
  p.status = "active";
  p.approvedBy = req.user._id;
  await p.save();
  res.json(shape(p));
}));

// Anyone on staff asks for approval
router.post("/:id/request", wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  if (p.status !== "detected") return res.status(400).json({ error: "Only a Detected printer can be requested" });
  p.status = "waiting_approval";
  p.requestedBy = req.user._id;
  await p.save();
  res.json(shape(p));
}));

// Admin approves. Nobody approves their own request.
router.post("/:id/approve", bossOnly, wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  if (p.status !== "waiting_approval") return res.status(400).json({ error: "Not waiting for approval" });
  if (p.requestedBy && String(p.requestedBy) === String(req.user._id)) {
    return res.status(403).json({ error: "You cannot approve your own request" });
  }
  p.status = "active";
  p.approvedBy = req.user._id;
  await p.save();
  res.json(shape(p));
}));

router.post("/:id/reject", bossOnly, wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  if (p.status !== "waiting_approval") return res.status(400).json({ error: "Not waiting for approval" });
  p.status = "detected";
  p.requestedBy = null;
  await p.save();
  res.json(shape(p));
}));

// Pause / resume (managers only if the Settings toggle allows it)
async function canPause(req) {
  return isBoss(req.user) || (await managersCanPause());
}

router.post("/:id/pause", wrap(async (req, res) => {
  if (!(await canPause(req))) return res.status(403).json({ error: "Managers cannot pause printers" });
  const p = await load(req, res); if (!p) return;
  if (p.status !== "active") return res.status(400).json({ error: "Only an Active printer can be paused" });
  p.status = "paused";
  await p.save();
  res.json(shape(p));
}));

router.post("/:id/resume", wrap(async (req, res) => {
  if (!(await canPause(req))) return res.status(403).json({ error: "Managers cannot resume printers" });
  const p = await load(req, res); if (!p) return;
  if (p.status !== "paused") return res.status(400).json({ error: "Only a Paused printer can be resumed" });
  p.status = "active";
  await p.save();
  res.json(shape(p));
}));

// Admin hides a printer
router.post("/:id/ignore", bossOnly, wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  p.status = "ignored";
  p.requestedBy = null;
  await p.save();
  res.json(shape(p));
}));

// Admin edits settings of a printer
router.patch("/:id", bossOnly, wrap(async (req, res) => {
  const p = await load(req, res); if (!p) return;
  const b = req.body;

  if (b.displayName !== undefined) p.displayName = String(b.displayName).trim().slice(0, 80);
  if (b.supportsColor !== undefined) p.supportsColor = !!b.supportsColor;
  if (b.duplexMode !== undefined) {
    if (!["none", "manual"].includes(b.duplexMode)) return res.status(400).json({ error: "Bad duplexMode" });
    p.duplexMode = b.duplexMode;
  }
  if (b.dailyLimit !== undefined) {
    if (b.dailyLimit === null || b.dailyLimit === "") p.dailyLimit = null;
    else {
      const n = Number(b.dailyLimit);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return res.status(400).json({ error: "Bad dailyLimit" });
      p.dailyLimit = n;
    }
  }
  if (b.isDefault === true) {
    await Printer.updateMany({ _id: { $ne: p._id } }, { isDefault: false });
    p.isDefault = true;
  } else if (b.isDefault === false) {
    p.isDefault = false;
  }
  await p.save();
  res.json(shape(p));
}));

module.exports = router;