// The print agent. Step 4.3: heartbeat, printer reporting, and printing jobs.
const { execFile } = require("child_process");
const config = require("./config");
const { call } = require("./api");
const { printJob } = require("./printer");
const log = require("./log");

const VERSION = "0.2.0";
const HEARTBEAT_MS = 10 * 1000;
const PRINTERS_MS = 60 * 1000;
const JOBS_MS = 5 * 1000;

const cfg = config.load();
if (!cfg || !cfg.key || !cfg.serverUrl) {
  console.error(
    "Not paired yet. Run: node pair.js --server <address> --code <code>",
  );
  process.exit(1);
}

let stopped = false;

function stopBecauseKeyRejected() {
  if (stopped) return;
  stopped = true;
  log(
    "The server rejected this agent's key. Make a new code on the Computers page and run pair.js again.",
  );
  process.exit(1);
}

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
          const list = Array.isArray(parsed) ? parsed : [parsed];
          resolve(
            list.map((p) => ({
              name: p.Name,
              portName: p.PortName,
              driverName: p.DriverName,
            })),
          );
        } catch (e) {
          reject(e);
        }
      },
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

// Tell the server how the job went. Tries a few times, because losing this message is costly.
async function reportResult(orderId, ok, error) {
  for (let i = 1; i <= 5; i++) {
    try {
      await call(cfg, `/jobs/${orderId}/result`, { ok, error });
      return;
    } catch (err) {
      if (err.status === 401) return stopBecauseKeyRejected();
      if (err.status === 409) {
        log("Server says this job is no longer ours. Not reporting again.");
        return;
      }
      log(`Could not report result (try ${i}/5): ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

let working = false; // one job at a time
async function pollJobs() {
  if (working || stopped) return;
  working = true;
  try {
    const { job } = await call(cfg, "/jobs/claim", {});
    if (!job) return;

    log(
      `Job ${job.trackingCode}: ${job.copies} copy, ${job.color ? "color" : "B/W"}, pages "${job.pages || "all"}" -> ${job.printer} (try ${job.attempt})`,
    );
    try {
      await printJob(job);
      log(
        `Job ${job.trackingCode}: sent to Windows. The manager must check the paper.`,
      );
      await reportResult(job.orderId, true, "");
    } catch (err) {
      log(`Job ${job.trackingCode} failed: ${err.message}`);
      await reportResult(job.orderId, false, err.message);
    }
  } catch (err) {
    if (err.status === 401) return stopBecauseKeyRejected();
    log("Job check failed: " + err.message);
  } finally {
    working = false;
  }
}

async function main() {
  log(`Print agent ${VERSION} started for "${cfg.name}" -> ${cfg.serverUrl}`);
  await heartbeat();
  await reportPrinters();
  setInterval(heartbeat, HEARTBEAT_MS);
  setInterval(reportPrinters, PRINTERS_MS);
  setInterval(pollJobs, JOBS_MS);
  pollJobs();
}

process.on("SIGINT", () => {
  log("Agent stopped.");
  process.exit(0);
});

main();
