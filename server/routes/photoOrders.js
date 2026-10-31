const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const Order = require("../models/Order");
const {
  calculateA4PhotoPrice,
  calculatePassportPrice,
} = require("../utils/pricing");
const { getSettings } = require("../utils/settings");
const { saveFile, deleteFile } = require("../utils/storage");
const photo = require("../utils/photo");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const staff = [requireAuth, requireRole("manager", "admin", "superadmin")];

const MAX_SHEETS = 60;
const MAX_PIECES = 40;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please try again later." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) =>
    ["image/jpeg", "image/png"].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPG and PNG photos are allowed")),
});

function uploadPhotos(req, res, next) {
  upload.array("photos", 10)(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "A photo is too large (max 20 MB)"
          : err.code === "LIMIT_UNEXPECTED_FILE" ||
              err.code === "LIMIT_FILE_COUNT"
            ? "You can add up to 10 photos"
            : err.message;
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

const toBool = (v) => v === true || v === "true" || v === "on";
const numOr = (v, fallback) =>
  Number.isFinite(Number(v)) && v !== "" && v !== null && v !== undefined
    ? Number(v)
    : fallback;
const makeTrackingCode = () =>
  crypto.randomBytes(5).toString("hex").toUpperCase();

function publicOrder(o) {
  return {
    trackingCode: o.trackingCode,
    source: o.source,
    orderType: o.orderType,
    status: o.status,
    price: o.price,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    rejectReason: o.rejectReason,
    cancelReason: o.cancelReason,
    atCounter: Boolean(o.atCounterAt),
    upiSubmitted: Boolean(o.upiReference),
    expiresAt: o.expiresAt || null,
  };
}

function paymentFlow(source, body, staffUser) {
  const now = new Date();
  if (source === "walkin") {
    const method = ["cash", "upi"].includes(body.payment) ? body.payment : "";
    return method
      ? {
          paid: true,
          paymentMethod: method,
          paymentConfirmedAt: now,
          paymentConfirmedBy: staffUser.username,
          status: "queued",
          queuedAt: now,
        }
      : { paid: false, status: "awaiting_payment" };
  }
  const minutes = getSettings().unpaidExpiryMinutes;
  return {
    paid: false,
    status: "awaiting_payment",
    expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
  };
}

// body.items is a JSON list, one entry per photo: [{ copies, fit, zoom, x, y }]
function parseItems(raw, count) {
  let list = [];
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch {
      throw new Error("Photo settings are not valid");
    }
    if (!Array.isArray(list)) throw new Error("Photo settings are not valid");
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const it = list[i] || {};
    const copies = numOr(it.copies, 1);
    if (!Number.isInteger(copies) || copies < 1 || copies > 20) {
      throw new Error(
        `Photo ${i + 1}: copies must be a whole number from 1 to 20`,
      );
    }
    out.push({
      copies,
      fit: it.fit === "fit" ? "fit" : "fill",
      zoom: numOr(it.zoom, 1),
      x: numOr(it.x, 0.5),
      y: numOr(it.y, 0.5),
    });
  }
  return out;
}

async function prepareA4(body, files, color) {
  const items = parseItems(body.items, files.length);
  const sheets = items.reduce((sum, it) => sum + it.copies, 0);
  if (sheets > MAX_SHEETS)
    throw new Error(`An order can have at most ${MAX_SHEETS} photo sheets`);

  const prepared = [];
  const warnings = [];
  for (let i = 0; i < files.length; i++) {
    const p = await photo.prepareA4Photo(files[i].buffer, items[i], i);
    prepared.push(p);
    if (p.dpi < photo.WARN_DPI)
      warnings.push(
        `Photo ${i + 1} may look soft (about ${Math.round(p.dpi)} DPI)`,
      );
  }
  const pdf = await photo.buildA4Pdf(prepared);
  return {
    buffer: pdf,
    fileName: "a4-photos.pdf",
    warnings,
    fields: {
      orderType: "photo_a4",
      pages: sheets,
      printPages: sheets,
      copies: 1,
      price: calculateA4PhotoPrice({ sheets, color }),
    },
  };
}

async function preparePassport(body, files, color) {
  if (files.length !== 1)
    throw new Error("Passport photos need exactly one photo");
  const size = String(body.passportSize || "");
  if (!photo.PASSPORT[size]) throw new Error("Choose a passport photo size");
  const pieces = Number(body.pieces);
  if (!Number.isInteger(pieces) || pieces < 1 || pieces > MAX_PIECES) {
    throw new Error(
      `Number of passport photos must be from 1 to ${MAX_PIECES}`,
    );
  }
  const r = await photo.renderPassport(files[0].buffer, size, {
    zoom: numOr(body.zoom, 1),
    x: numOr(body.x, 0.5),
    y: numOr(body.y, 0.5),
  });
  const warnings =
    r.dpi < photo.WARN_DPI
      ? [`This photo may look soft (about ${Math.round(r.dpi)} DPI)`]
      : [];
  return {
    buffer: r.jpeg,
    fileName: `passport-${size}.jpg`,
    warnings,
    fields: {
      orderType: "passport",
      passportSize: size,
      passportPieces: pieces,
      pages: 1,
      printPages: 1,
      copies: 1,
      price: calculatePassportPrice({ pieces, color }),
    },
  };
}

async function createPhotoOrder(body, files, source, staffUser) {
  const customerName = String(body.customerName || "").trim();
  const phone = body.phone;
  if (!customerName) throw new Error("Name is required");
  if (!/^[0-9]{10}$/.test(phone || ""))
    throw new Error("Phone number must be 10 digits");
  if (!files || files.length === 0)
    throw new Error("Please add at least one photo");

  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  if (totalBytes > 60 * 1024 * 1024) {
    throw new Error("An order can hold up to 60 MB of photos in total");
  }

  const type = body.orderType;
  if (!["photo_a4", "passport"].includes(type))
    throw new Error("Choose A4 photo or passport photos");
  const color = toBool(body.color);

  const prepared =
    type === "photo_a4"
      ? await prepareA4(body, files, color)
      : await preparePassport(body, files, color);

  const saved = await saveFile(prepared.buffer);
  try {
    const order = await Order.create({
      trackingCode: makeTrackingCode(),
      source,
      customerName,
      phone,
      ...saved,
      fileName: prepared.fileName,
      color,
      size: "A4",
      note: String(body.note || "").slice(0, 300),
      ...prepared.fields,
      ...paymentFlow(source, body, staffUser),
    });
    return { order, warnings: prepared.warnings };
  } catch (err) {
    deleteFile(saved.filePublicId, saved.fileResourceType).catch(() => {});
    throw err;
  }
}

// Price preview (saves nothing)
router.post("/quote", (req, res) => {
  const color = toBool(req.body.color);
  if (req.body.orderType === "passport") {
    const pieces = Number(req.body.pieces);
    const size = req.body.passportSize;
    if (
      !Number.isInteger(pieces) ||
      pieces < 1 ||
      pieces > MAX_PIECES ||
      !photo.PASSPORT[size]
    ) {
      return res.json({ price: 0 });
    }
    return res.json({
      price: calculatePassportPrice({ pieces, color }),
      perSheetA4: photo.capacity("a4", size).perSheet,
      perSheet4x6: photo.capacity("4x6", size).perSheet,
    });
  }
  const sheets = Number(req.body.sheets);
  if (!Number.isInteger(sheets) || sheets < 1 || sheets > MAX_SHEETS)
    return res.json({ price: 0 });
  res.json({ price: calculateA4PhotoPrice({ sheets, color }) });
});

// Online photo order (guest)
router.post("/online", limiter, uploadPhotos, async (req, res) => {
  try {
    const { order, warnings } = await createPhotoOrder(
      req.body,
      req.files,
      "online",
      null,
    );
    res.status(201).json({ ...publicOrder(order), warnings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Walk-in photo order (staff)
router.post("/walkin", ...staff, uploadPhotos, async (req, res) => {
  try {
    const { order, warnings } = await createPhotoOrder(
      req.body,
      req.files,
      "walkin",
      req.user,
    );
    res.status(201).json({ ...order.toObject(), warnings });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Staff test: returns a passport sheet PDF so you can check the layout (saves nothing)
router.post("/test-sheet", ...staff, uploadPhotos, async (req, res) => {
  try {
    if (!req.files || req.files.length !== 1)
      throw new Error("Send exactly one photo");
    const size = String(req.body.passportSize || "35x45");
    const paper = req.body.paper === "4x6" ? "4x6" : "a4";
    const pieces = Math.min(
      MAX_PIECES,
      Math.max(1, Number(req.body.pieces) || 6),
    );
    const r = await photo.renderPassport(req.files[0].buffer, size, {
      zoom: numOr(req.body.zoom, 1),
      x: numOr(req.body.x, 0.5),
      y: numOr(req.body.y, 0.5),
    });
    const pdf = await photo.buildPassportSheet({
      photoJpeg: r.jpeg,
      size,
      paper,
      pieces,
    });
    res.set("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
