const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    trackingCode: { type: String, unique: true, required: true },
    source: { type: String, enum: ["online", "walkin"], required: true },

    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },

    // file
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" }, // no longer used (files are private)
    filePublicId: { type: String, default: "" },
    fileResourceType: { type: String, default: "" },
    fileFormat: { type: String, default: "" },

    // print options
    pages: { type: Number, required: true, min: 1 }, // total pages in the file
    printPages: { type: Number, default: 0 }, // pages actually printed
    pageRange: { type: String, default: "" },
    copies: { type: Number, required: true, min: 1, default: 1 },
    color: { type: Boolean, default: false },
    size: { type: String, enum: ["A4", "A3"], default: "A4" },
    doubleSided: { type: Boolean, default: false },
    stapling: { type: Boolean, default: false },
    binding: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    note: { type: String, default: "", maxlength: 300, trim: true },

    // money
    price: { type: Number, required: true },
    paid: { type: Boolean, default: false }, // true = payment confirmed by staff
    paymentMethod: { type: String, enum: ["", "upi", "cash"], default: "" },
    // no default on purpose: the unique index skips orders without a reference
    upiReference: { type: String, trim: true, unique: true, sparse: true },
    paymentConfirmedAt: { type: Date },
    paymentConfirmedBy: { type: String, default: "" },
    rejectReason: { type: String, default: "", maxlength: 200 },
    cancelReason: { type: String, default: "", maxlength: 200 },
    atCounterAt: { type: Date }, // customer tapped "I'm at the counter" (step 1.4)
    expiresAt: { type: Date }, // unpaid online orders expire (step 1.6)

    // workflow
    status: {
      type: String,
      enum: [
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
      ],
      default: "awaiting_payment",
    },
    queuedAt: { type: Date },
    printedAt: { type: Date },
    printAttempts: { type: Number, default: 0 },
    printError: { type: String, default: "" },
    printerName: { type: String, default: "" },

    // orders from before the payment flow existed (the print agent skips them)
    legacy: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
