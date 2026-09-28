Maal dit billede stadig klar til sitet: ja

Ja for den udgave, der står på sitet nu (580, `291f5bf`, godkendt i 585). **Setu skal ikke kopiere den nye udgave endnu.**

Hvorfor:
- De nye miniaturer i "Ligner" (593) er større og uden ulæselig tekst.
- Men tekstens mørke baggrundsfelter er blevet liggende (M1, middel).
- I dødløftets og bænkens miniaturer går der derfor tre mørke striber tværs over kroppen. I "stangen glider frem" ligger én af dem præcis over hånden og stangen, hvor fejlen vises.
- Det er det første, en træner ser, når siden finder en fejl.

Rettelsen er lille (fjern felterne i `src/miniature.js`). Bagefter kan Setu kopiere det hele i én kopi:
- `maal-billede/` hel
- `baenk-figurer/index.html`, efter M2
- `tre-loeft/` og `min-krop/` (DA7)

Resten holder:
- DA7 er lukket.
- V7 er fanget i Yantras test og står, som jeg målte den i 582.
- Klip efter klip i samme fane holder også med mine egne klip (4K, HEVC, MOV og variabel billedrate).
- BA1 er lukket i første sætning. Den næste sætning på figursiden har dog samme slags fejl som DA7 (M2, lav).

# Kritik 598, blok 1: Mål dit billede efter Yantras 586, 593 og 595

Bhishak, 28. sep 2026. Ordre 598.

**Løftmodellen:**
- `entropi-loeftmodel-dhruva` `main`, hentet med `git archive`. Træet er ikke rørt.
- Main stod på `ed41442` (586 og 593 merget), da jeg begyndte. Mens jeg målte, blev 595 merget: **`af745da`**.
- Jeg har målt på `af745da`. Dist er den samme som på `ordre-595` (`2449355`), og 595 ændrede kun `tre-loeft.js` og `min-krop.js`.
- Yantras `docs/RAPPORT-dag-86.md`, `-87.md` og `-88.md` er læst.

**Sitet:** `entropi-coaching-site-wt2`, grenen `vaerktoejer` @ `11c6169` (Setus 591), hentet med `git archive`. Sitets `maal-billede/` er blob for blob 580-udgaven.

## Hvad jeg målte

`outputs/kritik-598/maal-598.mjs` giver **22/22 grønne tjek** (`maal-598.json`, `maal-598.log`, `M-*.png`).

**Siden er målt i sitets kopi, som den bliver, når Setu kopierer:**
- `dist/maal-billede/` og `dist/baenk-figurer/` fra main er lagt ind over sitets kopi, sammen med `tre-loeft/` og `min-krop/`.
- Browseren er Google Chrome 154 headless: 360 og 390 med touch, 1280 med mus.
- Alt net uden for den lokale server er afbrudt: 0 netkald.

**Punkterne er modellens egne tegnede fejlstillinger** (pinhole-kameraet fra main, som i 576 og 585). Der er 8 stillinger: squattens to fejl i bund og sticking, dødløftets to, sumo og bænkens.

**Mine egne scripts:**
- `vaerktoejer-585.mjs` til Ligner
- `klip-582.mjs` til klippene
- en ny pixelmåling af miniaturerne

## Hvad sitet skal have (for Setu)

| Mappe | Sitet (`11c6169`) mod main (`af745da`) | Fra ordre |
|---|---|---|
| `maal-billede/` | `maal-billede.js` ny, `miniaturer/` ny (8 SVG) | 593 |
| `baenk-figurer/` | `index.html` (BA1-sætningen) | 593 |
| `tre-loeft/` | `tre-loeft.js` (DA7) | 595 |
| `min-krop/` | `min-krop.js` (samme regnemodul, ingen synlig ændring) | 595 |
| fejlsiden, squat- og dødløftfigurerne | ens | |

**`src/maalVideo.js` er uændret siden `291f5bf`.** Videoen på sitet er den, jeg godkendte i 582 og 585.

**Kopierer Setu kun `index.html` og `maal-billede.js`, er alle miniaturer brudte.** Jeg har målt det: kun alt-teksten står (`M-390-ligner-kun-to-filer.png`). Mappen skal kopieres hel, som Yantra skriver.

## Yantras punkter

### Dag 87: kan man se fejlen i miniaturerne?

**Ja, i tegningen.** Jeg har målt hver miniature:
- **Fejlfigurens led og skiver** ligger 5,6-15,2 CSS-px fra modellens udførelse svagt bagved. De er matchet på samme radius.
- **Bænken:** "stangen for højt" 15,1 px, "albuen helt ude" 9,8 px.
- **Dødløftet:** "stangen glider frem" er mindst, 5,6 px, og "hoften først" er 13,7 px.
- **Squatten:** 7,7-15,2 px.
- **Kroppens størrelse:** 0,30-0,39 px pr. enhed, som Yantra skriver.

**Bænkens to står side om side** på alle tre bredder: 147 × 116 px på 360, 150 × 118 på 390 og 1280. Der er ingen vandret rul. Alle 8 stillinger × 3 bredder giver Ligner og henter miniaturen fra `miniaturer/`. Hvert link til den hele figur giver 200, og der er 0 JS-fejl.

**Men M1:** teksten er taget ud, tekstens baggrundsfelter er ikke. Alle fire bænk- og dødløftfigurer har tre felter (`<rect fill="#141410" fill-opacity="0.78">`, 98-132 × 17 enheder). Tegnet i 3× dækker de:

| Miniature | Felter | Dækket af figuren |
|---|---:|---:|
| dl-stang-frem | 3 | 14,2 % |
| dl-hofte-foerst | 3 | 10,4 % |
| bp-hoejt-bryst | 3 | 9,5 % |
| bp-albue-ud | 3 | 5,8 % |
| squattens fire | 0 | 0 % |

**Det ses tydeligt** (`M-mini-*-med-felter.png` mod `-uden-felter.png`, og `M-360-ligner-dl-stang-frem.png`):
- Tværs over lår og ryg ligger striber, der ligner en fejl i tegningen.
- I "stangen glider frem" ligger den tredje stribe over hånden og stangen i knæhøjde. Det er det sted, fejlen handler om.
- På bænken ligger to felter over hovedet og bænken.
- Stregerne for momentarmene er blevet stående uden tal. De er små og skader ikke.

`test/miniature593.test.js` tjekker, at "intet tegnet er skåret væk". Den tjekker ikke, at intet tegnet er dækket.

### Dag 87: mangler forfra-billedet i bænkens miniature?

**Nej, ikke i miniaturen.** Linjen under siger selv: "fra siden kan billedet ikke se albuen". De to miniaturer ligner hinanden, stangen tæt på halsen i begge. Det er ærligt, for fotoet kan ikke skelne dem.

Forfra-billedet og "overarm 80° ud" står i den hele figur bag linket. Uden tekst ville den lille ramme ikke sige noget på 150 px.

### Dag 87: er figursidens nye sætning om buen klar for en træner?

**Første sætning (BA1) er rigtig:**
- Sætningen har 22,1, 25,1 og 24,1 cm fra skulderleddet, som figurerne ("skulder 22,1 cm" osv.).
- Den har skridtene 3,0 cm længere mod fødderne og 1,0 cm nærmere halsen, regnet af de viste tal.
- Den siger "men ikke hele vejen".

Sætningen er lang (59 ord, to led), men den kan følges. Den lyder: "målt fra skulderleddet rører stangen 22,1, 25,1 og 24,1 cm mod fødderne, altså ...". BA1 er lukket.

**Næste afsnit har samme slags fejl som DA7 (M2).** Tallene er regnet af urundede værdier, og én gang med fortegn:

| Sætningen siger | Figurerne viser | Af de viste tal |
|---|---|---|
| bue: "vejen 10,5 cm kortere" | vej 46,2 → 35,8 | 10,4 |
| bue: "skulderens momentarm 1,7 cm længere" | momentarm i alt 25,8 → 27,6 | 1,8 |
| bue: "rører 2,0 cm længere mod fødderne" | 22,1 → 24,1 | 2,0 (passer) |
| greb: "vejen 3,8 cm kortere", "skulderens 7,6 cm længere" | 43,0 → 39,2; 25,6 → 33,2 | 3,8 og 7,6 (passer) |
| greb: "albuens 8,2 cm kortere" | albue 7,6 → 0,6 cm | 7,0 |

**Albuen:** i bredt greb er albuens momentarm −0,6 cm, på den anden side. Figuren viser "albue 0,6 cm" og "−3 Nm". "8,2 cm kortere" end 7,6 cm kan en træner ikke få til at passe.

**Om "1,7 ... fordi 2,0"** (Yantras spørgsmål): selv rettet til 1,8 er de to tal ikke ens. Momentarmen i alt regner afstanden ud til siden med. Et kort led, "(i alt, også ud til siden)", ville forklare det.

### Dag 86: V7

Yantras `h264b586`-test er ikke kørt her, men jeg har målt på den nye side:
- **Google Chrome 154:** 24 tryk frem i min VFR-MP4 fra 582 giver 0-24.
- **Playwrights Chromium 151:** 18 → 20, som i 582.

Siden kan intet gøre ved det, og Yantras test fanger det (han målte den rød i 151 og grøn i 153 og 154). V7 er lukket for testene. Grænsen for en træner med en gammel Chrome står.

### Dag 88: DA7 lukket?

**Ja.** Jeg har regnet uafhængigt af Yantras test:
- `aendringsLinje` på main er kørt for alle kropstyper og 120 skruede kroppe fra min egen terning (598): højde 158-198, vægt 60-145, proportioner 89-111 %, sumo, bue og greb.
- Det er alle stillinger i alle tre løft: 411 linjer, heraf 318 med tal.
- Min egen læser tjekker hver linje: tallet er forskellen af parentesens viste tal, og ordet har samme retning. **0 afvigelser.**

**I browseren** (390, touch, sitets kopi med 595) siger Dødløft, Opstilling:
- Lange arme: "hoften bøjer 9° mindre ved opstillingen (51° → 60°)"
- Korte lårben: "torsoen hælder 7° mindre ved opstillingen (62° → 55°)"

Se `M-390-tre-loeft-da7.png`.

**Naboen `dist/deadlift-animation.js`:**
- Den ligger ikke i sitets syv mapper.
- I 108 sætninger ("Sumo giver X cm kortere stangvej", "Overkroppen hælder X° mindre") afviger 18 med 0,1 fra parentesen, fx "4,8° mindre (… mod …)", hvor de viste tal giver 4,9.
- Fortegnet vendte ikke i mine kroppe.
- Den er lav og kun på udviklingssiden.

### Dag 88: klip efter klip i samme fane

Jeg har målt med mine egne klip. 12 klip er åbnet efter hinanden i samme fane: VFR-MOV, 4K, HEVC-MOV, 29,97 MP4, VFR-MP4 og 29,97 MOV, to gange. Der er tre serier: 390 med Luk, 390 uden Luk og 1280 med Luk. Hver runde er 3 tryk frem, Brug dette billede og (Luk).

**Resultat:**
- Alle 36 runder giver 0, 1, 2, 3, og fotoet er billede 3.
- **Med Luk:** 0 levende blob-URL'er og `readyState` 0 efter hver runde.
- **Uden Luk:** altid præcis 1 blob-URL (det åbne klip).
- Altid 1 `<video>`.
- **DOM-knuder:** 254 fra runde 2 til 12.
- **JS-heap:** svinger 3,1-5,0 MB uden at vokse.
- 0 netkald og 0 JS-fejl.

Det bekræfter Yantras 595 med andre klip, inklusive 4K og HEVC. En rigtig telefon (Safari) er stadig ikke målt.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M1 | middel | Miniaturerne i "Ligner" har tekstens mørke baggrundsfelter tilbage (3 i hver af dødløftets og bænkens fire). De dækker 5,8-14,2 % af figuren som striber tværs over kroppen. I "stangen glider frem" dækker de hånden og stangen i knæhøjde, hvor fejlen er. | Yantra: tag `rect` med `fill-opacity="0.78"` (tekstens baggrund) ud i `src/miniature.js`, som `<text>`. Test, at intet tegnet dækkes. Byg og skriv miniaturerne igen. |
| M2 | lav | Bænkens figurside, afsnittet under BA1: "vejen 10,5 cm kortere" (figurerne: 10,4), "momentarm 1,7 cm længere" (1,8) og "albuens 8,2 cm kortere" (figurerne: 7,6 → 0,6; armen skifter side). | Yantra: regn forskellene af de viste tal, som i DA7 og BA1. Sig om albuen, at den går fra 7,6 cm til 0,6 cm på den anden side. Et kort "(i alt, også ud til siden)" forklarer 1,8 mod 2,0. |
| M3 | lav | `dist/deadlift-animation.js`: 18 af 108 sammenligningssætninger afviger 0,1 fra parentesen. Ikke på sitet. | Yantra, når han er i nærheden: samme DA7-regel. |

**Lukket:**
- **BA1:** første sætning.
- **DA7:** 0 afvigelser i 411 linjer.
- **V7:** i testen, og siden er uændret.
- Min grænse fra 582 om **hukommelsen efter Luk videoen**.

**Står:**
- **W4:** forbedret, men M1.
- **DA14:** ikke en del af denne ordre.

## Ærlige grænser

- **Ikke en telefon:** headless Google Chrome 154 (og Chromium 151 til V7) på Windows, ikke en telefon og ikke Safari. Touch er Playwrights.
- **"Kan ses":** at fejlen ses i en miniature, er målt som afstand i CSS-px mellem fejlfigurens og modellens led. Det er ikke prøvet på en træner.
- **Tekstfelterne:** hvor meget de dækker, er målt i pixels, tegnet i 3×. Om en træner læser striberne som en fejl i tegningen, er min vurdering.
- **Punkterne** er modellens egne tegnede stillinger på et tomt billede, ikke klik i et foto.
- **Mine klip** er syntetiske (ffmpeg, fra 582) og ligger i `%TEMP%\kritik-582-klip`, ikke i repoet.
- **Hukommelsen:** kun sidens egne tal (blob-URL'er, knuder, heap), ikke afkoderens.
- **Yantras tests er ikke kørt.** Kun mine egne scripts.
- **Grænserne:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt.
