// Prints to the screen and also appends to logs\agent.log
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "logs");
const FILE = path.join(DIR, "agent.log");

function log(message) {
  const line = `${new Date().toLocaleString("en-IN")}  ${message}`;
  console.log(line);
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(FILE, line + "\n");
  } catch {
    // logging must never crash the agent
  }
}

module.exports = log;