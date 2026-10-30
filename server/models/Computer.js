const mongoose = require("mongoose");

const computerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Pairing (one-time code). Only a scrambled copy (hash) is stored.
    codeHash: { type: String, default: null, index: true },
    codeExpiresAt: { type: Date, default: null },
    // The PC's own secret key. Only the hash is stored here.
    keyHash: { type: String, default: null, index: true },
    pairedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    agentVersion: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Computer", computerSchema);