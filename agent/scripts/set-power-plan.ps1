# PowerShell Script: Disable Standby and Monitor Timeout to prevent PC sleep during store hours
Write-Host "Configuring Windows Power Plan to prevent sleep..." -ForegroundColor Cyan

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Notice: Changing powercfg timeouts may require Administrator privileges." -ForegroundColor Yellow
    Write-Host "If this command shows a permission notice, please re-run PowerShell as Administrator." -ForegroundColor Yellow
}

# Set AC (plugged in) Standby timeout to 0 (Never)
powercfg -change -standby-timeout-ac 0

# Set AC (plugged in) Monitor timeout to 0 (Never)
powercfg -change -monitor-timeout-ac 0

Write-Host "Power settings update command executed." -ForegroundColor Green
Write-Host "  - Standby timeout (AC): Never (0 min)" -ForegroundColor Green
Write-Host "  - Monitor timeout (AC): Never (0 min)" -ForegroundColor Green
