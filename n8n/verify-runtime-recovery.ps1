param(
  [string]$BlueprintRoot = (Join-Path $PSScriptRoot 'local-runtime')
)

$ErrorActionPreference = 'Stop'

$launcher = Join-Path $BlueprintRoot 'start-n8n.ps1'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
  throw 'Runtime recovery test could not find the reviewed launcher'
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempPrefix = $tempBase.TrimEnd('\') + '\'
$tempRoot = Join-Path $tempBase ("entropi-n8n-recovery-test-" + [guid]::NewGuid().ToString('N'))
$resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
if (-not $resolvedTempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to use a recovery-test folder outside the system temp directory'
}

$previousDelay = $env:ENTROPI_N8N_RESTART_DELAY_SECONDS
$previousLocation = (Get-Location).Path
try {
  $fakeBin = Join-Path $resolvedTempRoot 'node_modules\.bin'
  New-Item -ItemType Directory -Path $fakeBin -Force | Out-Null
  Copy-Item -LiteralPath $launcher -Destination (Join-Path $resolvedTempRoot 'start-n8n.ps1')

  $fakePowerShell = @(
    '$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ''..\..''))',
    '$statePath = Join-Path $runtimeRoot ''attempt.txt''',
    '$count = if (Test-Path -LiteralPath $statePath) { [int][IO.File]::ReadAllText($statePath) } else { 0 }',
    '$count += 1',
    '[IO.File]::WriteAllText($statePath, [string]$count)',
    'if ($count -eq 1) { exit 1 }',
    'exit 0'
  )
  [IO.File]::WriteAllLines(
    (Join-Path $fakeBin 'fake-n8n.ps1'),
    $fakePowerShell,
    [Text.UTF8Encoding]::new($false)
  )
  [IO.File]::WriteAllLines(
    (Join-Path $fakeBin 'n8n.cmd'),
    @(
      '@echo off',
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fake-n8n.ps1"',
      'exit /b %ERRORLEVEL%'
    ),
    [Text.ASCIIEncoding]::new()
  )

  $env:ENTROPI_N8N_RESTART_DELAY_SECONDS = '1'
  & (Join-Path $resolvedTempRoot 'start-n8n.ps1')
  if ($LASTEXITCODE -ne 0) {
    throw 'Runtime recovery launcher did not exit cleanly after its successful retry'
  }

  $attemptPath = Join-Path $resolvedTempRoot 'attempt.txt'
  $attempts = if (Test-Path -LiteralPath $attemptPath) {
    [int][IO.File]::ReadAllText($attemptPath)
  } else {
    0
  }
  if ($attempts -ne 2) {
    throw "Runtime recovery launcher used $attempts attempts instead of two"
  }
}
finally {
  $env:ENTROPI_N8N_RESTART_DELAY_SECONDS = $previousDelay
  Set-Location -LiteralPath $previousLocation
  if (Test-Path -LiteralPath $resolvedTempRoot) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}

Write-Host 'OK: local n8n launcher recovers a failed child process'
