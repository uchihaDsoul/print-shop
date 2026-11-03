# PowerShell Script: Register Print Shop Agent in Windows Startup
# Can register either the Electron GUI Companion or Headless Node Agent
param(
    [switch]$Headless = $false
)

$ErrorActionPreference = "Stop"

$AgentDir = Split-Path -Parent $PSScriptRoot
$StartupFolder = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder "PrintShopAgent.lnk"
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)

if ($Headless) {
    # Run node index.js silently or minimized
    $Shortcut.TargetPath = "node.exe"
    $Shortcut.Arguments = "`"$AgentDir\index.js`""
    $Shortcut.WorkingDirectory = $AgentDir
    $Shortcut.Description = "Print Shop Agent (Headless Print Queue)"
} else {
    # Run Electron GUI with --hidden parameter so it boots silently to Tray
    $ElectronPath = Join-Path $AgentDir "node_modules\electron\dist\electron.exe"
    if (Test-Path $ElectronPath) {
        $Shortcut.TargetPath = $ElectronPath
        $Shortcut.Arguments = "`"$AgentDir`" --hidden"
        $Shortcut.WorkingDirectory = $AgentDir
        $Shortcut.Description = "Print Shop Agent Desktop Companion"
    } else {
        # Fallback to npm run gui or node
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-WindowStyle Hidden -Command `"Set-Location '$AgentDir'; npm run gui -- --hidden`""
        $Shortcut.WorkingDirectory = $AgentDir
        $Shortcut.Description = "Print Shop Agent Companion"
    }
}

$Shortcut.Save()

# Also register in Windows Registry CurrentVersion\Run for guaranteed persistence
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegValue = "`"$($Shortcut.TargetPath)`" $($Shortcut.Arguments)"
Set-ItemProperty -Path $RegPath -Name "PrintShopAgent" -Value $RegValue -Force

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Print Shop Agent registered for Windows Startup! " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Startup Shortcut: $ShortcutPath"
Write-Host "Target:           $($Shortcut.TargetPath) $($Shortcut.Arguments)"
Write-Host "Registry Run Key: HKCU\Software\Microsoft\Windows\CurrentVersion\Run\PrintShopAgent"
Write-Host ""
Write-Host "The agent will now launch automatically on Windows boot." -ForegroundColor Cyan
