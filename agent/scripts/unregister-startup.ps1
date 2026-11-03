# PowerShell Script: Remove Print Shop Agent from Windows Startup
$ErrorActionPreference = "SilentlyContinue"

$StartupFolder = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder "PrintShopAgent.lnk"

if (Test-Path $ShortcutPath) {
    Remove-Item -Path $ShortcutPath -Force
    Write-Host "Removed Startup shortcut: $ShortcutPath" -ForegroundColor Yellow
}

# Remove from Registry CurrentVersion\Run
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $RegPath -Name "PrintShopAgent" -Force

Write-Host "Print Shop Agent auto-start has been disabled." -ForegroundColor Green
