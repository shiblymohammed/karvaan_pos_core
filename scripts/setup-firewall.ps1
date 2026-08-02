# ============================================================
# Karvaan POS — Windows Firewall Setup Script
# Run this ONCE as Administrator on the cashier PC to allow
# tablets and phones on the same Wi-Fi to connect.
# ============================================================
# HOW TO RUN:
#   Right-click this file → "Run with PowerShell"
#   OR in an admin terminal:
#   powershell -ExecutionPolicy Bypass -File .\setup-firewall.ps1
# ============================================================

$port = 3001
$ruleName = "Karvaan POS Backend (Port $port)"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Karvaan POS - Windows Firewall Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    Write-Host "Right-click the script and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Checking for existing firewall rule..." -ForegroundColor Yellow

# Remove existing rule if present (clean slate)
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Host "  Removed old rule." -ForegroundColor Gray
}

# Add inbound rule for TCP port 3001
New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $port `
    -Action Allow `
    -Profile Private,Domain `
    -Description "Allow Karvaan POS backend (NestJS) to accept connections from LAN tablets and phones" | Out-Null

Write-Host ""
Write-Host "SUCCESS! Firewall rule added:" -ForegroundColor Green
Write-Host "  Name   : $ruleName" -ForegroundColor White
Write-Host "  Port   : TCP $port" -ForegroundColor White
Write-Host "  Profile: Private (restaurant Wi-Fi)" -ForegroundColor White

# Show the PC's current local IPs
Write-Host ""
Write-Host "Your PC's Local IP Addresses:" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" }
foreach ($ip in $ips) {
    Write-Host "  http://$($ip.IPAddress):$port  <-- Use this on tablets/phones" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. On each tablet/phone, open the POS app" -ForegroundColor White
Write-Host "  2. Enter one of the URLs above in the Setup Screen" -ForegroundColor White
Write-Host "  3. Tap 'Test' to verify connection, then 'Save & Connect'" -ForegroundColor White
Write-Host ""
Write-Host "TIP: Assign a static IP to this PC in your router settings" -ForegroundColor Yellow
Write-Host "     so the IP never changes. (See router admin panel)" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to close"
