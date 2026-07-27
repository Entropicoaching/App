$ErrorActionPreference = 'Stop'

$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataRoot = Join-Path $runtimeRoot 'data'
$n8nCommand = Join-Path $runtimeRoot 'node_modules/.bin/n8n.cmd'
$restartDelaySeconds = 60

if (-not (Test-Path -LiteralPath $n8nCommand -PathType Leaf)) {
    throw "n8n command not found. Run npm ci in $runtimeRoot first."
}
if (-not [string]::IsNullOrWhiteSpace($env:ENTROPI_N8N_RESTART_DELAY_SECONDS)) {
    $configuredDelay = 0
    if (-not [int]::TryParse($env:ENTROPI_N8N_RESTART_DELAY_SECONDS, [ref]$configuredDelay) -or
        $configuredDelay -lt 1 -or $configuredDelay -gt 300) {
        throw 'ENTROPI_N8N_RESTART_DELAY_SECONDS must be an integer from 1 through 300.'
    }
    $restartDelaySeconds = $configuredDelay
}

New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null

$env:N8N_USER_FOLDER = $dataRoot
$env:N8N_HOST = '127.0.0.1'
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_PORT = '5678'
$env:N8N_PROTOCOL = 'http'
$env:N8N_EDITOR_BASE_URL = 'http://127.0.0.1:5678'
$env:N8N_SECURE_COOKIE = 'false'
$env:GENERIC_TIMEZONE = 'Europe/Copenhagen'
$env:TZ = 'Europe/Copenhagen'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_PERSONALIZATION_ENABLED = 'false'
$env:N8N_COMMUNITY_PACKAGES_ENABLED = 'false'
$env:N8N_UNVERIFIED_PACKAGES_ENABLED = 'false'
$env:N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS = 'true'
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = 'true'
$env:N8N_RUNNERS_TASK_TIMEOUT = '300'
$env:N8N_COMPRESSION_NODE_MAX_DECOMPRESSED_SIZE_BYTES = '268435456'
$env:N8N_COMPRESSION_NODE_MAX_ZIP_ENTRIES = '1000'

Set-Location -LiteralPath $runtimeRoot
while ($true) {
    & $n8nCommand start
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        break
    }

    Write-Warning "n8n exited with code $exitCode; retrying in $restartDelaySeconds seconds."
    Start-Sleep -Seconds $restartDelaySeconds
}
