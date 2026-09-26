Ordre 437

Gåderne set som elev: rating, dagens gåde, stime og de 330 lette gåder (Bhishak)

## Gren

- **Gren:** `kritik-437` i `C:\Users\Entropi\Desktop\entropi-app-kritik`, lavet fra app-`main` ab9468e (med kritik-432 merget). Ikke pushet.
- **Commit 1** `99ae654`: `outputs/kritik-437/` (gaader-437 og rating-437, scripts og målinger), `verify-kritik-437.mjs` og `verify:kritik-437` i `package.json`.
- **Commit 2:** `outputs/kritik-437/elev-437.*` og G-skærmbillederne, `docs/kritik-437/KRITIK-gaader.md` og denne rapport.
- **Skak** (`C:\Users\Entropi\Desktop\skak`) er kun læst: `main` @ `b9f8303` via `git archive` til en kopi i min scratchpad. `node_modules` er lånt som junction (kun læst). Skak-mappen står selv på en anden gren (`computer-niveauer`) med ucommittede ændringer fra en anden arbejder. Dem har jeg ikke rørt.

## Hvad ændret

- **`outputs/kritik-437/gaader-437.mjs`:** 60 tilfældige af de 330 lette gåder (frø 437) med min egen søgning, uafhængig af generatorens:
  - negamax med alfa-beta og transpositionstabel, **dybde 5** + rolig søgning, rent materiale; kører i 8 processer (ca. 4 min)
  - pr. gåde: lovlighed, tema målt på stillingen og entydighed (ethvert andet første træk inden for 1,5 bonde tæller som anden løsning)
  - et "grådigt" tjek: hvad en begynder ser vinde med det samme
  - træk der gør gåden svær for en begynder
- **`outputs/kritik-437/rating-437.mjs`:** skaks egen `gaaderating.js`/`gaadestime.js` og den rigtige pulje (5068 lovlige).
  - Seks elevtyper × 500 kørsler × 200 gåder: fast 70 %, fast 30 %, Elo 70 %, Elo 30 %, "barn" (70 % med gæt og sjusk) og styrke 250.
  - 50 % af de første 20 i fire rækkefølger og 500 tilfældige.
  - Dagens gåde på tre separate Node-processer ("pc'er") med hver sin rækkefølge og tidszone.
  - Et helt år af dagens gåde og stimen over fem dage.
- **`outputs/kritik-437/elev-437.mjs`:** headless Chromium, 390 × 844, touch.
  - Elev A løser 10 af 20 i blandet rækkefølge og fejler på tre børne-måder: forkert træk og tilbage; to forkerte, så løsningen vises; hint og spring over.
  - Elev B forbedrer sig: 10 forkerte, så 10 rigtige.
  - Til sidst en gåde med sort i træk.
  - 17 skærmbilleder `G-*.png`.
- **`docs/kritik-437/KRITIK-gaader.md`:** 11 fund (K1-K11) øverst og dommen **Klar til klassen: nej**.
  - K1: en elev der starter dårligt, falder over 300 point og ligger under start efter 10 rigtige.
  - K2: "Løst! (løst uden hint)" med rødt minus.
  - K3: sort i træk vises fra hvids side uden tekst.
- **Ingen ændringer i skak.** Ingen appkode i entropi-app er rørt; kun `outputs/kritik-437/`, `docs/kritik-437/` og én linje i `package.json`.

## Testresultat

- **`npm run verify:kritik-437`:** exit 0 efter hver blok (`… 1` efter commit 1, `… 2` efter commit 2). Verify'et tjekker de gemte målinger og at fundene ikke er vokset, forsvundet eller flyttet (id'erne i K8, K1-K4 i browseren), og at dokumenterne har det ordren kræver.
- **Gåderne (60, dybde 5):**
  - 0 ulovlige og 0 med forkert tema; alle 20 mat i 1 har ét mattræk; alle 14 gafler har tvunget kongetræk.
  - 3 med anden løsning i dybden (425-0076, 0200, 0247) og 2 der er lige så fristende for en begynder (425-0052, 0076). 425-0022's andet slag er patt.
  - 425-0200/0247 er efterprøvet med skaks egen `taktiksoegning.mjs` i dybde 6.
- **Ratingen:**
  - 0 brud på bunden i 3000 × 200 gåder.
  - Elo-eleverne lander på deres styrke ±5 med sd ca. 30 og 52 % løst.
  - Fast 70 % stiger uden stop (1630). Fast 30 % lander på 200-260.
  - 50 % af de første 20: gennemsnit 775; "først 10 forkerte" giver 598.
- **Dagens gåde:** ens på alle tre pc'er på tre datoer; UTC-pc'en har kl. 00:30 dansk tid stadig "i går". Stimen: 1, 1, 2, 3, 1 og 0 efter et hul.
- **Browser:** 0 sidefejl.
  - A: 800 → 824. B: 800 → 464 → 627.
  - 23 af 40 gåder havde sort i træk, alle vist fra hvids side.
  - Ratingen står ved y = 1138 på en skærm der er 844 høj.
- **`npm run lint`** kunne ikke køre: worktreen har ingen `node_modules`, og eslint fra hoved-checkoutet finder ikke `@eslint/js` via denne config. Konfigurationen dækker desuden kun `*.js`/`*.jsx`, ikke mine `.mjs`. Alle fire scripts består `node --check`.

## Hvad er næste

Fundene til Chaturanga (skak), vigtigst først:
- **K1:** skjul tallet i de første ca. 10 gåder ("vi finder dit niveau"), eller hold K fast til eleven har løst 5. I dag falder en elev der starter dårligt, 800 → 464 og når kun 627 efter 10 rigtige i træk.
- **K2:** skriv ikke "(løst uden hint)" ved et minus. Brug fx "Løst, men med et forkert træk først: 769 (−31)", og lad en vist løsning (fejl nr. 2) tælle som hint i teksten.
- **K3:** vend brættet i Gåder til den der trækker, og skriv "Sort trækker." Det gælder 47 % af puljen og 101 af de 330 lette.
- **K4:** sæt rating og +/− på én linje over brættet; i dag står det 300 px under skærmkanten på 390 × 844.
- **K5:** vis "Sprunget over efter et hint: −20" et øjeblik, før næste gåde.
- **K6:** tæl den "lettere gåde efter tre forkerte" med halv K eller slet ikke; i dag koster den op til −42.
- **K7:** overvej at sigte 150 under ratingen, så ligevægten bliver ca. 70 % rigtige i stedet for 50 %.
- **K8:** ret eller fjern 425-0076 (b8=D vinder mere end facit). Hæv ratingen på 425-0052, 0022 (patt-fælden) og 0011 (slag med forvandling), eller fjern dem. Søg "Red din brik" i dybde 5 før de godkendes (0200 og 0247 taber brikken alligevel). Kør gerne alle 330 med `gaader-437.mjs <kopi> 5 330` (ca. 20 min med 8 processer).
- **K9:** giv grafen en stiplet startlinje og tal i enderne.
- **K10, K11:** kun til orientering (svage elever gentager gåder; en pc med forkert tidszone viser gårsdagens gåde).

Til Marc: rettelserne i K1-K3 er små, men de bør ind, før klassen bruger ratingen. Dagens gåde og stimen kan klassen bruge i dag; de er rigtige.

Denne ordre hører til skole-planeten (skakbrættet), ikke Hara's Coaching-planet; den flytter ikke "Appen mærkbart bedre".

## Ærlige grænser

- **Eleverne er scripts, ikke børn.** "Forstår en 10-årig '+12/−8' og grafen?" er min vurdering ud fra skærmbilleder og tekster, ikke observeret i en klasse.
- **Rating-modellerne er modeller.** Et barns rigtige sandsynlighed afhænger af tema og dagsform, ikke kun af Elo-forskellen. "Fast 70 %" og "Elo 70 %" er de to yderpunkter.
- **60 af 330 gåder.** "Ca. 25 af 330 med noget" er et skøn ud fra 8 % i stikprøven. De 270 andre er ikke søgt.
- **Dybde 5 er dybere end generatorens 3, men ikke bevis.** Min søgning måler kun materiale, med mat = 1000 og uden remisregler. "Lige så fristende" er et halvtræk + rolig søgning, et groft billede af hvad en begynder ser.
- **Browsertallene skifter lidt fra kørsel til kørsel,** fordi appen vælger gåder tilfældigt (A: 810-843, B: 604-633 over fire kørsler). Mønstret var det samme.
- **Skak er læst på `main` b9f8303.** Hvad der ligger på grenen `computer-niveauer` (ordre 436, ucommittet), er ikke med.
- **Lint er ikke kørt** (se Testresultat).
