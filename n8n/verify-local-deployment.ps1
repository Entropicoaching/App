param(
  [string]$RuntimeRoot = (Join-Path $env:USERPROFILE 'Documents\Entropicoaching\n8n-local'),
  [string]$NodeCommand = 'node'
)

$ErrorActionPreference = 'Stop'

$coachWorkflowId = '8d6b7a5f-54a5-4b78-9713-cc9cf7890ae6'
$monitorWorkflowId = 'c2c8a96a-8fd1-4f3a-9b28-36b09c729c4e'
$scheduledTaskName = 'Entropi n8n'
$backupTaskName = 'Entropi n8n backup'
$n8nCommand = Join-Path $RuntimeRoot 'node_modules\.bin\n8n.cmd'
$n8nUserFolder = Join-Path $RuntimeRoot 'data'
$n8nLauncher = Join-Path $RuntimeRoot 'start-n8n.ps1'
$backupLauncher = Join-Path $RuntimeRoot 'backup-n8n.ps1'
$backupRoot = Join-Path $env:USERPROFILE 'Documents\Entropicoaching\n8n-backups'
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

foreach ($runtimeFile in @(
  'package.json', 'package-lock.json', 'start-n8n.ps1', 'install-autostart.ps1', 'remove-autostart.ps1',
  'backup-n8n.mjs', 'backup-n8n.ps1', 'install-backup-autostart.ps1', 'remove-backup-autostart.ps1'
)) {
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

$backupTask = Get-ScheduledTask -TaskName $backupTaskName -ErrorAction Stop
$backupActions = @($backupTask.Actions)
if ($backupActions.Count -ne 1) {
  throw "Local n8n backup task must have exactly one action"
}
$backupAction = $backupActions[0]
$expectedBackupArguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupLauncher`""
if ([IO.Path]::GetFullPath([string]$backupAction.Execute) -ine [IO.Path]::GetFullPath($expectedPowerShell) -or
    [string]$backupAction.Arguments -cne $expectedBackupArguments -or
    [IO.Path]::GetFullPath([string]$backupAction.WorkingDirectory) -ine [IO.Path]::GetFullPath($RuntimeRoot)) {
  throw "Local n8n backup task action differs from the reviewed command"
}
$backupTriggers = @($backupTask.Triggers)
if ($backupTriggers.Count -ne 1 -or $backupTriggers[0].CimClass.CimClassName -ne 'MSFT_TaskDailyTrigger') {
  throw "Local n8n backup task must have exactly one daily trigger"
}
$backupTrigger = $backupTriggers[0]
if (-not $backupTrigger.Enabled -or ([datetime]$backupTrigger.StartBoundary).TimeOfDay -ne [timespan]::FromHours(19.5)) {
  throw "Local n8n backup task is not enabled for 19:30"
}
$backupPrincipalAccount = ([string]$backupTask.Principal.UserId -split '\\')[-1]
if ($backupPrincipalAccount -ine $env:USERNAME -or
    [string]$backupTask.Principal.LogonType -ne 'Interactive' -or
    [string]$backupTask.Principal.RunLevel -ne 'Limited') {
  throw "Local n8n backup task principal differs from the reviewed interactive user"
}
if ([string]$backupTask.State -eq 'Disabled' -or
    [int]$backupTask.Settings.RestartCount -ne 3 -or
    [string]$backupTask.Settings.RestartInterval -ne 'PT1M' -or
    [string]$backupTask.Settings.ExecutionTimeLimit -ne 'PT30M' -or
    [string]$backupTask.Settings.MultipleInstances -ne 'IgnoreNew' -or
    -not $backupTask.Settings.StartWhenAvailable -or
    $backupTask.Settings.DisallowStartIfOnBatteries -or
    $backupTask.Settings.StopIfGoingOnBatteries) {
  throw "Local n8n backup task safeguards differ from the reviewed settings"
}

if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
  throw "Local n8n backup folder does not exist"
}
$latestBackup = Get-ChildItem -LiteralPath $backupRoot -Directory |
  Where-Object { $_.Name -match '^backup-\d{8}T\d{6}(?:\d{3})?Z$' } |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $latestBackup) {
  throw "Local n8n backup folder has no completed backup"
}
$manifestPath = Join-Path $latestBackup.FullName 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Latest local n8n backup has no manifest"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$backupAge = [DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse([string]$manifest.createdAt).ToUniversalTime()
if ([int]$manifest.schemaVersion -ne 1 -or [string]$manifest.integrity -ne 'ok' -or
    $backupAge.TotalMinutes -lt -5 -or $backupAge.TotalHours -gt 36) {
  throw "Latest local n8n backup manifest is invalid or stale"
}
foreach ($backupFile in @('database.sqlite', 'config')) {
  $backupPath = Join-Path $latestBackup.FullName $backupFile
  if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    throw "Latest local n8n backup is missing a required file"
  }
  $manifestFile = $manifest.files.$backupFile
  $fileInfo = Get-Item -LiteralPath $backupPath
  $fileHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ([long]$manifestFile.bytes -ne $fileInfo.Length -or [string]$manifestFile.sha256 -cne $fileHash) {
    throw "Latest local n8n backup does not match its integrity manifest"
  }
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
  $env:N8N_DIAGNOSTICS_ENABLED = 'false'

  $restoreUserFolder = Join-Path $resolvedTempRoot 'restore-user'
  $restoreDataFolder = Join-Path $restoreUserFolder '.n8n'
  New-Item -ItemType Directory -Path $restoreDataFolder -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $latestBackup.FullName 'database.sqlite') -Destination (Join-Path $restoreDataFolder 'database.sqlite')
  Copy-Item -LiteralPath (Join-Path $latestBackup.FullName 'config') -Destination (Join-Path $restoreDataFolder 'config')
  $restoreCoachExport = Join-Path $resolvedTempRoot 'restore-coach.json'
  $restoreMonitorExport = Join-Path $resolvedTempRoot 'restore-monitor.json'
  $env:N8N_USER_FOLDER = $restoreUserFolder

  & $n8nCommand export:workflow --id $coachWorkflowId --output $restoreCoachExport
  if ($LASTEXITCODE -ne 0) { throw "Coach briefing export from backup restore failed" }
  & $n8nCommand export:workflow --id $monitorWorkflowId --output $restoreMonitorExport
  if ($LASTEXITCODE -ne 0) { throw "Error monitor export from backup restore failed" }
  & $NodeCommand $verifier --live-coach $restoreCoachExport --live-monitor $restoreMonitorExport
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host 'OK: latest local n8n backup restores both reviewed workflows'

  $coachExport = Join-Path $resolvedTempRoot 'live-coach.json'
  $monitorExport = Join-Path $resolvedTempRoot 'live-monitor.json'
  $env:N8N_USER_FOLDER = $n8nUserFolder
  & $n8nCommand export:workflow --id $coachWorkflowId --output $coachExport
  if ($LASTEXITCODE -ne 0) { throw "Coach briefing export failed" }
  & $n8nCommand export:workflow --id $monitorWorkflowId --output $monitorExport
  if ($LASTEXITCODE -ne 0) { throw "Error monitor export failed" }
  & $NodeCommand $verifier --live-coach $coachExport --live-monitor $monitorExport
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host 'OK: local n8n blueprint, startup, recovery and backup safeguards are valid'
}
finally {
  $env:N8N_USER_FOLDER = $previousUserFolder
  $env:N8N_DIAGNOSTICS_ENABLED = $previousDiagnostics
  if (Test-Path -LiteralPath $resolvedTempRoot) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
