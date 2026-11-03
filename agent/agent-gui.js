// agent/agent-gui.js: Electron Windows Desktop Companion for Print Shop Agent
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const { agentCore, VERSION } = require("./agent-core");
const { getNativeIcon, ICON_DATA_URL } = require("./icon-data");

let tray = null;
let mainWindow = null;
let isQuiting = false;

// Request single instance lock so only one agent instance runs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getLoginSettings() {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return false;
  }
}

function setAutoStart(openAtLogin) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(openAtLogin),
      path: process.execPath,
      args: ["--hidden"],
    });
    return true;
  } catch (err) {
    agentCore.emitLog(`Failed to configure auto-start: ${err.message}`, "error");
    return false;
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const status = agentCore.getStatus();
  let statusBadge = "🔴 Offline";
  if (status.state === "online") statusBadge = "🟢 Connected";
  else if (status.state === "polling") statusBadge = "🟢 Active (Polling)";
  else if (status.state === "printing") statusBadge = "🔵 Printing Order";
  else if (status.state === "unpaired") statusBadge = "⚪ Not Paired";

  const isAutoStart = getLoginSettings();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Print Shop Agent v${VERSION}`,
      enabled: false,
    },
    {
      label: `Status: ${statusBadge}`,
      enabled: false,
    },
    {
      label: `PC: ${status.computerName || "Unpaired"}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Open Print Agent Status",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Check for Jobs Now",
      click: () => {
        agentCore.pollJobs();
      },
    },
    {
      label: "Refresh Windows Printers",
      click: () => {
        agentCore.reportPrinters();
      },
    },
    { type: "separator" },
    {
      label: "Auto-Start on Boot",
      type: "checkbox",
      checked: isAutoStart,
      click: (menuItem) => {
        setAutoStart(menuItem.checked);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("agent-status", agentCore.getStatus());
        }
      },
    },
    {
      label: "Restart Agent",
      click: () => {
        app.relaunch();
        isQuiting = true;
        app.exit(0);
      },
    },
    { type: "separator" },
    {
      label: "Quit Shop Agent",
      click: () => {
        isQuiting = true;
        agentCore.stopPolling();
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`Print Shop Local Agent - ${statusBadge} (${status.computerName || "Local"})`);
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  const icon = getNativeIcon(nativeImage);

  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 440,
    minHeight: 560,
    title: "Print Shop Agent - Local Companion",
    icon: icon || undefined,
    backgroundColor: "#090d16",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  const startMinimized = process.argv.includes("--hidden") || process.argv.includes("--minimized");

  mainWindow.once("ready-to-show", () => {
    if (startMinimized) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  let hasShownTrayTip = false;
  mainWindow.on("close", (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();

      if (!hasShownTrayTip && Notification.isSupported()) {
        hasShownTrayTip = true;
        try {
          new Notification({
            title: "Print Shop Agent is Active",
            body: "The agent minimized to the system tray. Print queues and order polling continue running in the background.",
            icon: icon,
          }).show();
        } catch {
          // notification fallback
        }
      }
    }
  });
}

function setupTray() {
  try {
    const icon = getNativeIcon(nativeImage);
    tray = new Tray(icon || nativeImage.createEmpty());

    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    updateTrayMenu();
  } catch (err) {
    console.error("System Tray initialization failed:", err);
  }
}

function registerIpcHandlers() {
  ipcMain.handle("get-initial-state", () => {
    return {
      ...agentCore.getStatus(),
      autoStartEnabled: getLoginSettings(),
      iconDataUrl: ICON_DATA_URL,
    };
  });

  ipcMain.handle("toggle-autostart", (_event, enable) => {
    const success = setAutoStart(enable);
    updateTrayMenu();
    return { success, enabled: getLoginSettings() };
  });

  ipcMain.handle("pair", async (_event, { serverUrl, code }) => {
    try {
      const cfg = await agentCore.pair(serverUrl, code);
      await agentCore.startPolling();
      updateTrayMenu();
      return { success: true, config: cfg };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("unpair", () => {
    agentCore.unpair();
    updateTrayMenu();
    return { success: true };
  });

  ipcMain.handle("poll-now", async () => {
    await agentCore.pollJobs();
    return { success: true };
  });

  ipcMain.handle("refresh-printers", async () => {
    await agentCore.reportPrinters();
    return { success: true, printers: agentCore.printers };
  });

  ipcMain.handle("open-logs-folder", () => {
    const logsDir = path.join(__dirname, "logs");
    shell.openPath(logsDir);
    return { success: true };
  });

  ipcMain.handle("set-power-plan", () => {
    return new Promise((resolve) => {
      exec("powercfg -change -standby-timeout-ac 0 && powercfg -change -monitor-timeout-ac 0", (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          agentCore.emitLog("Power settings updated: Standby and Monitor timeout set to Never.", "success");
          resolve({ success: true });
        }
      });
    });
  });

  ipcMain.handle("minimize-to-tray", () => {
    if (mainWindow) mainWindow.hide();
    return { success: true };
  });

  ipcMain.handle("quit-app", () => {
    isQuiting = true;
    agentCore.stopPolling();
    app.quit();
  });
}

function bindAgentEvents() {
  agentCore.on("status-changed", (state) => {
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-status", state);
    }
  });

  agentCore.on("log", (logEntry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-log", logEntry);
    }
  });

  agentCore.on("job-start", (job) => {
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-job", { event: "start", job });
    }
  });

  agentCore.on("job-success", (job) => {
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-job", { event: "success", job });
    }
  });

  agentCore.on("job-failed", ({ job, error }) => {
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-job", { event: "failed", job, error });
    }
  });

  agentCore.on("printers", (printers) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-printers", printers);
    }
  });

  agentCore.on("heartbeat", (info) => {
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent-heartbeat", info);
    }
  });
}

app.whenReady().then(() => {
  setupTray();
  createWindow();
  registerIpcHandlers();
  bindAgentEvents();

  // Start background polling
  agentCore.startPolling();
});

app.on("window-all-closed", (e) => {
  // Prevent quitting when window is closed; app stays in tray
  e.preventDefault();
});

process.on("uncaughtException", (err) => {
  agentCore.emitLog(`Fatal error: ${err.message}`, "error");
});
