const Setting = require("../models/Setting");

const ALL_SIZES = ["A4", "A3"];

const DEFAULTS = {
  enabledSizes: ["A4"],
  rates: {
    A4: { bw: 2, color: 10 },
    A3: { bw: 5, color: 20 },
  },
  doubleSidedDiscountPercent: 10,
  extras: { stapling: 0, binding: 30, urgent: 20 },
  idCardBw: 10,
  idCardColor: 20,
  // Full A4 photo: price per sheet (placeholders, set real ones on the Pricing page)
  photo: { a4: { bw: 25, color: 40 } },
  // Passport and ID photo sizes: price per piece. Only "enabled" and the prices can be edited.
  photoSizes: {
    "35x45": { label: "35 x 45 mm", wMm: 35, hMm: 45, enabled: true, bw: 8, color: 10 },
    "35x35": { label: "35 x 35 mm", wMm: 35, hMm: 35, enabled: false, bw: 8, color: 10 },
    "51x51": { label: "51 x 51 mm (2 x 2 inch)", wMm: 50.8, hMm: 50.8, enabled: true, bw: 8, color: 10 },
    "25x35": { label: "25 x 35 mm (PAN card)", wMm: 25, hMm: 35, enabled: false, bw: 8, color: 10 },
  },
  // Papers the shop may load. "cost" is what one sheet costs the shop (private, not shown to customers).
  papers: {
    a4: { label: "A4", wMm: 210, hMm: 297, enabled: true, cost: 10, driverName: "A4" },
    a5: { label: "A5", wMm: 148.5, hMm: 210, enabled: false, cost: 6, driverName: "" },
    "3.5x5": { label: "3.5 x 5 inch (3R)", wMm: 88.9, hMm: 127, enabled: false, cost: 4, driverName: "" },
    "4x6": { label: "4 x 6 inch (4R)", wMm: 101.6, hMm: 152.4, enabled: false, cost: 5, driverName: "" },
    "5x7": { label: "5 x 7 inch (5R)", wMm: 127, hMm: 177.8, enabled: false, cost: 8, driverName: "" },
  },
};

let current = JSON.parse(JSON.stringify(DEFAULTS));

function num(value, label, max = 100000) {
  const n = Number(value);
  if (
    value === "" ||
    value === null ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > max
  ) {
    throw new Error(`${label} must be a number between 0 and ${max}`);
  }
  return Math.round(n * 100) / 100;
}

// older saved prices have no photo sections, so a missing value falls back to the default
const orDefault = (value, fallback) => (value === undefined ? fallback : value);

function validateSizes(input, legacy) {
  const given = input && typeof input === "object" ? input : {};
  const out = {};
  for (const [key, def] of Object.entries(DEFAULTS.photoSizes)) {
    const e = given[key] || {};
    out[key] = {
      label: def.label,
      wMm: def.wMm,
      hMm: def.hMm,
      enabled: e.enabled === undefined ? def.enabled : Boolean(e.enabled),
      bw: num(orDefault(e.bw, orDefault(legacy.bw, def.bw)), `${def.label} black and white price`),
      color: num(orDefault(e.color, orDefault(legacy.color, def.color)), `${def.label} color price`),
    };
  }
  if (!Object.values(out).some((s) => s.enabled)) {
    throw new Error("Switch on at least one passport photo size");
  }
  return out;
}

function validatePapers(input) {
  const given = input && typeof input === "object" ? input : {};
  const out = {};
  for (const [key, def] of Object.entries(DEFAULTS.papers)) {
    const e = given[key] || {};
    const driverName = String(orDefault(e.driverName, def.driverName)).trim();
    if (driverName.length > 60) throw new Error(`${def.label}: the driver paper name must be 60 characters or fewer`);
    out[key] = {
      label: def.label,
      wMm: def.wMm,
      hMm: def.hMm,
      enabled: e.enabled === undefined ? def.enabled : Boolean(e.enabled),
      cost: num(orDefault(e.cost, def.cost), `${def.label} cost per sheet`),
      driverName,
    };
  }
  if (!Object.values(out).some((p) => p.enabled)) throw new Error("Switch on at least one paper");
  return out;
}

// Checks the input and returns a clean copy, or throws a friendly error
function validatePricing(input) {
  const r = (input && input.rates) || {};
  const e = (input && input.extras) || {};
  const p = (input && input.photo) || {};
  const pa4 = p.a4 || {};
  const legacyPassport = p.passport || {}; // old saved prices had one passport price for every size

  // older saved prices have no enabledSizes, so fall back to the default
  const wanted = Array.isArray(input && input.enabledSizes)
    ? input.enabledSizes
    : DEFAULTS.enabledSizes;
  const enabledSizes = ALL_SIZES.filter((s) => wanted.includes(s));
  if (enabledSizes.length === 0)
    throw new Error("Enable at least one paper size");

  return {
    enabledSizes,
    rates: {
      A4: {
        bw: num(r.A4 && r.A4.bw, "A4 black and white rate"),
        color: num(r.A4 && r.A4.color, "A4 color rate"),
      },
      A3: {
        bw: num(r.A3 && r.A3.bw, "A3 black and white rate"),
        color: num(r.A3 && r.A3.color, "A3 color rate"),
      },
    },
    doubleSidedDiscountPercent: num(
      input && input.doubleSidedDiscountPercent,
      "Double-sided discount",
      100,
    ),
    extras: {
      stapling: num(e.stapling, "Stapling charge"),
      binding: num(e.binding, "Binding charge"),
      urgent: num(e.urgent, "Urgent charge"),
    },
    idCardBw: num(orDefault(input && input.idCardBw, DEFAULTS.idCardBw), "Smart ID card B/W rate"),
    idCardColor: num(orDefault(input && input.idCardColor, DEFAULTS.idCardColor), "Smart ID card color rate"),
    photo: {
      a4: {
        bw: num(orDefault(pa4.bw, DEFAULTS.photo.a4.bw), "A4 photo black and white price"),
        color: num(orDefault(pa4.color, DEFAULTS.photo.a4.color), "A4 photo color price"),
      },
    },
    photoSizes: validateSizes(input && input.photoSizes, legacyPassport),
    papers: validatePapers(input && input.papers),
  };
}

// Call once at startup, after MongoDB is connected
async function loadPricing() {
  const doc = await Setting.findOne({ key: "pricing" });
  if (!doc) {
    await Setting.create({ key: "pricing", value: DEFAULTS });
    current = JSON.parse(JSON.stringify(DEFAULTS));
    console.log("Pricing: saved default prices");
    return;
  }
  try {
    current = validatePricing(doc.value);
    console.log("Pricing: loaded from database");
  } catch (err) {
    console.error(
      "Pricing in database is invalid, using defaults:",
      err.message,
    );
    current = JSON.parse(JSON.stringify(DEFAULTS));
  }
}

async function savePricing(input, username) {
  const clean = validatePricing(input);
  await Setting.findOneAndUpdate(
    { key: "pricing" },
    { value: clean, updatedBy: username || "" },
    { upsert: true, new: true },
  );
  current = clean;
  return clean;
}

const getPricing = () => current;

// What customers may see: everything except the shop's private paper costs
function getPublicPricing() {
  const { papers, ...rest } = current;
  return rest;
}

// Returns the size if it is enabled, otherwise the first enabled size
function pickSize(value) {
  const { enabledSizes } = current;
  return enabledSizes.includes(value) ? value : enabledSizes[0];
}

function calculatePrice({
  pages,
  copies,
  color,
  size,
  doubleSided,
  stapling,
  binding,
  urgent,
  isIdLayout,
}) {
  const { rates, doubleSidedDiscountPercent, extras, idCardBw, idCardColor } = current;
  
  let perPage = 0;
  if (isIdLayout) {
    perPage = color ? idCardColor : idCardBw;
  } else {
    const sizeRates = rates[size] || rates.A4;
    perPage = sizeRates[color ? "color" : "bw"];
  }

  const factor = doubleSided && !isIdLayout ? 1 - doubleSidedDiscountPercent / 100 : 1;
  let total = pages * copies * perPage * factor;

  // stapling and binding are charged per copy, urgent once per order
  if (stapling) total += extras.stapling * copies;
  if (binding) total += extras.binding * copies;
  if (urgent) total += extras.urgent;

  return Math.round(total);
}

// Full A4 photo: price per sheet (sheets = photos x copies)
function calculateA4PhotoPrice({ sheets, color }) {
  const perSheet = current.photo.a4[color ? "color" : "bw"];
  return Math.round(sheets * perSheet);
}

// Passport photos: price per piece, for the chosen size
function calculatePassportPrice({ pieces, color, size }) {
  const s = current.photoSizes[size] || current.photoSizes["35x45"];
  return Math.round(pieces * s[color ? "color" : "bw"]);
}

module.exports = {
  calculatePrice,
  calculateA4PhotoPrice,
  calculatePassportPrice,
  getPricing,
  getPublicPricing,
  loadPricing,
  savePricing,
  pickSize,
};