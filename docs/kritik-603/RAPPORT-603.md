Ordre 603

# To kritikker: Mål dit billede efter Yantras 599 og 601, matematikken efter Ganitas 596 og 602 (Bhishak)

**Dommene:**
- **Mål dit billede klar til Setus kopi: nej.** 599 og 601 virker, men mit M1 fra 598 (de mørke striber i miniaturerne) er ikke rettet. Når det er rettet, kopierer Setu i én kopi `maal-billede/` hel, `tre-loeft/`, `min-krop/` og `baenk-figurer/` fra løftmodellens `main`.
- **Matematikken stadig klar til Marcs klasse: ja.** Det gælder `main` (596). 602 er ikke merget og bør vente på Marcs valg af grænse (M14).

## Gren

`kritik-603` fra `main` (`ad42458`). Ingen push, ingen merge, ingen sub-agenter. Filer kun under `docs/kritik-603/` og `outputs/kritik-603/`.

- `559de4a` kritik 603 blok 1: Mål dit billede efter Yantras 599 og 601 (`docs/kritik-603/MAAL.md`).
- Blok 2 (commit 2): matematikken, verificering og denne rapport (`docs/kritik-603/MATEMATIK.md`, `RAPPORT-603.md`). Hashen står i git-loggen.

**Målt på:**

| | Hash | Bemærkning |
|---|---|---|
| Løftmodellen `main` | `207d4ec` | 601 blev merget undervejs; 599 alene er `03c929e` |
| Sitet `vaerktoejer` | `11c6169` | |
| Matematik `main` | `c63394a` | 596 |
| Matematik `ordre-602` | `bb5c678` | Ganitas `3cf77fd` kom undervejs, uden kodeændring |

Alt er hentet med `git archive`, og ingen af de tre træer er rørt.

## Hvad ændret

Jeg har ikke ændret noget i appen, løftmodellen, sitet eller matematikken. Jeg har lavet to kritikker med mine egne scripts.

**Blok 1, Mål dit billede** (`MAAL.md`, `maal-603.mjs`, 25 tjek). Jeg målte i sitets kopi med 599 og 601 lagt oven i, Chrome 154 headless på 390 og 1280, uden net.

- **599, Gem billedet med tallene:** filen er et PNG på 1200 px med sidens tabel. Der er 0 netkald og tomt lager. Billedet kan sendes alene; jeg har set det.
- **599, piletasterne:** i mit VFR-klip er hvert tryk ét billede. Der sker intet i felter, uden for siden eller med Shift, og efter Luk er tasterne sidens egne igen.
- **601, filen åbnes igen:** samme klik, krop og tabel.
  - Åbnet og gemt 8 gange i træk er billedet højst 0,021 af 255 fra det første.
  - Et fotos EXIF følger ikke med.
  - Et foto på 24 mio. pixels gemmes som 4899 × 3266 (7,7 MB).
  - Ni filer, jeg har lavet selv, kører ingen kode.
- **601, før og efter fra en fil:** datoen står ved billedet, og Byt vender fortegnet. En anden fase afvises.
- **M4 (lav, ny):** en måling, siden ikke kan bruge, åbnes stille som et almindeligt billede. Datoen og billedets størrelse tjekkes ikke.
- **M1 (middel), M2 og M3 (lav) står** fra 598.

**Blok 2, matematikken** (`MATEMATIK.md`). Min elev fra 590 har fået tre nye knapper: gætterens ur (3 s), en svag ærlig elev (40 % i første forsøg) og genindlæsning. Jeg har kørt 9 kørsler (22 elevforløb) på `main` og `ordre-602`, 390 og 1280.

- **596 holder.** Den ærlige elev har ingen pause over 2:37 uden "+N". Takkekortet efter en quest viser bonussen.
- **M7, halvt lukket af 602:** den hurtige gætter falder fra 370 og 645 til 225 og 435. Koden viser nu samme niveau som den ærlige (Øvet), men følgergætterens tal er stadig 435 mod 260.
- **M13 (lav, ny):** den ærlige elev ser "står stille" 2-3 gange. Ganitas rapport siger, at hun ingen ser.
- **M14 (middel, ny):** den svage ærlige elev falder fra 165 til 95. Hun får 10 "+N" i stedet for 23 og venter op til 10:18. Gætteren rammer 27-30 % i første forsøg og den svage elev 43 %. En grænse på en tredjedel ville skille dem; halvdelen gør ikke.
- **Genindlæsning før hver opgave** hjælper ikke gætteren, for runden starter forfra (Brøker 50).

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-603/maal-603.mjs` | **25/25 grønne** (Chrome 154.0.8037.57), 0 netkald, 0 JS-fejl |
| `bash outputs/kritik-603/koer-elever-603.sh a` og `b` | 9 kørsler, 22 elevforløb, alle exit 0, 0 JS-fejl, 0 netkald |
| `node outputs/kritik-603/verify-kritik-603.mjs --blok 1` | grøn (før commit 1) |
| `node outputs/kritik-603/verify-kritik-603.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

`maal-603.log` og elevernes `.log` er gitignored. JSON'en (`maal-603.json`, `elev-603-*.json`) er committet.

**Rødt undervejs, alt i mine egne scripts:**
- **Tabellen:** mit første tabeltjek var for stramt. Sidens første celle har rækkens fodnote med.
- **Før og efter:** jeg slog Sammenlign til, før der var et billede, og læste den forkerte tabel.
- **Store fotos:** mine punkter lå uden for billedet, så filen blev afvist. Det førte til M4.
- **Højden og vægten i billedet:** jeg ledte efter "180 cm", hvor billedet skriver "180,0 cm".

Alle fire er rettet, og hele målingen er kørt igen på `207d4ec`.

## Hvad er næste

**Yantra:**
1. **M1:** fjern tekstens baggrundsfelter (`rect` med `fill-opacity="0.78"`) i `src/miniature.js`. Test, at intet tegnet dækkes, og byg `miniaturer/` igen. Det er den eneste ting, der står mellem 599/601 og sitet.
2. **M2** på bænkens figurside (10,5 / 1,7 / 8,2 cm) og **M4** (en fil, siden ikke kan bruge, skal sige det; tjek datoen og billedets størrelse). Begge er små.
3. **M3,** når han er i nærheden.

**Setu:** vent på Yantras M1-commit. Kopiér så i én kopi fra løftmodellens `main`:
- `dist/maal-billede/` hel, med `miniaturer/`
- `dist/tre-loeft/` og `dist/min-krop/` (W7)
- `dist/baenk-figurer/index.html`

Kopiér ikke kun de to filer i `maal-billede/`, for så er miniaturerne brudte.

**Ganita:**
1. **Merg ikke 602, før Marc har valgt grænsen (M14).**
2. Ret sætningen "Den ærlige elev ser ingen af linjerne" (M13).
3. Overvej, om en halv værdi kan hæves, når forløbet senere klares over grænsen.
4. Prøv en quest, der har hvilet, og genindlæsning mellem to runder. Dem har jeg ikke målt.

**Marc:**
- **M14 er dit valg.** Skal et forløb være halvt værd under halvdelen rigtige i første forsøg (heltens regel), eller under en tredjedel? En tredjedel rammer gætteren og ikke det barn, der har svært ved det.
- M2, N1, M4, M5 og M11 fra matematikken står som før.

**For Hara (Coaching, "Appen mærkbart bedre"):** intet af dette er i coaching-appen. Mål dit billede er Entropis værktøj på sitet. Når M1 er rettet og Setu har kopieret, kan en træner gemme en måling og åbne den igen i uge 8. Det er Hara-relevant for værktøjssiden, ikke for appen.

## Ærlige grænser

**Ingen telefon:**
- Headless Chrome 154 og Playwrights Chromium på Windows, ikke Safari, Android eller en skole-pc.
- Om iPhone gemmer filen, og om Fotos beholder målingen, kan jeg ikke svare på herfra.

**Kun syntetiske data:**
- Løftbillederne er flader klikket med modellens punkter, og klippet er mit fra 582.
- Eleverne er min model ("Tulle").
- Ingen atleter, elever eller klip, og ingen atletdata i filerne.

**Vurderinger, ikke målinger:**
- "Kan sendes alene", "Byt kan ikke overses" og "venligt nok" er min vurdering, ikke prøvet på en træner eller et barn.

**Ikke kørt eller målt:**
- Yantras og Ganitas egne tests er ikke kørt. Kun mine scripts.
- Genindlæsning mellem runder og en quest, der har hvilet.

**Grænserne:**
- Løftmodellen, sitet og matematikken er ikke rørt.
- Intet er pushet eller merget.
