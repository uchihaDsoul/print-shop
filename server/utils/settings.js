const Setting = require("../models/Setting");

const DEFAULTS = {
  // guest feature toggles
  guestShowPaper: true,
  guestShowPhoto: true,
  guestShowStapling: true,
  guestShowBinding: true,
  guestShowUrgent: true,
  guestShowDoubleSided: false, // Parked by default based on Phase 5 Part A
  guestShowCash: true,
  guestShowUPI: true,

  // payments
  upiId: "",
  upiPayeeName: "",
  waitMessage: "The shop will confirm your payment within a few minutes.",
  unpaidExpiryMinutes: 60,
  // printing
  printTiming: "auto", // "auto" = print right after confirm, "manual" = wait for a Print now tap
  readyMode: "manual", // "manual" = manager taps Ready, "auto" = Ready after printing
  coverSlip: true,
  dailyPageLimit: 0, // 0 = no limit
  // double-sided (assisted manual duplex)
  duplexSheetsPerRound: 10,
  dryingSecondsBW: 20,
  dryingSecondsColor: 60,
  // staff and printers
  managerCanPausePrinters: true,
  showVirtualPrinters: false,
  pairingCodeMinutes: 15,
};

let current = { ...DEFAULTS };

function int(value, label, min, max) {
  const n = Number(value);
  if (value === "" || value === null || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}`);
  }
  return n;
}

function oneOf(value, label, list) {
  if (!list.includes(value)) throw new Error(`${label} must be one of: ${list.join(", ")}`);
  return value;
}

function text(value, label, max) {
  const s = String(value ?? "").trim();
  if (s.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return s;
}

// Checks the input and returns a clean copy, or throws a friendly error
function validateSettings(input) {
  const i = { ...current, ...(input || {}) };

  const upiId = text(i.upiId, "UPI ID", 100);
  if (upiId && !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(upiId)) {
    throw new Error("UPI ID looks wrong. It should look like name@bank");
  }

  return {
    guestShowPaper: Boolean(i.guestShowPaper ?? DEFAULTS.guestShowPaper),
    guestShowPhoto: Boolean(i.guestShowPhoto ?? DEFAULTS.guestShowPhoto),
    guestShowStapling: Boolean(i.guestShowStapling ?? DEFAULTS.guestShowStapling),
    guestShowBinding: Boolean(i.guestShowBinding ?? DEFAULTS.guestShowBinding),
    guestShowUrgent: Boolean(i.guestShowUrgent ?? DEFAULTS.guestShowUrgent),
    guestShowDoubleSided: Boolean(i.guestShowDoubleSided ?? DEFAULTS.guestShowDoubleSided),
    guestShowCash: Boolean(i.guestShowCash ?? DEFAULTS.guestShowCash),
    guestShowUPI: Boolean(i.guestShowUPI ?? DEFAULTS.guestShowUPI),

    upiId,
    upiPayeeName: text(i.upiPayeeName, "Payee name", 60),
    waitMessage: text(i.waitMessage, "Waiting message", 200) || DEFAULTS.waitMessage,
    unpaidExpiryMinutes: int(i.unpaidExpiryMinutes, "Unpaid order expiry", 5, 1440),

    printTiming: oneOf(i.printTiming, "Print timing", ["auto", "manual"]),
    readyMode: oneOf(i.readyMode, "Ready mode", ["manual", "auto"]),
    coverSlip: Boolean(i.coverSlip),
    dailyPageLimit: int(i.dailyPageLimit, "Daily page limit", 0, 100000),

    duplexSheetsPerRound: int(i.duplexSheetsPerRound, "Sheets per double-sided round", 1, 50),
    dryingSecondsBW: int(i.dryingSecondsBW, "Drying wait for black and white", 0, 600),
    dryingSecondsColor: int(i.dryingSecondsColor, "Drying wait for color", 0, 600),

    managerCanPausePrinters: Boolean(i.managerCanPausePrinters),
    showVirtualPrinters: Boolean(i.showVirtualPrinters),
    pairingCodeMinutes: int(i.pairingCodeMinutes, "Pairing code lifetime", 1, 120),
  };
}

// Call once at startup, after MongoDB is connected
async function loadSettings() {
  const doc = await Setting.findOne({ key: "shop" });
  if (!doc) {
    await Setting.create({ key: "shop", value: DEFAULTS });
    current = { ...DEFAULTS };
    console.log("Settings: saved defaults");
    return;
  }
  try {
    current = validateSettings(doc.value);
    console.log("Settings: loaded from database");
  } catch (err) {
    console.error("Settings in database are invalid, using defaults:", err.message);
    current = { ...DEFAULTS };
  }
}

async function saveSettings(input, username) {
  const clean = validateSettings(input);
  await Setting.findOneAndUpdate(
    { key: "shop" },
    { value: clean, updatedBy: username || "" },
    { upsert: true, new: true }
  );
  current = clean;
  return clean;
}

const getSettings = () => current;

module.exports = { loadSettings, saveSettings, getSettings, DEFAULTS };