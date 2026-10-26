const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    trackingCode: { type: String, unique: true, required: true },
    source: { type: String, enum: ["online", "walkin"], required: true },

    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },

    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    filePublicId: { type: String, default: "" },
    fileResourceType: { type: String, default: "" },
    fileFormat: { type: String, default: "" },
    pages: { type: Number, required: true, min: 1 },
    printPages: { type: Number, default: 0 }, // pages actually printed
    pageRange: { type: String, default: "" }, // e.g. "1-5,8"
    copies: { type: Number, required: true, min: 1, default: 1 },
    color: { type: Boolean, default: false },
    size: { type: String, enum: ["A4", "A3"], default: "A4" },
    doubleSided: { type: Boolean, default: false },
    stapling: { type: Boolean, default: false },
    binding: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    note: { type: String, default: "", maxlength: 300, trim: true },

    price: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "printing", "ready", "collected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);