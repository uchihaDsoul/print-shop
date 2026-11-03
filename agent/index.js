// The print agent entry point.
// Supports both direct CLI usage (node index.js) and programmatic module usage (require('./index'))
const { agentCore, VERSION } = require("./agent-core");
const log = require("./log");

function startPolling() {
  return agentCore.startPolling();
}

function stopPolling() {
  return agentCore.stopPolling();
}

// If invoked directly from terminal:
if (require.main === module) {
  const cfg = agentCore.cfg;
  if (!cfg || !cfg.key || !cfg.serverUrl) {
    console.warn("Notice: Agent is not paired yet. The Companion UI will open so you can pair it.");
  }

  process.on("SIGINT", () => {
    log("Agent stopped by user.");
    agentCore.stopPolling();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("Agent terminated.");
    agentCore.stopPolling();
    process.exit(0);
  });

  // Start background polling
  startPolling();

  // Start the Companion GUI dashboard
  const isHeadless = process.argv.includes("--headless") || process.argv.includes("--no-gui");
  try {
    const { startCompanionServer } = require("./companion-server");
    startCompanionServer(!isHeadless);
  } catch (err) {
    console.error("Could not start companion UI server:", err.message);
  }
}

module.exports = {
  startPolling,
  stopPolling,
  agentCore,
  VERSION,
};
