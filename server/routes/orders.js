const express = require("express");
const crypto = require("crypto");
const Order = require("../models/Order");
const { calculatePrice } = require("../utils/pricing");

const router = express.Router();

function makeTrackingCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function createOrder(body, source) {
  const { customerName, phone, fileName, pages, copies, color, size, doubleSided } = body;

  const options = {
    pages: Number(pages),
    copies: Number(copies) || 1,
    color: Boolean(color),
    size: size === "A3" ? "A3" : "A4",
    doubleSided: Boolean(doubleSided),
  };

  const price = calculatePrice(options);

  return Order.create({
    trackingCode: makeTrackingCode(),
    source,
    customerName,
    phone,
    fileName,
    ...options,
    price,
  });
}

router.post("/online", async (req, res) => {
  try {
    res.status(201).json(await createOrder(req.body, "online"));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/walkin", async (req, res) => {
  try {
    res.status(201).json(await createOrder(req.body, "walkin"));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/track/:code", async (req, res) => {
  const order = await Order.findOne({ trackingCode: req.params.code.toUpperCase() });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({
    trackingCode: order.trackingCode,
    status: order.status,
    price: order.price,
    paid: order.paid,
  });
});

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.source) filter.source = req.query.source;
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
});

router.patch("/:id", async (req, res) => {
  const { status, paid } = req.body;
  const update = {};
  if (status) update.status = status;
  if (typeof paid === "boolean") update.paid = paid;

  const order = await Order.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;