# TID-PR-FRAME: hvor går tiden i "Vis mig nu"?

Ordre 116 · commit 1. Målt med `npm run verify:videocoach-clip` på Marcs eget
klip (`test-clips\marc-doedloeft-270.mov`, ét vindue, 0,57s afspillet),
FØR nogen ændring. Ny instrumentering i `vcRealtimeTrackWindow`
(`public/videocoach.html`, `vcRtDiag`) tidsmåler pr. frame; samme tal vises
nu i den eksisterende `?diag=1`-linje i den rigtige app.

## Tal (tre kørsler, samme klip — maskinen har støj, se nedenfor)

| Kørsel | tid/afspillet | hent | nedskaler | søg | filter (total) | ms/frame |
|---|---|---|---|---|---|---|
| 1 | 1,23x | 1,5ms | 13,3ms | 21,0ms | 0,4ms | 43,6ms |
| 2 | 1,27x | 2,1ms | 17,1ms | 21,7ms | 0,6ms | 51,3ms |
| 3 | 1,29x | 2,1ms | 15,0ms | 24,7ms | 0,4ms | 52,3ms |

**"tegn" (den synlige `render()`-tegning) er altid 0ms her** — headless
Chromium i `verify-videocoach-clip.mjs` udtrækker kun selve tracker-koden
(ORDRE 80-markørerne), ikke app'ens rAF-løkke. Kun målbar i browseren med
`?diag=1`.

## Hvad dominerer

**Søgning** (`mpMatchPoint`-løkken + gen-find af features) er størst i alle
tre kørsler: 21-25ms/frame, ca. halvdelen af den målte tid. **Nedskalering**
(`drawImage` til det lille canvas) er nummer to: 13-17ms/frame. Tilsammen
34-42ms af 44-52ms målt — resten (6-8ms) er ikke fanget af de fire
buckets (rVFC-planlægning mellem frames, gæld-bogføring) og er derfor IKKE
noget en enkelt ændring kan fjerne.

Commit 2 angriber derfor **søgning og nedskalering**, i den rækkefølge.
"hent" (getImageData/mpBuildFrame, ~2ms) og "filter" (one-euro, <1ms — kun
kørt én gang pr. vindue, ikke pr. frame) er for små til at være målet.

## Note om støj

Kørsel-til-kørsel-variansen (1,23x-1,29x) er denne maskines egen baggrunds-
belastning under selve målingen, ikke en ændring i koden — alle tre kørsler
er PRÆCIS samme commit. Se det som et interval, ikke ét facit-tal.
