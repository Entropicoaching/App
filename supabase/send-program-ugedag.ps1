# send-program-ugedag.ps1 - ren funktion, ingen netvaerk (ordre 1185)
# Samme regel som create_program_week (sql/create_program_week.sql) og drafter.send (1183):
# stabil sortering efter ugedag, ukendt dag sidst. Resultatet giver for hvert pas
# session_order (0-baseret, som databasen) og weekday (0=mandag ... 6=soendag, $null hvis ukendt).

function Get-SessionerEfterUgedag {
    param([object[]]$Sessions)

    $dage = @{
        monday = 0; mandag = 0; tuesday = 1; tirsdag = 1; wednesday = 2; onsdag = 2
        thursday = 3; torsdag = 3; friday = 4; fredag = 4
        saturday = 5; lordag = 5; sunday = 6; sondag = 6
    }
    # Danske varianter bygges af tegnkoder, saa filen er ren ASCII (PowerShell 5 laeser den uden BOM)
    $dage[("l" + [char]0xF8 + "rdag")] = 5
    $dage[("s" + [char]0xF8 + "ndag")] = 6

    $liste = @()
    $n = 0
    foreach ($s in @($Sessions)) {
        $navn = ("" + $s.day).ToLower()
        $wd = $null
        if ($dage.ContainsKey($navn)) { $wd = $dage[$navn] }
        $liste += [pscustomobject]@{
            Session = $s
            Weekday = $wd
            Noegle  = $(if ($null -eq $wd) { 99 } else { $wd })
            Indeks  = $n
        }
        $n++
    }

    $sorteret = @($liste | Sort-Object -Property Noegle, Indeks)
    $o = 0
    foreach ($x in $sorteret) {
        [pscustomobject]@{ Session = $x.Session; Weekday = $x.Weekday; Order = $o }
        $o++
    }
}
