# ORDRE 68 — resten af den stille familie, og trykfladerne

## Gren

`stille-fejl-3-og-trykflader` (fra `main` `42ef7df`, ordre 64 allerede merget).

Commits:
- `2867cfb` — commit 1: G2+G3 — `undoDelete` og session-niveauets
  "Spring resten over"/"Auto-udfyld"/"Gem feedback" kører nu gennem
  `runGuardedWrite`
- `dc61a05` — commit 2: F13-F16+F26 — fem trykflader under 44px løftet op

Filer: `src/AthleteView.jsx`, `src/Auth.jsx`, `src/athleteWriteGuard.test.js`
(udvidet), `scripts/verify-athlete-write-failures.mjs` (udvidet). Ingen
skema, ingen SQL, ingen push, ingen nye afhængigheder. Videocoach urørt.
Ingen atletdata i kode, tekst eller test.

## Hvad ændret

**Commit 1 — G2+G3: resten af den stille familie**

Ordre 64's egen rangering pegede på fire steder tilbage med det samme
mønster som F1/F2/F4-F7 (rå Supabase-kald uden fejltjek eller uden at vente
på svar før tilstanden ændres):

- **`undoDelete`** (Fortryd efter slettet måltid) skrev
  `supabase.from('meal_logs').insert(t.restore)` uden at kigge på fejlen,
  og ryddede "Fortryd"-toasten øjeblikkeligt uanset udfald. Et netværksdrop
  betød: toasten forsvinder, måltidet er IKKE genskabt, og atleten får
  ingen besked om at det gik galt.
- **`skipRemainingSets`** og **`autoCompleteSession`** ("Spring resten
  over"/"Auto-udfyld" i Program-fanen) tjekkede allerede `{ error }` på
  både SELECT og INSERT, men viste den rå Supabase-fejlbesked direkte til
  atleten (`'Fejl ved hentning: ' + fetchErr.message`) i stedet for en
  oversat sætning, og gik ikke gennem den fælles garde.
- **`saveFeedback`** ("Gem feedback" på en gennemført session) tjekkede
  slet ikke fejlen fra `sessions`-update'en og opdaterede den lokale
  tilstand (`athlete_rating`/`athlete_comment`) ubetinget — en fejlet
  gemning så ud som en gemt gemning.

Alle fire kører nu gennem `runGuardedWrite` med en oversat, ét-sætnings
fejlbesked i atletens sprog, og tilstanden (toast, sæt-log, session-
feedback) ændres kun EFTER et bekræftet svar. Derudover er der tilføjet en
afventer-indikator (samme mønster som `savingWeight`/`savingReadiness`):
knapperne deaktiveres og viser "..."/"Gemmer..." mens skrivningen er i
gang, så et hurtigt dobbelttryk ikke sender samme skrivning to gange, og
atleten kan se at noget sker.

**Commit 2 — F13-F16+F26: trykfladerne under 44px**

Fem steder fra ordre 64's fundliste (afsnit 3, tommelfinger-trykflader),
alle uden designændring — kun `minHeight`/`minWidth: '44px'` +
`boxSizing: 'border-box'`, samme mønster som sæt-loggerens Log/Spring
over/RPE-vælger fik tidligere:

| Fund | Sted | Før | Efter |
|---|---|---|---|
| F13 | Kostsøgningens hurtig-tilføj "+" | 30×30px cirkel | 44×44px |
| F14 | Rediger (✎) / slet (✕) på kostlog-rækker | 21×15px / ingen fast bredde | 44×44px begge |
| F15 | Kontomenuens "⋯"-knap | 20×19px | 44×44px |
| F16 | Mobilitetens "✕ Afslut" (guide) og "✕ fjern" (områdevalg) | 51×13px | 51×44px (bredden er teksten, ikke fundet) |
| F26 | "Glemt adgangskode?"-linket | 116×27px | 116×44px |

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler i
  `AthleteView.jsx`/`Dashboard.jsx`, urørt af denne ordre).
- `npm run gate:tracker` — GRØN (trackeren er urørt af begge commits).
- `node --test src/*.test.js` — 48/48 grønne, heraf 3 nye i
  `athleteWriteGuard.test.js` (G2, G3×2 — én for skip/autofill-mønsteret,
  én for saveFeedback).
- `verify:athlete-write-failures` (udvidet) — bekræfter i kildeteksten at
  `undoDelete`, `skipRemainingSets`, `autoCompleteSession` og
  `saveFeedback` alle går gennem `runGuardedWrite`, og at
  `setUndoToast(null)`/`fetchExerciseLogs`/`setAllWeeks` kun kaldes EFTER
  et bekræftet `ok`.
- `verify:athlete-tap-targets` — grøn (sæt-loggerens tidligere fix, urørt).
- `verify:athlete-password-reset` — grøn (F26-linket rører ikke selve
  glemt-adgangskode-flowet, kun trykfladen).
- `verify:athlete-onboarding`, `verify:athlete-onboarding-guide`,
  `verify:athlete-identity`, `verify:progression-state` — grønne
  (urørte områder, kørt som sikkerhedstjek fordi de deler fil).
- **Headless måling af de fem trykflader (commit 2):** isoleret HTML-side
  med præcis de samme inline-styles som i koden (før og efter, side om
  side), indlæst i headless Chrome på en 375px viewport, målt med
  `getBoundingClientRect()`:
  ```
  F13  før 30×30  →  efter 44×44
  F14  før 21×15  →  efter 44×44
  F15  før 20×19  →  efter 44×44
  F16  før 51×13  →  efter 51×44
  F26  før 116×27 →  efter 116×44
  ```
  Alle fem gik fra under 44px til mindst 44px på den led der var for lille;
  ingen ændrede bredde-dimension urimeligt (F16/F26 er tekstknapper, hvor
  kun højden var fundet).

## Hvad er næste

Rangeret efter hyppighed × pris, som i ordre 64. Fundlisten fra ordre 41
er nu udtømt for de høj-prioriterede fund; det resterende er lavere
frekvens/pris eller kræver Marcs prioritering:

1. **F17/F18 — jargon uden forklaring.** "TDEE" i Kostlog har ingen
   info-knap (i modsætning til RPE, som allerede har en "ℹ"). De to
   beskedspor ("Besked"/"Teknik & løft") forklares ingen steder, hverken i
   klik-guiden eller i selve Beskeder-fanen — en ny atlet kan sende et
   teknik-spørgsmål i det forkerte spor. Moderat frekvens, lav-moderat
   pris (forvirring, ikke tab af data).
2. **F22 — Parathed viser ingen udvikling efter gemt log.** Den mest
   daglige, mest rutineprægede handling i appen (`readiness_score`
   beregnes allerede) er den eneste daglige rutine der ikke spejler noget
   tilbage til atleten. Ingen fejl, intet tab — en forspildt mulighed, ikke
   en friktion, men høj frekvens.
3. **F21 — Kostlogs TDEE-trend er skjult bag et manuelt fold-ud.** Svagere
   fund end F22, samme kategori ("stille i uge 2").
4. **G5-G13 — resten af ordre 41's krydstjek** (mobilitetstimere der
   fortsætter ved låst skærm, ingen log ud-bekræftelse, flere små
   trykflader end de nu rettede, manglende "send bekræftelseslink igen").
   Ingen af dem er rangeret over F17/F18/F21/F22 i denne vurdering — se
   `outputs/atletens-foerste-uge/RAPPORT.md` for den fulde liste.

Ingen af disse har samme akutte "stille fejl"-karakter som F1-F7/G2/G3
(tavse skrivninger); det er derfor rimeligt at Marc prioriterer blandt dem
efter smag, ikke efter en indbygget hastighed.

## Ærlige grænser

- **Ingen levende Supabase-test af G2/G3-rettelserne** — samme begrænsning
  som alle tidligere runder: statisk kildelæsning
  (`verify-athlete-write-failures.mjs`) og hermetiske enhedstests af selve
  `runGuardedWrite`-mønsteret, ingen render-baseret test af den faktiske
  React-komponent mod en rigtig eller mocket Supabase-klient.
- **Trykflade-målingen (commit 2) er en isoleret harness, ikke den
  levende app.** Jeg gengav de eksakte inline-styles fra koden i en
  separat HTML-fil og målte dem headless (samme tal som koden reelt
  producerer, da CSS-boksmodellen er deterministisk), men målte ikke i
  selve `AthleteView`/`Auth` mod en logget-ind atlet — det ville have
  krævet et login (og dermed enten en test-konto eller ægte atletdata,
  begge dele uden for grænserne for denne ordre).
- **To eksisterende verify-scripts fejler allerede på ren `main`
  (`42ef7df`), før nogen af denne ordres ændringer:**
  `verify:athlete-first-day-flow` (en sha256-lås på readiness-kernen,
  forventer en anden hash end den koden reelt har — sandsynligvis en
  gammel lås der ikke blev opdateret, da readiness-koden sidst blev
  rørt) og `verify:auth-logout-and-role-switch` (forventer at
  `window.location.reload()` står lige uden for `signOutHardCore`-kaldet
  i `signOutHard`; koden i main matcher ikke det længere). Begge er
  bekræftet uafhængigt af denne ordre (kørt i en midlertidig `git
  worktree` af `main` uden mine commits). Ordren beder ikke om at røre
  logud eller førstedagsflowet, så jeg har ladet dem stå urørte — men
  Marc bør vide at to gates allerede er røde på `main`, uafhængigt af
  denne gren.
- **F16's "mobilitet"-afgrænsning er snæver:** kun `MobilityGuideStep`
  (mobilitetens egen guide, bekræftet ved at den kun bruges dér) og
  områdevalgets "✕ fjern" er rettet. En tredje, visuelt identisk "✕
  Afslut"-knap i opvarmningsguiden (linje ~5604, en anden funktion end
  mobilitet) er bevidst IKKE rørt — ordren og ordre 64's F16 nævner kun
  mobilitet, og opvarmning er et separat fund uden for denne liste.

## Betydning for Hara

Under "Appen mærkbart bedre for atleterne": endnu fire steder hvor
atleten nu får besked i stedet for en tavs, misvisende skærm (samme klasse
som F1/F2/F4-F7), og fem trykflader løftet til den anbefalte
tommelfinger-standard — begge dele reducerer små, gentagne friktioner som
delmålet handler om at fjerne "uden skub".
