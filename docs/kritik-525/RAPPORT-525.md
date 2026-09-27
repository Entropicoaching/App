Ordre 525: to kritikker. Matematikspillet som en elev i 5. klasse (Ganita 479-505) og gentjek af squat-udgivelsen efter Setus 516

Bhishak, 27. sep 2026. Ordren kom fra Dhruva via Marc. Planet: school. Spor:
spor-matematik-minispil-tr-n-kompetencerne-som-g-der-014dc3.

**Domme:**
- **matematikspillet foeles som et eventyr: nej.** Eventyret er bygget og virker, når eleven når det: Anes kæde,
  bagerhuen på figuren, takkekortet og Min helt. Men:
  - De første 6½ minut er 12 ens opgaver uden en person (M1).
  - Tallene, der vokser, kan intet (M2).
  - Nye steder åbner i stilhed (M3), så en elev bliver ved Møllen hele den første halve time.
  - En travl elev når "Mester" uden en eneste quest (M6).
- **squat-artiklen klar til udgivelse naar Marc har valgt: ja.** Stopperne fra 502 (U1, U3 og U4) er lukket. 7
  punkter venter på Marcs valg, og U12 og U15 er små og åbne. Nyt fund N1: stien til Min krop skal afgøres sammen
  med V8.

**Identitet:** træets `CLAUDE.local.md` siger Vaidya. Ordren siger, at jeg er Bhishak, og at filen gælder
hovedtræet. Marc bad mig udføre ordren direkte, og kritik 409-521 er lavet i dette træ, så jeg har fulgt ordren.

## Gren

`kritik-525`, fra `main` i `entropi-app-kritik`. Jeg har kun rørt `docs/kritik-525/` og `outputs/kritik-525/`.
Intet er pushet eller merget. Matematik og sitet er ikke ændret, og der er ingen rigtige elever.

Commits:
- `7c51b8b`: blok 1, matematikspillet (`MATEMATIK.md`).
- blok 2: squat-udgivelsen, verificering og denne rapport (`SQUAT-2.md`). Hashen står i `git log`.

**Læst:**
- Matematik (`main` @ `4bdda17`, med `git show`/`git archive`; Ganitas træ står på `liv-og-hak` og er ikke rørt):
  `docs/QUESTBOG.md`, `docs/KORTET.md` (overskrifter og målingerne), `outputs/RAPPORT-499.md`, `-505.md`, og
  ordrerne 479, 489, 499 og 505.
- Setu: `ordrer/kilder/setu-516/RAPPORT-516.md`.
- Sitet: grenen `udgivelse-squat-min-krop` @ `273d670` (med `git show`/`git archive`) og `vaerktoejer` for stien.
- Min egen `SQUAT-UDGIVELSE.md` fra kritik 502.

## Hvad ændret

Intet i matematik, sitet eller appen. Nye filer:

**Blok 1:**
- `outputs/kritik-525/elev-525.mjs` → `elev-525.json` og `E-*.png`: en syntetisk elev ("Tulle", et fantasinavn,
  70 % rigtige i første forsøg) spiller fra en tom browser i 30 minutter på modellens ur, headless på 390 og
  1280 px uden net. Der er to udgaver af samme elev:
  - travl: svarer kun.
  - følger: tager "Hjælp Ane" og "!".

  Bagefter ser hun Min helt, questbogen og journalen, og en gemt "anden dag" med Bigården.
- `outputs/kritik-525/variation-525.mjs` → `.json`: Møllens 8 forløb over 500 salte.
- `docs/kritik-525/MATEMATIK.md` med M1-M9.

**Blok 2:**
- `outputs/kritik-525/squat-525.mjs` → `squat-525.json` og `S-*.png`: squat-grenen headless på 390 og 1280 px og
  kilden læst direkte.
- `docs/kritik-525/SQUAT-2.md` med U1-U16, N1 og N2.
- `outputs/kritik-525/verify-kritik-525.mjs`.

**Hovedtal:**

| | travl elev | følger |
|---|---|---|
| Opgaver før det første hak | 12 (6 min 38 s) | 12 (6 min 38 s) |
| Quests på 30 min | 0 | 3 |
| Niveau / udstyr efter 30 min | 8 "Mester" / 1 af 9 | 5 "Svend" / 2 af 9 |
| Hånd og Hjerte | 1 og 1 | 1 og 1 |
| "Spørg din lærer" | 3 gange | 4 gange |
| Steder besøgt | Møllen | Møllen |
| 2/3 mod 2/5 i forløb 3 (500 salte) | 9 % af opgaverne | |

| Squat, U1-U16 | 502 | 525 |
|---|---|---|
| Stoppere | U1-U4 | 0 (U2 er Marcs valg) |
| Lukket | 0 | 7 |
| Venter på Marc | | 7 |
| Åbne | 16 | 2 (U12 og U15) |

## Testresultat

- `node outputs/kritik-525/verify-kritik-525.mjs --blok 1`: grøn (commit 1).
- `node outputs/kritik-525/verify-kritik-525.mjs --blok 2`: grøn (commit 2).
  - Den tjekker blok 1 igen, tallene i de tre JSON-filer mod dokumenterne og U1-U16's status (7/7/2).
  - Den tjekker også, at grenen kun rører de to mapper, at der ikke er nogen upstream, at commit-beskederne er ASCII,
    og at `npm run lint` er grøn.
- `elev-525.mjs`: 4 kørsler med 201 opgaver, som alle havde facit i spillets generatorer. 0 sidefejl, ingen vandret
  rulning og 0 netkald ud. Anden dag: 2 kørsler, 0 sidefejl.
- `squat-525.mjs`: 6 kørsler (3 sider × 2 bredder). 0 JS-fejl, 0 manglende filer, 0 synlige [MARC], 0 atletnavne og
  0 tankestreger i artiklen.
- `npm run lint` er grøn. `npm test` er ikke kørt, fordi grenen ikke rører appens kode.

## Hvad er næste

**Ganita (matematik), efter 518:**
1. **M1:** en åbningsscene på 2-3 linjer efter "Start eventyret", hvor Mølleren eller Ane møder figuren. Rul til
   opgaven. Vis Anes låste quest i panelet fra første opgave.
2. **M6:** efter et forløb, hvor en quest er åbnet: lad eleven vælge ("Hjælp Ane" / "Fortsæt hos Mølleren"), før
   næste opgave vises.
3. **M3:** et sted, der åbner, skal siges (kort og replik; "Grusgraven er åben: Grusgraveren venter"). Det passer
   med 518 blok 2.
4. **M4:** "spørg din lærer eller sidemanden" kun ved 0-1 rigtige i første forsøg.
5. **M5, M7-M9** efter Marcs valg: talparrene i forløb 3-4, et bredere layout på 1280 og Biavleren i sin scene.
6. Kør `outputs/kritik-525/elev-525.mjs` igen efter 518. Den tager `MAT_REF=<gren>`.

**Marc (matematik):** M2. Skal Hoved, Hånd og Hjerte kunne noget (en sti, en hilsen, en genstand), eller skal de to
felter, der står stille, væk? Og skal titlerne kræve en quest?

**Setu (sitet):**
1. **N1:** skriv i valg 11, at artiklen i dag peger på `assets/min-krop/`. Vælger Marc
   `assets/vaerktoejer/min-krop/`, skal artiklens link og ramme ændres i samme commit.
2. **N2/U15:** "opslaget" til "artiklen" nu. "0,09 m/s" enten til kilden, når Yantra har den, eller ud af
   hovedteksten.
3. Udgivelsescommitten efter Marcs valg: U2, U6, datoen, noindex ud, sitemap-linjen og `SITEMAP-KLAR.txt` slettet
   (U8), og U10/U11, hvis Marc siger ja.

**Yantra:** U12 (referencekroppenes højde og vægt), U15 (kilden til 0,09 m/s), U5 i bundtet efter Marcs valg. Ret
også "intet krav" i løftmodellens kilde til `squat-anatomi.js`, så Setus U3 ikke forsvinder ved næste bygning.

**Bhishak:** et kort gentjek, når 518 og M1/M6 er leveret. Samme elev og terning; forventet: en person inden for
2-3 min og et andet sted inden for 30 min.

**Betydning for Hara (school, spor matematik-minispil):**
- Spillet har nu alt, hvad et lille eventyr skal have: personer, kæder, ting man kan se, en helt og et kort.
- Det, der mangler, er vejen ind: de første minutter og valget efter et forløb. Det er små ændringer i
  præsentationen, ikke i reglerne.

## Ærlige grænser

- Eleven er en model, ikke et barn. Keder sig og forvirret er mine skøn ud fra hvad og hvor længe. Tiden er
  modelleret (0,4 s pr. ord, 10 s pr. opgave), ikke målt. 70 % er ét valg.
- Siden er kørt med låst tid og salt (`Date.now` og `Math.random`), så animationer og landsbyens liv er ikke
  vurderet. Lyd er ikke hørt.
- Anden dag med Bigården er en gemt tilstand, ikke spillet frem.
- 518 er ikke committet og derfor ikke set.
- Squat: kun Chromium headless på Windows, uden Google Fonts og ikke på GitHub Pages. U3's rettelse ligger i en
  bygget fil (se Yantra).
- Ingen sub-agenter, ingen push, ingen merges og ingen rigtige elever.
