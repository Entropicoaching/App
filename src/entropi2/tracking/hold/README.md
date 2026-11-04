# Coachens holdoverblik

Nye, ikke tilkoblede moduler. `CoachTeam.mjs` er en rigtig React-komponent;
`overview.mjs` er en ren model. Begge kræver `enabled === true`, før input læses.
Ingen requests, hooks, lagring, writes, automatisk planlægning eller ændring af
eksisterende OFF-adfærd. Importeres ikke fra eksisterende appkode.

## Inputkontrakt

```js
{
  enabled: true,
  asOf: '2026-11-04', // eksplicit dansk kalenderdag, ingen implicit klokke
  roster: { state: 'ready', complete: true, athleteIds: ['synthetic-a'] },
  athletes: [{
    athleteId: 'synthetic-a',
    coachWeek: /* normaliseret snapshot fra coachuge/README.md */,
    sources: /* fire autoriserede kilder fra kvalitet/README.md */
  }]
}
```

Kaldende kode ejer autorisation og skal levere hele coachens atletliste. Modulet
foretager ingen autorisation eller databaseopslag. `athleteId` er atlet-id, aldrig
`user_id`. Listen og snapshots må højst have 10.000 elementer. Id'er er unikke,
trimmede strenge på højst 120 tegn. Datoen skal kunne repræsenteres af de
eksisterende kalender- og kvalitetsmoduler.

`roster.state: 'loading'` giver indlæsning; fejl, ufuldstændig liste, ugyldige
id'er/datoer eller dubletter giver fejl. Kun en fuldt indlæst tom liste giver
"Ingen atleter". Snapshot-listen er ikke atletlisten: atleter uden snapshot
bliver på holdet med ukendt flagantal og ukendt dækning. Fremmede snapshots
ignoreres; gentagne snapshots for samme atlet afvises for den atlet.

`coachWeek.athleteId` og `coachWeek.asOf` skal stemme præcist med roster/dato.
`evaluateCoachWeek` ejer flagregler og tilstrækkeligt signalgrundlag.
`weeklyDataBasis` ejer fire kalenderuger, identitetsfiltrering og dagsdækning.
Kildernes `complete: true` skal gælde hele kvalitetsmodulets datovindue;
ugeevalueringen kræver desuden sine egne længere vinduer, bl.a. 84 dages styrke.
Ukendt/fejlet ugegrundlag giver `flagCount: null`, aldrig nul. Nul flag sammen
med tomt eller utilstrækkeligt ugegrundlag beskrives udtrykkeligt sådan.
Kun de fire datadomæner fra kvalitet benyttes. Private ekstrafelter læses ikke;
output indeholder kun id, tilstande, flagantal og daterede dækningsopgørelser.

## Rækkefølge og placering

1. Positive flagantal, flest først.
2. Ukendt flagantal.
3. Kendt nul flag.

Ved lighed: flest datadomæner med ukendt dækning, derefter flest manglende eller
ugyldige dagsværdier over de fire viste uger, derefter atlet-id i fast
strengrækkefølge. Dette er en gennemgangsrækkefølge, ingen helbredsdiagnose.

Hvert atletkort viser id, antal flag/ukendt og ugegrundlagets tilstand øverst.
Den aktuelle uges datointerval, eventuelt antal forløbne dage samt Træningslog,
Kost, Vægt og Dagsform vises direkte med registrerede dage og værdigrundlag.
Fejl og ukendt dækning vises direkte. De tre tidligere uger er foldet under
"Tidligere tre ugers datagrundlag". Der er ingen rå observationer på holdkortet.
Visningen er én kolonne med tekstombrydning og native details/summary.

## Prøver

Alle `*.test.mjs` opdages af appens eksisterende `npm test` uden ændringer af
testkommandoen. `CoachTeam.test.mjs` importerer rigtig React og ReactDOM/server;
ingen shim eller automatisk skip. `overview.review.test.mjs` bruger et separat
bucket-orakel på 30 syntetiske hold. `fixtures.mjs` indeholder kun syntetiske
id'er og data. Lokal adapter i leverancens rod er særskilt beskrevet i ADAPTER.md
og erstatter ikke React-prøverne.
