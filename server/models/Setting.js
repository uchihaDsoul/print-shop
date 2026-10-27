const mongoose = require("mongoose");

// Generic key-value settings. Right now it holds one document: key "pricing".

const settingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        updatedBy: { type: String, default: "" },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Setting", settingSchema);