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
$athleteId  = $json.p_payload.athleteId
$payload    = ($json | Select-Object -Property p_payload | ConvertTo-Json -Depth 20 -Compress)
$body       = [System.Text.Encoding]::UTF8.GetBytes($payload)

# Pre-flight: UNIQUE constraint på weeks(athlete_id, start_date).
# Tjek FØR ugen oprettes — fejler vi først ved PATCH'en bagefter, efterlades
# en halv uge uden dato. Datoen ændres ALDRIG automatisk for at tvinge det igennem.
if ($start_date -and $athleteId) {
    try {
        $clash = Invoke-RestMethod -Method Get `
            -Uri "$PATCH`?athlete_id=eq.$athleteId&start_date=eq.$start_date&select=week_number,block_name" `
            -Headers $headers
    } catch {
        Write-Error "Kunne ikke tjekke for kolliderende uger: $($_.Exception.Message)"
        exit 1
    }
    if ($clash.Count -gt 0) {
        $w = $clash[0]
        Write-Host "STOP: start_date $start_date kolliderer med eksisterende uge $($w.week_number) ($($w.block_name))." -ForegroundColor Red
        Write-Host "Intet er sendt. Slet/ret den eksisterende uge i appen, eller ret start_date i $JsonFile manuelt." -ForegroundColor Yellow
        exit 1
    }
}

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

    # Sæt weekday på sessionerne ud fra "day"-feltet i JSON (0=mandag ... 6=søndag)
    $dayMap = @{ monday=0; tuesday=1; wednesday=2; thursday=3; friday=4; saturday=5; sunday=6 }
    $jsonSessions = $json.p_payload.sessions
    if ($jsonSessions) {
        $SESS = "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/sessions"
        $dbSessions = Invoke-RestMethod -Method Get `
            -Uri "$SESS`?week_id=eq.$($r.week_id)&select=id,session_order&order=session_order" `
            -Headers $headers
        $sat = 0
        for ($i = 0; $i -lt $jsonSessions.Count; $i++) {
            $day = $jsonSessions[$i].day
            if ($day -and $dayMap.ContainsKey($day.ToLower())) {
                $db = $dbSessions | Where-Object { $_.session_order -eq $i }
                if ($db) {
                    $wdBody = [System.Text.Encoding]::UTF8.GetBytes("{`"weekday`":$($dayMap[$day.ToLower()])}")
                    Invoke-RestMethod -Method Patch `
                        -Uri "$SESS`?id=eq.$($db.id)" `
                        -Headers ($headers + @{ Prefer = "return=minimal" }) `
                        -ContentType "application/json; charset=utf-8" `
                        -Body $wdBody | Out-Null
                    $sat++
                }
            }
        }
        Write-Host "  weekday sat på $sat sessioner" -ForegroundColor Green
    }
} catch {
    $detail = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $detail = [System.IO.StreamReader]::new($stream).ReadToEnd()
    } catch {}

    # UNIQUE constraint på weeks(athlete_id, start_date) → forklar HVILKEN uge
    # der kolliderer i stedet for et råt Postgres-fejldump.
    if ($detail -match '23505' -or $detail -match 'duplicate key') {
        Write-Host "FEJL: Ugen kolliderer med en eksisterende uge (samme atlet + start_date)." -ForegroundColor Red
        if ($start_date -and $athleteId) {
            try {
                $w = (Invoke-RestMethod -Method Get `
                    -Uri "$PATCH`?athlete_id=eq.$athleteId&start_date=eq.$start_date&select=week_number,block_name" `
                    -Headers $headers)[0]
                if ($w) { Write-Host "  Eksisterende uge: uge $($w.week_number) ($($w.block_name)), start_date $start_date" -ForegroundColor Yellow }
            } catch {}
        }
        Write-Host "  Datoen ændres aldrig automatisk. Slet/ret den eksisterende uge i appen, eller ret start_date i JSON-filen." -ForegroundColor Yellow
    } else {
        Write-Host "FEJL: $($_.Exception.Message)" -ForegroundColor Red
        if ($detail) { Write-Host $detail }
    }
    exit 1
}
