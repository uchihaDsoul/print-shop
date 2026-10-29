const Order = require("../models/Order");

// Safe to run on every start: it only touches orders that still say "pending"
async function migrateOrders() {
  const paid = await Order.updateMany(
    { status: "pending", paid: true },
    { $set: { status: "queued", queuedAt: new Date(), legacy: true } }
  );
  const unpaid = await Order.updateMany(
    { status: "pending" },
    { $set: { status: "awaiting_payment", legacy: true } }
  );

  const moved = paid.modifiedCount + unpaid.modifiedCount;
  if (moved > 0) console.log(`Migration: updated ${moved} old order(s)`);
}

module.exports = { migrateOrders };