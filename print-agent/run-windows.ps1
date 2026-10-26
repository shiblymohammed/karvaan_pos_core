param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference = 'Stop'
$profileDirectory = Join-Path $env:LOCALAPPDATA 'KarvaanPrint'
$logFile = Join-Path $profileDirectory 'agent.log'
if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 5MB) {
  Move-Item -LiteralPath $logFile -Destination (Join-Path $profileDirectory 'agent.previous.log') -Force
}
& $NodePath (Join-Path $PSScriptRoot 'agent.cjs') run *>> $logFile
exit $LASTEXITCODE
