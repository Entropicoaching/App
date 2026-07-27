$ErrorActionPreference = 'Stop'

$taskName = 'Entropi n8n'
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $runtimeRoot 'start-n8n.ps1'
$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "n8n launcher not found: $launcher"
}

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $runtimeRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'Starts the local Entropi n8n Community Edition runtime at sign-in and restarts it after process failures.' `
    -Force | Out-Null

Write-Host "Installed scheduled task: $taskName"
Write-Host 'It will start automatically at the next sign-in.'
Write-Host 'If n8n exits unexpectedly, Task Scheduler retries after one minute.'
