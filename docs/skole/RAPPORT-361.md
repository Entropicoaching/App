# Rapport: ORDRE 361 (Bhishak, kritiker paa "Laer skak" efter 356 og matematikkens kosmetik efter 357)

## Gren
Gren `kritik-skole-4` (fra `main`). Sessionen blev genstartet to gange (stroemsvigt, appen genstartede); arbejdet er fortsat fra de urene filer.
- Commit 1 `b951cca`: blok 1, skak (script `scripts/kritik-skole-4.mjs`, `verify:kritik-skole-4`, skak-skaermbilleder, `maalinger.json`, skak-delen af `docs/skole/KRITIK-356-357.md`)
- Commit 2: blok 2, matematik-skaermbilleder, matematik-fund, denne rapport (hash i `git log`; et commit kan ikke nævne sit eget)
- Kilder set: skak `f71af13` (pinnet af ordren), matematik `8364204` (`git rev-parse main`).

## Hvad ændret
Intet, kritik. Kun nye filer: testscript, skaermbilleder og `maalinger.json` i `outputs/kritik-skole-4/`, `docs/skole/KRITIK-356-357.md`, denne rapport og een linje i `package.json`. Skak og matematik er urørt (hver traekkes ud med `git archive`).

Kort resultat (fuld fund-liste i `docs/skole/KRITIK-356-357.md`):
- **Skak: klar til telefonen: ja.** Opgavetekst og braet ses samtidig paa alle 31 trin paa 390 og 360 px; niveauundertekster, "Spring over" og tegneveaerktoejets skjulning virker; koordinater 12,5 px med kontrast 10,4:1 / 6,2:1. Codex' seks fund: fem lukket med Codex' egen tekst, Sg5 delvist. Fund: Spil-fanen siger "Vaelg Pil eller Ring" mens de er skjult (irriterer), "Rigtigt!" skubber braettet 45-50 px ned saa nederste raekke skaeres af (irriterer), koordinater overlapper brikkefoedder, forvandling uden kvittering, statuslinjen "Hvid traekker." (kosmetisk).
- **Matematik: klar til telefonen: ja.** 20 unikke opgaver pr. spil, 0 ens mellem spil paa plads; kortet: Moellen-knap fri, skilt med luft, klynge 34/17 px fra toppen, sedler inden for kanten, laasetekster 12 px, landsbyen mellem kirken og moellen. Kosmetik: laasekort over landsbyen paa 360, 11 px kildelinje.

## Testresultat
- `npm run verify:kritik-skole-4` (een kommando): koert til ende, exit 0 (ca. 4,5 min). Skak paa 390x844 og 360x800 (forside, Laer skak trin for trin, loeste trin, Spil, Opstil, Gaader), matematik paa tre spil (390, 360, 390 til variation); konsol tom i alle sessioner. `maalinger.json` og skaermbilleder i `outputs/kritik-skole-4/`.
- `npm run lint`: groen.
- Skak og matematik har egne testsaet; de er ikke koert, fordi intet er rettet dér.

## Hvad er næste
Bhishak kan rette skak-fundene i en ordre, mindste gevinst foerst: skjul "Vil du tegne?"-teksten i Spil (S1), hold braettet paa plads efter "Rigtigt!" (S2), flyt koordinaterne fra brikkernes foedder (S3), saet Codex' regel "udvikling vejer tungest" ind i trin 22 (S4). NB: skaks `main` er siden flyttet til `243c54a` (ordre 359: mini-parti og forside paa een raekke); denne kritik dækker IKKE den, saa en ny kritikrunde boer tage mini-partiet paa telefonen.

For Hara: Coaching-planeten (delmaal "Appen maerkbart bedre") er ikke beroert; ingen ændring i entropi-appen. Skole-planeten, spor "Skakbraettet frit braet og opgaver til undervisningen": begge spil er klar til telefonen paa 356/357-niveau. Duta bedes lade det staa i afleveringen.

## Ærlige grænser
- Kun Chromium-emulering (isMobile + touch, 2x), ikke en rigtig telefon; skaermbillederne er ikke set paa en fysisk skaerm.
- Skak er set paa `f71af13`, ikke paa nuvaerende `main` `243c54a`.
- Sg5-beskeden (Codex' fund 3) er ikke set: jeg spillede kun de rigtige traek; forkerte traek paa de nye trin er ikke afproevet.
- Af de 31 Laer-trin er kun fem loest (1, 8, 11, 14, 15); de oevrige er sprunget over (og set med braet og tekst); slutspil og aabninger er ikke spillet igennem.
- Kontrasten paa koordinaterne er beregnet ud fra maalte farver, ikke pixelmaalt.
- "Ikke overlap med moellehuset" er vurderet paa skaermbilledet; scriptets hus-tjek finder kun hjulikonet i selve knappen.
- Matematikvariationen er set paa tre spil x 20 opgaver; progressionen (niveauer, antal) er ikke gennemgaaet, og de to 390-spil delte 2 af 20 opgaver (tilfaeldighed, ikke fejl efter min vurdering).
- Ikke set: Kirken, Landsbygaden, Grusgraven, Sporvognen (kun kortet), Lygten; Ovet/Staerk-niveauerne mod computeren.
- Ingen elevdata; ingen push.
