param(
  [string]$BackupRoot = (Join-Path $env:USERPROFILE 'Documents\Entropicoaching\n8n-backups'),
  [ValidateRange(1, 60)]
  [int]$Keep = 14
)

$ErrorActionPreference = 'Stop'

$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupScript = Join-Path $runtimeRoot 'backup-n8n.mjs'
$node = Get-Command node -ErrorAction Stop

if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) {
  throw 'n8n backup script is missing from the runtime folder'
}

& $node.Source $backupScript --backup-root $BackupRoot --keep $Keep
if ($LASTEXITCODE -ne 0) {
  throw "n8n backup failed with exit code $LASTEXITCODE"
}
