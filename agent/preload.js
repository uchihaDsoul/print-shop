const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("printAgentApi", {
  getInitialState: () => ipcRenderer.invoke("get-initial-state"),
  toggleAutoStart: (enable) => ipcRenderer.invoke("toggle-autostart", enable),
  pair: (serverUrl, code) => ipcRenderer.invoke("pair", { serverUrl, code }),
  unpair: () => ipcRenderer.invoke("unpair"),
  pollNow: () => ipcRenderer.invoke("poll-now"),
  refreshPrinters: () => ipcRenderer.invoke("refresh-printers"),
  openLogsFolder: () => ipcRenderer.invoke("open-logs-folder"),
  setPowerPlan: () => ipcRenderer.invoke("set-power-plan"),
  minimizeToTray: () => ipcRenderer.invoke("minimize-to-tray"),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  onStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent-status", handler);
    return () => ipcRenderer.removeListener("agent-status", handler);
  },

  onLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent-log", handler);
    return () => ipcRenderer.removeListener("agent-log", handler);
  },

  onJob: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent-job", handler);
    return () => ipcRenderer.removeListener("agent-job", handler);
  },

  onPrinters: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent-printers", handler);
    return () => ipcRenderer.removeListener("agent-printers", handler);
  },

  onHeartbeat: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("agent-heartbeat", handler);
    return () => ipcRenderer.removeListener("agent-heartbeat", handler);
  },
});
