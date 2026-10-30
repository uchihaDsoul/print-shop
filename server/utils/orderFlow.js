const STATUSES = [
  "awaiting_payment",
  "awaiting_confirmation",
  "queued",
  "printing",
  "printed",
  "ready",
  "collected",
  "rejected",
  "cancelled",
  "print_failed",
];

// An order may only enter these statuses after its payment is confirmed
const NEEDS_PAYMENT = ["queued", "printing", "printed"];

module.exports = { STATUSES, NEEDS_PAYMENT };