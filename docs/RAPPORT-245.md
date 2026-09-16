# Rapport — ordre 245: den sidste blinde vinkel: det rigtige klik-igennem-flow i den automatiske suite

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `sporing-i-suiten`, forgrenet fra `main` (`21e1b2f`, ordrens egen base).
To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `1406217` | Den nye prøve mod et rigtigt klip, to rettede blinde vinkler i test-infrastrukturen, `npm run proever`-integration |
| 2 | (denne rapport, se hash i `git log` efter commit) | rapport |

Ordrens betingede "commit 2" (find grunden hvis prøven ikke er 5/5 stabil)
udgik: de to fund/rettelser beskrevet nedenfor blev fundet og rettet FØR
commit 1 blev lavet — arbejdstræet blev aldrig committet i en ustabil
tilstand, og den committede prøve var allerede 5/5 grøn.

Arbejdstræet er rent efter hver commit. Ingen produktions-Supabase, ingen
atletdata i filer eller rapport, ingen push. `public/videocoach.html` og
`src/` er urørt. Ingen ny afhængighed.

## Hvad ændret

234's rapport til Marc pegede på ÉN kendt blind vinkel tilbage: selve
stangbane-sporingens rigtige klik-igennem-flow (⚡ → klik skiven → ⚡ igen →
📨 send) har ikke stået i den automatiske suite siden ordre 200 (målt
upålidelig, <10/10, på et rigtigt klip). 221/225 viste at selve TRACKINGEN
kan fuldføre på et rigtigt klip (`marc-doedloeft-270.mov`, ~21-30s), men
225 bekræftede kun trackerens INTERNE tilstand (`window.__vcTrackerBenchmarkLast`)
— aldrig den fulde UI-strøm bagefter (arket åbne, send til coach). Denne
ordre byggede en ny prøve (`e2e/coach-sporing-rigtigt-klip.mjs`, genbruger
`runVideoUpload`/`runCoachSporing` og samme hånd-målte klikpunkt/klip som
`coach-sporing-trace-real.mjs` — ingen ny generator, intet nyt klip) der
udfører DET FULDE flow mod `test-clips/marc-doedloeft-270.mov` og venter på
det faktiske udfald, ikke en banner-gætning. De første forsøg (live, ikke
kun læst) afslørede to reelle huller i den DELTE test-infrastruktur — aldrig
i selve trackeren:

Første fund: `confirmAndWaitForTracking` (`e2e/coach-sporing.spec.mjs`)
genkendte kun to bannerudfald ("Klip + loop", "Ingen tydelig") plus den
stille `#sheet.open`-vej (225's egen rettelse) — men IKKE 225 · commit 2's
tredje, ærlige udfald: banneret "Stangen blev tabt ved rep X...". Ramte en
kørsel dette udfald, ville funktionen have pollet i tavshed til
`maxIterations` og fejlrapporteret et falsk "aldrig færdig" — nøjagtig
samme klasse blind vinkel 225 allerede rettede for `#sheet.open`, bare for
det tredje udfald. Rettet i `confirmAndWaitForTracking`: banneret genkendes
nu som et terminalt (men negativt) udfald i stedet for at blive ignoreret.

Andet fund, DIREKTE observeret live: selv efter første rettelse fejlede
hver eneste kørsel konsekvent efter ~60s med et ægte Playwright-timeout på
et klik på `#moreBtn` ("subtree intercepts pointer events" fra
`<div id="sheet" class="open">`). `runCoachSporing` klikker altid
`#moreBtn`→`#aiBtn` for at åbne analyse-arket — en antagelse der holder for
det syntetiske klip (tager altid `applySessionView`-banner-vejen), men IKKE
for et rigtigt klip der (som `marc-doedloeft-270.mov`, bekræftet i 225) tager
den stille `openSheetFn()`-vej: arket er allerede åbent, og det blinde klik
rammer i stedet det åbne arkets egen overlay. Dette er den faktiske grund
til at "det rigtige klik-igennem-flow" aldrig har været afprøvet HELT
igennem før — 225 stoppede ved trackerens interne tilstand. Rettet i
`runCoachSporing`: springer de to klik over når arket allerede er åbent
(fanget via `viaSheet` fra `confirmAndWaitForTracking`, eller en direkte
optælling af `#sheet.open`).

Efter begge rettelser: 5/5 kørsler grønne, 29,6-29,9s (0,3s spredning, se
Testresultat). Loftet sat til 60s (30×2s) — >2x margin til den langsomste
målte kørsel, strammere end `runCoachSporing`s egen 120s-standard (sat for
det mere variable syntetiske klip). Gået ind i `npm run proever` som fuld
prøve (fjerde e2e-trin, efter `run-all.mjs`), sprunget ærligt over
("SPRUNGET OVER", ikke fejl) hvis `test-clips/marc-doedloeft-270.mov`
mangler lokalt eller port 8991 er optaget — samme mønster `proever.mjs`
allerede bruger for `npm run e2e` selv.

## Testresultat

- **`npm run lint`:** rent.
- **Den nye prøve, 5 kørsler i træk** (`node e2e/coach-sporing-rigtigt-klip.mjs --gentag=5`, efter begge rettelser, med det endelige 60s-loft):

  | # | Resultat | Varighed | Udfald |
  |---|---|---|---|
  | 1 | GRØN | 29,7s | arket åbnede med resultat, sendt (cm_per_px=0,563) |
  | 2 | GRØN | 29,7s | arket åbnede med resultat, sendt (cm_per_px=0,563) |
  | 3 | GRØN | 29,9s | arket åbnede med resultat, sendt (cm_per_px=0,563) |
  | 4 | GRØN | 29,6s | arket åbnede med resultat, sendt (cm_per_px=0,563) |
  | 5 | GRØN | 29,8s | arket åbnede med resultat, sendt (cm_per_px=0,563) |

  **5/5 grønne.**
- **`npm run proever`** (kørt efter integration i `scripts/proever.mjs`):
  **58/58 grønne, 0 fejl, 0 sprunget over** — inklusive den nye prøve
  (30,4s, `e2e (coach-sporing-rigtigt-klip.mjs)`-rækken).
- **`git status --short`:** rent efter commit 1.

## Hvad er næste

1. Kun ÉT rigtigt klip er dækket (`marc-doedloeft-270.mov`). Det andet
   lokale rigtige klip (`vis-mig-nu-4-reps-realistisk.mp4`, kendt fra 225
   for en reel, lang tabsepisode) er ikke tilføjet som en ekstra prøve —
   ordren pegede specifikt på "det rigtige klik-igennem-flow", ental, og
   ingen ordre bad om at udvide til flere klip.
2. "Stangen blev tabt"-genkendelsen (første rettelse) er stadig ALDRIG set
   i praksis i nogen kørsel her (klippet finder altid et brugbart rep, som
   i 225) — kun kodemæssigt ræsonneret, samme ærlige grænse 225 selv
   navngav for den samme besked.
3. `npm run proever` tager nu ca. 30s længere pr. kørsel pga. denne nye
   prøve — en bevidst pris ordren selv beder om ("går den ind i npm run
   proever som fuld prøve").

**Tre linjer til Marc:** "alt grønt" dækker nu ALT det 234 efterlod som
sidste kendte blinde vinkel: selve stangbane-sporingens FULDE klik-igennem-
flow (upload, klik, sporing, send) er nu en prøve i `npm run proever`, kørt
mod et rigtigt klip, 5/5 stabil (29,6-29,9s). Det var aldrig trackeren der
har været upålidelig siden ordre 200 — det var to blinde vinkler i selve
test-koden (en manglende bannergenkendelse, og et blindt klik der ramte et
allerede-åbent ark), begge fundet LIVE og rettet i prøven, ingen ændring i
`public/videocoach.html`.

## Ærlige grænser

- Kun ÉT rigtigt klip afprøvet 5x (`marc-doedloeft-270.mov`) — ikke en bred
  stikprøve af forskellige løft/kameravinkler/lysforhold. "5/5 stabil"
  gælder for DETTE klip, ikke stangbane-sporing generelt.
- Alle 10 grønne kørsler (5 før det endelige loft blev sat + 5 efter) landede
  på den SAMME vej: den stille `openSheetFn`/`viaSheet`-fuldførelse med et
  brugbart rep fundet ved ~21-30s tracking. Den anden, banner-baserede vej
  (`applySessionView`, "Klip + loop om sættet") og "Stangen blev
  tabt"-vejen er begge kun bekræftet på det syntetiske klip hhv. kun
  kodemæssigt — ingen af dem er observeret levende på et rigtigt klip i
  denne ordre.
- 60s-loftet er sat fra 5 datapunkter på én maskine, samme session — ikke en
  bred, tidsspredt stikprøve. En fremtidig, langsommere/mere belastet
  maskine kunne i princippet ramme loftet uden at det er et reelt hæng
  (samme klasse usikkerhed 225 selv navngav for sit eget 10s-loft).
- Én transient, urelateret fejl blev set ÉN gang under selve udviklingen af
  denne prøve (`video_analyses mangler en awaiting_analysis-række efter
  upload`, 1,7s — før flowet overhovedet nåede sporingen), da to separate
  `node`-processer blev startet med under et sekunds mellemrum og delte
  samme faste mock-/vite-port. Ikke reproduceret i nogen af de 10
  committede, grønne kørsler (som hver kører i eget `--gentag`-loop med
  fuld oprydning — luk browser, stop vite, luk mock — FØR næste kørsel
  starter). Selve prøven, som den er skrevet og committet, har derfor ikke
  denne race — men to helt separate, samtidige `npm run proever`-kørsler på
  samme maskine (fx to arbejdstræer) kunne stadig kollidere om port 8991,
  samme kendte grænse `npm run e2e` selv har haft siden før denne ordre.
- `#moreBtn`-fejlen (anden rettelse) er bevist ved at den FAKTISK opstod
  (et ægte 59,2s Playwright-timeout, fuld fejltekst gemt i arbejdet bag
  denne rapport) — ikke kun ræsonneret. Rettelsen er dog kun afprøvet mod
  DETTE klips `viaSheet`-vej; den er ikke afprøvet mod en kørsel hvor
  `#sheet.open` bliver sandt AD EN ANDEN vej end `openSheetFn` (ingen kendt
  sådan vej findes i koden i dag, men det er ikke udtømmende udelukket).
