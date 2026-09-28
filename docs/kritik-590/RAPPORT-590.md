Ordre 590: to kritikker, matematikken efter Ganitas 578, 583 og 588 og skakken efter Chaturangas 577, 581, 587 og 592, med de to domme (Bhishak)

Planet: school. Spor: spor-matematik-minispil-tr-n-kompetencerne-som-g-der-014dc3.

**Domme:**
- **matematikken klar til Marcs klasse: ja.**
  - Koden og laerer.html lækker intet, og om-tag kan ikke farmes.
  - Men en elev, der gætter hurtigt, får flere point og en stærkere kode end den, der regner (M7, middel). Det bør rettes, før koderne styrer klassens time.
- **skakken klar til Marcs klasse: ja.**
  - Koden, QR-koden, kameraet og lærersiden lækker intet.
  - Tilbage er kun lave fund. QR-scanningen er ikke prøvet med et rigtigt webkamera (S4).

## Gren

`kritik-590` fra `main` (`345fd03`) i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter. Kun filer under `docs/kritik-590/` og `outputs/kritik-590/`.

**Hvad jeg har læst, og hvordan:**
- **Matematik:** `main` @ `a615468` (578, 583 og 588 merget) og `2774da7` (før 588), hentet med `git archive`. Læst: `RAPPORT-578.md`, `-583.md` og `-588.md`.
- **Skak:** `main` @ `890c033` (577, 581, 587 og 592 merget), hentet med `git archive`. Læst: `RAPPORT-577.md`, `-581.md`, `-587.md` og `-592.md`.
- **Begge træer er urørte.**
- **To merges kom undervejs:** 588 og 587 var ikke merget, da jeg begyndte. De blev merget, mens jeg målte (og 592 med). Jeg har målt alt igen på de nye `main`.

**Commits:**
- `c70dbe5` kritik 590 blok 1: matematikken
- blok 2: skakken, verificering og denne rapport. Hashen står i `git log`, for den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i matematik eller skak. Nye filer:

- **Dokumenterne:**
  - `docs/kritik-590/MATEMATIK.md`: blok 1, dom i første linje, fund M7-M12.
  - `docs/kritik-590/SKAK.md`: blok 2, dom i første linje, fund S1-S4.
- **Min elev i matematik:**
  - `outputs/kritik-590/elev-590.mjs`: min elev fra 572 med én ny elev, **gætteren** (`GAET=1`). Den skriver også bonus-, loft- og niveau-linjer med elevens ur.
  - `opsummer-elev-590.mjs` laver tabellerne.
  - Fem kørsler: `elev-590-{foer,efter}-*.json`, før og efter 588, med terning 525 og 731 og gætteren.
- **Målrettede prøver:**
  - `outputs/kritik-590/matematik-590.mjs` + `.json` + `M-*.png`: farme-reglerne på alle forløb, koden og laerer.html.
  - `outputs/kritik-590/skak-590.mjs` + `.json` + `S-*.png`:
    - min skak-elev i de fem nye temaer, koden og laerer.html
    - min egen QR-læser, et falsk kamera og klassens fremgang
- `outputs/kritik-590/verify-kritik-590.mjs`: `--blok 1` og `--blok 2`.

**Matematik, kort:**
- **Farme ved om-tag: nej.**
  - Loftet holder på alle 63 forløb og quests.
  - Et klaret forløb taget om 1.000 gange giver 0.
  - `oevePoint` 99999 renses til loftet.
- **Farme ved at gætte: ja (M7, middel).**
  - Gætteren (1 s pr. tryk, tilfældig knap) får Brøker 370-645 (Øvet til Dygtig) på 20 min. Den ærlige elev får 220-260 (Øvet).
  - Mestringen nås ved held, når forløbet kan tages om uden grænse.
  - Tallene er ens før og efter 588.
- **Koden:**
  - Kun de syv niveauer. Samme kode med et andet navn og ur.
  - Intet netkald, HTML vises som tekst, og intet gemmes uden flueben.
  - I praksis entydig, og én kode viser én elev (M11, lav).
- **Ganitas spørgsmål:**
  - 3:20 uden "+N" er om-tag ved loftet (M8).
  - "Øv her" og klaret-skærmen er lukket af 588 (M9, M10).
  - Niveau-linjen ved svaret dækkes i 0,8 s af "+10 Brøker" (M12, lav).

**Skak, kort:**
- **Koden:**
  - Udgave 1 og 2 bærer kun procent. 2.000 koder går ind og ud uden fejl.
  - Samme kode en måned senere og uden ugerne.
  - `skak.html` kan hverken læse koder eller bruge kameraet.
- **QR-koden:**
  - Min egen læser giver præcis de 20 tegn og intet andet.
  - Det falske kamera giver A, B, A i feltet.
  - Intet billede gemmes (0 `toDataURL`/`toBlob`/optagelse), og kameraet slukkes ved Stop og faneskift.
  - Når kameraet nægtes, siger siden "tast", og tastefeltet virker.
- **laerer.html:**
  - 25 syntetiske koder med to udgaver: "25 koder læst.", "Klassens time: gafler" og ingen kode i resultatet.
  - HTML i feltet vises som tekst.
  - Klassens fremgang (592) viser ingen kode, og begge sæt gemmes kun med flueben.
- **De nye temaer:**
  - Alle 30 gåder kom fra det rigtige tema og blev løst.
  - Aflede er svært for en begynder (S2).

## Testresultat

- **`matematik-590.mjs`:** 25/25 grønne på `a615468` (også 25/25 på `2774da7` før 588).
- **`elev-590.mjs`:** fem kørsler á fire (travl og følger på 390 og 1280), alle med 0 netkald og 0 JS-fejl:
  - før 588: terning 525 og gætteren
  - efter 588: terning 525, terning 731 og gætteren
- **`skak-590.mjs`:** 43/43 grønne på `890c033`. Første kørsel på `f7966e8` var 22/24; de to røde var min egen fejl i de lagte tal (se SKAK.md) og blev 24/24.
- **`node outputs/kritik-590/verify-kritik-590.mjs --blok 1`:** grøn (før commit 1).
- **`--blok 2`:** grøn. Den tjekker grenen og grænserne, alle tjek i JSON-filerne, hasherne, dommene, afsnittene, fund-tabellerne, ingen tankestreger og ingen atletnavne.
- **`npm run lint`:** grøn.
- **Røde undervejs, alle i mine egne prøver:**
  - `/s+/` fjernede alle "s" i elevens tekster (rettet, og alle kørsler lavet igen).
  - Et figur-udseende, der ikke findes.
  - Forkerte skak-tal i frøet.
  - Intet af det var en fejl i spillene.

## Hvad er næste

**Ganita (matematik), i denne rækkefølge:**
1. **M7 (middel):** få gætteren til ikke at vinde, kun i visningen; mestringen røres ikke. Point undervejs kun for rigtigt i første forsøg, eller ingen svar-point fra 3. om-tag af samme forløb (bonussen står). Mål med `MAT_REF=HEAD TAG=efter GAET=1 SEED=525 node outputs/kritik-590/elev-590.mjs` (min elev; den ligger i entropi-app-kritik). Målet er, at gætteren ikke når over den ærlige elevs 220-260.
2. **M12 (lav):** niveau-linjen under "Rigtigt!" i fuld bredde, så "+10 Brøker" ikke dækker den, og opgavens tekst ikke presses ind i en spalte. Det er 588's eget forslag.
3. **M11 (lav, Marcs valg):** teksten "Koden er dine tal, ikke dit navn" og en lærerside, der venter på 5 koder. Gør det sammen med Chaturanga, så de to ligner hinanden.

**Chaturanga (skak):**
1. **#23 lette gåder i aflede og fanget brik (S2):** min elev klarer 1 af 6 første træk i aflede.
2. **S1 (lav, Marcs valg):** samme tekst og samme "mindst 5 koder" som Ganita.
3. **S3 (lav):** fold "Øvet af under halvdelen" sammen på 390.

**Marc:**
- Prøv QR-scanningen med et rigtigt webkamera og to elever, før du regner med den (S4). Tastefeltet er reserven.
- M2, N1, M4 og M5 i matematik er stadig dine.

## Ærlige grænser

- **Eleverne er modeller, ikke børn:**
  - I matematik: to terninger og en gætter med et hurtigt ur (1 s pr. tryk), så gætterens tal er et øvre skøn.
  - I skak: min begynder-model, tre gåder pr. tema.
- **Headless Chromium på Windows**, 390 og 1280 px. Ingen rigtig telefon, skole-pc eller webkamera.
- **Kameraet er falsk** (`canvas.captureStream`), og min QR-læser kan kun version 2 og læser SVG-stien, ikke pixels.
- **Matematikkens skærme er Ganitas:** klaret-skærmen og niveau-linjen er set i hans skærmbilleder fra 583 og 588, sammen med min elevs tidsstempler.
- **Kun syntetiske data:**
  - Elever: "Tulle", "Pip" og min skak-elev.
  - Koder: 25 + 25 opdigtede (frø 574, 577 og 590) og mine egne udgave 1-koder.
  - Ingen rigtige elever, ingen navne og intet pushet.
- **Ikke gentjekket her:** K26 (592, "Find feltet" ruller) og 588's reduced-motion-vej.
