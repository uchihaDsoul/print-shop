export const STATUS_LABEL = {
  awaiting_payment: "Awaiting payment",
  awaiting_confirmation: "Awaiting confirmation",
  queued: "Queued",
  printing: "Printing",
  printed: "Printed",
  ready: "Ready",
  collected: "Collected",
  rejected: "Rejected",
  cancelled: "Cancelled",
  print_failed: "Print failed",
};

export const ALL_STATUSES = Object.keys(STATUS_LABEL);

export const statusLabel = (s) => STATUS_LABEL[s] || s;

// Orders list order: things that need attention first
export const SORT_ORDER = [
  "awaiting_confirmation",
  "awaiting_payment",
  "print_failed",
  "queued",
  "printing",
  "printed",
  "ready",
  "collected",
  "rejected",
  "cancelled",
];

// Filter chips on the Orders page (the value goes to the server)
export const FILTERS = [
  { label: "All", value: "" },
  { label: "Needs payment", value: "awaiting_payment,awaiting_confirmation" },
  { label: "To print", value: "queued,printing,printed,print_failed" },
  { label: "Ready", value: "ready" },
  { label: "Collected", value: "collected" },
  { label: "Closed", value: "rejected,cancelled" },
];

// Used by the red badge in the sidebar
export const NEEDS_ACTION = "awaiting_payment,awaiting_confirmation";