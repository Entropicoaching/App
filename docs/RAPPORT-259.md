# Rapport — ordre 259: atleten ser sin egen volumen pr. muskelgruppe

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `atletens-volumen`, forgrenet fra `main` (`b1c3815`, `950fd8d`-merget
fra ordre 256 bekræftet inde). Tre commits (denne rapport er den tredje).
Arbejdstræet er rent. Ingen migration, ingen RLS-ændring, ingen nye
tabeller, ingen ny afhængighed, ingen push, ingen atletdata i denne
rapport.

## Hvad ændret

Ny lazy-loadet fane "Volumen" i atletvisningen (`src/athlete/VolumenTab.jsx`,
samme `LazyBoundary`-mønster som ordre 232's øvrige faner), tilføjet i
`AthleteView.jsx`s `NAV_ITEMS` mellem "Program" og "Kost". Fanen viser
atletens egne gennemførte sæt pr. muskelgruppe, med samme regnestykke
(`src/volume/beregn.js`) og samme muskelkort (`src/volume/muskelkort.js`)
som coachens kort (`src/dashboard/VolumenKort.jsx`, ordre 177/185/210).
Commit 1: "denne uge" som en simpel tabel (gruppe → direkte/i alt), med
linjen "Beregnet ud fra standard-øvelseskort". Commit 2: en knap skifter
visningen til "seneste 4 uger", genbruger coachens egen søjle-graf
(`src/dashboard/VolumenGraf.jsx`) uændret — den tager kun `{uger, grupper}`
og har ingen coach-specifik afhængighed. `AthleteView.jsx` fik et nyt
`volumeLogs`/`volumeLoading`-state og en `fetchVolumeLogs`-funktion (samme
`exercise_logs`-kilde som coachens `fetchAthleteLogs`, men begrænset til
~5 uger — nok til 4-ugers-vinduet plus margin, uden coachens fulde
2000-sæt-historik), udløst når fanen åbnes (samme udløsermønster som
"Beskeder"/"Stævnedag"). Marcs egne kortlægningsrettelser
(`exercise_muscle_overrides`) læses ALDRIG her — `slaaOevelseOp` kaldes
uden et `rettelser`-argument, hvilket automatisk falder tilbage til
BASIS-kortet (indbygget + genereret), ingen særlig kode krævet for at
opnå det.

## Testresultat

- **`npm run lint`:** rent.
- **`npm run proever`:** 58/58 grønne (0 fejl, 0 sprunget over), inkl. den
  udvidede e2e nedenfor.
- **E2e (`e2e/atlet.spec.mjs`, commit 3):** den eksisterende atlet-rejse
  udvidet med ét trin efter de tre loggede Squat-sæt: åbn "Volumen"-fanen,
  vent på teksten "Knæ-strækkere" (Squats primære gruppe i muskelkort.js),
  og assert at rækken viser "3/3" (direkte/i alt af de tre gennemførte
  sæt) — en ægte assertion mod et beregnet tal, ikke kun at teksten findes.
  Kørt alene (`npm run e2e:atlet`) og som del af den fulde suite: begge
  grønne.
- Build (`npm run build`) verificeret undervejs i begge kodecommits:
  `VolumenTab` lander som sin egen chunk (2,3 kB efter commit 1, 3,7 kB
  efter commit 2 med grafen), ingen advarsler.

## Hvad er næste

1. Coachens egne kortlægningsrettelser tæller endnu ikke med i atletens
   tal — kræver enten en RLS-politik der lader atleten læse
   `exercise_muscle_overrides` (Marcs eget ja, uden for denne ordre) eller
   en anden vej til at dele dem sikkert.
2. Ikke afprøvet mod produktion (samme stående grænse som 131/210/228/248/
   256) — kun mod den lokale mock/e2e og `npm run dev`.
3. For Hara: atleten har nu selv adgang til et volumen-overblik der før
   kun var coachens — det lukker den kløft ordre 209 fandt, og er noget
   atleten ser i sin almindelige uge uden at Marc skal pege på det.

**Tre linjer til Marc:** Atleten kan nu åbne "Volumen" og se sine egne
gennemførte sæt pr. muskelgruppe, enten for denne uge eller som en
4-ugers-trend — samme tal og samme farver som dit eget kort. Det eneste
der mangler for at dine egne øvelses-rettelser også tæller med i atletens
tal, er en RLS-politik der giver atleten læseadgang til dem.

## Ærlige grænser

- Kun BASIS-muskelkortet bruges — en øvelse Marc selv har rettet
  (`exercise_muscle_overrides`) vises IKKE korrigeret for atleten, kun for
  coachen. Fladen siger det ("Beregnet ud fra standard-øvelseskort"), men
  det er stadig en reel forskel mellem de to visninger af samme tal.
- "Seneste 4 uger" er atletens EGET vindue, ikke sammenlignet mod noget
  planlagt — ingen "planlagt mod gennemført"-graf her, det er bevidst
  uden for denne ordres omfang (kræver `weeks`, en coach-fane-funktion).
- E2e-assertionen dækker ét scenarie (Squat, "denne uge", ét
  muskelgruppetal) — 4-ugers-trenden og "ingen data endnu"-tilstanden er
  kun verificeret manuelt via build/lint, ikke af en e2e-assertion.
- Ikke afprøvet mod produktion, se "Hvad er næste".
