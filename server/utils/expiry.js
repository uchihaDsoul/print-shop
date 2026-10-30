const Order = require("../models/Order");
const { deleteFile } = require("./storage");

// Deletes the file from Cloudinary and clears the fields on the order
async function clearFile(order) {
  if (!order.filePublicId) return;
  try {
    await deleteFile(order.filePublicId, order.fileResourceType);
    order.fileUrl = "";
    order.filePublicId = "";
    order.fileResourceType = "";
    order.fileFormat = "";
    await order.save();
  } catch (err) {
    console.error("Expiry: file delete failed, will retry:", err.message);
  }
}

// 1) cancel online orders that were never paid in time
async function expireUnpaidOrders() {
  const now = new Date();
  const due = await Order.find({
    status: "awaiting_payment",
    paid: false,
    source: "online",
    expiresAt: { $lt: now },
  })
    .select("_id")
    .limit(50);

  let cancelled = 0;
  for (const { _id } of due) {
    // the first one to change it wins, so a payment confirmed a second ago is never cancelled
    const order = await Order.findOneAndUpdate(
      { _id, status: "awaiting_payment", paid: false, expiresAt: { $lt: now } },
      {
        $set: { status: "cancelled", cancelReason: "Not paid in time" },
        $unset: { expiresAt: "" },
      },
      { new: true }
    );
    if (!order) continue;
    cancelled++;
    await clearFile(order);
  }
  if (cancelled > 0) console.log(`Expiry: cancelled ${cancelled} unpaid order(s)`);
}

// 2) retry files that could not be deleted earlier
async function retryFileCleanup() {
  const left = await Order.find({
    status: { $in: ["cancelled", "rejected"] },
    filePublicId: { $ne: "" },
  }).limit(20);
  for (const order of left) await clearFile(order);
}

let running = false;

async function runExpiry() {
  if (running) return;
  running = true;
  try {
    await expireUnpaidOrders();
    await retryFileCleanup();
  } catch (err) {
    console.error("Expiry job error:", err.message);
  } finally {
    running = false;
  }
}

function startExpiryJob() {
  runExpiry(); // catch up right away (the server may have been asleep)
  setInterval(runExpiry, 60 * 1000);
}

module.exports = { startExpiryJob };