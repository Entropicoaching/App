Ordre 399

# Rapport: hvorfor matematikopgaverne er "lidt spøjse", læst af læreren og eleven (Bhishak)

Planet: school · Spor: spor-matematik-minispil-tr-n-kompetencerne-som-g-der-014dc3.
Arbejdet vedrører matematikspillet, ikke Coaching-planeten. Der er intet til Haras delmål "Appen
mærkbart bedre".

## Gren

`kritik-399` i `C:\Users\Entropi\Desktop\entropi-app-wt2`, fra `main` @ `1a297ca`. Ingen merges,
intet push.

- Blok 1: `01053fc`, alle opgavetyper genereret og mærket U1-U7.
- Blok 2: `68c9283`, dommen pr. type, M-SP1 til M-SP5 og kornmålingen.
- Blok 3: commit'en med denne rapport. Den indeholder `verify:kritik-399`, rettede kodeplaceringer
  i M-SP3 og M-SP4 og rapporten.

Matematik (`C:\Users\Entropi\Desktop\matematik`, `main` @ `e662c66`) er kun læst via
`git archive` til en scratch-kopi. Intet i matematik er rettet.

## Hvad ændret

- `outputs/kritik-399/opgaver.txt` indeholder 1262 opgaver fra 37 opgavetyper på seks steder:
  Møllen, Grusgraven, Købmanden, Kirken, Sporvognen og Den gamle gang. Der er 30-36 pr. type, og
  alle er lavet med spillets egne generatorer (`QUEST_BANK[..].lavOpgaver`) over 1500 spilsalte.
  - Hver opgave står med svarmuligheder, hint, forklaring og en dom (`DOM: ok` eller
    `DOM: SPOEJS U…` med grund).
  - Øverst står en opsummering pr. type.
  - Typer med under 30 forskellige opgaver i hele spillet er fyldt op med markerede gentagelser.
    Det er selv et fund (U6).
- `outputs/kritik-399/generer-opgaver.mjs` er generatoren og dommens navngivne regler.
- `docs/kritik-399/KRITIK-matematik-opgaver.md` har de fem fund øverst. Derefter kommer en tabel
  pr. sted med andel spøjse og hyppigste U-type, tre ordrette eksempler pr. type med et før/nu-
  forslag, og afsnittet om kornene.
- `outputs/kritik-399/korn-maaling.mjs`, `outputs/kritik-399/korn/` (12 skærmbilleder og
  `maaling.json`): headless måling af kornene over "Rigtigt!".
- `outputs/kritik-399/verify-kritik-399.mjs` og én linje i `package.json` (`verify:kritik-399`).

**Dommen:** 799 af 1262 opgaver (63 %) er spøjse. Uden de to lette fund (svar uden enhed og kun
hele timer) er det 769 (61 %). Pr. sted:

| Sted | Andel spøjse |
|---|---|
| Købmanden | 100 % |
| Kirken | 77 % |
| Sporvognen | 75 % |
| Møllen | 60 % |
| Den gamle gang | 57 % |
| Grusgraven | 33 % |

Regnestykkerne og hintene er fagligt i orden. Det spøjse er historien omkring tallene:

- **M-SP1:** Sporvognen kører 2-7 timer og kun på hele klokkeslæt (`src/spil-quest.js:135-183`).
- **M-SP2:** Købmanden og Kirkens gamle opgaver bruger én skabelon, har svar uden enhed og byder
  på "købmanden deler sine penge ud til kunderne" (`src/spil-quest.js:18-24, 36-58, 88-128`).
- **M-SP3:** Møllens brøker står i historien som "2/4 sæk", "3/9 sæk" og "1/7 sæk", og alt
  begynder med "Mølleren har" (`src/broek-trappe.js:163-451`).
- **M-SP4:** Møllens trin 1-2 har et kværnhjul med malede felter, korn der sendes ud til gårdene,
  "1 sække", kun 14 forskellige delopgaver og et forkortet svar før trin 4
  (`src/broek-trappe.js:96-160`).
- **M-SP5:** Grusgraven har "Tipvognens spor er 1 cm og 9 mm", "En sten starter" i hintet,
  "390 cm = 390 cm", "8 m lang og 300 cm bred" og en grusplads på 2 m
  (`src/maale-trappe.js:61, 81, 85, 195-241, 289, 374-392`).

**Kornene (Ganita 395):** Ja, de forstyrrer, når beskeden er rosen "Rigtigt! 4/6 kan også
skrives 2/3.". På mobilen ligger de oven på teksten i 0,70 s, med op til 7 korn på "også … 2/3".
Ved den korte "Rigtigt!" rører de ikke teksten, men springer fra tomt grønt felt. Årsagen er, at
de starter i feltets midte (`src/spil-app.js:141-144`). Rosen kommer i 18 % af Møllens opgaver og
i 2 af 3 i forløb 4.

## Testresultat

- `npm run verify:kritik-399`: **OK**. Den fandt 37 typer på 6 steder og 1262 opgaver, mindst 30
  pr. type, og hver opgave har en dom. M-SP1 til M-SP5 har tilsammen 24 kodeplaceringer, og alle
  filer og linjer findes i matematik `main`. Kornmålingen findes, og rapporten starter med
  "Ordre 399" og har de fem afsnit.
  - Første kørsel fejlede ærligt: M-SP3 og M-SP4 angav linjerne uden filnavn, og rapporten
    manglede. Begge dele er rettet.
- `npm run lint`: **OK** (exit 0, ingen fund). Min eneste ændring uden for `docs/` og `outputs/` er én
  linje i `package.json`, og ingen `.js` i `src/` er rørt.
- `node outputs/kritik-399/korn-maaling.mjs <kopi> <playwright>`: fire svar målt. Tre rigtige på
  mobil og ét på desktop, og alle fandt det rigtige svar. Tal i `korn/maaling.json`.

## Hvad er næste

Ordren til Ganita, i punktform (ret i matematik, én gren):

- **M-SP1, Sporvognen:** ture på 10-50 minutter i stedet for 2-7 timer, klokkeslæt i
  5-minutters spring med punktum (kl. 13.40), og mindst hver anden opgave går over en hel time.
  Omdøb `sejltid` til `turtid`.
- **M-SP2, Købmanden og Kirken:**
  - `heltalSvarmuligheder` får en enhed (kr, m, m²).
  - `delHandelOpgave` bliver til "venner deler en regning" eller "æbler i kurve".
  - `kasseOpgave` tæller rigtige ting (flasker, bakker æg), og "den store leverance" får store
    tal.
  - Hver type får 3-4 skabeloner.
  - Kirkens `arealOpgave` og `omkredsOpgave` skiftes til Grusgravens `arealTrinOpgave` og
    `omkredsTrinOpgave`.
  - "á" bliver til "à".
- **M-SP3, Møllens brøker:** brøker i historien er altid forkortede, med nævnerne 2, 3, 4, 5, 6,
  8, 10 og 12.
  - Mindst tre forskellige grundled (mølleren, mølledrengen, bageren).
  - "Forlænge" spørger om niendedele i stedet for "hvilken brøk er lige så meget".
  - "Skriv brøken så kort som muligt" bliver til "Forkort brøken så meget som muligt".
  - Distraktoren "lagt d til" kun når d ≤ 2.
  - "Blandet tal" handler om poser.
- **M-SP4, trin 1-2:**
  - `vis: raa` på trin 1-3 (svaret står, som eleven talte det).
  - Kværnhjulet bliver en kageplade eller sække på vognen.
  - `delOpgave` deler mel til bagere, med 4 skabeloner og over 30 forskellige.
  - Ved 1 sæk står "sækken" i hint og forklaring.
  - Stangen tegnes med to tegn eller felter af samme størrelse.
- **M-SP5, Grusgraven:**
  - `LINEAL_TING` får en bestemt form ("Stenen"), som hintet bruger.
  - "fra 0" bliver til "fra 0-stregen".
  - Omregningshintet nævner ikke det stykke, der allerede står i cm.
  - Omregning fra cm til mm bruger søm eller blyant, ikke tipvognens spor.
  - Omkreds med cm bruger skuret eller bedet.
  - Målestok på 1:100 bruger skuret eller vognen, ikke gruspladsen.
- **Kornene:** de springer fra enden af ordet "Rigtigt!" og opad-til-højre. Har beskeden en ros
  eller et hint, springer de fra "+10"-mærket.
- **Bagefter:** en ny læsning (Bhishak) med `generer-opgaver.mjs` mod Ganitas gren. Samme regler
  og samme tal, så det kan ses, om andelen falder.

## Ærlige grænser

- Dommen er min læsning, skrevet som navngivne regler, så hver opgave med samme fejl får samme
  dom. Det er ikke en måling af elever. En anden lærer vil sætte grænsen anderledes, især ved
  "svar uden enhed" og "kun hele timer". Derfor står tallet også uden de to (61 %).
- Kodeplaceringerne er fra matematik `main` @ `e662c66`. Rettes der i matematik først, flytter
  linjerne sig. Verify-scriptet tjekker kun, at fil og linje findes, ikke hvad der står i linjen.
  Det har jeg tjekket med øjnene for M-SP3 og M-SP4.
- Kornene er målt headless med stillbilleder og DOM-prøver hver 25. ms. Det er ikke set med
  øjnene på en rigtig telefon. Kun Møllens forløb 1 er målt, ikke Grusgravens gruskorn (samme
  kode).
- Ordren sagde "skriv kun i dine egne mapper". `npm run verify:kritik-399` kræver én linje i
  `package.json`. Den er tilføjet ligesom `verify:kritik-394`, og selve scriptet ligger i
  `outputs/kritik-399/`.
- `matematik.html`s egne minispil og Lyset er ikke læst. Ordren handlede om stederne i spillet.
- Før/nu-forslagene er forslag, ikke afprøvede generatorer. Nogle "nu" (fx kirkegårdens stendige)
  skal have tal, der passer til stedet, når Ganita skriver dem.
- Fem utrackede billeder under `outputs/kritik-skole*/` lå i træet, før jeg startede. De er ikke
  mine og er ikke rørt.
- Ingen elevdata. Figuren "Ravn" i kornmålingen er en flygtig testprofil i en headless browser.
