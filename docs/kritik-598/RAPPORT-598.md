Ordre 598: to kritikker, Mål dit billede efter Yantras 586, 593 og 595 og skakken efter Chaturangas 592, med de to domme (Bhishak)

Planet: coaching. Spor: spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5.

**Domme:**
- **Maal dit billede stadig klar til sitet: ja.** Det gælder udgaven på sitet (580), men **Setu skal ikke kopiere den nye udgave endnu.**
  - Miniaturerne fra 593 har tekstens mørke baggrundsfelter tilbage. De ligger som striber tværs over kroppen i dødløftets og bænkens figurer og dækker 5,8-14,2 % af figuren. I "stangen glider frem" dækker de hånden og stangen (M1, middel).
  - Rettelsen er lille. Derefter kan Setu kopiere det hele i én kopi, når også 599 (merget undervejs, ikke vurderet) har fået sin kritik.
  - DA7, V7 og klip efter klip holder. BA1 er lukket, men afsnittet under har samme slags fejl som DA7 (M2, lav).
- **skakken stadig klar til Marcs klasse: ja.**
  - K26 er lukket på alle fire skærme, og klassens fremgang virker, som Marc ville bruge den.
  - K25 er lukket i de store temaer, men ikke i temaer med en lille pulje: Mellemtræk, Angreb på f7, Bagerste række og Offer (S5, lav).

## Gren

`kritik-598` fra `main` (`720084a`) i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter. Kun filer under `docs/kritik-598/` og `outputs/kritik-598/`.

**Hvad jeg har læst, og hvordan:**
- **Løftmodellen:** `entropi-loeftmodel-dhruva` `main`, hentet med `git archive`.
  - Main stod på `ed41442` (586 og 593), da jeg begyndte. 595 blev merget, mens jeg målte (`af745da`).
  - Jeg har målt alt på `af745da`. Dens dist er den samme som `ordre-595` (`2449355`).
  - Efter commit 1 blev Yantras 599 merget (`03c929e`). Den ændrer kun `maal-billede.js` og `index.html`. Jeg har kørt blok 1 igen på `03c929e` (23/23, samme tal) og lagt den nye måling i commit 2. 599's nye funktioner er ikke vurderet.
  - Læst: `docs/RAPPORT-dag-86.md`, `-87.md` og `-88.md`.
- **Sitet:** `entropi-coaching-site-wt2`, grenen `vaerktoejer` @ `11c6169` (Setus 591), hentet med `git archive`.
- **Skak:** `main` @ `890c033` (592 merget), hentet med `git archive`. Læst: `outputs/RAPPORT-592.md`.
  - Chaturanga arbejder på 597, men har intet committet på `ordre-597`. Den er ikke med.
- **Alle tre træer er urørte.**

**Commits:**
- `e6cf62b` kritik 598 blok 1: Mål dit billede
- blok 2: skakken, verificering og denne rapport. Hashen står i `git log`, for den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i løftmodellen, sitet eller skak. Nye filer:

- **Dokumenterne:**
  - `docs/kritik-598/MAAL.md`: blok 1, dom i første linje, Setus kopi, Yantras punkter og fund M1-M3.
  - `docs/kritik-598/SKAK.md`: blok 2, dom i første linje, som elev og som lærer, fund S5-S6.
- **`outputs/kritik-598/maal-598.mjs`** + `.json` + `M-*.png`. Siden er målt i sitets kopi med main lagt oven i:
  - hvad Setu skal kopiere, blob for blob
  - miniaturerne, både som filer (led og skiver mod modellens, tekstfelterne i pixels tegnet i 3×) og i "Ligner" på 360, 390 og 1280
  - kopi af kun to filer
  - bænkens figurside mod figurernes egne tal
  - DA7 i 411 linjer og i browseren
  - 12 klip efter hinanden med mine klip fra 582
  - V7 i Chrome 154 og Chromium 151
- **`outputs/kritik-598/skak-598.mjs`** + `.json` + `S-*.png`. Min `skak-590.mjs` (A-E), nu også på 360, plus:
  - **F:** K26 med 48 tryk på 4 skærme
  - **G:** K25/K17 i browseren og 400 nye elever i node med appens egen vælger
  - **H:** Marcs to uger med fravær og blandede udgaver
- **`outputs/kritik-598/verify-kritik-598.mjs`:** `--blok 1` og `--blok 2`, uden browser og net.

## Testresultat

- **`node outputs/kritik-598/maal-598.mjs`:** 22/22 grønne på `af745da` (commit 1) og 23/23 på `03c929e` (commit 2) (Google Chrome 154.0.8037.57 og Chromium 151.0.7922.34), 0 netkald.
- **`node outputs/kritik-598/skak-598.mjs`:** 58/58 grønne, 0 netkald og 0 JS-fejl.
  - Undervejs var tre tjek røde, fordi mit eget tjek var forkert: listen hedder "Gaffel", og Aflede er rigtigt nok "kan ikke sammenlignes".
  - Et fjerde tjek var rødt, fordi "Angreb på f7" gav 1049. Det er nu fund S5.
- **`node outputs/kritik-598/verify-kritik-598.mjs --blok 1`** og **`--blok 2`:** grønne.
- **`npm run lint`:** grøn.

Yantras og Chaturangas egne tests er ikke kørt. Kun mine scripts.

## Hvad er næste

**Yantra (løftmodellen):**
1. **M1 først:** tag tekstens baggrundsfelter (`rect` med `fill-opacity="0.78"`) ud i `src/miniature.js`, som `<text>`.
   - Lav en test, der tjekker, at intet tegnet dækkes, ikke kun at intet er skåret væk.
   - Skriv miniaturerne igen med `scripts/ordre-593-miniaturer.mjs`.
2. **M2:** bænkens figurside, afsnittet under BA1.
   - Regn "vejen ... kortere" og "momentarm ... længere" af de viste tal (10,4 og 1,8, ikke 10,5 og 1,7).
   - Sig om albuen i bredt greb, at den går fra 7,6 cm til 0,6 cm på den anden side, ikke "8,2 cm kortere".
   - "(i alt, også ud til siden)" forklarer, hvorfor 1,8 ikke er 2,0.
3. **M3 (lav, når han er i nærheden):** samme DA7-regel i `dist/deadlift-animation.js`.
4. Fra hans egen liste står DA14 tilbage.

**Bhishak (næste kritik):** Yantras 599 (Gem billedet med tallene, piletasterne), før Setu kopierer.

**Setu (sitet), når Dhruva giver ordren efter Yantras M1 (og gerne M2) og en kritik af 599, i én kopi:**
- **Hele `dist/maal-billede/`** med `miniaturer/`. Kun to filer giver brudte billeder, målt.
- **`dist/baenk-figurer/index.html`**
- **`dist/tre-loeft/` og `dist/min-krop/`** (DA7)

Fejlsiden og figurerne er de samme. Ikke før M1 er rettet: 580-udgaven på sitet er stadig godkendt og bedre end en med striber over kroppen.

**Chaturanga (skak):**
- **S5 (lav):** lad også de 3 af 10 valg fra hele temaet i `vaelgTemaGaade` holde sig inden for et vindue, eller tage temaets egne gåder. Test med 400 nye elever × 20 tryk pr. tema, som i `skak-598.mjs` del G3.
- **S6 (lav, ingen rettelse nødvendig):** overvej at skrive, hvor mange der har øvet et tema, i "kan ikke sammenlignes".
- Derefter hans egen liste (#23, #25, #26).

**Marc:** intet nyt at gøre. En rigtig telefon (Safari og en adresselinje, der folder sig) er stadig det, ingen af os kan måle. Det gælder både Mål dit billede og "Find feltet".

**Hara:** coaching-planeten. Mål dit billede er værktøjet, trænerne ser først. M1 er det, der står mellem den nye udgave og sitet.

## Ærlige grænser

- **Ikke en telefon:** headless Google Chrome 154 og Chromium 151 (Mål dit billede) og Playwrights Chromium (skak) på Windows. Touch er Playwrights.
- **Mål dit billede:**
  - At fejlen "kan ses" i en miniature, er målt som afstand i CSS-px mellem fejlfigurens og modellens led.
  - At striberne ser ud som en fejl i tegningen, er min vurdering fra skærmbillederne.
  - Punkterne er modellens egne tegnede stillinger, og klippene er mine syntetiske fra 582. Ingen er optaget af en telefon.
- **Skak:**
  - Min elev er et script, og koderne er opdigtede.
  - Simuleringen i node bruger bankerne, som mit script kender dem. Appens pulje kan have flere egne gåder, men browseren gav samme billede.
  - Kameraet er falsk.
- **Undervejs:** main flyttede i løftmodellen (595). Jeg har målt alt på den nye main og skrevet det.
- **Grænserne:** ingen rigtige atleter, elever eller klip. Intet er pushet eller merget, og løftmodellen, sitet og skak er ikke rørt.
