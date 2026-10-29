const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]); // local DNS fix; harmless on Render

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { loadPricing } = require("./utils/pricing");
const { loadSettings } = require("./utils/settings");
const { migrateOrders } = require("./utils/migrate");

const app = express();
app.set("trust proxy", 1);

const allowed = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS")),
  }),
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ message: "Server is running" });
});

app.use("/api/orders", require("./routes/orders"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await loadPricing();
    await loadSettings();
    await migrateOrders();
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
  })
  .catch((err) => console.error("Startup failed:", err.message));