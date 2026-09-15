# Rapport — Ordre 205: prøverne efterlader et rent træ

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`rent-trae-efter-e2e`, forgrenet fra `main` (`5fe52f5`) — 201 stod allerede
merget der (`8bad5fe merge: kaeden-foer-dashboard`), så commit 2 (lukning af
201) var et no-op, se nedenfor. To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `469d3be` | Prøverne skriver til `outputs/_seneste/` (git-ignoreret), ikke over leverance-facit; `--opdater-leverance` opdaterer facit på forlangende |
| 2 | — (no-op) | `docs/RAPPORT-201.md` var allerede committet og merget til `main` da denne ordre startede |
| 3 | `5789da9` | `docs/E2E.md` + `docs/MAAL-TELEFON.md`: facit vs. prøvekørsel, hvordan facit opdateres |

Arbejdstræet er rent efter hver commit. Ingen push.

## Hvad ændret

**Commit 1.** `e2e/harness.mjs`s `OUT_DIR` peger nu på
`outputs/_seneste/e2e/` i stedet for `outputs/e2e/` (én central konstant,
brugt af alle e2e-spec'er). `scripts/maal-telefon.mjs` og
`scripts/maal-coach-telefon.mjs` skriver samme vej: `outputs/_seneste/maal/`
og `outputs/_seneste/maal-coach/`. Ny lille delt fil
`scripts/leverance-sti.mjs` (ingen ny afhængighed — kun `node:fs`) holder
selve kopi-logikken ét sted: `harLeveranceFlag()` (er `--opdater-leverance`
givet), `argvUdenLeveranceFlag()` (positions-argumenter som label, uanset
flagets placering) og `opdaterLeverance(fra, til)` (overskriver kun stien
der findes i kilden). `e2e/run-all.mjs` kalder den efter en grøn kørsel;
de to `maal-*`-scripts kalder den efter deres JSON+skærmbilleder er
skrevet. `.gitignore` fik `outputs/_seneste/`.

Leverance-mappernes indhold (`outputs/e2e/`, `outputs/maal/`,
`outputs/maal-coach/`) er urørt — de er stadig facit fra tidligere ordrer,
og opdateres kun når en ordre udtrykkeligt beder om det, med
`--opdater-leverance`.

**Commit 2 (no-op).** `docs/RAPPORT-201.md` (måling før/efter for både
coachens atletliste og atletens forside, dom: rettelsen beholdes selvom
TTI-tallet ikke rykkede sig målbart) var allerede committet i
`kaeden-foer-dashboard` og merget til `main` i `8bad5fe`, før denne ordre
startede. Intet at lukke.

**Commit 3.** `docs/E2E.md` fik et nyt afsnit "Facit vs. prøvekørsel" (hvor
billederne lander, og hvordan `--opdater-leverance` bruges), plus rettet
den forældede sti-reference. `docs/MAAL-TELEFON.md` fik samme sti-rettelse
og en henvisning til det nye afsnit. Ingen ny side — begge filer eksisterede
allerede og beskrev netop dette.

## Testresultat

- **`npm run lint`:** rent.
- **`npm run e2e`:** grøn (25,6-26,0s over tre kørsler), `git status --short`
  tom bagefter hver gang.
- **`npm run maal:telefon`:** kørt, skriver til
  `outputs/_seneste/maal/2026-09-15.json` + skærmbilleder, `git status
  --short` tom bagefter.
- **`npm run maal:coach-telefon`:** kørt (45 attrap-atleter, telefon +
  desktop, før og efter login), skriver til
  `outputs/_seneste/maal-coach/2026-09-15.json` + skærmbilleder, `git status
  --short` tom bagefter.
- **`--opdater-leverance` afprøvet:** `npm run e2e -- --opdater-leverance`
  kopierede reelt 28 skærmbilleder ind over `outputs/e2e/` (bevist med `git
  status --short outputs/e2e`) — derefter `git checkout -- outputs/e2e`,
  fordi ingen ordre har bedt om nye leverancebilleder denne gang. Flaget
  virker; ingen nye leverancebilleder er leveret.
- **Alle 34 `verify:*`-scripts:** grønne (fuld liste kørt, se
  `npm run` uden argument for navnene).
- **Efter den fulde verify-suite** stod to filer ændret:
  `outputs/film-foer-du-sender/atlet-foerste-besoeg-390px.png` og
  `outputs/reps-pr-saet/mobil-390px-reps-pr-saet.png` — skrevet direkte af
  hhv. `scripts/verify-videocoach-film-guide.mjs` og
  `scripts/verify-athlete-reps-per-set-mobile.mjs`, samme rodfejl som denne
  ordre retter for e2e/maal, men uden for ordrens navngivne omfang (kun
  `npm run e2e`, `maal:telefon`, `maal:coach-telefon` var nævnt). Reverteret
  med `git checkout --` — ingen indholdsændring, kun genereret pixel-støj.
  Se "Hvad er næste".
- **`git status --short`:** tom efter alt ovenstående.

## Hvad er næste

1. **To `verify:*`-scripts skriver stadig direkte over leverance-facit**
   (`verify-videocoach-film-guide.mjs`, `verify-athlete-reps-per-set-mobile.mjs`
   — se Testresultat). Samme mønster, samme løsning
   (`scripts/leverance-sti.mjs` er allerede skrevet og genbrugelig) — ikke
   rettet her, fordi ordren navngav kun tre kommandoer. Der kan være flere;
   jeg har ikke gennemsøgt alle 34 for direkte skriv til `outputs/*`.
2. Ingen Hara-relevans denne gang — dette er proces/værktøjs-infrastruktur
   (et rent træ efter prøvekørsel), ikke en ændring i selve appen atleten
   eller coachen oplever.

## Ærlige grænser

- Jeg har IKKE gennemsøgt alle 34 `verify:*`-scripts systematisk for
  samme fejl som punkt 1 ovenfor beskriver — kun opdaget de to der faktisk
  udløste den under selve leverance-kørslen. Der kan være flere jeg ikke så.
- `--opdater-leverance` er afprøvet og reverteret igen (se Testresultat) —
  ingen nye leverancebilleder er faktisk leveret denne ordre, kun beviset
  for at mekanismen virker.
- Commit 2 er et bevidst no-op, ikke en fejl: 201 var allerede færdig og
  merget da denne ordre startede (base var `main`, ikke
  `kaeden-foer-dashboard`, jf. ordrens egen instruktion om at tjekke
  `main` først).
