$ErrorActionPreference = 'Stop'

$taskName = 'Entropi n8n backup'
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupLauncher = Join-Path $runtimeRoot 'backup-n8n.ps1'
$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $backupLauncher -PathType Leaf)) {
  throw "n8n backup launcher not found: $backupLauncher"
}

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupLauncher`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $runtimeRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '19:30'
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Creates a consistent local n8n database and encryption-config backup; retains the latest 14.' `
  -Force | Out-Null

Write-Host "Installed scheduled task: $taskName"
Write-Host 'It runs daily at 19:30 and catches up when the computer becomes available.'
