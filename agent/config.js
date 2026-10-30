// Reads and writes agent\config.json (server address and the secret key)
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "config.json");

function load() {
  if (!fs.existsSync(FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function save(config) {
  fs.writeFileSync(FILE, JSON.stringify(config, null, 2), "utf8");
}

module.exports = { load, save, FILE };