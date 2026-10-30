const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const Computer = require("../models/Computer");
const Printer = require("../models/Printer");
const { requireAgent, sha256 } = require("../middleware/agentAuth");
const wrap = require("../utils/wrap");

const router = express.Router();

const pairLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// Classify a Windows printer by its port and name
function classify(name, portName) {
  const port = String(portName || "");
  const virtualName = /print to pdf|xps|onenote|fax|send to/i.test(name);
  const virtualPort = /^(nul:|portprompt:|microsoft\.)/i.test(port) || /^file:/i.test(port);
  if (virtualName || virtualPort) return { connection: "virtual", isVirtual: true };
  if (/^usb/i.test(port)) return { connection: "usb", isVirtual: false };
  if (/^brw|^wsd|^\d+\.\d+\.\d+\.\d+|^ip_|^http/i.test(port)) return { connection: "wifi", isVirtual: false };
  return { connection: "unknown", isVirtual: false };
}

// Step 1: swap the one-time code for the PC's own key
router.post("/pair", pairLimiter, wrap(async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (code.length !== 8) return res.status(400).json({ error: "Invalid code" });

  const key = crypto.randomBytes(32).toString("hex");
  // One atomic step: only one request can ever use a code
  const computer = await Computer.findOneAndUpdate(
    { codeHash: sha256(code), codeExpiresAt: { $gt: new Date() } },
    { $set: { keyHash: sha256(key), pairedAt: new Date(), active: true, lastSeenAt: new Date() },
      $unset: { codeHash: 1, codeExpiresAt: 1 } },
    { new: true }
  );
  if (!computer) return res.status(400).json({ error: "Invalid or expired code" });

  res.json({ computerId: computer._id, name: computer.name, key }); // key is shown only now
}));

// Step 2: "I'm alive"
router.post("/heartbeat", requireAgent, wrap(async (req, res) => {
  const version = String(req.body.agentVersion || "").slice(0, 30);
  if (version) await Computer.updateOne({ _id: req.computer._id }, { agentVersion: version });
  res.json({ ok: true });
}));

// Step 3: the PC reports its Windows printers
router.post("/printers", requireAgent, wrap(async (req, res) => {
  const reported = req.body.printers;
  if (!Array.isArray(reported) || reported.length > 50) {
    return res.status(400).json({ error: "printers must be a list of at most 50" });
  }

  const now = new Date();
  const names = [];

  for (const item of reported) {
    const name = String((item && item.name) || "").trim().slice(0, 200);
    if (!name) continue;
    names.push(name);
    const portName = String(item.portName || "").slice(0, 200);
    const driverName = String(item.driverName || "").slice(0, 200);
    const kind = classify(name, portName);

    const existing = await Printer.findOne({ computer: req.computer._id, windowsName: name });
    if (!existing) {
      await Printer.create({
        computer: req.computer._id,
        windowsName: name,
        displayName: name,
        portName,
        driverName,
        ...kind,
        // virtual printers stay hidden until an admin enables one as a test printer
        status: kind.isVirtual ? "ignored" : "detected",
        supportsColor: true,
        lastSeenAt: now,
      });
    } else {
      existing.portName = portName;
      existing.driverName = driverName;
      existing.connection = kind.connection;
      existing.isVirtual = kind.isVirtual;
      existing.lastSeenAt = now;
      if (existing.status === "missing") {
        existing.status = existing.statusBeforeMissing || "detected";
        existing.statusBeforeMissing = null;
      }
      await existing.save();
    }
  }

  // Printers that were not in this report are now missing
  const gone = await Printer.find({
    computer: req.computer._id,
    windowsName: { $nin: names },
    status: { $ne: "missing" },
  });
  for (const p of gone) {
    p.statusBeforeMissing = p.status;
    p.status = "missing";
    await p.save();
  }

  res.json({ ok: true, count: names.length });
}));

module.exports = router;