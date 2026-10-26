// Price per page in rupees. Change to your real rates.
const RATES = {
  A4: { bw: 2, color: 10 },
  A3: { bw: 5, color: 20 },
};

function calculatePrice({ pages, copies, color, size, doubleSided }) {
  const perPage = RATES[size][color ? "color" : "bw"];
  const discount = doubleSided ? 0.9 : 1;
  return Math.round(pages * copies * perPage * discount);
}

module.exports = { calculatePrice };