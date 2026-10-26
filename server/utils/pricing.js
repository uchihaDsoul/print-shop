// Price per page in rupees. Change to your real rates.
const RATES = {
  A4: { bw: 2, color: 10 },
  A3: { bw: 5, color: 20 },
};

// 0.9 means 10% off for double-sided
const DOUBLE_SIDED_FACTOR = 0.9;

function calculatePrice({ pages, copies, color, size, doubleSided }) {
  const perPage = RATES[size][color ? "color" : "bw"];
  const factor = doubleSided ? DOUBLE_SIDED_FACTOR : 1;
  return Math.round(pages * copies * perPage * factor);
}

module.exports = { calculatePrice, RATES, DOUBLE_SIDED_FACTOR };