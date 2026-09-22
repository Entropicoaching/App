# Rapport 322: kritik af skak (312) og matematik (313) før Marc kigger

## Gren

`kritik-skole`, base `main` (`8fadcd0`). To blokke, hver sit commit:

- Blok 1 (commit 1): kritik af skak (312 + 296) — script + skærmbilleder
- Blok 2 (commit 2): kritik af matematik (313), arket og rapporten — se `git log`
  (et commit kan ikke nævne sit eget, se ordre 296, Commit 4)

## Hvad ændret

Intet — kritik. Jeg har rettet ingen kode i skak- eller matematik-repoet, og
committet intet der (kun læst `RAPPORT-312.md`/`RAPPORT-313.md`s afsnit
"Hvad ændret"/"Hvad er næste", og kørt egne headless-script mod de to
`.html`-filer). I app-wt2 er der tilføjet:

- `scripts/kritik-skole-skak.mjs` og `scripts/kritik-skole-matematik.mjs` —
  headless Playwright-script (kører mod den samme delte `playwright` som
  hver af de to skole-repoer selv bruger, `createRequire` mod deres
  `node_modules`, ingen ny afhængighed i app-wt2's egen `package.json`).
- `package.json`: ét nyt script, `verify:kritik-skole`, som kører begge i
  forlængelse af hinanden (ordrens "één verificeringskommando").
- `outputs/kritik-skole/skak/*.png` og `outputs/kritik-skole/matematik/*.jpg`
  — skærmbillederne kritikken bygger på. `fund.json` i hver mappe er
  script-outputtet der ligger til grund for fundene i `KRITIK-312-313.md`
  (maskinlæsbart, ikke selve leverancen).
- `docs/skole/KRITIK-312-313.md` — selve arket til Marc: to linjer øverst
  ("Skak: ..." / "Matematik: ..."), fund efter alvor pr. spil, og hvad jeg
  ikke kunne teste.

## Testresultat

`npm run verify:kritik-skole` (== `node scripts/kritik-skole-skak.mjs && node
scripts/kritik-skole-matematik.mjs`): **grøn**.

- **Skak**: hele "Lær skak"-rejsen (27/27 trin) gennemspillet for "Jeg er
  ny" på 1280x800 med mus — alle fem principper (godt/dårligt træk), alle
  fire åbninger (inkl. et bevidst FORKERT første træk i Italiensk, som
  korrekt ruller tilbage med sin egen besked), alle fire slutspil spillet
  til ægte mat/mål mod motoren (samme generiske, IKKE-scriptede
  "pres mobilitet/nærm kongen"-strategi som 312's egen `roegtest-312.mjs`
  bruger, ikke en genafspillet facit-linje). "Jeg kan reglerne" og "Jeg
  spiller allerede" lander begge korrekt. Opstil + tegneværktøjslinjen
  (296) afprøvet med mus (pil, ring, farveskift, "Spil videre" med
  tegningen liggende). Samme forløb gentaget på 390x844 med ægte
  touch-emulering (`Input.dispatchTouchEvent`) — HER fandt kritikken det
  eneste alvor-1-fund: et forkert træk spillet med finger-TRÆK (drag)
  bliver aldrig afvist, kun tryk-tryk virker (se `KRITIK-312-313.md`).
  Ingen konsol-/sidefejl i nogen af de to kørsler.
- **Matematik**: hele landsbyen gennemspillet på 390x844 — figur oprettet,
  alle fem steder besøgt, 115 opgaver løst (113 korrekte, 2 endte på facit
  efter tre forsøg, som ventet), udstyr og journal tjekket, ingen to
  værdi-lige brøksvar vist samtidig, ingen konsol-/sidefejl. Et let
  visuelt gennemsyn kørt på desktop (1280x800: kort + én opgave som
  stikprøve). Et alvor-2-fund: udstyrs-knappen i journalen er 36px høj
  (under 44px-tommelfingerreglen).
- `npm run lint`: grøn (de nye `.mjs`-script ligger uden for
  ESLint-konfigurationens `**/*.{js,jsx}`-omfang, så de ændrer ikke
  lint-resultatet for resten af repoet — bekræftet ved at køre lint efter
  ændringerne).

Se `docs/skole/KRITIK-312-313.md` for selve arket og alle fund med
skærmbillede-henvisninger.

## Hvad er næste

- **Skak (alvor-1)**: ret finger-træk (drag) i "Lær skak", så det samme
  "lovligt-men-forkert"-tjek der allerede kører for tryk-tryk (klik-klik)
  også kører når trækket kommer fra et sammenhængende touch-drag — det er
  formentlig samme kodesti som resten af rejsen (307/312's
  klik-til-træk-mekanik), men drag-håndteringen ser ud til at committe
  trækket uden at spørge først.
- **Skak (polish)**: hvis Marc vil lukke "ikke super sexet"-gabet til
  matematik-spillet, er de konkrete punkter i `KRITIK-312-313.md` et sted
  at starte (statuslinjens debug-agtige udseende, ingen illustration/tema,
  ensartede kasse-knapper) — ikke bedt om i denne ordre, kun noteret.
- **Matematik (alvor-2)**: udstyrs-knappens højde i journalen (36px →
  mindst 44px) — lille, ikke blokerende.
- **Matematik (verifikation)**: en fremtidig kørsel kunne målrettet lede
  efter den uforkortede brøk-sag (4/6-for-2/3-hintet) hvis Marc vil se den
  live, fx ved at køre kritik-scriptet flere gange eller ved at kigge
  specifikt i opgavegeneratorens data — selve reglen er allerede
  unit-testet (`test/broek.test.mjs`), så dette er en nice-to-have, ikke en
  mistanke om en fejl.

## Ærlige grænser

- **Kun Chromium headless** — ingen ægte lokal Edge og ingen fysisk
  touch-tavle/telefon. Touch er emuleret via CDP's
  `Input.dispatchTouchEvent`, samme mekanik skak-repoets egen 296-test
  bruger, men det er stadig en emulering.
- **Skak**: gådebanken (mønstre, trin 12-14) blev sprunget over bevidst —
  312's egen `roegtest-312.mjs` dækker den fuldt, og ordren pegede på
  niveauer/åbninger/slutspil/Opstil.
- **Matematik**: "den gamle gang" (kræver Lygten, ulåst efter Sporvognens
  kæde) blev ikke opsøgt — jeg stoppede efter alle fem hovedsteders 115
  opgaver, langt over ordrens "to opgaver pr. sted". 313's egen
  `browser-check-verden.mjs` dækker den gamle gang.
- **Den uforkortede brøk-sag blev ikke observeret LIVE** i 115 løste
  opgaver (data-afhængigt, ikke noget jeg kunne fremtvinge) — men reglen
  er bekræftet korrekt og unit-testet i `test/broek.test.mjs` (navngivet
  efter "Marcs 21. sep-eksempel"). Se `KRITIK-312-313.md` for detaljer.
- Ingen elevdata er brugt eller skrevet nogen steder — kun de to
  `.html`-filers egen offentlige/faste indhold og en opdigtet testfigur
  ("Ravn").
- Ingen skærmlæser-/tastaturgennemgang af nogen af de to spil.
- Denne kritik er IKKE en ny, uafhængig regressionstest af 312/313s
  egne, allerede grønne facit — den bruger til dels de samme
  interaktionsmønstre (bevidst, for at kunne genskabe det Marc selv ville
  møde), men målet var at finde noget de IKKE allerede havde fanget, ikke
  at bevise deres tal forkerte.
