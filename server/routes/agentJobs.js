const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Printer = require("../models/Printer");
const { requireAgent } = require("../middleware/agentAuth");
const { getSettings } = require("../utils/settings");
const { saveFile, getTempUrl, deleteFile } = require("../utils/storage");
const { getLoadedPaper } = require("../utils/paper");
const { capacity, buildPassportSheet } = require("../utils/photo");
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
        printError:
          "The print agent stopped responding. Check the paper, then press Retry.",
      },
    },
  );
}

// Builds the passport print sheet for the paper that is loaded. The customer's cropped photo is kept.
async function buildPassportSheetFor(order, paper) {
  const hasSource = Boolean(order.passportSourceId);
  const sourceId = hasSource ? order.passportSourceId : order.filePublicId;
  const sourceType = hasSource
    ? order.passportSourceType
    : order.fileResourceType;
  const sourceFormat = hasSource
    ? order.passportSourceFormat
    : order.fileFormat;

  const per = capacity(paper, order.passportSize).perSheet;
  if (!per) throw new Error("this size does not fit on that paper");

  const res = await fetch(getTempUrl(sourceId, sourceType, sourceFormat), {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new Error(`could not read the stored photo (${res.status})`);
  const jpeg = Buffer.from(await res.arrayBuffer());

  const pdf = await buildPassportSheet({
    photoJpeg: jpeg,
    size: order.passportSize,
    paper,
    pieces: order.passportPieces,
  });
  const saved = await saveFile(pdf);
  const sheets = Math.ceil(order.passportPieces / per);

  const set = {
    ...saved,
    fileName: `passport-${order.passportSize}-${paper}.pdf`,
    passportPaper: paper,
    pages: sheets,
    printPages: sheets,
  };
  if (!hasSource) {
    set.passportSourceId = order.filePublicId;
    set.passportSourceType = order.fileResourceType;
    set.passportSourceFormat = order.fileFormat;
  }
  await Order.updateOne({ _id: order._id }, { $set: set });

  // a sheet built earlier for another paper is no longer needed
  if (hasSource)
    deleteFile(order.filePublicId, order.fileResourceType).catch(() => {});
}

// The agent asks: "do you have a job for me?"
router.post(
  "/claim",
  wrap(async (req, res) => {
    await sweepStale();
    const settings = getSettings();
    const today = todayIST();
    const paperState = await getLoadedPaper();

    const printers = await Printer.find({
      computer: req.computer._id,
      status: "active",
    }).sort({
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
        orderType:
          paperState.loaded === "plain"
            ? { $in: ["document", null] }
            : paperState.loaded, // photo orders wait for the paper-loaded cards (step 5.9); old orders have no type
        legacy: { $ne: true },
        doubleSided: false, // held until Phase 5 (assisted flip)
        size: "A4",
        filePublicId: { $ne: "" },
      };
      if (settings.printTiming === "manual") filter.printNow = true;
      if (!printer.supportsColor) filter.color = false;

      const candidates = await Order.find(filter)
        .sort({ urgent: -1, queuedAt: 1 })
        .limit(20);

      for (const c of candidates) {
        if (!FORMATS.includes(String(c.fileFormat).toLowerCase())) {
          await Order.updateOne(
            { _id: c._id, status: "queued" },
            {
              $set: {
                status: "print_failed",
                printError: "Unsupported file type",
              },
            },
          );
          continue;
        }
        if (limit && printer.dailyPages + c.printPages * c.copies > limit)
          continue;

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
          { new: true },
        );
        if (!job) continue;

        // passport orders: build the print sheet now, for the paper that is loaded
        if (job.orderType === "passport") {
          try {
            await buildPassportSheetFor(job, paperState.passportPaper);
          } catch (err) {
            await Order.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: "print_failed",
                  printError:
                    "Could not build the passport sheet: " + err.message,
                },
              },
            );
            continue;
          }
        }

        const fresh = await Order.findById(job._id);
        return res.json({
          job: {
            orderId: fresh._id,
            trackingCode: fresh.trackingCode,
            printer: printer.windowsName,
            fileName: fresh.fileName,
            format: String(fresh.fileFormat).toLowerCase(),
            url: getTempUrl(
              fresh.filePublicId,
              fresh.fileResourceType,
              fresh.fileFormat,
            ), // valid 2 minutes
            pages: fresh.pageRange, // like "1-5,8", empty = all
            copies: fresh.copies,
            color: fresh.color,
            paper:
              fresh.orderType === "passport" && fresh.passportPaper === "4x6"
                ? "4x6"
                : "A4",
            attempt: fresh.printAttempts,
          },
        });
      }
    }

    res.json({ job: null });
  }),
);

// The agent reports: printed, or failed
router.post(
  "/:id/result",
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Bad id" });

    const ok = req.body.ok === true;
    const error = String(req.body.error || "").slice(0, 300);

    const order = await Order.findOne({
      _id: req.params.id,
      status: "printing",
      claimedBy: req.computer._id,
    });
    if (!order)
      return res
        .status(409)
        .json({ error: "This job is not being printed by this computer" });

    if (ok) {
      const now = new Date();
      await Order.updateOne(
        { _id: order._id, status: "printing" },
        {
          $set: {
            status:
              getSettings().readyMode === "auto" &&
              (!order.orderType || order.orderType === "document")
                ? "ready"
                : "printed", // photo orders always wait for a person (drying)
            printedAt: now,
            printError: "",
          },
        },
      );
      await Printer.updateOne(
        { computer: req.computer._id, windowsName: order.printerName },
        { $inc: { dailyPages: order.printPages * order.copies } },
      );
      return res.json({ ok: true, status: "done" });
    }

    const giveUp = order.printAttempts >= MAX_ATTEMPTS;
    await Order.updateOne(
      { _id: order._id, status: "printing" },
      {
        $set: {
          status: giveUp ? "print_failed" : "queued",
          printError: error || "Print failed",
        },
      },
    );
    res.json({ ok: true, status: giveUp ? "print_failed" : "retry" });
  }),
);

// Diagnostic: explains why a claim may come back empty (no secrets in the answer)
router.get("/why", wrap(async (req, res) => {
  const settings = getSettings();
  const paper = await getLoadedPaper();
  const printers = await Printer.find({ computer: req.computer._id });
  const queued = await Order.find({ status: "queued" });
  const printing = await Order.find({ status: "printing" });
  const wanted = paper.loaded === "plain" ? "document" : paper.loaded;

  const usable = printers.filter((p) => p.status === "active" && (!p.isVirtual || p.testPrinter));
  const free = usable.filter(
    (p) =>
      !printing.some(
        (o) => o.printerName === p.windowsName && String(o.claimedBy) === String(req.computer._id)
      )
  );
  const limitOf = (p) =>
    p.dailyLimit != null ? p.dailyLimit : settings.dailyPageLimit > 0 ? settings.dailyPageLimit : null;

  const blocked = queued.map((o) => {
    const why = [];
    const type = o.orderType || "document";
    if (!o.paid) why.push("not paid");
    if (o.legacy) why.push("old order from before the payment flow");
    if (o.doubleSided) why.push("double-sided orders are held");
    if (o.size !== "A4") why.push("not A4");
    if (!o.filePublicId) why.push("no file");
    if (!FORMATS.includes(String(o.fileFormat).toLowerCase())) why.push(`file format "${o.fileFormat}" is not printable`);
    if (type !== wanted) why.push(`paper loaded is "${paper.loaded}" but this order is "${type}"`);
    if (settings.printTiming === "manual" && !o.printNow) why.push("print timing is manual and Print now was not tapped");
    if (usable.length === 0) why.push("no Active printer for this computer");
    else if (free.length === 0) why.push("every Active printer is busy with a job in 'printing'");
    else {
      if (o.color && !free.some((p) => p.supportsColor)) why.push("color order but no free printer supports color");
      const need = (o.printPages || 1) * (o.copies || 1);
      if (!free.some((p) => !limitOf(p) || p.dailyPages + need <= limitOf(p))) why.push("daily page limit reached");
    }
    return {
      code: o.trackingCode,
      orderType: type,
      blockedBy: why.length ? why : ["nothing found: this order should be claimable"],
    };
  });

  res.json({
    computer: req.computer.name,
    printTiming: settings.printTiming,
    dailyPageLimitSetting: settings.dailyPageLimit,
    loadedPaper: paper,
    printers: printers.map((p) => ({
      name: p.windowsName,
      status: p.status,
      virtual: p.isVirtual,
      testPrinter: p.testPrinter,
      supportsColor: p.supportsColor,
      dailyPages: p.dailyPages,
      dailyLimit: p.dailyLimit,
    })),
    printingOrders: printing.map((o) => ({
      code: o.trackingCode,
      orderType: o.orderType || "document",
      printer: o.printerName,
      since: o.claimedAt,
      attempts: o.printAttempts,
    })),
    blocked,
  });
}));

module.exports = router;
