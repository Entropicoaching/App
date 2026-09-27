Ordre 517: to kritikker. Mål dit billede efter Yantras 510 (endelig dom til sitet: nej, B13) og skakken som en elev hjemme en søndag (anbefales: ja, K1-K10) (Bhishak)

Fra Dhruva via Marc. Planet school, spor skakbrættet (blok 1 hører til coaching, sporet kropsmodel-til-teknikfeedback).

**Identitet:** repoets CLAUDE.local.md kalder mig Vaidya. Ordren siger Bhishak, og dette træ er Bhishaks hjem, som i 409-511. Jeg har arbejdet som Bhishak, kun under `docs/kritik-517/` og `outputs/kritik-517/`.

## Gren

`kritik-517` fra `main` (`c747f6e`) i `entropi-app-kritik`. Intet er pushet, intet er merget, og ingen sub-agenter er brugt.

- **Blok 1** (`3873a37`): Mål dit billede, `docs/kritik-517/MAAL-BILLEDE-3.md`.
- **Blok 2**: skakken hjemme, `docs/kritik-517/SKAK-HJEMME.md` og denne rapport. Hashen står i `git log`, og commit-beskeden starter med "kritik 517 blok 2".

**Kun læst, intet rørt:**
- `entropi-loeftmodel-dhruva` @ `7f604f7`. Hentet med `git archive` til en midlertidig mappe.
- `skak` @ `61f0dd6`. `skak.html` er åbnet direkte som file://.

## Hvad ændret

Kun kritik. Ingen kode i appen, løftmodellen eller skakken er ændret.

**Blok 1, Mål dit billede** (første linje: "Mål dit billede klar til sitet: nej"):
- **B11 er lukket.** Med Min krop (183 cm/120 kg) på 390 er siden 390 px og tabellen 358 px i alle seks faser, med og uden stangens vægt.
  - ≈ står i guld foran tallet i hver række inden for målefejlen.
  - Forklaringen står lige under tabellen.
- **B12 er lukket.** "Knæ 119,6° (stangen 31 cm under knæet)" står i tallinjen på Marcs knæhøjde-billede, med samme cm som beskeden.
  - Tallinjen er på skærmen sammen med billedets bund.
  - Der er intet mærke ved gulvet og intet ved knæhøjde.
- **Nyt: B13 (middel, stopper sitet).** Tallinjens tal står uden mellemrum imellem og kan ikke bryde.
  - Med en kendt skala er siden 377-388 px på telefoner med 360 og 375 px i squat og dødløft.
  - På 390 er der kun 3 px luft, og med "Stang −8,5 cm" er siden 395 px. Det er E6 fra 511, med samme årsag.
  - Rettelsen er ét mellemrum.
- **Yantras tre spørgsmål:**
  1. ≈ er tydeligt nok.
  2. Ordene i sætningen kan sendes, men indholdet kan ikke, før E1/E2 er rettet. 10° skråt kamera giver "stangen længere tilbage mod hælen (−13,3 cm)".
  3. Mærket må gerne bryde, men tallinjen skal have mellemrum (B13).
- **Før/efter:** E5 er lukket (ord og forbehold). E1 og E2 er stadig åbne.

**Blok 2, skakken hjemme** (første linje: "skakken hjemme god nok til at anbefale til en elev: ja"):
- **Hvad jeg har prøvet:** en elev (script) på 390 med touch og 1280 med mus.
  - spil mod computeren på niveau 3 til mat eller opgivelse
  - analysen med nøjagtighed, Lær af dine fejl og gennemse
  - PGN ud (kopiér og fil) og ind (et lichess-parti med ur og vurdering, en sidevariant, danske bogstaver og et ulovligt træk)
  - forhåndstræk i rigtig tid mod niveau 1 og 8
  - en tilfældig storm
- **Resultat:** alt virker offline uden fejl.
- **Fund:**
  - **K1:** "Mod computeren" ligger under skærmens kant på 390, og Spil står på makker.
  - **K2:** "Indlæs parti" erstatter et parti i gang uden at spørge.
  - **K3:** remis eller "*" fra PGN får ingen analyse.
  - **K4:** navnene fra PGN vises ikke.
  - **K5:** spyd og spid.
  - **K6:** klassens bord nr. står hjemme.
  - **K7:** stormen står under kanten på 390.
  - **K8:** nøjagtigheden smigrer et tabt parti og kan ikke sammenlignes med lichess.
  - **K9:** stormen viser ikke de missede gåder.
  - **K10:** øvebrættet har ingen koordinater.

## Testresultat

- `node outputs/kritik-517/maal-side-517.mjs`: **20/20** grønne (dhruva `7f604f7`).
- `node outputs/kritik-517/skak-517.mjs`: **18/18** grønne (skak `61f0dd6`) i den gemte kørsel. To kørsler før tjekkene var skrevet gav den samme adfærd. Tallene skifter, fordi computeren trækker tilfældigt, og tjekkene måler adfærd.
- `node outputs/kritik-517/verify-kritik-517.mjs --blok 1`: grøn (commit 1).
- `node outputs/kritik-517/verify-kritik-517.mjs --blok 2`: grøn. Den tjekker:
  - dokumenterne og de gemte målinger
  - at grenen kun rører `docs/kritik-517` og `outputs/kritik-517`
  - at der ikke er nogen upstream
  - at commit-beskederne er ASCII
  - at dhruva og skak er urørte
  - `npm run lint`
- `npm run lint`: grøn.

## Hvad er næste

**Yantra** (Mål dit billede, `src/embed/maalBillede.js`):
1. **B13:** mellemrum mellem tallinjens spans (`.join(' ')` eller flex-wrap med gap). Test: `scrollWidth <= 360` med Min krop i alle seks faser og i før/efter med "Stang −8,5 cm". Så er målesiden **ja** til sitet. Det lukker også E6.
2. **Før/efter før den kommer på sitet:** E1 (tærskel pr. række eller tre klik pr. billede) og E2 (skrå kamera: to nav eller en advarsel). Indtil da skal "Størst forskel"-sætningen skjules på sitet, eller forbeholdet skal stå i selve sætningen.
3. B10 venter stadig på Marcs squatklip fra siden.

**Setu** (værktøjssiden):
- Kopiér ikke `dist/maal-billede/` til sitet, før B13 er rettet og merget.
- Kopierer Setu før, så med "Størst forskel" skjult og en note om telefoner under 390 px. Det anbefaler jeg ikke, fordi rettelsen er ét mellemrum.

**Chaturanga** (skak):
1. **K1:** husk sidste modstander (computer eller makker), og sæt "Mod computeren" over brættet på en telefon (eller et lille startkort "Spil mod computeren").
2. **K2:** "Indlæs parti" spørger som "Start forfra", når et parti er i gang.
3. **K3:** analysér ethvert indlæst parti (også remis og "*"), eller sig hvorfor ikke.
4. **K5:** ét ord: "Spyd" (som knapperne) eller "Spid" overalt.
5. **K4, K6-K10** er små. K8 er én sætning i forklaringen: "Tallet kan ikke sammenlignes med lichess, og efter et afgjort parti stiger det."
- **MOD-LICHESS #3 (gådetemaerne)** er stadig det største hul mod lichess og venter på Marcs ja.

**Hara:**
- **Blok 1** har betydning for Coaching-planeten (sporet kropsmodel-til-teknikfeedback). Mål dit billede er ét mellemrum fra sitet.
- **Blok 2** hører til school og har ingen betydning for delmålet "Appen mærkbart bedre".

## Ærlige grænser

- **Kun headless Chromium på Windows.** Ingen rigtig iPhone, Android eller skole-pc. B13's margen på 390 (3 px) kan gå begge veje med en anden skrifttype.
- **Mål dit billede:**
  - De syntetiske figurer er modellens egne stillinger uden perspektiv.
  - Marcs klip er mine egne klik fra 494, og skærmbillederne af det er kun udsnit (der er andre mennesker i baggrunden).
  - E3 og E4 er ikke regnet igen.
- **Skakken:**
  - Eleven er et grådigt, tilfældigt script, ikke et barn.
  - Forhåndstræk er ikke prøvet i lyn mod en makker, og lyd, briksæt, biblioteket og klassens time er ikke prøvet.
  - Udklipsholderen blev læst med browserens tilladelse.
- **Ingen rigtige elever eller atleter.** Kun Marcs eget klip fra 462 og syntetiske data.
