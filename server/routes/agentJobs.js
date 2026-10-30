const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Printer = require("../models/Printer");
const { requireAgent } = require("../middleware/agentAuth");
const { getSettings } = require("../utils/settings");
const { getTempUrl } = require("../utils/storage");
const wrap = require("../utils/wrap");

const router = express.Router();
router.use(requireAgent); // only a paired shop PC may use these routes

const MAX_ATTEMPTS = 3; // first try + 2 automatic retries
const STALE_MS = 10 * 60 * 1000; // a job stuck in "printing" this long is given up
const FORMATS = ["pdf", "jpg", "jpeg", "png"];

// today's date in India time, like "2026-10-30"
function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// If an agent vanished mid-job we do NOT reprint automatically (risk of a double print).
// A person checks the paper and presses Retry.
async function sweepStale() {
  await Order.updateMany(
    { status: "printing", claimedAt: { $lt: new Date(Date.now() - STALE_MS) } },
    {
      $set: {
        status: "print_failed",
        printError: "The print agent stopped responding. Check the paper, then press Retry.",
      },
    }
  );
}

// The agent asks: "do you have a job for me?"
router.post("/claim", wrap(async (req, res) => {
  await sweepStale();
  const settings = getSettings();
  const today = todayIST();

  const printers = await Printer.find({ computer: req.computer._id, status: "active" }).sort({
    isDefault: -1,
    createdAt: 1,
  });

  for (const printer of printers) {
    // virtual printers only work when an admin enabled them as test printers
    if (printer.isVirtual && !printer.testPrinter) continue;

    // one job at a time per printer
    const busy = await Order.exists({
      status: "printing",
      claimedBy: req.computer._id,
      printerName: printer.windowsName,
    });
    if (busy) continue;

    // new day: reset the page counter
    if (printer.dailyPagesDate !== today) {
      printer.dailyPages = 0;
      printer.dailyPagesDate = today;
      await printer.save();
    }
    const limit =
      printer.dailyLimit != null
        ? printer.dailyLimit
        : settings.dailyPageLimit > 0
        ? settings.dailyPageLimit
        : null;

    const filter = {
      status: "queued",
      paid: true, // never print unpaid work
      legacy: { $ne: true },
      doubleSided: false, // held until Phase 5 (assisted flip)
      size: "A4",
      filePublicId: { $ne: "" },
    };
    if (settings.printTiming === "manual") filter.printNow = true;
    if (!printer.supportsColor) filter.color = false;

    const candidates = await Order.find(filter).sort({ urgent: -1, queuedAt: 1 }).limit(20);

    for (const c of candidates) {
      if (!FORMATS.includes(String(c.fileFormat).toLowerCase())) {
        await Order.updateOne(
          { _id: c._id, status: "queued" },
          { $set: { status: "print_failed", printError: "Unsupported file type" } }
        );
        continue;
      }
      if (limit && printer.dailyPages + c.printPages * c.copies > limit) continue;

      // atomic claim: if two agents ask at once, only one wins
      const job = await Order.findOneAndUpdate(
        { _id: c._id, status: "queued", paid: true },
        {
          $set: {
            status: "printing",
            printerName: printer.windowsName,
            claimedBy: req.computer._id,
            claimedAt: new Date(),
            printError: "",
          },
          $inc: { printAttempts: 1 },
        },
        { new: true }
      );
      if (!job) continue;

      return res.json({
        job: {
          orderId: job._id,
          trackingCode: job.trackingCode,
          printer: printer.windowsName,
          fileName: job.fileName,
          format: String(job.fileFormat).toLowerCase(),
          url: getTempUrl(job.filePublicId, job.fileResourceType, job.fileFormat), // valid 2 minutes
          pages: job.pageRange, // like "1-5,8", empty = all
          copies: job.copies,
          color: job.color,
          attempt: job.printAttempts,
        },
      });
    }
  }

  res.json({ job: null });
}));

// The agent reports: printed, or failed
router.post("/:id/result", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Bad id" });

  const ok = req.body.ok === true;
  const error = String(req.body.error || "").slice(0, 300);

  const order = await Order.findOne({
    _id: req.params.id,
    status: "printing",
    claimedBy: req.computer._id,
  });
  if (!order) return res.status(409).json({ error: "This job is not being printed by this computer" });

  if (ok) {
    const now = new Date();
    await Order.updateOne(
      { _id: order._id, status: "printing" },
      {
        $set: {
          status: getSettings().readyMode === "auto" ? "ready" : "printed",
          printedAt: now,
          printError: "",
        },
      }
    );
    await Printer.updateOne(
      { computer: req.computer._id, windowsName: order.printerName },
      { $inc: { dailyPages: order.printPages * order.copies } }
    );
    return res.json({ ok: true, status: "done" });
  }

  const giveUp = order.printAttempts >= MAX_ATTEMPTS;
  await Order.updateOne(
    { _id: order._id, status: "printing" },
    { $set: { status: giveUp ? "print_failed" : "queued", printError: error || "Print failed" } }
  );
  res.json({ ok: true, status: giveUp ? "print_failed" : "retry" });
}));

// Diagnostic: explains why a claim may come back empty (no secrets in the answer)
router.get("/why", wrap(async (req, res) => {
  const settings = getSettings();
  const printers = await Printer.find({ computer: req.computer._id });
  const queued = await Order.find({ status: "queued" });
  res.json({
    computer: req.computer.name,
    printTiming: settings.printTiming,
    printers: printers.map((p) => ({
      name: p.windowsName,
      status: p.status,
      virtual: p.isVirtual,
      testPrinter: p.testPrinter,
    })),
    queuedOrders: queued.map((o) => ({
      code: o.trackingCode,
      paid: o.paid,
      legacy: o.legacy,
      doubleSided: o.doubleSided,
      size: o.size,
      hasFile: Boolean(o.filePublicId),
      format: o.fileFormat,
      printNow: o.printNow,
    })),
  });
}));

module.exports = router;