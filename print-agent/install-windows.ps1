param([string]$ServerUrl, [string]$PairingCode)
$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nodeVersion = & $nodePath -p 'process.versions.node'
if ([version]$nodeVersion -lt [version]'22.12.0') { throw 'Install Node.js 22.12 or newer first.' }
$profileDirectory = Join-Path $env:LOCALAPPDATA 'KarvaanPrint'
$applicationDirectory = Join-Path $profileDirectory 'app'
New-Item -ItemType Directory -Path $applicationDirectory -Force | Out-Null
# Per-user credentials; keep other local users out of the profile.
$userIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $profileDirectory /inheritance:r /grant:r "${userIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the printing profile directory.' }
$taskName = 'Karvaan Local Printing'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $taskName }
foreach ($fileName in @('agent.cjs', 'transport.cjs', 'windows-print.ps1', 'run-windows.ps1')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $fileName) -Destination (Join-Path $applicationDirectory $fileName) -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $profileDirectory 'config.json'))) {
  if (-not $ServerUrl) { $ServerUrl = Read-Host 'POS server URL (e.g. http://... or https://...)' }
  if (-not $PairingCode) { $PairingCode = Read-Host 'One-time pairing code from Printer Setup' }
  & $nodePath (Join-Path $applicationDirectory 'agent.cjs') pair $ServerUrl $PairingCode
  if ($LASTEXITCODE -ne 0) { throw 'Pairing failed. The background task was not installed.' }
}
$runnerPath = Join-Path $applicationDirectory 'run-windows.ps1'
$taskArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runnerPath + '" -NodePath "' + $nodePath + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments -WorkingDirectory $applicationDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userIdentity
$principal = New-ScheduledTaskPrincipal -UserId $userIdentity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Hidden -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Printing installed and started. It starts when this Windows user signs in. Keep this computer on and signed in; locking the screen is fine.'
