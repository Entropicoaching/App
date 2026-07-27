param(
  [string]$RuntimeRoot = (Join-Path $env:USERPROFILE 'Documents\Entropicoaching\n8n-local'),
  [string]$NodeCommand = 'node'
)

$ErrorActionPreference = 'Stop'

$coachWorkflowId = '8d6b7a5f-54a5-4b78-9713-cc9cf7890ae6'
$monitorWorkflowId = 'c2c8a96a-8fd1-4f3a-9b28-36b09c729c4e'
$scheduledTaskName = 'Entropi n8n'
$n8nCommand = Join-Path $RuntimeRoot 'node_modules\.bin\n8n.cmd'
$n8nUserFolder = Join-Path $RuntimeRoot 'data'
$n8nLauncher = Join-Path $RuntimeRoot 'start-n8n.ps1'
$expectedPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$runtimeBlueprintRoot = Join-Path $PSScriptRoot 'local-runtime'
$runtimeRecoveryVerifier = Join-Path $PSScriptRoot 'verify-runtime-recovery.ps1'
$verifier = Join-Path $PSScriptRoot 'verify-workflows.mjs'

if (-not (Test-Path -LiteralPath $n8nCommand -PathType Leaf)) {
  throw "n8n command not found below the supplied runtime root"
}
if (-not (Test-Path -LiteralPath $n8nUserFolder -PathType Container)) {
  throw "n8n data folder not found below the supplied runtime root"
}
if (-not (Test-Path -LiteralPath $n8nLauncher -PathType Leaf)) {
  throw "n8n launcher not found below the supplied runtime root"
}

function Get-NormalizedFileText([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required local runtime file is missing: $([IO.Path]::GetFileName($Path))"
  }
  return [IO.File]::ReadAllText($Path).Replace("`r`n", "`n").TrimEnd()
}

foreach ($runtimeFile in @('package.json', 'package-lock.json', 'start-n8n.ps1', 'install-autostart.ps1', 'remove-autostart.ps1')) {
  $blueprintPath = Join-Path $runtimeBlueprintRoot $runtimeFile
  $deployedPath = Join-Path $RuntimeRoot $runtimeFile
  if ((Get-NormalizedFileText $blueprintPath) -cne (Get-NormalizedFileText $deployedPath)) {
    throw "Installed local n8n runtime differs from the reviewed blueprint: $runtimeFile"
  }
}

& $runtimeRecoveryVerifier -BlueprintRoot $runtimeBlueprintRoot
if ($LASTEXITCODE -ne 0) {
  throw 'Local n8n child-process recovery test failed'
}

$scheduledTask = Get-ScheduledTask -TaskName $scheduledTaskName -ErrorAction Stop
$taskActions = @($scheduledTask.Actions)
if ($taskActions.Count -ne 1) {
  throw "Local n8n scheduled task must have exactly one action"
}
$taskAction = $taskActions[0]
$expectedArguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$n8nLauncher`""
if ([IO.Path]::GetFullPath([string]$taskAction.Execute) -ine [IO.Path]::GetFullPath($expectedPowerShell)) {
  throw "Local n8n scheduled task does not use the expected Windows PowerShell executable"
}
if ([string]$taskAction.Arguments -cne $expectedArguments) {
  throw "Local n8n scheduled task arguments differ from the reviewed launcher command"
}
if ([IO.Path]::GetFullPath([string]$taskAction.WorkingDirectory) -ine [IO.Path]::GetFullPath($RuntimeRoot)) {
  throw "Local n8n scheduled task uses an unexpected working directory"
}

$taskTriggers = @($scheduledTask.Triggers)
if ($taskTriggers.Count -ne 1 -or $taskTriggers[0].CimClass.CimClassName -ne 'MSFT_TaskLogonTrigger') {
  throw "Local n8n scheduled task must have exactly one logon trigger"
}
$taskTrigger = $taskTriggers[0]
if (-not $taskTrigger.Enabled) {
  throw "Local n8n scheduled task logon trigger is disabled"
}
$triggerAccount = ([string]$taskTrigger.UserId -split '\\')[-1]
if ($triggerAccount -ine $env:USERNAME) {
  throw "Local n8n scheduled task logon trigger belongs to an unexpected user"
}
$principalAccount = ([string]$scheduledTask.Principal.UserId -split '\\')[-1]
if ($principalAccount -ine $env:USERNAME -or
    [string]$scheduledTask.Principal.LogonType -ne 'Interactive' -or
    [string]$scheduledTask.Principal.RunLevel -ne 'Limited') {
  throw "Local n8n scheduled task principal differs from the reviewed interactive user"
}
if ([string]$scheduledTask.State -eq 'Disabled') {
  throw "Local n8n scheduled task is disabled"
}
if ([int]$scheduledTask.Settings.RestartCount -lt 1) {
  throw "Local n8n scheduled task has no process-failure restart policy"
}
if ([string]$scheduledTask.Settings.RestartInterval -ne 'PT1M') {
  throw "Local n8n scheduled task restart interval differs from one minute"
}
if ([string]$scheduledTask.Settings.MultipleInstances -ne 'IgnoreNew') {
  throw "Local n8n scheduled task does not block duplicate instances"
}
if (-not $scheduledTask.Settings.StartWhenAvailable) {
  throw "Local n8n scheduled task will not catch up after a missed start"
}
if ([string]$scheduledTask.Settings.ExecutionTimeLimit -ne 'PT0S') {
  throw "Local n8n scheduled task has an execution time limit"
}
if ($scheduledTask.Settings.DisallowStartIfOnBatteries -or $scheduledTask.Settings.StopIfGoingOnBatteries) {
  throw "Local n8n scheduled task is not configured for uninterrupted laptop operation"
}

$health = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5678/healthz'
if ($health.StatusCode -ne 200) {
  throw "Local n8n health check failed"
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = Join-Path $tempBase ("entropi-n8n-verify-" + [guid]::NewGuid().ToString('N'))
$resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
if (-not $resolvedTempRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a temporary folder outside the system temp directory"
}

$previousUserFolder = $env:N8N_USER_FOLDER
$previousDiagnostics = $env:N8N_DIAGNOSTICS_ENABLED
try {
  New-Item -ItemType Directory -Path $resolvedTempRoot | Out-Null
  $coachExport = Join-Path $resolvedTempRoot 'coach.json'
  $monitorExport = Join-Path $resolvedTempRoot 'monitor.json'
  $env:N8N_USER_FOLDER = $n8nUserFolder
  $env:N8N_DIAGNOSTICS_ENABLED = 'false'

  & $n8nCommand export:workflow --id $coachWorkflowId --output $coachExport
  if ($LASTEXITCODE -ne 0) { throw "Coach briefing export failed" }

  & $n8nCommand export:workflow --id $monitorWorkflowId --output $monitorExport
  if ($LASTEXITCODE -ne 0) { throw "Error monitor export failed" }

  & $NodeCommand $verifier --live-coach $coachExport --live-monitor $monitorExport
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host 'OK: local n8n blueprint, startup and recovery safeguards are valid'
}
finally {
  $env:N8N_USER_FOLDER = $previousUserFolder
  $env:N8N_DIAGNOSTICS_ENABLED = $previousDiagnostics
  if (Test-Path -LiteralPath $resolvedTempRoot) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
