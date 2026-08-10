# VIDEOCOACH-CLEAN-REBUILD-001

Status: **GRØN lokal kandidat**. Base er eksakt live `8b80f75b1f572ca7040baff0e76a0d19c7f5e035`.
Marcs eget klip er fortsat en **separat HUMAN-GATE**, commitlåst til kandidaten; denne rapport er
ikke en produktions-, deploy- eller valideringspåstand.

## Dom

Clean rebuild etablerer én analysesession før tracking. Acquisition gemmer hele
den manuelt afgrænsede video som immutable `raw pts/times/confidence/validity`.
Rep-, fase- og liftfortolkning er afledt bagefter og må ikke slice eller mutere
raw. Review, rendering, scrub/playback og eksport bruger samme fulde raw start og
slut. Lockout afslutter fortsat deadlifts koncentriske metrics, mens pause og fuld
retur til gulvet forbliver synlige.

Recovery er fail-closed gennem den eksisterende normale jump-validitet. To stærke
home-fund og recoverable features kan derfor ikke gøre et outputJump over maxJump
gyldigt. En recovery inden for grænsen virker fortsat. Invalid/unknown frames
bevarer sidste sikre koordinat internt, men tegnes ikke som et aktuelt gyldigt
punkt. Manuel korrektion opretter en eksplicit ny revision med
`manualCorrections`; den muterer ikke den frosne forgænger bagud.

## Metric som UX-nordstjerne

[Metrics officielle bar-path-guide](https://metric.coach/articles/the-complete-guide-to-bar-path-tracking-with-your-smartphone)
er kun read-only produkt-/UX-reference. Der er ingen pixelkopi, Metric-brand,
farvekrav eller påstand om samme validering.

Video er visuelt centrum med hel raw path ovenpå. Aktuelt rep er tydeligt i
fasefarver og med retning; ældre reps er nedtonet grå. En faselegende, rep selector
og den eksisterende scrub forbinder bane og tid. Kompakte velocity-, ROM- og
tempo-kort vises kun ved gyldigt signal. Exportpreview viser præcis den fulde
sekvens før lokal eksport. Normal ATHLETE/coach-visning har ingen debug-krom.

Liftfortolkningen er separat fra acquisition:

- Deadlift: setup, ascent/concentric, lockout og return.
- Squat: eccentric, transition, concentric og lockout.
- Bench: eccentric, pause, concentric og lockout; ned- og opkurven tegnes separat.

## Browsernær A/B-accept

`docs/videocoach/run-clean-rebuild-gate.mjs` serverer urørt `8b80f75` og kandidaten
fra hver sin friske localhost-origin. Den genererer én syntetisk WebM lokalt og
bruger **samme video**, samme synlige frame-scrub, samme manuelle start og samme
ATHLETE-upload/skiveflow. Ingen atletdata forlader maskinen.

| Kontrakt | Evidens | Resultat |
|---|---|---|
| Stabilitet mod live | Gentaget grøn A/B; seneste løb: live 123 frames / 2 invalid; kandidat 123 / 2 | PASS |
| Immutable full path | Raw pts, times, confidence og valid er alignet/frosset; 123 samples i seneste grønne løb | PASS |
| Ingen bundhop | Sidste gyldige return-output endte ved y=263,8, tæt på første gulvpunkt og over canvas-bund | PASS |
| Ingen auto-cut | Hele 4,9 s raw sekvens inkl. lockout-pause og fuld retur er i review/render/export | PASS |
| Faser og metrics | Separate deadlift-faser; gyldig velocity, ROM og tempo; squat/bench-kontrol separat | PASS |
| Rep-UX | Aktuelt rep fremhævet, ældre reps grå, rep selector + scrub + retning | PASS |
| Exportpreview | Fuld raw bane og faseoverlay vises før eksport | PASS |
| Mobil/desktop | 390 px og 1440 px uden horisontalt overflow | PASS |
| Browserkvalitet | Ingen konsolfejl og ingen synlig debug-krom | PASS |
| Eksisterende deadlift-rigs/bræktests | Home recovery, hurtig nedtur, full return/top-exit, probe og syntaks | GRØN |

Runneren printer de aktuelle testtal ved hver kørsel; tabellen ovenfor fastholder
det konkrete grønne reference-run, ikke en statisk forventning.

## Filscope og værn

- `public/videocoach.html`: session/raw/interpretation, recovery/manual correction,
  full-path review/render/export og Metric-inspireret Entropi-UX.
- `docs/videocoach/run-clean-rebuild-gate.mjs`: rigtig video/upload A/B og
  390/1440-browseraccept.
- `docs/videocoach/tracker-deadlift-rig.js`,
  `braek-deadlift-rig.mjs`, `tracker-deadlift-top-exit-rig.mjs`: konflikterende
  gamle kontrakter erstattet af fail-closed/full-raw-kontrakten.

Ingen trackingthreshold, jump gate, dependency, tung model, database,
credential, atletdata, push, merge eller deploy er tilføjet. Kostecky
er alene arkitekturinspiration; der er intet grøn-marker-krav.

## Gate

- `node docs/videocoach/run-deadlift-gate.mjs` — **GRØN**.
- `node docs/videocoach/run-clean-rebuild-gate.mjs` — **GRØN**.
- Commitlåst Hub-port køres først efter den ene lokale commit.

Samlet lokal dom: **PASS / GRØN**. Næste sandhedsbarriere er den separate
HUMAN-GATE på Marcs samme lokale klip.
