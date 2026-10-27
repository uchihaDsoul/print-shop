const Setting = require("../models/Setting");

const DEFAULTS = {
  rates: {
    A4: { bw: 2, color: 10 },
    A3: { bw: 5, color: 20 },
  },
  doubleSidedDiscountPercent: 10,
  extras: { stapling: 0, binding: 30, urgent: 20 },
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

// Checks the input and returns a clean copy, or throws a friendly error
function validatePricing(input) {
  const r = (input && input.rates) || {};
  const e = (input && input.extras) || {};
  return {
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

function calculatePrice({
  pages,
  copies,
  color,
  size,
  doubleSided,
  stapling,
  binding,
  urgent,
}) {
  const { rates, doubleSidedDiscountPercent, extras } = current;
  const perPage = rates[size][color ? "color" : "bw"];
  const factor = doubleSided ? 1 - doubleSidedDiscountPercent / 100 : 1;
  let total = pages * copies * perPage * factor;

  // stapling and binding are charged per copy, urgent once per order
  if (stapling) total += extras.stapling * copies;
  if (binding) total += extras.binding * copies;
  if (urgent) total += extras.urgent;

  return Math.round(total);
}

module.exports = { calculatePrice, getPricing, loadPricing, savePricing };
