const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const Order = require("../models/Order");
const { calculatePrice, getPricing, pickSize } = require("../utils/pricing");
const { getSettings } = require("../utils/settings");
const { STATUSES, NEEDS_PAYMENT } = require("../utils/orderFlow");
const { saveFile, getTempUrl, deleteFile } = require("../utils/storage");
const { uploadOne } = require("../utils/upload");
const { countPages } = require("../utils/pdf");
const { parsePageRange } = require("../utils/pageRange");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const staff = [requireAuth, requireRole("manager", "admin", "superadmin")];
const boss = [requireAuth, requireRole("admin", "superadmin")];

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

const toBool = (v) => v === true || v === "true" || v === "on";

function makeTrackingCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 characters
}

// Deletes the order's file from Cloudinary (the caller saves the order)
async function removeOrderFile(order) {
  if (!order.filePublicId) return;
  try {
    await deleteFile(order.filePublicId, order.fileResourceType);
    order.fileUrl = "";
    order.filePublicId = "";
    order.fileResourceType = "";
    order.fileFormat = "";
  } catch (e) {
    console.error("File delete failed:", e.message);
  }
}

// The only order fields a customer is allowed to see
function publicOrder(o) {
  return {
    trackingCode: o.trackingCode,
    source: o.source,
    status: o.status,
    price: o.price,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    rejectReason: o.rejectReason,
    atCounter: Boolean(o.atCounterAt),
    upiSubmitted: Boolean(o.upiReference),
    expiresAt: o.expiresAt || null,
  };
}

const payLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again later." },
});

// Finds an online order that is still waiting for payment
async function findPayable(req, res) {
  const order = await Order.findOne({
    trackingCode: String(req.params.code).toUpperCase(),
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  if (order.source !== "online") {
    res.status(400).json({ error: "Please pay at the counter for this order" });
    return null;
  }
  if (!["awaiting_payment", "awaiting_confirmation"].includes(order.status)) {
    res.status(400).json({ error: "This order isn't waiting for payment" });
    return null;
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    res
      .status(400)
      .json({ error: "This order has expired. Please place a new order." });
    return null;
  }
  return order;
}

async function createOrder(body, source, file, staffUser) {
  const { customerName, phone } = body;

  if (!/^[0-9]{10}$/.test(phone || "")) {
    throw new Error("Phone number must be 10 digits");
  }

  let pages = Number(body.pages);
  let fileData = { fileName: body.fileName || "" };

  if (file) {
    pages = await countPages(file); // the server decides the page count
    fileData = {
      ...(await saveFile(file.buffer)),
      fileName: file.originalname,
    };
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

    // payment and workflow fields
    const now = new Date();
    let flow;
    if (source === "walkin") {
      const method = ["cash", "upi"].includes(body.payment) ? body.payment : "";
      flow = method
        ? {
            paid: true,
            paymentMethod: method,
            paymentConfirmedAt: now,
            paymentConfirmedBy: staffUser.username,
            status: "queued",
            queuedAt: now,
          }
        : { paid: false, status: "awaiting_payment" };
    } else {
      const minutes = getSettings().unpaidExpiryMinutes;
      flow = {
        paid: false,
        status: "awaiting_payment",
        expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
      };
    }

    return await Order.create({
      trackingCode: makeTrackingCode(),
      source,
      customerName,
      phone,
      ...fileData,
      pages,
      printPages: range.count,
      pageRange: range.normalized,
      note,
      ...printOptions,
      price,
      ...flow,
    });
  } catch (err) {
    // order failed: remove the uploaded file so it isn't left behind
    if (fileData.filePublicId) {
      deleteFile(fileData.filePublicId, fileData.fileResourceType).catch(
        () => {},
      );
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
    res
      .status(400)
      .json({ error: "Could not read this file. It may be damaged." });
  }
});

// Online order: file is required
router.post("/online", orderLimiter, uploadOne, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please attach a file" });
  try {
    const order = await createOrder(req.body, "online", req.file, null);
    res.status(201).json(publicOrder(order));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Walk-in order: file is optional, staff only
router.post("/walkin", ...staff, uploadOne, async (req, res) => {
  try {
    res
      .status(201)
      .json(await createOrder(req.body, "walkin", req.file, req.user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public tracking: only safe fields
router.get("/track/:code", trackLimiter, async (req, res) => {
  const order = await Order.findOne({
    trackingCode: req.params.code.toUpperCase(),
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(publicOrder(order));
});

// Customer: submit the UPI reference number
router.post("/track/:code/upi", payLimiter, async (req, res) => {
  const order = await findPayable(req, res);
  if (!order) return;

  const reference = String(req.body.reference || "").replace(/\s+/g, "");
  if (!/^\d{12}$/.test(reference)) {
    return res
      .status(400)
      .json({ error: "Enter the 12-digit UPI reference number from your payment app" });
  }

  const used = await Order.findOne({ upiReference: reference, _id: { $ne: order._id } });
  if (used) {
    return res.status(400).json({ error: "This reference number has already been used" });
  }

  try {
    order.paymentMethod = "upi";
    order.upiReference = reference;
    order.status = "awaiting_confirmation";
    await order.save();
    res.json(publicOrder(order));
  } catch (err) {
    const msg =
      err.code === 11000 ? "This reference number has already been used" : err.message;
    res.status(400).json({ error: msg });
  }
});

// Customer: chose to pay cash (the order stays quiet until they reach the counter)
router.post("/track/:code/cash", payLimiter, async (req, res) => {
  const order = await findPayable(req, res);
  if (!order) return;
  if (order.upiReference) {
    return res.status(400).json({ error: "You already sent a UPI payment. Please ask the shop." });
  }
  order.paymentMethod = "cash";
  await order.save();
  res.json(publicOrder(order));
});

// Customer: "I'm at the counter" (this is what alerts the manager)
router.post("/track/:code/counter", payLimiter, async (req, res) => {
  const order = await findPayable(req, res);
  if (!order) return;
  if (order.upiReference) {
    return res.status(400).json({ error: "You already sent a UPI payment. Please ask the shop." });
  }
  order.paymentMethod = "cash";
  order.atCounterAt = new Date();
  order.status = "awaiting_confirmation";
  await order.save();
  res.json(publicOrder(order));
});

// Staff: list orders. ?status= accepts one status or a comma-separated list
router.get("/", ...staff, async (req, res) => {
  const filter = {};
  if (req.query.status) {
    const list = String(req.query.status)
      .split(",")
      .filter((s) => STATUSES.includes(s));
    if (list.length) filter.status = { $in: list };
  }
  if (req.query.source) filter.source = req.query.source;
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
});

// Today's totals, split by online and walk-in (admin and super admin only)
router.get("/stats", ...boss, async (req, res) => {
  // midnight today in India time (IST = UTC+5:30, no daylight saving)
  const IST = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST);
  nowIST.setUTCHours(0, 0, 0, 0);
  const start = new Date(nowIST.getTime() - IST);

  const rows = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start },
        status: { $nin: ["rejected", "cancelled"] },
      },
    },
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

// Staff: temporary link to the order's file
router.get("/:id/file", ...staff, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || !order.filePublicId) {
    return res.status(404).json({ error: "No file for this order" });
  }
  res.json({
    url: getTempUrl(
      order.filePublicId,
      order.fileResourceType,
      order.fileFormat,
    ),
  });
});

// Staff: change status, or confirm / undo a payment
router.patch("/:id", ...staff, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isBoss = ["admin", "superadmin"].includes(req.user.role);
    const { status, paid, paymentMethod, rejectReason } = req.body;
    const now = new Date();

    // 1) payment
    if (typeof paid === "boolean" && paid !== order.paid) {
      if (paid) {
        order.paid = true;
        order.paymentMethod = ["cash", "upi"].includes(paymentMethod)
          ? paymentMethod
          : order.paymentMethod || "cash";
        order.paymentConfirmedAt = now;
        order.paymentConfirmedBy = req.user.username;
        if (
          ["awaiting_payment", "awaiting_confirmation"].includes(order.status)
        ) {
          order.status = "queued";
          order.queuedAt = now;
          order.expiresAt = undefined;
        }
      } else {
        if (order.status !== "queued" && !isBoss) {
          return res.status(400).json({
            error:
              "This order is already being processed, so only an admin can mark it unpaid",
          });
        }
        order.paid = false;
        order.paymentConfirmedAt = undefined;
        order.paymentConfirmedBy = "";
        if (order.status === "queued") order.status = "awaiting_payment";
      }
    }

    // 2) status
    if (status && status !== order.status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: "Unknown status" });
      }
      if (NEEDS_PAYMENT.includes(status) && !order.paid) {
        return res
          .status(400)
          .json({ error: "Confirm the payment before printing" });
      }
      if (
        ["awaiting_payment", "awaiting_confirmation"].includes(status) &&
        order.paid
      ) {
        return res.status(400).json({ error: "This order is already paid" });
      }

      order.status = status;
      if (status === "queued") {
        order.queuedAt = now;
        order.printError = "";
      }
      if (status === "printed") order.printedAt = now;
      if (status === "rejected") {
        order.rejectReason = String(rejectReason || "")
          .trim()
          .slice(0, 200);
      }
      if (["collected", "cancelled", "rejected"].includes(status)) {
        order.expiresAt = undefined;
      }
    }

    // privacy: delete the file once the order is finished or cancelled
    if (["collected", "cancelled"].includes(order.status)) {
      await removeOrderFile(order);
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete an order and its file (admin and super admin only)
router.delete("/:id", ...boss, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  await removeOrderFile(order);
  await order.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
