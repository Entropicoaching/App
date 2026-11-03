# Samlet signalliste

`buildAthleteSignalList({ athleteId, enabled, outputs })` returnerer én prioriteret
liste for den valgte atlet. Modellen er ren og kræver `enabled === true`. Standard
og OFF giver `[]` uden at læse outputs. Ingen skærme eller eksisterende flag ændres.

Hver kommende byggesten leverer `SignalOutput` som dokumenteret i
`athleteSignals.mjs`: `{ athleteId, source, signals }`. Mapping:

| Byggesten | source |
| --- | --- |
| TRACK-BELASTNING1 | belastning |
| TRACK-STYRKETREND1 | styrke |
| TRACK-KOSTTREND1 | kost |
| TRACK-VAEGT1 | vaegt |

`athleteId` er `athletes.id`. Adapteren skal selv sikre coachens adgang og kun
levere sammenfatninger af atletens egne indtastninger. Modellen er ikke en
adgangskontrol og skal ikke have rå journaler eller privat cyklusdata.

En kandidat indeholder `key`, `subject`, `strength`, `reason` og `dataBasis`.
Styrken er præcis `info`, `obs` eller `vigtig`. `key` er en fælles semantisk kode,
fx `recovery.review`; `subject` er et stabilt emne, fx `weekly` eller et øvelses-id.
Modsatrettede fund skal have forskellige keys, fx `weight.up` og `weight.down`.
Begge identitetsfelter er ikke-tomme strenge uden ydre whitespace.

Datagrundlaget kræver `sufficient: true`, positive heltal `sampleCount` og
`minimumSampleCount`, gyldige inklusive ISO-dage `from <= to` og en ikke-tom
`summary`, der beskriver målingerne og deres enheder. Kilden bestemmer minimum og
datakvalitet for sin metode; modellen kræver også count >= minimum. Fravær, for få
data, ukendt styrke og ugyldige kandidater giver intet signal. Ugyldige kandidater
hindrer ikke andre gyldige fund. Modellen beregner ingen trænings- eller sundheds-
tærskler. Kilderne vælger det relevante tidsvindue før kaldet; modellen afgør ikke
friskhed og har ikke et implicit ur.

Dubletter har samme `(key, subject)` for samme atlet, også på tværs af kilder.
Stærkeste styrke vinder, unikke begrundelser beholdes, og datagrundlag bevares med
kilde og periode. Observationstal lægges aldrig sammen: perioder kan overlappe.
Forskellige perioder for samme emne giver én sag med flere datagrundlag. Kun de
dokumenterede felter kopieres. Resultatet deler ingen objekter med input.

Sortering: vigtig, obs, info; derefter key og subject i stabil kodeenhedsorden.
Begrundelser og datagrundlag sorteres også stabilt. Kilder vises i rækkefølgen i
tabellen. Ingen IO, lagring, netværk, importerede datakilder eller sideeffekter.

Prøver: kør alle `*.test.mjs` i denne mappe med Nodes indbyggede test runner.
Prøverne importerer den faktiske model og bruger kun syntetiske data.
