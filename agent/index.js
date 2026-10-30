// The print agent. Step 4.2: heartbeat and printer reporting only.
const { execFile } = require("child_process");
const config = require("./config");
const { call } = require("./api");
const log = require("./log");

const VERSION = "0.1.0";
const HEARTBEAT_MS = 10 * 1000;
const PRINTERS_MS = 60 * 1000;

const cfg = config.load();
if (!cfg || !cfg.key || !cfg.serverUrl) {
  console.error("Not paired yet. Run: node pair.js --server <address> --code <code>");
  process.exit(1);
}

let stopped = false;

function stopBecauseKeyRejected() {
  if (stopped) return;
  stopped = true;
  log("The server rejected this agent's key. Make a new code on the Computers page and run pair.js again.");
  process.exit(1);
}

// Asks Windows for its printer list
function getWindowsPrinters() {
  return new Promise((resolve, reject) => {
    const command =
      "Get-Printer | Select-Object Name,PortName,DriverName | ConvertTo-Json -Compress";
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { timeout: 30000, windowsHide: true },
      (error, stdout) => {
        if (error) return reject(error);
        try {
          const parsed = JSON.parse(stdout.trim() || "[]");
          const list = Array.isArray(parsed) ? parsed : [parsed]; // a single printer comes as one object
          resolve(
            list.map((p) => ({ name: p.Name, portName: p.PortName, driverName: p.DriverName }))
          );
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

async function heartbeat() {
  try {
    await call(cfg, "/heartbeat", { agentVersion: VERSION });
  } catch (err) {
    if (err.status === 401) return stopBecauseKeyRejected();
    log("Heartbeat failed: " + err.message);
  }
}

let lastCount = -1;
async function reportPrinters() {
  try {
    const printers = await getWindowsPrinters();
    const result = await call(cfg, "/printers", { printers });
    if (result.count !== lastCount) {
      log(`Reported ${result.count} printer(s) to the server.`);
      lastCount = result.count;
    }
  } catch (err) {
    if (err.status === 401) return stopBecauseKeyRejected();
    log("Printer report failed: " + err.message);
  }
}

async function main() {
  log(`Print agent ${VERSION} started for "${cfg.name}" -> ${cfg.serverUrl}`);
  await heartbeat();
  await reportPrinters();
  setInterval(heartbeat, HEARTBEAT_MS);
  setInterval(reportPrinters, PRINTERS_MS);
}

process.on("SIGINT", () => {
  log("Agent stopped.");
  process.exit(0);
});

main();