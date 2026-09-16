# Rapport — ordre 248: main efterset før næste push: hele prøvehøsten, og live-appen uden fejl i konsollen

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `main-efterset`, forgrenet fra `main` (`fd18f56`, ordrens egen base — 245
allerede merget). Én commit (denne rapport — ingen kodeændring var
nødvendig, se begge halvdele nedenfor). Arbejdstræet er rent. Ingen
produktions-Supabase ud over de læsninger appen selv gør ved almindelig
sideindlæsning, ingen atletdata, ingen push.

## Hvad ændret

`npm run proever` kørt på `main` (rent træ, `fd18f56`): **58/58 grønne, 0
fejl, 0 sprunget over** — hele harmen (22 enhedstests, 35 verify:*-scripts,
`e2e (run-all.mjs)` og `e2e (coach-sporing-rigtigt-klip.mjs)` mod det rigtige
klip) er grøn uden at røre koden. Ingenting at rette — 231, 232, 233, 234 og
245's parallelle merges (AthleteView i seks chunks, modulepreload, de nye
prøver fra 234/245) står stabilt sammen. `npm run lint` er også rent. Mod
den live app (`21e1b2f`, det Marc kører nu): åbnede headless, telefon
390×844, de to sider der er nåelige UDEN et ægte produktionslogin —
login-/landingsskærmen (`https://app.entropicoaching.dk/`) og
Videocoach-forsiden (`https://app.entropicoaching.dk/videocoach.html`,
`public/videocoach.html`s statiske værktøj) — og loggede al
konsol-`error`/`pageerror` og alle fejlede/4xx-5xx netværkskald. Begge sider:
0 konsolfejl, 0 fejlede netværkskald, indholdet indlæste faktisk (titel +
sideindhold bekræftet, ikke en tom fejlside). Atletliste, Dagens pas og
Check-in kræver et ægte, indlogget produktionslogin — ordre 228, 131 og 210
har hver for sig allerede bekræftet at der ikke findes nogen testkonto mod
produktion, og denne ordre forbyder selv at omgå det, så de tre skærme er
IKKE afprøvet mod live. Tjekket blev kørt med et ad hoc Playwright-script
(genbruger samme delte Chromium-runtime som `e2e/harness.mjs` og
`scripts/maal-produktion.mjs`, ingen ny afhængighed) — ikke committet, da
ordren bad om et tjek, ikke et nyt fast script.

## Testresultat

- **`npm run lint`:** rent.
- **`npm run proever`** (main, `fd18f56`, rent træ):

  | Type | Antal | Resultat |
  |---|---|---|
  | enhedstest | 22 | alle GRØNNE |
  | verify | 35 | alle GRØNNE |
  | e2e (`run-all.mjs`) | 1 | GRØN, 27,2s |
  | e2e (`coach-sporing-rigtigt-klip.mjs`, rigtigt klip) | 1 | GRØN, 30,3s |

  **58/58 grønne, 0 fejl, 0 sprunget over.** Fuld tabel i
  `outputs/_seneste/proever.md` (gitignoreret arbejdssti — se
  `docs/PROEVER-KORT.md` for hvad hver kategori venter på).

- **Live app (`21e1b2f`), headless, telefon 390×844:**

  | Side | Nåelig uden login? | Konsolfejl | Fejlede netværkskald | Indhold indlæst |
  |---|---|---|---|---|
  | Login/landing (`app.entropicoaching.dk/`) | Ja | 0 | 0 | Ja (titel "Entropi Coaching") |
  | Videocoach-forside (`app.entropicoaching.dk/videocoach.html`) | Ja | 0 | 0 | Ja (titel "Entropi VideoCoach") |
  | Atletliste | Nej — kræver ægte produktionslogin | — | — | Ikke afprøvet |
  | Dagens pas | Nej — kræver ægte produktionslogin | — | — | Ikke afprøvet |
  | Check-in | Nej — kræver ægte produktionslogin | — | — | Ikke afprøvet |

## Hvad er næste

1. De tre indloggede skærme (Atletliste, Dagens pas, Check-in) er stadig
   ikke afprøvet direkte mod live — de kræver et ægte produktionslogin, som
   ingen ordre må oprette eller bruge (se ordre 228/131/210). Det tætteste
   mulige tjek uden det: `npm run proever`s mock-baserede e2e (58/58 grønne)
   dækker den SAMME kode på de skærme, bare mod mock-Supabase, ikke ægte
   netværk.
2. Ingen ny ordre er nødvendig for at rette noget — der var intet rødt at
   rette, hverken i harvest eller i den nåelige del af live-appen.
3. For Hara: intet funktionelt ændret for atleter i denne ordre — arbejdet
   er et QA-tjek der bekræfter at main og den live app allerede er stabile
   før Marcs næste push, ikke en ny forbedring i sig selv.

**Tre linjer til Marc:** Main er klar til push: **ja**. Hele prøvehøsten er
58/58 grøn, `npm run lint` er rent, og live-appen (`21e1b2f`) viser 0
konsolfejl og 0 fejlede netværkskald på de sider der kunne tjekkes uden
login. På telefonen bagefter: åbn Atletliste, Dagens pas og Check-in med dit
eget login og se efter noget der springer i øjnene visuelt (de tre skærme er
IKKE maskintjekket mod live i denne ordre, kun mod mock) — ellers intet
specifikt at lede efter.

## Ærlige grænser

- Atletliste, Dagens pas og Check-in er IKKE afprøvet mod den live app —
  kun mod mock-Supabase via `npm run proever`s e2e-del. En fejl der kun
  opstår mod ægte produktions-Supabase (fx en RLS-politik eller en rigtig
  netværkslatens) ville ikke være fanget her.
- "0 konsolfejl, 0 fejlede netværkskald" gælder kun de to sider der faktisk
  blev åbnet, kun ét besøg hver, kun `console.error`/`pageerror`/HTTP ≥400 —
  ikke `console.warn`, og ikke en fuld interaktionstest (der blev ikke
  klikket eller udfyldt noget på nogen af de to sider).
- Tjek-scriptet mod live-appen er ikke committet (ad hoc, se "Hvad ændret")
  — en fremtidig ordre der vil gentage præcis dette tjek skal skrive det
  igen, eller bede om at det bliver et fast script.
- `npm run proever` blev kun kørt ÉN gang på denne maskine i denne session —
  ikke en tidsspredt stikprøve. 58/58 grøn er et øjebliksbillede, ikke en
  garanti mod flaky prøver over tid (samme forbehold `docs/PROEVER-KORT.md`
  selv navngiver for browser-baserede prøver).
