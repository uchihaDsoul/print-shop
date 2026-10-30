const mongoose = require("mongoose");

const STATUSES = ["detected", "waiting_approval", "active", "paused", "ignored", "missing"];

const printerSchema = new mongoose.Schema(
  {
    computer: { type: mongoose.Schema.Types.ObjectId, ref: "Computer", required: true },
    windowsName: { type: String, required: true }, // exact Windows name
    displayName: { type: String, default: "" },
    portName: { type: String, default: "" },
    driverName: { type: String, default: "" },
    connection: { type: String, enum: ["usb", "wifi", "virtual", "unknown"], default: "unknown" },
    isVirtual: { type: Boolean, default: false },
    testPrinter: { type: Boolean, default: false },
    status: { type: String, enum: STATUSES, default: "detected" },
    statusBeforeMissing: { type: String, default: null },
    supportsColor: { type: Boolean, default: true },
    duplexMode: { type: String, enum: ["none", "manual"], default: "none" },
    isDefault: { type: Boolean, default: false },
    dailyLimit: { type: Number, default: null }, // null = no limit
    dailyPages: { type: Number, default: 0 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

printerSchema.index({ computer: 1, windowsName: 1 }, { unique: true });

module.exports = mongoose.model("Printer", printerSchema);
module.exports.STATUSES = STATUSES;