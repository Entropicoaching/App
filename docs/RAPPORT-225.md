# Rapport — Ordre 225: den hængende browser: rigtige klip skal fejle hurtigt, ikke hænge i minutter

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`fejl-hurtigt`, forgrenet fra `main` (`3eea22d`, ordre 221 merget). Tre
commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `be319b6` | plSearch-kald instrumenteret bag TRACKER_PROBE — ingen adfærdsændring |
| 2 | `356820a` | Ærligt loft ved tabt stang + rettelse af falsk-hæng i test-høsten |
| 3 | `1fdcd1f` | Fravalgt: billigere genfinding — tallene bærer ikke premissen |

Arbejdstræet er rent efter hver commit. Ingen push. Ingen produktions-
Supabase. Ingen video committet. Ingen atletdata i denne rapport (kun
tidspunkter, millisekunder og pixel-tal — ingen navne, ingen billeder).

## Hvad ændret

**Commit 1 — plSearch-kaldene, målt.** `plSearch` (i
`public/videocoach.html`) fik instrumentering bag den eksisterende
TRACKER_PROBE-guard: antal kald, tid pr. kald, gitterstørrelse (antal
`plEvidence`-evalueringer) og tomme fund, tagget pr. kaldested
(`calibration-local`, `calibration-home`, `quick-audit`, `home-confirm`,
`home-recovery`) og eksponeret LIVE på `window.__vcPlSearchProbeLog` (samme
array-reference hele kørslen), så en Node-side måling kan læse tallene selv
når selve sporings-loopet aldrig publicerer et fuldt benchmark-run.
`e2e/coach-sporing-trace-real.mjs` fik `--max-minutes` og `--only` samt en
pr.-sekund/pr.-tag opsummering af de samme tal. Samme betingelser, samme
rækkefølge i selve søge-/accept-logikken — kun mærket og talt.

**Fund: FRAVALGT-221s hypotese er FORKERT.** Kørt mod
`marc-doedloeft-270.mov` (klippet der "sidder fast ved 96%" i RAPPORT-221):
kun 8-9 `plSearch`-kald i alt over hele kørslen (2 kalibrering, 6-7
hjemme-genfinding), 460-500ms samlet, 53-58ms/kald i snit, gitter på
~618 punkter/kald, ALDRIG et tomt fund. Genfindingen er billig, ikke dyr —
det modsatte af hvad FRAVALGT-221 gættede på ("en dyr, gentaget
`plSearch`-baseret genfindings-sti ... uden øvre grænse for forsøg").

**Commit 2 — hvor tiden RENT FAKTISK gik, og hvad der viste sig at være det
egentlige problem.** Da commit 1's tal modsagde FRAVALGT-221s hypotese,
blev den ægte sporings-løkke (`startMultipointTracking`) sporet direkte:
`window.__vcTrackerBenchmarkLast` viste sig at blive publiceret med
`outcome:'completed'` for `marc-doedloeft-270.mov` efter blot **~21
sekunder** ægte tid — IKKE et hæng. Den mistede stangen ved t=3,58s (klippet
er 3,85s langt) og fandt den aldrig igen inden klippets egen slutning, men
selve sporings-LØKKEN afsluttede normalt, fandt ét brugbart (delvist) rep,
og `runFullAnalysis` åbnede analyse-arket via `openSheetFn()` — en helt
anden, STILLE fuldførelsesvej end den `applySessionView` bruger.

**Rodårsagen til "aldrig færdig inden for 15 minutter" i RAPPORT-221 var en
fejlmåling i selve test-høsten, ikke et hæng i appen.**
`e2e/coach-sporing.spec.mjs`s `confirmAndWaitForTracking` genkendte kun to
banner-tekster som "færdig" ("Klip + loop om sættet", sat af
`applySessionView`, kræver `sessionRun===true`; og "Ingen tydelig rep").
COACHWEB-testens eget klik-flow sætter aldrig `sessionRun`, så et rigtigt
klip der (som her) lander på et BRUGBART delvist rep tager i stedet
`openSheetFn()`-vejen — den sætter #sheet's 'open'-klasse, men INGEN
banner-tekst. `confirmAndWaitForTracking` blev derfor ved med at polle et
banner der aldrig kom, helt til dens egen (Node-side) grænse, og RAPPORTERED
et hæng der aldrig fandt sted i browseren. Rettet: funktionen genkender nu
også `#sheet.open` som fuldført.

**Et ægte loft blev tilføjet alligevel, som et reelt sikkerhedsnet** — ikke
fordi dette klip krævede det, men fordi det ANDET rigtige klip
(`vis-mig-nu-4-reps-realistisk.mp4`, 4 reps) VISTE en reel, lang
tabsepisode (t=8,2-11,3s, 90+ mislykkede genfindingsforsøg i træk) hvor
stangen aldrig blev fundet igen. Et `setInterval` (oprettet FØR
`requestVideoFrameCallback`-loopet starter — en engangs-`setTimeout` armeret
INDEFRA selve rVFC-kædens kaldsstak viste sig empirisk IKKE at fyre under en
reel tabsepisode, formentlig samme udsultningsmekanisme som rammer rVFC selv;
en almindelig `setInterval` sat op TIDLIGT fyrer derimod pålideligt) tjekker
hvert sekund om der er gået >10.000ms realtid siden sidste accepterede frame
(kun `deadliftMode`, samme betingelse som selve hjemme-genfindingen). Ved
10s: sporingen stoppes, `path.lostTimeoutAt`/`lostTimeoutRep` sættes, og
banneret viser "Stangen blev tabt ved rep X · klip fra Ys eller klik stangen
igen" — men KUN når intet rep i forvejen var brugbart (`runFullAnalysis`s
`!tracked||!usableRep`-gren); findes et brugbart delvist rep, vinder det
rigtige resultat, hvilket er den rigtige prioritering for en coach. 10s er
valgt ud fra commit 1's egne tal: >170x den gennemsnitlige kaldstid (57ms)
og langt over selv den længste observerede sammenhængende
genfindings-serie (113 kald / 6,1s) — rigelig margin til at en LEGITIM
genfinding kan nå at lykkes (verificeret: fire tidligere, kortere
tabsepisoder på det samme 4-reps-klip nåede alle at genfinde sig selv INDEN
loftet), men lavt nok til at en reelt fastlåst episode stoppes inden for
sekunder, ikke minutter.

**Verificeret LIVE på begge rigtige klip efter rettelsen:** begge
`Sporet igennem: true` — ingen af dem "hænger" længere i test-høsten,
fordi ingen af dem RENT FAKTISK hænger i browseren. Sporingen op til et
evt. tab er uændret byte for byte; kun tilføjelser bag måling.

**Commit 3 — fravalgt.** Se `docs/FRAVALGT-225.md`: ordrens betingelse for
en billigere genfinding ("hvis gitteret er dyrt") holder ikke — commit 1's
tal viser det modsatte. Ingen ændring af `plSearch`s gitterstørrelse eller
kaldsfrekvens.

## Testresultat

- **`npm run lint`:** rent.
- **Alle 34 `verify:*`-scripts:** grønne (kun exit-koder tjekket — Danske
  ord som "fejl"/"failures" optræder i mange scripts' egen, korrekte
  beskrivelse af hvad de tester).
- **`npm run e2e`:** grøn (26,7s — port 8991 var fri).
- **Synthetic-klip-regression (standard + `--glat`):** identiske tal med
  RAPPORT-221 (599 frames, 0 ugyldige, 5/5 reps på `--glat`; 599 frames, 299
  ugyldige, 0/5 reps på standard) — ingen ændring i tracker-adfærd.
- **Begge rigtige klip (`marc-doedloeft-270.mov`,
  `vis-mig-nu-4-reps-realistisk.mp4`) kørt LIVE mod den rettede test-høst:**
  begge `tracked: true`. Første klip: `outcome:'completed'` på ~21s (ingen
  loft nødvendigt). Andet klip: `outcome:'lost_budget_exceeded'` — loftet
  greb korrekt ind på en reel, lang tabsepisode, mens fire tidligere,
  kortere tabsepisoder på samme klip fik lov at genfinde sig selv.
- **`git status --short`:** tomt efter alle tre commits.

## Hvad er næste

1. RAPPORT-221's "højeste prioritet"-fund (rigtige klip hænger i minutter)
   var en fejlmåling, ikke en app-fejl — det bør rettes i den fælles
   forståelse af hvor haster status er. Se Duta/Hara-linjen nedenfor.
2. Beskeden "Stangen blev tabt ved rep X..." er kun verificeret KODEMÆSSIGT
   korrekt, ikke set i praksis på et rigtigt klip (se `docs/FRAVALGT-225.md`)
   — begge testklip fandt altid et brugbart delvist rep først. En fremtidig
   ordre kunne konstruere/finde et klip der taber stangen FØR første
   brugbare rep, for at se beskeden i den faktiske flade.
3. `runFullAnalysis`s stille `openSheetFn()`-vej (ingen banner-tekst ved
   fuldførelse, når `sessionRun` er false) er ikke i sig selv en fejl — en
   coach ser stadig analyse-arket åbne — men er værd at kende til for
   fremtidige test-høster: en manglende banner-tekst betyder ikke
   nødvendigvis at appen hænger.
4. Har betydning for Hara (Coaching-planeten, "Appen mærkbart bedre"): dette
   ÆNDRER RAPPORT-221's konklusion. Det er IKKE sandt at "en coach der
   analyserer en ægte atlets dødløft kan opleve browseren hænge i
   adskillige minutter uden feedback" — det tog test-HØSTEN minutter at
   INDSE at appen var færdig, ikke appen selv minutter at blive færdig.
   Ægte, prioriteret risiko: en coach kunne miste feedback HELT hvis stangen
   tabes tidligt i et sæt uden noget brugbart rep bagefter (punkt 2 ovenfor,
   ikke verificeret i praksis), men det er en anden, mindre hastende
   kategori end et flerminutters browser-hæng.

**Tre linjer til Marc:** når et klip taber stangen og INTET brugbart rep er
fundet, ser du nu (i stedet for et stille hæng) "Stangen blev tabt ved rep X
· klip fra Ys eller klik stangen igen" inden for højst 10 sekunder efter
tabet. Finder appen derimod ét brugbart rep FØR tabet (det almindelige
udfald på begge rigtige klip i denne ordre), åbner analyse-arket normalt —
du ser aldrig noget "hæng" i første omgang, for der var reelt aldrig ét.

## Ærlige grænser

- Commit 2's loft-besked ("Stangen blev tabt ved rep X...") er ALDRIG
  faktisk set på skærmen i denne ordre — begge testklip fandt et brugbart
  delvist rep først, så den rigtige branch i `runFullAnalysis` (der ville
  vise beskeden) blev aldrig taget. Kodestien er læst og ræsonneret
  igennem, ikke observeret levende.
- Loftets 10.000ms er valgt ud fra to datapunkter (samme klip-par som
  commit 1), ikke en bred stikprøve. Et tredje, endnu ikke set klip kunne i
  princippet have en legitim genfinding der tager længere end 10s.
- Hvorfor en engangs-`setTimeout` armeret indefra `requestVideoFrameCallback`
  -kæden ikke fyrer under en reel tabsepisode (mens en tidligt oprettet
  `setInterval` gør) er observeret empirisk (gentaget 3 gange, samme
  mønster), IKKE forklaret ned til Chromiums egen implementering.
- `runFullAnalysis`s `openSheetFn()`-sti (stille fuldførelse uden
  banner-tekst) er ikke ændret eller undersøgt for om REELLE coaches
  (uden for e2e-testens klik-simulering) nogensinde rammer den med
  `sessionRun===false` — kun at ÉN test-simulerings-klik-rækkefølge gør.
- Ordre 221 og alle tidligere rapporter der byggede på "rigtige klip hænger
  i minutter" (inkl. denne ordres egen "Hvorfor"-afsnit) er nu VIST forkerte
  for de to klip der findes lokalt — men ikke bekræftet for ALLE mulige
  rigtige klip; et klip med en anden fejltilstand (fx et helt andet sted
  sporingen sidder fast) er ikke udelukket.
