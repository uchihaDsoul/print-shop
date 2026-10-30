const crypto = require("crypto");
const Computer = require("../models/Computer");

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// Used by routes that only the print agent may call.
async function requireAgent(req, res, next) {
  try {
    const key = req.get("x-agent-key");
    if (!key) return res.status(401).json({ error: "Missing agent key" });

    const computer = await Computer.findOne({ keyHash: sha256(key), active: true });
    if (!computer) return res.status(401).json({ error: "Invalid agent key" });

    await Computer.updateOne({ _id: computer._id }, { lastSeenAt: new Date() });
    req.computer = computer;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { requireAgent, sha256 };