// Price per page in rupees. Change to your real rates.
const RATES = {
  A4: { bw: 2, color: 10 },
  A3: { bw: 5, color: 20 },
};

// 0.9 means 10% off for double-sided
const DOUBLE_SIDED_FACTOR = 0.9;

// Flat extra charges per order, in rupees (0 = free)
const EXTRAS = {
  stapling: 0,
  binding: 30,
  urgent: 20,
};

function calculatePrice({ pages, copies, color, size, doubleSided, stapling, binding, urgent }) {
  const perPage = RATES[size][color ? "color" : "bw"];
  const factor = doubleSided ? DOUBLE_SIDED_FACTOR : 1;
  let total = pages * copies * perPage * factor;

  // binding and stapling are charged per copy, urgent once per order
  if (stapling) total += EXTRAS.stapling * copies;
  if (binding) total += EXTRAS.binding * copies;
  if (urgent) total += EXTRAS.urgent;

  return Math.round(total);
}

module.exports = { calculatePrice, RATES, DOUBLE_SIDED_FACTOR, EXTRAS };