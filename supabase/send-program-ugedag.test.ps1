# Proeve uden netvaerk for send-program-ugedag.ps1 (ordre 1185)
# Koer: powershell -NoProfile -File supabase\send-program-ugedag.test.ps1
$ErrorActionPreference = "Stop"
$fejl = 0
function Tjek($navn, $ok) {
    if ($ok) { Write-Host "OK   $navn" } else { Write-Host "FEJL $navn"; $script:fejl++ }
}

$fil = Join-Path $PSScriptRoot "send-program-ugedag.ps1"
if (-not (Test-Path $fil)) { Write-Host "FEJL send-program-ugedag.ps1 findes ikke"; exit 1 }
. $fil

# Usorteret payload, et pas uden dag, to pas samme dag
$payload = @(
    [pscustomobject]@{ label = "A"; day = "friday" },
    [pscustomobject]@{ label = "B"; day = $null },
    [pscustomobject]@{ label = "C"; day = "monday" },
    [pscustomobject]@{ label = "D"; day = "friday" },
    [pscustomobject]@{ label = "E"; day = "Sondag" }
)
$r = @(Get-SessionerEfterUgedag $payload)

Tjek "antal uaendret" ($r.Count -eq 5)
Tjek "raekkefoelge C,A,D,E,B" ((($r | ForEach-Object { $_.Session.label }) -join ",") -eq "C,A,D,E,B")
Tjek "session_order er 0,1,2,3,4" ((($r | ForEach-Object { $_.Order }) -join ",") -eq "0,1,2,3,4")
Tjek "weekday 0,4,4,6,null" ((($r | ForEach-Object { if ($null -eq $_.Weekday) { "n" } else { $_.Weekday } }) -join ",") -eq "0,4,4,6,n")
Tjek "samme dag: stabil (A foer D)" ($r[1].Session.label -eq "A" -and $r[2].Session.label -eq "D")
Tjek "tom liste giver tom" (@(Get-SessionerEfterUgedag @()).Count -eq 0)

# Hele weekday-blokken fra send-program.ps1 med falske svar (intet net, ingen noegle)
$kilde = Get-Content (Join-Path $PSScriptRoot "send-program.ps1") -Raw -Encoding UTF8
$m = [regex]::Match($kilde, '(?s)(\$jsonSessions\s*=.*?)\r?\n\} catch \{')
Tjek "weekday-blokken kan udtrages" $m.Success
$script:kald = @()
function Invoke-RestMethod {
    param($Method, $Uri, $Headers, $ContentType, $Body)
    if ($Method -eq "Get") {
        # Databasen: session_order 0..4 efter ugedag, id = "id<order>"
        return @(0..4 | ForEach-Object { [pscustomobject]@{ id = "id$_"; session_order = $_ } })
    }
    $script:kald += ,@($Uri, [System.Text.Encoding]::UTF8.GetString($Body))
}
$r = [pscustomobject]@{ week_id = "w1" }
$headers = @{}
$json = [pscustomobject]@{ p_payload = [pscustomobject]@{ sessions = $payload } }
Invoke-Expression $m.Groups[1].Value
$pa = ($script:kald | ForEach-Object { ($_[0] -replace '^.*id=eq\.', '') + ':' + ($_[1] -replace '\D', '') }) -join ','
Tjek "PATCH til rette session (id0:0,id1:4,id2:4,id3:6)" ($pa -eq "id0:0,id1:4,id2:4,id3:6")

if ($fejl -gt 0) { Write-Host "$fejl fejl"; exit 1 }
Write-Host "Alle proever OK"
