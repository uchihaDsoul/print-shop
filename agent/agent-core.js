// Agent Core: EventEmitter-based controller for heartbeat, printer reporting, and job printing
const { EventEmitter } = require("events");
const { execFile } = require("child_process");
const config = require("./config");
const { call } = require("./api");
const { printJob } = require("./printer");
const log = require("./log");

const VERSION = "2.0.0";
const HEARTBEAT_MS = 10 * 1000;
const PRINTERS_MS = 60 * 1000;
const JOBS_MS = 5 * 1000;
const MAX_LOG_HISTORY = 250;

class PrintAgentCore extends EventEmitter {
  constructor() {
    super();
    this.version = VERSION;
    this.cfg = config.load();
    this.isRunning = false;
    this.working = false;
    this.stopped = false;
    this.lastCount = -1;
    this.intervals = [];
    this.logHistory = [];
    this.printers = [];
    this.activeJob = null;
    this.stats = {
      jobsCompleted: 0,
      jobsFailed: 0,
      heartbeatsSent: 0,
      startedAt: null,
    };
    this.state = {
      status: this.cfg && this.cfg.key ? "idle" : "unpaired",
      statusMessage: this.cfg && this.cfg.key ? "Ready to start" : "Not paired yet. Please pair with server.",
      lastHeartbeat: null,
      lastPrintersReported: null,
      serverOnline: false,
    };
  }

  emitLog(message, level = "info") {
    const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
    const entry = { time, message, level, timestamp: Date.now() };
    this.logHistory.push(entry);
    if (this.logHistory.length > MAX_LOG_HISTORY) {
      this.logHistory.shift();
    }
    // Also write to standard log file and console
    log(`[${level.toUpperCase()}] ${message}`);
    this.emit("log", entry);
  }

  setStatus(status, message) {
    this.state.status = status;
    if (message) this.state.statusMessage = message;
    this.emit("status-changed", { ...this.state, activeJob: this.activeJob, stats: this.stats });
  }

  getStatus() {
    return {
      version: this.version,
      paired: Boolean(this.cfg && this.cfg.key && this.cfg.serverUrl),
      computerName: this.cfg ? this.cfg.name : "Unpaired PC",
      computerId: this.cfg ? this.cfg.computerId : null,
      serverUrl: this.cfg ? this.cfg.serverUrl : "",
      state: this.state.status,
      statusMessage: this.state.statusMessage,
      lastHeartbeat: this.state.lastHeartbeat,
      lastPrintersReported: this.state.lastPrintersReported,
      serverOnline: this.state.serverOnline,
      printers: this.printers,
      activeJob: this.activeJob,
      stats: this.stats,
      isRunning: this.isRunning,
      recentLogs: this.logHistory.slice(-50),
    };
  }

  reloadConfig() {
    this.cfg = config.load();
    return this.cfg;
  }

  async pair(serverUrl, code) {
    const cleanUrl = String(serverUrl || "").trim().replace(/\/+$/, "");
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanUrl || !/^https?:\/\//.test(cleanUrl)) {
      throw new Error("Invalid server URL. Must start with http:// or https://");
    }
    if (!cleanCode || cleanCode.length !== 8) {
      throw new Error("Invalid pairing code. Must be an 8-character code.");
    }

    this.emitLog(`Attempting to pair with ${cleanUrl} using code ${cleanCode}...`, "info");
    const result = await call({ serverUrl: cleanUrl }, "/pair", { code: cleanCode }, false);

    const newConfig = {
      serverUrl: cleanUrl,
      computerId: result.computerId,
      name: result.name,
      key: result.key,
    };
    config.save(newConfig);
    this.cfg = newConfig;

    this.emitLog(`Successfully paired as "${result.name}"!`, "success");
    this.setStatus("online", `Connected to ${cleanUrl} as "${result.name}"`);
    return newConfig;
  }

  unpair() {
    config.save({});
    this.cfg = null;
    this.stopPolling();
    this.setStatus("unpaired", "Agent has been unpaired.");
    this.emitLog("Agent unpaired and credentials cleared.", "warn");
  }

  getWindowsPrinters() {
    return new Promise((resolve, reject) => {
      const command =
        "try { Get-Printer -ErrorAction Stop | Select-Object Name,PortName,DriverName | ConvertTo-Json -Compress } catch { $devices = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices'; $list = @(); foreach ($p in $devices.PSObject.Properties) { if ($p.Name -notmatch '^(PS|__)') { $val = [string]$p.Value; $port = ($val -split ',')[-1].Trim(); $list += @{ Name = $p.Name; PortName = $port; DriverName = 'Standard' } } }; $list | ConvertTo-Json -Compress }";
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

  async heartbeat() {
    if (!this.cfg || !this.cfg.key) return;
    try {
      await call(this.cfg, "/heartbeat", { agentVersion: this.version });
      this.state.serverOnline = true;
      this.state.lastHeartbeat = new Date().toISOString();
      this.stats.heartbeatsSent++;
      if (this.state.status === "offline" || this.state.status === "connecting") {
        this.setStatus("online", "Connected to cloud server");
      }
      this.emit("heartbeat", { ok: true, timestamp: this.state.lastHeartbeat });
    } catch (err) {
      this.state.serverOnline = false;
      if (err.status === 401) {
        this.stopBecauseKeyRejected();
        return;
      }
      this.setStatus("offline", `Server unreachable: ${err.message}`);
      this.emitLog(`Heartbeat failed: ${err.message}`, "warn");
      this.emit("heartbeat", { ok: false, error: err.message });
    }
  }

  async reportPrinters() {
    if (!this.cfg || !this.cfg.key) return;
    try {
      const printers = await this.getWindowsPrinters();
      this.printers = printers;
      const result = await call(this.cfg, "/printers", { printers });
      this.state.lastPrintersReported = new Date().toISOString();
      if (result.count !== this.lastCount) {
        this.emitLog(`Reported ${result.count} printer(s) to server.`, "info");
        this.lastCount = result.count;
      }
      this.emit("printers", printers);
    } catch (err) {
      if (err.status === 401) {
        this.stopBecauseKeyRejected();
        return;
      }
      this.emitLog(`Printer scan failed: ${err.message}`, "warn");
    }
  }

  async reportResult(orderId, ok, error) {
    if (!this.cfg || !this.cfg.key) return;
    for (let i = 1; i <= 5; i++) {
      try {
        await call(this.cfg, `/jobs/${orderId}/result`, { ok, error });
        return;
      } catch (err) {
        if (err.status === 401) return this.stopBecauseKeyRejected();
        if (err.status === 409) {
          this.emitLog("Server says this job is no longer ours. Abandoning report.", "warn");
          return;
        }
        this.emitLog(`Reporting result failed (try ${i}/5): ${err.message}`, "warn");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  async pollJobs() {
    if (this.working || this.stopped || !this.cfg || !this.cfg.key) return;
    this.working = true;
    try {
      const { job } = await call(this.cfg, "/jobs/claim", {});
      if (!job) {
        if (this.state.status !== "printing" && this.state.serverOnline) {
          this.setStatus("polling", "Waiting for incoming print orders...");
        }
        return;
      }

      this.activeJob = {
        orderId: job.orderId,
        trackingCode: job.trackingCode,
        printer: job.printer,
        copies: job.copies,
        color: job.color,
        pages: job.pages || "all",
        paper: job.paper,
        attempt: job.attempt,
        startedAt: new Date().toISOString(),
      };

      this.setStatus("printing", `Printing order ${job.trackingCode} on ${job.printer}`);
      this.emitLog(
        `Job ${job.trackingCode}: ${job.copies} copy, ${job.color ? "color" : "B/W"}, pages "${job.pages || "all"}" -> ${job.printer} (try ${job.attempt})`,
        "info",
      );
      this.emit("job-start", this.activeJob);

      try {
        await printJob(job);
        this.emitLog(
          `Job ${job.trackingCode}: Sent to Windows print spooler. Ready for collection.`,
          "success",
        );
        this.stats.jobsCompleted++;
        await this.reportResult(job.orderId, true, "");
        this.emit("job-success", this.activeJob);
      } catch (err) {
        this.emitLog(`Job ${job.trackingCode} failed: ${err.message}`, "error");
        this.stats.jobsFailed++;
        await this.reportResult(job.orderId, false, err.message);
        this.emit("job-failed", { job: this.activeJob, error: err.message });
      } finally {
        this.activeJob = null;
        this.setStatus("online", "Connected and ready for next job");
      }
    } catch (err) {
      if (err.status === 401) {
        this.stopBecauseKeyRejected();
        return;
      }
      this.emitLog(`Job check failed: ${err.message}`, "warn");
    } finally {
      this.working = false;
    }
  }

  stopBecauseKeyRejected() {
    if (this.stopped) return;
    this.stopped = true;
    this.stopPolling();
    this.setStatus("unpaired", "Server rejected agent key. Please re-pair.");
    this.emitLog(
      "The server rejected this agent's key. Generate a new code in Admin > Computers and pair again.",
      "error",
    );
  }

  async startPolling() {
    this.reloadConfig();
    if (!this.cfg || !this.cfg.key || !this.cfg.serverUrl) {
      this.setStatus("unpaired", "Not paired yet. Please enter server URL and pairing code.");
      this.emitLog("Agent is not paired. Awaiting pairing credentials.", "warn");
      return false;
    }

    if (this.isRunning) return true;
    this.isRunning = true;
    this.stopped = false;
    this.stats.startedAt = new Date().toISOString();

    this.setStatus("connecting", `Connecting to ${this.cfg.serverUrl}...`);
    this.emitLog(
      `Print agent v${VERSION} started for "${this.cfg.name}" -> ${this.cfg.serverUrl}`,
      "info",
    );

    // Initial triggers
    await this.heartbeat();
    await this.reportPrinters();

    // Recurring schedules
    this.intervals.push(setInterval(() => this.heartbeat(), HEARTBEAT_MS));
    this.intervals.push(setInterval(() => this.reportPrinters(), PRINTERS_MS));
    this.intervals.push(setInterval(() => this.pollJobs(), JOBS_MS));

    this.pollJobs();
    return true;
  }

  stopPolling() {
    this.isRunning = false;
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
    this.setStatus("offline", "Agent polling stopped.");
    this.emitLog("Agent polling stopped.", "info");
  }
}

// Singleton instance
const agentCore = new PrintAgentCore();

module.exports = {
  PrintAgentCore,
  agentCore,
  VERSION,
};
