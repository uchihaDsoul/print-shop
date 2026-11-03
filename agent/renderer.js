// renderer.js: Desktop Companion UI Controller
// Supports both Electron native window (window.printAgentApi) and Local Web Dashboard (HTTP/SSE)
if (!window.printAgentApi) {
  const eventSource = new EventSource("/api/events");
  window.printAgentApi = {
    getInitialState: async () => {
      const res = await fetch("/api/status");
      const data = await res.json();
      return { ...data, autoStartEnabled: false };
    },
    toggleAutoStart: async () => ({ success: false, enabled: false }),
    pair: async (serverUrl, code) => {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, code }),
      });
      return res.json();
    },
    unpair: async () => {
      const res = await fetch("/api/unpair", { method: "POST" });
      return res.json();
    },
    pollNow: async () => {
      const res = await fetch("/api/poll", { method: "POST" });
      return res.json();
    },
    refreshPrinters: async () => {
      const res = await fetch("/api/printers", { method: "POST" });
      return res.json();
    },
    openLogsFolder: () => {},
    setPowerPlan: async () => {
      const res = await fetch("/api/powercfg", { method: "POST" });
      return res.json();
    },
    minimizeToTray: () => {
      window.blur();
    },
    quitApp: () => {
      window.close();
    },
    onStatusChanged: (cb) => {
      eventSource.addEventListener("agent-status", (e) => cb(JSON.parse(e.data)));
    },
    onLog: (cb) => {
      eventSource.addEventListener("agent-log", (e) => cb(JSON.parse(e.data)));
    },
    onJob: (cb) => {
      eventSource.addEventListener("agent-job", (e) => cb(JSON.parse(e.data)));
    },
    onPrinters: (cb) => {
      eventSource.addEventListener("agent-printers", (e) => cb(JSON.parse(e.data)));
    },
    onHeartbeat: (cb) => {
      eventSource.addEventListener("agent-heartbeat", (e) => cb(JSON.parse(e.data)));
    },
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const api = window.printAgentApi;

  // DOM Elements
  const elLogo = document.getElementById("app-logo");
  const elHeaderPulse = document.getElementById("header-pulse");
  const elPcName = document.getElementById("pc-name");
  const elServerAddress = document.getElementById("server-address");
  const elStatusBadge = document.getElementById("status-badge");
  const elStatusText = document.getElementById("status-text");
  const elLastPing = document.getElementById("last-ping");
  const elStatPrinted = document.getElementById("stat-printed");
  const elStatPrinters = document.getElementById("stat-printers");
  const elStatUptime = document.getElementById("stat-uptime");
  const elJobCardContent = document.getElementById("job-card-content");
  const elJobStatusPill = document.getElementById("job-status-pill");
  const elConsoleBody = document.getElementById("console-body");
  const elConsoleWrapper = document.getElementById("console-wrapper");
  const elPrintersList = document.getElementById("printers-list");
  const elTabPrinterCount = document.getElementById("tab-printer-count");
  const elChkAutoStart = document.getElementById("chk-autostart");
  const elSettingsPairingDesc = document.getElementById("settings-pairing-desc");

  // Buttons
  const btnMinimize = document.getElementById("btn-minimize");
  const btnPollNow = document.getElementById("btn-poll-now");
  const btnRefreshPrinters = document.getElementById("btn-refresh-printers");
  const btnOpenLogs = document.getElementById("btn-open-logs");
  const btnClearLogs = document.getElementById("btn-clear-logs");
  const btnCopyLogs = document.getElementById("btn-copy-logs");
  const btnPowerPlan = document.getElementById("btn-power-plan");
  const btnShowPair = document.getElementById("btn-show-pair");
  const btnUnpair = document.getElementById("btn-unpair");
  const btnQuitApp = document.getElementById("btn-quit-app");

  // Modal
  const modalPair = document.getElementById("modal-pair");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelPair = document.getElementById("btn-cancel-pair");
  const btnSubmitPair = document.getElementById("btn-submit-pair");
  const inputServerUrl = document.getElementById("input-server-url");
  const inputPairCode = document.getElementById("input-pair-code");
  const pairError = document.getElementById("pair-error");

  let currentLogs = [];
  let currentFilter = "all";
  let startTime = null;
  let lastHeartbeatTime = null;

  // Tab switching
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");
    });
  });

  // Filter pills
  const filterPills = document.querySelectorAll(".filter-pill");
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.dataset.filter;
      renderLogs();
    });
  });

  function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }

  function updateHeartbeatDisplay() {
    if (!lastHeartbeatTime) {
      elLastPing.textContent = "Connecting...";
      return;
    }
    const elapsedSec = Math.floor((Date.now() - new Date(lastHeartbeatTime).getTime()) / 1000);
    if (elapsedSec < 3) {
      elLastPing.textContent = "Just now";
    } else if (elapsedSec < 60) {
      elLastPing.textContent = `${elapsedSec}s ago`;
    } else {
      elLastPing.textContent = `${Math.floor(elapsedSec / 60)}m ago`;
    }
  }

  // Live timer tick
  setInterval(() => {
    if (startTime) {
      const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      elStatUptime.textContent = formatUptime(elapsed);
    }
    updateHeartbeatDisplay();
  }, 1000);

  function applyStatus(state) {
    if (!state) return;

    elPcName.textContent = state.computerName || "Unpaired Computer";
    elServerAddress.textContent = state.serverUrl || "No Server Set";
    elServerAddress.title = state.serverUrl || "";

    const status = state.state || "idle";
    elStatusText.textContent = state.statusMessage || "Operating normally";

    // Clear classes
    elHeaderPulse.className = "status-pulse-dot";
    elStatusBadge.className = "badge";

    if (status === "online" || status === "idle") {
      elHeaderPulse.classList.add("online");
      elStatusBadge.classList.add("badge-online");
      elStatusBadge.textContent = "Online";
    } else if (status === "polling") {
      elHeaderPulse.classList.add("polling");
      elStatusBadge.classList.add("badge-polling");
      elStatusBadge.textContent = "Polling";
    } else if (status === "printing") {
      elHeaderPulse.classList.add("printing");
      elStatusBadge.classList.add("badge-printing");
      elStatusBadge.textContent = "Printing";
    } else if (status === "offline") {
      elHeaderPulse.classList.add("offline");
      elStatusBadge.classList.add("badge-offline");
      elStatusBadge.textContent = "Offline";
    } else if (status === "unpaired") {
      elHeaderPulse.classList.add("unpaired");
      elStatusBadge.classList.add("badge-unpaired");
      elStatusBadge.textContent = "Not Paired";
    } else {
      elHeaderPulse.classList.add("connecting");
      elStatusBadge.classList.add("badge-connecting");
      elStatusBadge.textContent = "Connecting";
    }

    if (state.lastHeartbeat) {
      lastHeartbeatTime = state.lastHeartbeat;
      updateHeartbeatDisplay();
    }

    if (state.stats) {
      elStatPrinted.textContent = state.stats.jobsCompleted || 0;
      if (state.stats.startedAt && !startTime) {
        startTime = state.stats.startedAt;
      }
    }

    if (state.paired) {
      elSettingsPairingDesc.textContent = `Paired as "${state.computerName}" with ${state.serverUrl}`;
    } else {
      elSettingsPairingDesc.textContent = "Computer is not paired with a print shop server";
    }

    renderActiveJob(state.activeJob);
    if (state.printers) renderPrinters(state.printers);
  }

  function renderActiveJob(job) {
    if (!job) {
      elJobStatusPill.className = "pill-idle";
      elJobStatusPill.textContent = "IDLE";
      elJobCardContent.innerHTML = `
        <div class="idle-placeholder">
          <svg class="idle-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          <p>Listening for cloud print orders every 5s</p>
        </div>
      `;
      return;
    }

    elJobStatusPill.className = "pill-active";
    elJobStatusPill.textContent = "PRINTING";

    const colorBadge = job.color ? "🎨 Color" : "⬛ Monochrome";
    const paperBadge = job.paper === "4x6" ? "Photo 4x6" : "A4 Plain";

    elJobCardContent.innerHTML = `
      <div class="job-active-grid">
        <div class="job-row-main">
          <span class="job-code">${job.trackingCode || "Order #" + job.orderId}</span>
          <span class="job-printer" title="${job.printer}">${job.printer}</span>
        </div>
        <div class="job-badges">
          <span class="job-badge">${job.copies} ${job.copies === 1 ? "Copy" : "Copies"}</span>
          <span class="job-badge">${colorBadge}</span>
          <span class="job-badge">Pages: ${job.pages}</span>
          <span class="job-badge">${paperBadge}</span>
          ${job.attempt > 1 ? `<span class="job-badge" style="color: #fbbf24;">Try ${job.attempt}</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderPrinters(printers) {
    const list = Array.isArray(printers) ? printers : [];
    elStatPrinters.textContent = list.length;
    elTabPrinterCount.textContent = list.length;

    if (list.length === 0) {
      elPrintersList.innerHTML = `<div class="empty-state">No Windows printers detected.</div>`;
      return;
    }

    elPrintersList.innerHTML = list
      .map(
        (p) => `
      <div class="printer-item">
        <div class="printer-details">
          <strong>${p.name}</strong>
          <span>Port: ${p.portName || "N/A"} • Driver: ${p.driverName || "Standard"}</span>
        </div>
        <span class="printer-tag">Ready</span>
      </div>
    `,
      )
      .join("");
  }

  function renderLogs() {
    let filtered = currentLogs;
    if (currentFilter === "jobs") {
      filtered = currentLogs.filter((l) => /job|order|printed|spooler/i.test(l.message));
    } else if (currentFilter === "warn") {
      filtered = currentLogs.filter((l) => l.level === "warn" || l.level === "error");
    }

    if (filtered.length === 0) {
      elConsoleBody.innerHTML = `<div class="log-line info"><span class="log-msg">No logs in this view.</span></div>`;
      return;
    }

    elConsoleBody.innerHTML = filtered
      .map(
        (log) => `
      <div class="log-line ${log.level || "info"}">
        <span class="log-time">${log.time || ""}</span>
        <span class="log-msg">${escapeHtml(log.message || "")}</span>
      </div>
    `,
      )
      .join("");

    // Auto scroll to bottom
    elConsoleWrapper.scrollTop = elConsoleWrapper.scrollHeight;
  }

  function appendLog(entry) {
    currentLogs.push(entry);
    if (currentLogs.length > 300) currentLogs.shift();
    renderLogs();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Initial State Load
  try {
    const init = await api.getInitialState();
    if (init.iconDataUrl) {
      elLogo.src = init.iconDataUrl;
    }
    elChkAutoStart.checked = Boolean(init.autoStartEnabled);
    if (init.recentLogs) {
      currentLogs = init.recentLogs;
      renderLogs();
    }
    applyStatus(init);

    // If not paired yet, open modal automatically
    if (!init.paired) {
      modalPair.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Failed to load initial state:", err);
  }

  // Event Listeners from Main Process
  api.onStatusChanged((state) => {
    applyStatus(state);
  });

  api.onLog((entry) => {
    appendLog(entry);
  });

  api.onJob(({ event, job, error }) => {
    if (event === "start") {
      renderActiveJob(job);
    } else if (event === "success" || event === "failed") {
      renderActiveJob(null);
    }
  });

  api.onPrinters((printers) => {
    renderPrinters(printers);
  });

  api.onHeartbeat((info) => {
    if (info.ok) {
      lastHeartbeatTime = info.timestamp || new Date().toISOString();
      updateHeartbeatDisplay();
    }
  });

  // UI Button Actions
  btnMinimize.addEventListener("click", () => {
    api.minimizeToTray();
  });

  btnPollNow.addEventListener("click", async () => {
    btnPollNow.disabled = true;
    btnPollNow.textContent = "Checking...";
    await api.pollNow();
    setTimeout(() => {
      btnPollNow.disabled = false;
      btnPollNow.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Check Jobs Now
      `;
    }, 1000);
  });

  btnRefreshPrinters.addEventListener("click", async () => {
    btnRefreshPrinters.disabled = true;
    btnRefreshPrinters.textContent = "Scanning...";
    await api.refreshPrinters();
    setTimeout(() => {
      btnRefreshPrinters.disabled = false;
      btnRefreshPrinters.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
        Rescan Printers
      `;
    }, 1200);
  });

  btnOpenLogs.addEventListener("click", () => {
    api.openLogsFolder();
  });

  btnClearLogs.addEventListener("click", () => {
    currentLogs = [];
    renderLogs();
  });

  btnCopyLogs.addEventListener("click", () => {
    const text = currentLogs.map((l) => `${l.time} [${l.level}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    btnCopyLogs.textContent = "Copied!";
    setTimeout(() => (btnCopyLogs.textContent = "Copy"), 1500);
  });

  elChkAutoStart.addEventListener("change", async () => {
    const result = await api.toggleAutoStart(elChkAutoStart.checked);
    elChkAutoStart.checked = result.enabled;
  });

  btnPowerPlan.addEventListener("click", async () => {
    btnPowerPlan.disabled = true;
    btnPowerPlan.textContent = "Configuring...";
    const res = await api.setPowerPlan();
    if (res.success) {
      btnPowerPlan.textContent = "Sleep Disabled ✓";
      btnPowerPlan.classList.remove("primary");
      btnPowerPlan.classList.add("secondary");
    } else {
      btnPowerPlan.textContent = "Failed";
    }
  });

  // Pairing Modal Actions
  btnShowPair.addEventListener("click", () => {
    modalPair.classList.remove("hidden");
    inputPairCode.value = "";
    pairError.classList.add("hidden");
  });

  btnCloseModal.addEventListener("click", () => {
    modalPair.classList.add("hidden");
  });

  btnCancelPair.addEventListener("click", () => {
    modalPair.classList.add("hidden");
  });

  btnSubmitPair.addEventListener("click", async () => {
    const url = inputServerUrl.value.trim();
    const code = inputPairCode.value.trim().toUpperCase();

    if (!url || !code) {
      pairError.textContent = "Please provide both Server URL and 8-character Pairing Code.";
      pairError.classList.remove("hidden");
      return;
    }

    btnSubmitPair.disabled = true;
    btnSubmitPair.textContent = "Connecting...";
    pairError.classList.add("hidden");

    const result = await api.pair(url, code);
    btnSubmitPair.disabled = false;
    btnSubmitPair.textContent = "Connect & Pair";

    if (result.success) {
      modalPair.classList.add("hidden");
    } else {
      pairError.textContent = result.error || "Pairing failed. Check server address and code.";
      pairError.classList.remove("hidden");
    }
  });

  btnUnpair.addEventListener("click", async () => {
    if (confirm("Are you sure you want to unpair this computer? Polling will stop immediately.")) {
      await api.unpair();
      modalPair.classList.remove("hidden");
    }
  });

  btnQuitApp.addEventListener("click", () => {
    api.quitApp();
  });
});
