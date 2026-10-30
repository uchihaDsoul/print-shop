const express = require("express");
const crypto = require("crypto");
const Computer = require("../models/Computer");
const Printer = require("../models/Printer");
const Setting = require("../models/Setting");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sha256 } = require("../middleware/agentAuth");
const { isOnline } = require("../utils/printerRouting");
const wrap = require("../utils/wrap");

const router = express.Router();
const boss = [requireAuth, requireRole("admin", "superadmin")];

// Code letters without look-alikes (no 0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

async function codeMinutes() {
  const doc = await Setting.findOne({ key: "shop" });
  const value = doc && doc.value && Number(doc.value.pairingCodeMinutes);
  return value > 0 ? value : 15;
}

async function applyNewCode(computer) {
  const code = makeCode();
  const minutes = await codeMinutes();
  computer.codeHash = sha256(code);
  computer.codeExpiresAt = new Date(Date.now() + minutes * 60 * 1000);
  await computer.save();
  return { code, expiresAt: computer.codeExpiresAt };
}

function shape(c) {
  return {
    _id: c._id,
    name: c.name,
    paired: !!c.keyHash,
    online: isOnline(c),
    lastSeenAt: c.lastSeenAt,
    pairedAt: c.pairedAt,
    agentVersion: c.agentVersion,
    codePending: !!(c.codeHash && c.codeExpiresAt && c.codeExpiresAt > new Date()),
    createdAt: c.createdAt,
  };
}

// List computers
router.get("/", ...boss, wrap(async (req, res) => {
  const list = await Computer.find().sort({ createdAt: -1 });
  res.json(list.map(shape));
}));

// Add a computer and get its one-time pairing code (shown only once)
router.post("/", ...boss, wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 60) return res.status(400).json({ error: "Name is required (max 60 characters)" });

  const computer = await Computer.create({ name, createdBy: req.user._id });
  const { code, expiresAt } = await applyNewCode(computer);
  res.status(201).json({ computer: shape(computer), code, expiresAt });
}));

// New code for an existing computer. This also cancels its old key (re-pairing).
router.post("/:id/code", ...boss, wrap(async (req, res) => {
  const computer = await Computer.findById(req.params.id);
  if (!computer) return res.status(404).json({ error: "Computer not found" });
  computer.keyHash = null;
  computer.pairedAt = null;
  const { code, expiresAt } = await applyNewCode(computer);
  res.json({ computer: shape(computer), code, expiresAt });
}));

// Remove a computer and its printers
router.delete("/:id", ...boss, wrap(async (req, res) => {
  const computer = await Computer.findById(req.params.id);
  if (!computer) return res.status(404).json({ error: "Computer not found" });
  await Printer.deleteMany({ computer: computer._id });
  await computer.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;