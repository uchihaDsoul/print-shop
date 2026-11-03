// companion-server.js: Zero-dependency local companion dashboard server
// Provides a local web interface on http://127.0.0.1:5050 with real-time SSE streaming
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { agentCore, VERSION } = require("./agent-core");
const { ICON_BASE64 } = require("./icon-data");

const PORT = process.env.AGENT_UI_PORT || 5050;
let sseClients = [];

// Helper to broadcast SSE events to all connected browser windows
function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

function setupAgentEventForwarding() {
  agentCore.on("status-changed", (state) => broadcastSSE("agent-status", state));
  agentCore.on("log", (entry) => broadcastSSE("agent-log", entry));
  agentCore.on("job-start", (job) => broadcastSSE("agent-job", { event: "start", job }));
  agentCore.on("job-success", (job) => broadcastSSE("agent-job", { event: "success", job }));
  agentCore.on("job-failed", ({ job, error }) => broadcastSSE("agent-job", { event: "failed", job, error }));
  agentCore.on("printers", (printers) => broadcastSSE("agent-printers", printers));
  agentCore.on("heartbeat", (info) => broadcastSSE("agent-heartbeat", info));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function createCompanionServer() {
  setupAgentEventForwarding();

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    // CORS & Security headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Static Assets
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(path.join(__dirname, "index.html")).pipe(res);
    }
    if (pathname === "/styles.css") {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      return fs.createReadStream(path.join(__dirname, "styles.css")).pipe(res);
    }
    if (pathname === "/renderer.js") {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      return fs.createReadStream(path.join(__dirname, "renderer.js")).pipe(res);
    }
    if (pathname === "/icon.png") {
      const iconBuf = Buffer.from(ICON_BASE64, "base64");
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": iconBuf.length });
      return res.end(iconBuf);
    }

    // Server-Sent Events (SSE) Stream
    if (pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      sseClients.push(res);
      req.on("close", () => {
        sseClients = sseClients.filter((c) => c !== res);
      });
      return;
    }

    // API Routes
    if (pathname === "/api/status" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(agentCore.getStatus()));
    }

    if (pathname === "/api/poll" && req.method === "POST") {
      await agentCore.pollJobs();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }

    if (pathname === "/api/printers" && req.method === "POST") {
      await agentCore.reportPrinters();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, printers: agentCore.printers }));
    }

    if (pathname === "/api/pair" && req.method === "POST") {
      const body = await parseJsonBody(req);
      try {
        const cfg = await agentCore.pair(body.serverUrl, body.code);
        await agentCore.startPolling();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, config: cfg }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (pathname === "/api/unpair" && req.method === "POST") {
      agentCore.unpair();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }

    if (pathname === "/api/powercfg" && req.method === "POST") {
      exec("powercfg -change -standby-timeout-ac 0 && powercfg -change -monitor-timeout-ac 0", (err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
        agentCore.emitLog("Power settings updated: Standby and Monitor timeout set to Never.", "success");
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  return server;
}

function openInBrowser(url) {
  const target = url || `http://127.0.0.1:${PORT}`;
  const startCmd = process.platform === "win32" ? `start "" "${target}"` : `open "${target}"`;
  exec(startCmd, () => {});
}

function startCompanionServer(autoOpen = true) {
  const server = createCompanionServer();
  server.listen(PORT, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${PORT}`;
    agentCore.emitLog(`Local Companion UI running at ${url}`, "info");
    if (autoOpen) {
      openInBrowser(url);
    }
  });
  return server;
}

module.exports = {
  startCompanionServer,
  openInBrowser,
  PORT,
};
