# Målinger — én tabel, ordre 201 til 233

Skrevet af Vaidya, ordre 239. Kun tal der allerede står i rapporterne
201-233 (og 226/228 som først lukkede metodefejl den serie selv fandt) —
ingen nye målinger lavet her. Se hver rapport for den fulde kontekst,
usikkerhed og "Ærlige grænser". Skærm-forkortelser: **AL** = Atletliste
(coach), **DP** = Dagens pas (atlet), **CI** = Check-in (atlet).

**Metodeskifte at kende før man læser tallene:** ordre 201 (og tidligere,
175→200) målte med Lighthouses SIMULEREDE throttling. Fra ordre 226 og
frem bruges `throttlingMethod: 'devtools'` (reel CDP-nedsættelse) — de to
metoder giver IKKE sammenlignelige absolutte tal (se ordre 226s fund: en
mekanisk bevist gevinst var usynlig under simulate, synlig under devtools).
Sammenlign kun tal inden for samme metode-blok.

## TTI pr. ordre, telefonprofil 390px

| Dato | Ordre | Metode | Skærm | TTI før | TTI efter | Ændring |
|---|---|---|---|---|---|---|
| 2026-09-14 | 201 | simulate | AL | 6005ms | 5994ms | −11ms (støj) |
| 2026-09-14 | 201 | simulate | DP | 6140ms | 6139ms | −1ms (støj) |
| 2026-09-14 | 201 | simulate | CI | 6136ms | 5991ms | −145ms (inden for støj) |
| 2026-09-15 | 226 (commit 1→3) | devtools | AL | 6437ms | 6175ms | −262ms |
| 2026-09-15 | 226 (commit 1→3) | devtools | DP | 6570ms | 6226ms | −344ms |
| 2026-09-15 | 226 (commit 1→3) | devtools | CI | 6546ms | 6246ms | −300ms |
| 2026-09-15 | 228 (commit 1, produktion) | devtools, mod app.entropicoaching.dk | Login/landing | 3426ms (lokalt ukomp.) | 2204ms (produktion) | −1222ms (komprimering) |
| 2026-09-15 | 228 (commit 2) | devtools | AL | 6175ms | 5675ms | −500ms |
| 2026-09-15 | 228 (commit 2) | devtools | DP/CI | uændret | uændret | ±34ms (støj) |
| 2026-09-15 | 228 (commit 3, ad hoc) | devtools, 1 løb | AL | — | 5682ms (TTI), scripts 4737ms=83% | — |
| 2026-09-15 | 228 (commit 3, ad hoc) | devtools, 1 løb | DP | — | 6236ms (TTI), scripts 4768ms=76% | — |
| 2026-09-15 | 231 (commit 2) | devtools | AL | 5673ms | 5653ms | −20ms (støj) |
| 2026-09-15 | 231 (commit 2) | devtools | DP | 6168ms | 6207ms | +39ms (støj) |
| 2026-09-15 | 231 (commit 2) | devtools | CI | 6166ms | 6233ms | +67ms (støj) |
| 2026-09-15 | 231 (commit 3, ad hoc) | devtools, 1 løb | AL | — | 5133ms (TTI), TBT 0ms, scripts 4811ms=94% | — |
| 2026-09-15 | 231 (commit 3, ad hoc) | devtools, 1 løb | DP | — | 6305ms (TTI), TBT 206ms, scripts 4794ms=76% | — |
| 2026-09-15 | 232 (commit 2) | devtools | AL | 5820ms | 5838ms | +18ms (støj) |
| 2026-09-15 | 232 (commit 2) | devtools | DP | 6385ms | 5987ms | −398ms |
| 2026-09-15 | 232 (commit 2) | devtools | CI | 6403ms | 5950ms | −453ms |
| 2026-09-15 | 232 (commit 3) | devtools | AL | 5838ms | 6025ms | +187ms (støj) |
| 2026-09-15 | 232 (commit 3) | devtools | DP | 5987ms | 5749ms | −636ms (−10,0 %) |
| 2026-09-15 | 232 (commit 3) | devtools | CI | 5950ms | 5743ms | −660ms (−10,3 %) |
| 2026-09-15 | 233 (commit 1→2) | devtools | AL | 7198ms | 7014ms | −184ms |
| 2026-09-15 | 233 (commit 1→2) | devtools | DP | 5803ms | 5751ms | −52ms (støj) |
| 2026-09-15 | 233 (commit 1→2) | devtools | CI | 5793ms | 5835ms | +42ms (støj) |

Ordre 233s absolutte AL-tal (7198/7014ms) er højere end 232s (5820-6025ms)
på samme skærm — begge er ægte målinger med samme metode/script, forskellen
er sessions-/host-støj mellem kørsler, ikke en regression (se ordre 233s
"Ærlige grænser": "de absolutte TTI-sekundtal i serien er ikke pålidelige
nok til selv at bruges som fra-til-tal på tværs af ordrer").

## Bundtstørrelse, rå/gzip

| Dato | Ordre | Del | Før | Efter |
|---|---|---|---|---|
| 2026-09-15 | 226 | Hovedbundt (`index.js`) | 424,88 kB / 120,99 kB (113 moduler) | 359,07 kB / 101,61 kB (96 moduler) |
| 2026-09-15 | 228 | Dashboard-chunk | 328,34 kB / 75,90 kB | 247,79 kB / 62,15 kB |
| 2026-09-15 | 228 | Ny: VolumenKort-chunk | — | 80,78 kB / 13,92 kB |
| 2026-09-15 | 232 (commit 2) | AthleteView-chunk | 251,10 kB / 59,45 kB | 178,64 kB / 43,03 kB |
| 2026-09-15 | 232 (commit 2) | Ny: MobiliseringTab | — | 60,55 kB / 14,67 kB |
| 2026-09-15 | 232 (commit 2) | Ny: StaevnedagTab | — | 14,41 kB / 3,53 kB |
| 2026-09-15 | 232 (commit 3) | AthleteView-chunk | 178,64 kB / 43,03 kB | 120,34 kB / 32,96 kB |
| 2026-09-15 | 232 (commit 3) | Ny: ProgramTab (athlete) | — | 32,32 kB / 8,37 kB |
| 2026-09-15 | 232 (commit 3) | Ny: KostTab | — | 24,00 kB / 5,35 kB |
| 2026-09-15 | 232 (commit 3) | Ny: BeskederTab | — | 6,32 kB / 2,05 kB |
| 2026-09-15 | 232 (commit 3) | Ny: CountdownRing | — | 1,35 kB / 0,65 kB |
| 2026-09-15 | 233 | `dist/index.html` (inline preload-script) | 1,10 kB | 2,77 kB |

AthleteView-chunken samlet, base (ordre 232 start) → efter commit 3:
**251,10 kB → 120,34 kB rå (−52 %), 59,45 kB → 32,96 kB gzip (−45 %)**.

## Serien i tre tal (til Marc, samlet 226-233)

Hovedbundt −16 % gzip (120,99→101,61 kB), Dashboard-chunk −25 % rå
(328,34→247,85 kB), AthleteView-chunk −51 % rå (251,10→120,34 kB) — tre
reelle, bekræftede skæringer i selve byte-vægten. Rækkefølgen
hovedbundt/skærmchunk er rettet (ordre 233), men båndbredde-deling, ikke
rækkefølge, er nu den bekræftede grænse — se `docs/OVERLEVERING.md`.

## Kendt skævhed i alle TTI-tal

Den lokale statiske testservers `startStaticServer()` sender ukomprimerede
bytes (ingen gzip/br) — gælder HELE serien siden ordre 123, ikke kun disse
rapporter. Ordre 228 bekræftede at produktionen rent faktisk serverer gzip
(~28,5 % af rå størrelse), så de absolutte TTI-tal ovenfor er sandsynligvis
mere pessimistiske end hvad produktion reelt viser. Før/efter-sammenligning
inden for SAMME ordre (samme skævhed på begge sider) er fortsat gyldig.
Kilde: `docs/VALG-226.md`, `docs/RAPPORT-228.md`.
