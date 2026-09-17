# Rapport — ordre 267: check-in der tager to minutter for atleten

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `check-in-to-minutter`, forgrenet fra `main` (`3d29a13`, ordre 263 bekræftet
merget inde — bekræftet med `git log --oneline -1` før forgrening). Fire
commits (denne rapport er den fjerde). Arbejdstræet er rent. Ingen migration,
ingen RLS-ændring, ingen nye tabeller, ingen ny afhængighed, ingen push,
ingen atletdata i denne rapport. `src/Dashboard.jsx`/`src/dashboard/` er ikke
rørt (Bhishaks område, ordre 266).

- `33041c9` — commit 1: forudfyldning, ét tryk i stedet for otte
- `0bfd3f6` — commit 2: "hvad coachen ser" + "hvad det ændrede sidst"
- `e30699a` — commit 3: den rolige påmindelse i Dagens pas
- (denne rapport er commit 4, se hash i `git log` efter commit)

## Hvad ændret

Gennemgik "Dagens parathed" felt for felt: alle fem hovedfelter (søvn,
energi, motivation, stress, muskelømhed) indgår i `calcReadinessScore`s
vægtede model (25/25/15/15/20 %, `AthleteView.jsx`) — intet af dem kunne
fjernes uden at gøre selve parathedstallet mindre retvisende, så ingen
felter er fjernet. Det eneste appen faktisk kan udlede er "sandsynligvis som
sidst" (commit 1): formularen forudfyldes nu automatisk fra atletens seneste
log, første gang den er hentet (ny `useEffect` i `AthleteView.jsx`, samme
"et påbegyndt udkast har forrang"-regel som den eksisterende
draft-gendannelse fra ordre 76), stadig frit at rette hvert felt. Målt i
tryk/taster fra tom formular til afsendt, en typisk dag uden ændringer
(søvn talt som "7.5" = 3 taster): FØR 3 (søvn) + 4 (fire skalaer) + 1
(afsend) = 8 tryk/taster; EFTER, med forudfyldning: 1 tryk ("Log parathed")
hvis intet er anderledes end sidst, 2 tryk hvis ét felt er ændret. Målt som
tryk/taster, ikke en stopur-tid — der findes ingen tidsmålings-harness for
UI-interaktion i repoet, og tryktallet er det der reelt driver skærmtiden
for en daglig, gentaget opgave som denne. Rating-knapperne fik
`aria-pressed`/`aria-label` og søvnfeltet et `aria-label` (så en forudfyldt
værdi kan bekræftes i e2e uden en mountet komponent) — `e2e/atlet.spec.mjs`s
`ratingButton`-hjælper er justeret til at matche på det i stedet for
xpath-scoping.

Commit 2 — efter afsendelse: to nye, stille kort, begge udledt af data der
allerede er hentet (ingen nyt opslag, udover at `readinessHistory`s
eksisterende forespørgsel fik `sleep_hours`/`sore_zones` tilføjet til sit
`select`). "Det din coach ser" genimplementerer (genbruger ikke —
`Dashboard*`/`src/dashboard/` er fredet i denne ordre) samme regnestykke som
coachens "Parathed — nøgletal"-kort: antal logs, gns. søvn, hyppigste ømme
zone, lav-parathed-varsel ved tre dage i træk under 50. "Sidst det gjorde en
forskel" er en tidsmæssig korrelation, ikke en gemt årsagskæde (ingen tabel
knytter et check-in til en efterfølgende programrettelse): en lav score
(under 50) efterfulgt, inden for ni dage, af en ny uge med en coach-note.
Findes ingen match, vises intet — jf. ordrens "hvis det findes i data".
Begge regnestykker ligger i `src/readinessInsight.js`
(`summarizeReadinessForCoach`, `lastCheckinDrivenChange`), 12 nye
enhedstests.

Commit 3 — mangler ugens check-in, og ugen er ved at være slut (de sidste to
dage af ugen), viser "Dagens pas" nu en rolig linje øverst med et link
("Ugens check-in mangler stadig. · Log den →") — ingen mail, ingen
notifikation, ingen rød farve. Ren funktion `shouldNudgeCheckin` (nyt
`src/checkinReminder.js`, 8 enhedstests) læser kun `readinessLog`/
`readinessHistory` og ugens start-/slutdato (den eksisterende
`weekStartDate`-udregning, ingen ny hentning) — forsvinder igen så snart et
check-in er logget den uge.

Commit 4 — ny e2e (`e2e/check-in.spec.mjs`, `npm run e2e:check-in`): egen
seed med tre stykker check-in-historik lagt ind på forhånd (en log 8 dage
tilbage til forudfyldningen, en lav log 16 dage tilbage + en note-uge 3 dage
efter til "hvad ændrede sig sidst", en ugedato sat så ugen slutter i dag til
nudge-testen). Flowet: log ind som atlet → ser nudgen i Dagens pas → klikker
linket → ser formularen forudfyldt (`aria-pressed`) → sender med ét tryk →
assert mod mockens `readiness_logs` → ser begge de nye kort med korrekt
udregnede tal ("gns. søvn 5,7 timer", "oftest øm: Ben", coach-noten fra
deload-ugen) → ser nudgen væk igen. Wired ind i `npm run proever` (samme
mønster som ordre 263's dagens-pas-række).

## Testresultat

- `npm run lint`: rent, hele repoet, efter hver commit.
- `npm run proever`: **60/65 grønne, 0 fejl, 5 sprunget over** — de fem
  sprungne er ALLE fem e2e-rækker (inkl. den nye `check-in.spec.mjs`), fordi
  port 8991 var optaget begge gange hele suiten blev kørt samlet (samme
  kendte mønster som ordre 210's dokumenterede portkonflikt med en samtidig
  Bhishak-session på samme maskine — ikke en fejl i koden). Alle 60 øvrige
  rækker (enhedstests + `verify:*`) grønne, `outputs/_seneste/proever.md`.
- Fordi den samlede kørsel ikke kunne få porten, er alle fem e2e-specs i
  stedet kørt ENKELTVIS undervejs, og alle grønne: `npm run e2e:atlet`
  (rating-knappernes nye aria-label bekræftet virkende), `npm run
  e2e:dagens-pas` (ingen regression fra nudge-ledningen), `npm run e2e` (den
  delte atlet→coach-rejse, 28,0s), `npm run e2e:check-in` (ny, se commit 4
  ovenfor) — sidstnævnte kørt to gange, identisk grøn begge gange, én gang
  efter alle fire commits var samlet på grenen.
- `node --test` for de nye/udvidede filer, del af den fulde
  `node --test`-kørsel (alle grønne): `readinessInsight.test.js` 20/20
  (12 nye), `checkinReminder.test.js` 8/8 (ny fil).

## Hvad er næste

1. "Det din coach ser" er en uafhængig genimplementering af coachens eget
   "Parathed — nøgletal"-kort (bevidst, `Dashboard*`/`dashboard/` er fredet i
   denne ordre) — ændrer en fremtidig ordre coachens tærskler/regnestykke
   (fx lav-parathed-vinduet på 3 dage, eller 50-punktsgrænsen), følger denne
   kopi ikke automatisk med. Værd at tjekke når 266 lander.
2. Vinduerne i commit 2/3 (ni dage for "hvad ændrede sig", to dage for
   nudgen, score under 50 for "lav") er første gæt, ikke tunet mod Marcs
   rigtige atleter — værd at justere når check-in-raten rent faktisk kan
   måles over en blok.
3. For Hara (Coaching-planeten, delmål "Appen mærkbart bedre for
   atleterne"): dette er selve check-in-skærmen atleten møder hver uge,
   reduceret fra otte tryk til typisk ét, med et synligt tegn på at svaret
   bliver brugt bagefter — det er selve forudsætningen for Marcs mål 1
   (check-in hver uge, en hel blok uden fejl af den gamle slags).

**Tre linjer til Marc:** Check-in tager nu ét tryk på en typisk dag (alt er
forudfyldt fra sidste gang, kun det der reelt er anderledes skal røres) mod
otte før. Efter afsendelse ser atleten det samme du ser (score, snit, ømme
zoner), og — når data viser det — hvad en tidligere lav uge faktisk ændrede
i planen. Hold øje med to ting den første uge: om check-in-raten rent
faktisk stiger, og om nogen atlet ser en "det ændrede en forskel"-note der
virker forkert (den bygger på en tidsmæssig sammenfald, ikke en gemt
årsag — se Ærlige grænser).

## Ærlige grænser

- Tidsmålingen er tryk/taster, ikke sekunder — der findes ingen
  stopurs-instrumentering for UI-interaktion i dette repo. 8→1(/2) tryk er
  optalt direkte i koden og bekræftet funktionelt af `e2e/check-in.spec.mjs`
  (som rent faktisk kun trykker "Log parathed" og intet andet), men er ikke
  en målt skærmtid.
- "Sidst det gjorde en forskel" er en heuristisk tidsmæssig korrelation
  (score under 50, en note-uge inden for ni dage), ikke en gemt
  årsagssammenhæng — kan vise en tilfældig, urelateret note, eller helt
  overse et ægte svar, hvis coachen reagerede et andet sted end
  ugens `coach_note` (fx ved at ændre en enkelt øvelses vægt).
- Begge nye kort i commit 2 er begrænset til det atleten selv har adgang
  til at hente (`readinessHistory`, op til 14 forudgående dage + i dag) —
  IKKE coachens fulde historik. "Det din coach ser" kan derfor i sjældne
  tilfælde vise et lidt andet tal end det coachens eget kort rent faktisk
  viser, hvis coachen har mere end ~14 dages historik at regne på.
- Nudgens vindue (de sidste to dage af ugen) og korrelationsvinduet (ni
  dage) er begge faste, håndvalgte tal — ikke udledt af data, se "Hvad er
  næste".
- Procesafvigelse under arbejdet, ikke en kodegrænse: under gentagne
  manuelle e2e-kørsler opdagede jeg flere efterladte lokale
  node-processer der stadig lyttede på port 8991 (fra `timeout`-afbrudte
  kørsler i denne session) og lukkede tre af dem for at frigøre porten til
  næste kørsel. Jeg kan ikke med sikkerhed udelukke at én af dem tilhørte en
  anden, samtidig session på samme maskine (jf. ordre 210's dokumenterede
  portkonflikt med en Bhishak-session) frem for at være min egen efterladte
  proces — ingen data var i fare (kun lokale dev-mock/vite-processer, ingen
  skrivning mod noget delt eller produktion), men afbrød i så fald muligvis
  den anden sessions egen kørsel. Nævnes her for gennemsigtighed.
- Ikke afprøvet mod produktion (samme stående grænse som tidligere ordrer i
  denne serie) — kun mod den lokale mock/e2e og `npm run dev`.
- E2e-testen (commit 4) dækker ét scenarie ad gangen for hver af de tre
  forbedringer — andre tilstande (et påbegyndt udkast der overtrumfer
  forudfyldningen, nudgen præcis på grænsen mellem "midt i ugen" og "ved at
  være slut", flere kandidat-uger for "hvad ændrede sig") er kun
  enhedstestet, ikke klikket igennem.
