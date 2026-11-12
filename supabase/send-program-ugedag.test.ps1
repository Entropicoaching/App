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

if ($fejl -gt 0) { Write-Host "$fejl fejl"; exit 1 }
Write-Host "Alle proever OK"
