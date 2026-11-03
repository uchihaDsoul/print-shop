# Print Shop Local Agent 2.0: Windows Desktop Companion

A dedicated Windows Desktop Companion application for the Print Shop Local Agent with real-time status monitoring, background system tray minimization, and automatic Windows Startup persistence.

---

## 🌟 Key Features

1. **Live Desktop Companion Window (`agent-gui.js`):**
   - **Real-Time Cloud Connection Indicator:** Instant visual status badge (🟢 Online / 🟡 Polling / 🔵 Printing / 🔴 Offline / ⚪ Not Paired).
   - **Order Spooling Monitor:** Live card showing active print order, tracking code, copy count, color/BW mode, page range, and destination printer.
   - **Automatic Windows Printer Discovery:** Automatically reports local USB, network, and virtual printers to the cloud server every 60 seconds.
   - **Live Activity Console:** Real-time streaming log terminal with filtering, copy-to-clipboard, and direct access to log files.
   - **Integrated Cloud Pairing Dialog:** Pair or re-pair computers with one click without needing terminal commands.

2. **System Tray Integration:**
   - Minimizing or clicking the window close button (`X`) minimizes to the system tray so the print queue remains active without cluttering the taskbar.
   - Tray icon context menu with quick options: Check Orders Now, Rescan Printers, Toggle Auto-Start, Restart Agent, and Quit.
   - Double-clicking the tray icon restores the status window.

3. **Auto-Start on Boot Persistence:**
   - Registers automatically with Windows Startup (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` and the Windows Startup folder).
   - Launches with the `--hidden` flag on boot to run silently in the system tray immediately when the PC powers on.

4. **Power Plan Optimization (No Sleep):**
   - Automatically sets Windows Standby and Monitor sleep timeouts to **Never** on AC power so the print agent never stops polling orders during business hours.

---

## 🚀 Quick Start Guide

### Option 1: Running the Desktop Companion (GUI)

```powershell
cd D:\Git\print-shop\agent

# 1. Install dependencies (Electron)
npm install

# 2. Launch Desktop Companion Window
npm run gui
```

Or double-click `start-companion.bat`.

---

### Option 2: Running Headless (CLI Queue Mode)

If you prefer running without a desktop window:

```powershell
cd D:\Git\print-shop\agent
npm start
```

---

## ⚙️ Windows Persistence Scripts

### 1. Enable Auto-Start on Windows Boot
```powershell
# Electron GUI (starts minimized to tray on boot):
powershell -ExecutionPolicy Bypass -File scripts\register-startup.ps1

# Headless Node mode:
powershell -ExecutionPolicy Bypass -File scripts\register-startup.ps1 -Headless
```
Or use the npm script:
```powershell
npm run autostart:on
```

### 2. Disable Auto-Start
```powershell
npm run autostart:off
# Or directly:
powershell -ExecutionPolicy Bypass -File scripts\unregister-startup.ps1
```

### 3. Prevent PC Sleep During Shop Hours
```powershell
npm run nosleep
# Or directly:
powershell -ExecutionPolicy Bypass -File scripts\set-power-plan.ps1
```

---

## 📁 File Structure

```text
agent/
├── agent-core.js            # Core EventEmitter agent controller
├── agent-gui.js             # Electron main process (Window + Tray + AutoStart)
├── index.js                 # Unified entry point (supports CLI and GUI import)
├── preload.js               # Context-isolated IPC bridge
├── index.html               # Desktop companion UI
├── styles.css               # Windows 11 Fluent dark theme styling
├── renderer.js              # UI interaction and event handling
├── icon-data.js             # Embedded high-res print shop icon
├── config.js & config.json  # Agent credentials and server endpoint
├── api.js                   # Authenticated HTTP client for cloud backend
├── printer.js               # SumatraPDF automation & download spooler
├── log.js                   # File & console logger
├── pair.js                  # CLI pairing utility
├── start-companion.bat      # 1-click launcher for Windows shop staff
└── scripts/
    ├── register-startup.ps1   # Windows Startup & Registry configuration
    ├── unregister-startup.ps1 # Auto-start removal script
    └── set-power-plan.ps1     # Windows powercfg sleep prevention script
```
