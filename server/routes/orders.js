const express = require("express");
const crypto = require("crypto");
const Order = require("../models/Order");
const { calculatePrice, getPricing, pickSize } = require("../utils/pricing");
const { saveFile, getTempUrl, deleteFile } = require("../utils/storage");
const { uploadOne } = require("../utils/upload");
const { countPages } = require("../utils/pdf");
const { requireAuth, requireRole } = require("../middleware/auth");
const staff = [requireAuth, requireRole("manager", "admin", "superadmin")];
const boss = [requireAuth, requireRole("admin", "superadmin")];
const { parsePageRange } = require("../utils/pageRange");

const rateLimit = require("express-rate-limit");

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please try again later." },
});
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many requests. Please try again later." },
});

const router = express.Router();

const toBool = (v) => v === true || v === "true" || v === "on";

function makeTrackingCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase(); //10 characters
}

async function createOrder(body, source, file) {
  const { customerName, phone } = body;

  if (!/^[0-9]{10}$/.test(phone || "")) {
    throw new Error("Phone number must be 10 digits");
  }

  let pages = Number(body.pages);
  let fileData = { fileName: body.fileName || "" };

  if (file) {
    pages = await countPages(file); // server decides the total
    fileData = { ...(await saveFile(file.buffer)), fileName: file.originalname };
  }

  try {
    if (!(pages >= 1)) throw new Error("Pages must be 1 or more");
    const range = parsePageRange(body.pageRange, pages);

    const printOptions = {
      copies: Number(body.copies) || 1,
      color: toBool(body.color),
      size: pickSize(body.size),
      doubleSided: toBool(body.doubleSided),
      stapling: toBool(body.stapling),
      binding: toBool(body.binding),
      urgent: toBool(body.urgent),
    };
    const note = String(body.note || "").slice(0, 300);
    const price = calculatePrice({ ...printOptions, pages: range.count });

    return await Order.create({
      trackingCode: makeTrackingCode(),
      source,
      customerName,
      phone,
      ...fileData,
      pages,
      printPages: range.count,
      pageRange: range.normalized,
      ...printOptions,
      price,
    });
  } catch (err) {
    // order failed: remove the uploaded file so it isn't left behind
    if (fileData.filePublicId) {
      deleteFile(fileData.filePublicId, fileData.fileResourceType).catch(() => { });
    }
    throw err;
  }
}

// Public price list
router.get("/rates", (req, res) => {
  res.json(getPricing());
});

// Price preview (saves nothing)
router.post("/quote", (req, res) => {
  const total = Number(req.body.pages) || 0;
  const copies = Number(req.body.copies) || 1;
  if (total < 1 || copies < 1) return res.json({ price: 0, printPages: 0 });

  try {
    const range = parsePageRange(req.body.pageRange, total);
    const price = calculatePrice({
      pages: range.count,
      copies,
      color: toBool(req.body.color),
      size: pickSize(req.body.size),
      doubleSided: toBool(req.body.doubleSided),
      stapling: toBool(req.body.stapling),
      binding: toBool(req.body.binding),
      urgent: toBool(req.body.urgent),
    });
    res.json({ price, printPages: range.count });
  } catch (err) {
    res.json({ price: 0, printPages: 0, error: err.message });
  }
});

// Count pages of a chosen file (saves nothing)
router.post("/pagecount", orderLimiter, uploadOne, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  try {
    res.json({ pages: await countPages(req.file) });
  } catch (err) {
    res.status(400).json({ error: "Could not read this file. It may be damaged." });
  }
});

// Online order: file is required
router.post("/online", orderLimiter, uploadOne, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please attach a file" });
  try {
    res.status(201).json(await createOrder(req.body, "online", req.file));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Walk-in order: file is optional (protect with login later)
router.post("/walkin", ...staff, uploadOne, async (req, res) => {
  try {
    res.status(201).json(await createOrder(req.body, "walkin", req.file));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/track/:code", trackLimiter, async (req, res) => {
  const order = await Order.findOne({ trackingCode: req.params.code.toUpperCase() });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({
    trackingCode: order.trackingCode,
    status: order.status,
    price: order.price,
    paid: order.paid,
  });
});

// Admin list (protect later)
router.get("/", ...staff, async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.source) filter.source = req.query.source;
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
});

// Staff only: get a temporary link to the order's file
router.get("/:id/file", ...staff, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || !order.filePublicId) {
    return res.status(404).json({ error: "No file for this order" });
  }
  res.json({
    url: getTempUrl(order.filePublicId, order.fileResourceType, order.fileFormat),
  });
});

// Admin update (protect later). Deletes the file when order is collected.
router.patch("/:id", ...staff, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.body.status) order.status = req.body.status;
    if (typeof req.body.paid === "boolean") order.paid = req.body.paid;

    if (order.status === "collected" && order.filePublicId) {
      try {
        await deleteFile(order.filePublicId, order.fileResourceType);
        order.fileUrl = "";
        order.filePublicId = "";
        order.fileResourceType = "";
      } catch (e) {
        console.error("File delete failed:", e.message);
      }
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Today's totals, split by online and walk-in (admin and super admin only)
router.get("/stats", ...boss, async (req, res) => {
  // midnight today in India time (IST = UTC+5:30, no daylight saving)
  const IST = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST);
  nowIST.setUTCHours(0, 0, 0, 0);
  const start = new Date(nowIST.getTime() - IST);

  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: "$source",
        orders: { $sum: 1 },
        total: { $sum: "$price" },
        paidTotal: { $sum: { $cond: ["$paid", "$price", 0] } },
      },
    },
  ]);
  res.json(rows);
});

// Delete an order and its file (admin and super admin only)
router.delete("/:id", ...boss, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.filePublicId) {
    await deleteFile(order.filePublicId, order.fileResourceType).catch(() => { });
  }
  await order.deleteOne();
  res.json({ ok: true });
});

module.exports = router;