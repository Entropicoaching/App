# VIDEOCOACH-ENTROPI-TRACK-UX-001

Status: **5/5 PASS** på lokal kandidat direkte efter `6692edca4920de42217a6cd0278567d38f447f78`.
Marcs commitlåste kliptest er en separat HUMAN-GATE; denne rapport er ikke en produktionsgodkendelse.

## Acceptmatrix

| Krav | Resultat | Evidens |
|---|---|---|
| TRACK-BOTTOM-01 | **PASS** | Den syntetiske seam-rig reproducerer 6,4 px råt koordinatdrop og reducerer det til 0,3 px. Browser-A/B med samme genererede WebM, samme manuelle afgrænsning og en realistisk forskudt startmarkering målte sent bundudsving `4,3 → 1,6 px`. Råt og kalibreret recovery-center har adskilt state; den mindst hoppende observation skal stadig gennem eksisterende `maxJump`. Ingen trackingtærskel eller home-position er tilføjet. |
| TRACK-PRESERVE-02 | **PASS** | Kandidaten gemte 114 alignede og immutable `raw pts/times/valid/confidence` over 4,9 sekunder. Hele returen nåede tilbage til bunden; top var mindst lige så god (`156,6 → 154,1 px`, lavere er højere på canvas). Deadlift havde `setup`, `concentric`, `lockout`, `return`; valide velocity/ROM/tempo blev bevaret. Squat- og bench-kontroller beholdt særskilte liftfaser uden raw-mutation. |
| ENTROPI-SYSTEM-03 | **PASS** | `public/videocoach.html` har én fælles Entropi-shell med samme tokens, typografi, spacing, kontrolhøjde, statusord og hierarki på tværs af video, liftvalg, tracking, Bane og eksport. Det tidligere fritstående review-HUD er integreret i systemets arbejdsdock. Ingen Metric-branding, pixelkopi eller valideringspåstand. |
| ENTROPI-UX-04 | **PASS** | Video/full path er centrum. Video/Bane/Eksport, rep-selector, scrub, faser/retning, overlayvalg og kun signalvalide metrics er samlet i samme flow. Tabskift bevarer playback-position; Tilbage fra eksport lander i Bane. Eksport lukker andre sheets først, så modal stacks undgås. Touch-targets er mindst 36 px i gate og de primære systemhandlinger 44 px. |
| BROWSER-ACCEPT-05 | **PASS** | Cachefri localhost-A/B mod `6692edc` gennem reel ATHLETE-mode, genereret upload og synlig liftvælger: baseline 120 frames/14 invalid, kandidat 114/11. Fuld raw bane, retur, top, lockout/concentric, Bane- og eksportflow blev gennemført ved 390 og 1440 px uden horisontalt overflow, konsolfejl eller debug-krom. |

## Trackingkontrakt

Lost recovery har to uafhængige tilstande: `homeCorrectionPending` er en centerfejl i
delta-domænet, mens `recoveryPending` er et absolut center. Ved et stærkt recovery-fund
bevares både den rå detectorobservation og samme observation korrigeret med den allerede
målte home-bias. Den med mindst afstand til sidste sikre `cur` går videre; fem features
og den eksisterende `recoveryJump <= maxJump` er fortsat obligatoriske. Afvisning
gemmer sidste sikre koordinat med `valid=false` og `confidence=0`.

Acquisition fryses før interpretation. Faseanalyse, review, rendering og eksport læser
hele raw-forløbet og må ikke slice eller mutere det. Manuel korrektion er fortsat en
eksplicit efterfølgende handling.

## Lokal gate

```powershell
node docs/videocoach/run-entropi-track-ux-gate.mjs
```

Runneren kalder seam-riggen og den browsernære clean-rebuild-gate med base `6692edc`,
bund-recovery-fixtur og Entropi-UX-accept aktiveret. Den bruger kun genereret video;
ingen atletdata, klip eller produktionsforbindelser indgår.

Der er ikke pushet, merget, deployet eller skrevet til database/produktion.
