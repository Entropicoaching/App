Ordre 558

# Kritik 558: fejlgenkendelsen efter Yantras 545, 549 og 554 med den endelige dom, og skakkens "Mit bibliotek" og "Gentag det svære" (Chaturanga 547) (Bhishak)

**fejlgenkendelsen klar til sitet: ja**
**skakken stadig klar til eleverne: ja**

## Gren

`kritik-558` fra `main` (`1bc7420`). Ingen push, ingen merges, ingen sub-agenter. Filer kun under `docs/kritik-558/` og `outputs/kritik-558/`.

Løftmodellen og skak er kun læst med `git archive`, og begge træer er urørt:
- `entropi-loeftmodel-dhruva` `main` @ `346f791`, hvor 545, 549 og 554 er merget,
- skak `main` @ `6e9b86c`, hvor 547 er merget.

Commits:
- `aa6c107` blok 1: fejlgenkendelsen (`docs/kritik-558/FEJLGENKENDELSE.md`).
- Blok 2: skakken (`docs/kritik-558/SKAK-6.md`) og denne rapport. Hashen står i git-loggen.

## Hvad ændret

Intet i løftmodellen, sitet eller skak. Kun kritik.

**Blok 1, fejlgenkendelsen** (`FEJLGENKENDELSE.md`, dom **ja**)

- **L6 lukket.** "Ligner ikke ..." navngiver det tjekkede, siger "Det udelukker ikke fejlen" og "Andre fejl tjekker siden ikke". Den læses ikke som "uden fejl".
- **30-50 ord er ikke for mange.** På 360 er det 4-6 linjer (88-132 px). Men linjen står som tredje grå afsnit under tabellen (lav).
- **L9 lukket.** I sko med torsoen holdt er dommen 0 % ved 1,5-3 cm; i stedet vises et hint.
  - Hintet kommer aldrig på modellens egen bund og kommer på fejlfiguren i 97-98 %. Det er det rigtige snit i bunden.
  - L11 (lav): ved sticking point giver 3 cm stadig 13-16 % falsk dom.
- **L7 og L3 lukket, L8 delvis.** Ved 2,5 cm er det hvert andet, ikke "tredje til femte".
- **Nyt L10 (middel):** linjens tal gælder omhyggelige klik lige fra siden. Med typiske klik overses "stangen glider frem" i 19 % (linjen: "ca. 2 af 100"), "hoften tilbage" i bunden i 14 % (telefonen i hånden 19-23 %) og sumoens "stangen glider frem" i 10,5 % (linjen: "ca. 1 af 100"). Rettes med én bisætning.
- **Sumo med mine dybder og klik:** falsk alarm i snit højst 2,8 %. En bred sumo overses ved gulvet i 14-31 % og stoppes næsten altid.
  - Grænsen "4°" er 3,8° eller 20 cm til siden. Med stativ tjekkes 99 %, i hånden kun 52 % (L12, lav).
  - 3° til den anden side overser "stangen glider frem" i 16-36 %.
- **Bænkens vip fejler til den sikre side.** En bue i lænden (545), halvt af hver og vippet giver ingen falske fund; vagten koster "ikke tjekket" (31-60 %).
  - L13 (lav): skuldrene 3 cm ned mod hofterne giver 3-6 % falsk "stangen for højt", 11 % 10° skråt.
- **L14 (lav):** to koloner i sumoens grund og hintlinket i standardblå på mørk baggrund.

**Blok 2, skakken** (`SKAK-6.md`, dom **ja**)

- **Mit bibliotek** viser præcis min optælling efter 547's regel. "Dit svageste tema" er det rigtige efter reglen (Gaffel på alle tre bredder), og "Øv gafler" virker.
- **Gentag i dag** følger reglen dag for dag med et falsk ur over 13 dage på alle tre bredder: antal, kort, beskeder ("om 3 dage", "i morgen", "om 7 dage", "Den sidder nu"). Ratingen står stille.
- **K12 lukket:** "Ny storm" øverst, 5 missede og "Vis alle".
- **Nye fund:**
  - **K18 middel:** et hint tæller som "rigtigt" i biblioteket.
  - **K19 middel:** "Gentag i dag" står under brættet og under første skærm på telefonen.
  - **K20 middel:** gentagne gåder løfter procenten (Gaffel 40-50 → 75-85 %), og stormens fejl tæller ikke (Mat i 2 "100 %" efter 4 af 4 galt i stormen).
  - **K21 lav:** 7 dage bruges kun efter en ny fejl.
  - **K22 lav:** én dårlig storm giver 17-21 gentagelser næste dag.
  - **K23 lav:** temaer uden for de 12 tæller ingen steder.

**Har det betydning for Hara?** Ja: planet coaching, delmål "Appen mærkbart bedre". Fejlgenkendelsen har nu dommen "klar til sitet", og Setu kan kopiere `dist/maal-billede/`, når Yantra har rettet L10.

## Testresultat

- `node outputs/kritik-558/fejl-558.mjs`: exit 0, 70 s, på `346f791` (`fejl-558.json`, `fejl-558.log`).
- `node outputs/kritik-558/side-558.mjs`: **18/18** på 360, 390 og 1280, uden net og uden JS-fejl, intet gemt, ingen vandret rulning.
- `node outputs/kritik-558/bibliotek-558.mjs`: **105/105** på 360, 390 og 1280 (13 dage med falsk ur), uden net og uden JS-fejl.
- `node outputs/kritik-558/verify-kritik-558.mjs --blok 1` og `--blok 2`: grøn. `npm run lint`: grøn.
- Mine gamle 548-scripts er ikke kørt igen. `fejl-558.mjs` er `fejl-548.mjs` med Yantras rettelse (`fejl-549.mjs`), og `side-558.mjs` erstatter `side-548.mjs`'s fem forældede tjek.

## Hvad er næste

- **Yantra:** L10 først: "med omhyggelige klik" og tallet for hurtige klik i `ingenLinje` (et `typisk` ved siden af `pct` i `OVERSET` og `OVERSET_SUMO`). Derefter efter lyst:
  - L11: hint ved sticking point fra 2,5 cm,
  - L12: "stativ ud for stangen, højst ca. 20 cm til siden" i sumo,
  - L13: skuldrene og skulderklikket i bænkens grænse,
  - L8: "hvert andet til femte",
  - L14: kolonerne og linkets farve, og linjen fremhævet under tabellen.
- **Setu:** kopiér `dist/maal-billede/` fra dhruva `main` til sitet, når L10 er rettet (eller nu, hvis Marc vil have 554 ud først; resten er lavt).
- **Chaturanga:** K19 (Gentag over brættet eller et tal på fanen), K18 (hint er ikke rigtigt), K20 (kun første forsøg i procenten), og så K21-K23. #17 (fremgang over tid) passer godt sammen med K20.
- **Marc:** et rigtigt sumoklip filmet med stativ fra 3 m og et bænkklip med stor bue fra siden ville vise, om L12 og L13 holder uden for modellen.

## Ærlige grænser

- **Fejlgenkendelsen:** kun syntetiske, tegnede figurer og Marcs eget gulv- og knæbillede, et pinhole-kamera uden linseforvrængning og mine antagelser:
  - dybderne, klikfejlen og sumoens knæ og fod ±10 cm,
  - buen på fire måder og skuldrene som et rent skift,
  - træneren i hånden som en fordeling, jeg har valgt.

  Intet rigtigt løft med en kendt fejl, intet i vægtløftersko.
- **Skakken:** min elev er en regel, ikke et barn. Det falske ur sætter datoen pr. dag og genindlæser. Åbninger og felter i Gentag er kun tjekket i logikken, ikke i browseren.
- **Kun headless Chromium på Windows**, ikke en rigtig telefon.
- **Ingen atlet- eller elevdata** ud over Marcs eget klip.
