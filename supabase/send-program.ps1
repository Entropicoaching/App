# send-program.ps1 — sender en JSON-fil til create_program_week
# Brug: .\supabase\send-program.ps1 .\supabase\marc-week1.json
#
# Krav: SUPABASE_SECRET_KEY i .env.local (projektrod)

param(
    [Parameter(Mandatory)][string]$JsonFile
)

# Læs nøgle fra .env.local
$root    = Split-Path $PSScriptRoot
$envLine = Get-Content (Join-Path $root ".env.local") | Where-Object { $_ -match "^SUPABASE_SECRET_KEY\s*=" }
$KEY     = ($envLine -split "=", 2)[1].Trim()

if (-not $KEY -or $KEY -notlike "sb_secret_*") {
    Write-Error "SUPABASE_SECRET_KEY mangler eller er forkert i .env.local"
    exit 1
}

$URL     = "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_program_week"
$PATCH   = "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/weeks"
$headers = @{ apikey = $KEY; Authorization = "Bearer $KEY"; "User-Agent" = "entropi-cowork/1.0" }

# Læs JSON — udtræk start_date hvis til stede, send kun p_payload til endpointet
$json       = Get-Content (Resolve-Path $JsonFile) -Raw -Encoding UTF8 | ConvertFrom-Json
$start_date = $json.start_date
$payload    = ($json | Select-Object -Property p_payload | ConvertTo-Json -Depth 20 -Compress)
$body       = [System.Text.Encoding]::UTF8.GetBytes($payload)

Write-Host "Sender $JsonFile ..." -ForegroundColor Cyan

try {
    $r = Invoke-RestMethod -Method Post -Uri $URL `
        -Headers $headers `
        -ContentType "application/json; charset=utf-8" `
        -Body $body

    Write-Host "Oprettet!" -ForegroundColor Green
    Write-Host "  week_id:   $($r.week_id)"
    Write-Host "  Uge:       $($r.week_number)"
    Write-Host "  Sessioner: $($r.sessions)"
    Write-Host "  Øvelser:   $($r.exercises)"

    # Sæt start_date hvis angivet i JSON
    if ($start_date) {
        $patchBody = [System.Text.Encoding]::UTF8.GetBytes("{`"start_date`":`"$start_date`"}")
        Invoke-RestMethod -Method Patch `
            -Uri "$PATCH`?id=eq.$($r.week_id)" `
            -Headers ($headers + @{ Prefer = "return=minimal" }) `
            -ContentType "application/json; charset=utf-8" `
            -Body $patchBody | Out-Null
        Write-Host "  start_date: $start_date" -ForegroundColor Green
    }
} catch {
    Write-Host "FEJL: $($_.Exception.Message)" -ForegroundColor Red
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        Write-Host ([System.IO.StreamReader]::new($stream).ReadToEnd())
    } catch {}
}
