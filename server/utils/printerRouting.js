const Printer = require("../models/Printer");

const ONLINE_MS = 30 * 1000; // a computer is online if it spoke to us in the last 30 seconds

function isOnline(computer) {
  return !!(computer && computer.active && computer.lastSeenAt &&
    Date.now() - new Date(computer.lastSeenAt).getTime() < ONLINE_MS);
}

// Picks the best printer for a job, or null if none is available.
// getQueueLength(printerId) is given by the caller (Phase 4 will use real queue counts).
async function pickPrinter({ color, getQueueLength = async () => 0 }) {
  const printers = await Printer.find({ status: "active" }).populate("computer");

  let list = printers.filter((p) => isOnline(p.computer));
  if (color) list = list.filter((p) => p.supportsColor);
  list = list.filter((p) => p.dailyLimit == null || p.dailyPages < p.dailyLimit);
  if (list.length === 0) return null;

  const withQueue = [];
  for (const p of list) withQueue.push({ p, queue: await getQueueLength(p._id) });

  withQueue.sort((a, b) => {
    if (a.queue !== b.queue) return a.queue - b.queue; // shortest queue first
    if (a.p.isDefault !== b.p.isDefault) return a.p.isDefault ? -1 : 1; // default breaks ties
    return a.p.windowsName.localeCompare(b.p.windowsName);
  });
  return withQueue[0].p;
}

module.exports = { pickPrinter, isOnline };