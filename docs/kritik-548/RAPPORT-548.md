Ordre 548: fejlgenkendelsen igen efter Yantras 537 og 541, og LAES-SQUAT.html som Marc ville læse den. Dom 1: "fejlgenkendelsen klar til sitet: nej" (ja, når L6 og L9 er skrevet om). Dom 2: "LAES-SQUAT hjælper Marc med at vælge: ja".

Bhishak, 27. sep 2026. Ordre 548 fra Dhruva via Marc. Planet coaching, spor spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5.

## Gren

`kritik-548`, lavet fra `main` på `02a0571` i `entropi-app-kritik`. Ingen push, ingen merge, ingen upstream.

| Commit | Hvad |
|---|---|
| `ba97339` | Blok 1: fejlgenkendelsen (`docs/kritik-548/FEJLGENKENDELSE.md`, `outputs/kritik-548/fejl-548.*`, `side-548.*`, `S-*.png`, `verify-kritik-548.mjs`) |
| commit 2 | Blok 2: LAES-SQUAT og denne rapport (`LAES-SQUAT.md`, `RAPPORT-548.md`, `laes-548.*`, `L-*.png`). Hashen står i `git log`; beskeden starter med "kritik 548 blok 2". |

- Filer kun under `docs/kritik-548/` og `outputs/kritik-548/`.
- Læst, ikke rørt:
  - `entropi-loeftmodel-dhruva` main `ca860bf`, hentet med `git archive` til en midlertidig mappe,
  - `entropi-coaching-site` (`915e57b`, `9390990`, `8df8846`) med `git show`,
  - `LAES-SQUAT.html` og Setus `ordrer/kilder/setu-543/`.
- Ingen sub-agenter.

## Hvad ændret

Ingen kode er ændret. To kritikker er skrevet.

**Blok 1, fejlgenkendelsen** (`FEJLGENKENDELSE.md`):
- Mine `fejl-536.mjs` og `side-536.mjs` er kørt igen som `fejl-548.mjs` og `side-548.mjs` med samme pinhole, dybder og klikfejl. Nyt: to pladser mere (20° og 10° til den anden side), svaret på linjen for hver regel, sko med hæl, tæer ud på to måder, sidens skøn af kameraets vinkel og modelvalget i sko omvendt.
- **L1, L2, L4 og L5 er lukket:**
  - modellens bane over gulvet giver højst 1,3 % "hoften stiger først" fra ti pladser,
  - der står altid en linje med grunden,
  - "gennemsnittet for din højde" uden Min krop,
  - telefonen i hånden er nævnt.
- **L3 er delvis lukket:** feltet "Sko med hæle" klarer high bar og hæl, men "dér letter hælen" står stadig i sætningen.
- **Falsk alarm** er højst 3,4 % for alle syv regler og alle ti pladser.
- **Nyt L6 (middel):** "Ligner ingen af modellens fejlfigurer over målefejlen." står under modellens egen fejlfigur: "kun knæene" ved sticking point i 28-48 %, i sko med hæl og feltet udfyldt i 92-100 %, med tæerne 30° ud i 84-87 %. Linjen læses som "uden fejl".
- **Nyt L9 (middel):** holder løfteren i sko torsoen i stedet for ankelbøjningen (Yantras eget åbne spørgsmål), giver feltet på 2 cm falsk "Ligner: hoften skudt for langt tilbage" i 53 % af billederne af en rigtig bund, og 93 % ved 3 cm.
- **L7 og L8 (lave):**
  - et kamera, der står forskudt uden at dreje, giver hintet "Filmet mere end 5° skråt (ca. 8°)", og 1 m forskudt stopper alle regler,
  - "hvert femte billede" er hvert tredje med mit kamera.
- **Svar på Yantras fire spørgsmål:**
  - tæer ud: ingen falsk "hoften tilbage",
  - modelvalget i sko: L9,
  - navenes 80 cm: rigtigt for tunge løft, skønnet 10 % lavt med 70 cm,
  - perspektivet lige fra siden: kommer af hans hofteleds dybde, skal ikke rettes.

**Blok 2, LAES-SQUAT.html** (`LAES-SQUAT.md`):
- Læst på 390 og 1280 i lys og mørk, uden net: intet sidelæns rul, ingen fejl, 17 px brødtekst, valgene slut efter 7,6 skærme på telefonen.
- De ni valg har hver en forklaring uden fagord. Fagordene står i koden, der ændres.
- Dhruvas anbefalinger er rimelige, undtagen valg 7, som er betinget, så "squat udgiv forslag" er udefineret dér (S1).
- Setus mening står adskilt i valgene, men ikke i noterne (S6).
- Sammenligningen holder: deload og "Hvad laver en coach" talt selv, inden for 2 %, samme overskrifter, squat 21. sep 453 ord som Setu. Men squats 5.510 er ikke kun brødtekst, som siden siger; brødteksten er 4.288 (S7).
- Marcs ord: alle 54 citater står ordret i kilden, men:
  - fire stikord er klippet midt i hans sætning, bl.a. "konkurrencegodkendt squat" (S2),
  - et "stikord" er Dhruvas note "Ikke besvaret" (S3),
  - et par i Kropstyper handler om to ting (S4),
  - svarene fra 26. sep er "ordret i substans" (S5).
- Siden fortæller ikke:
  - hvad "forslag" gør ved valg 7,
  - at artiklen siger "seks fejlbilleder" mod modellens otte (S8),
  - at "udgiv" først starter Yantra og to commits.

## Testresultat

- `node outputs/kritik-548/fejl-548.mjs`: exit 0, `fejl-548.json`, ca. 12 s.
- `node outputs/kritik-548/side-548.mjs`: **16/16** tjek grønne (dhruva `ca860bf`).
- `node outputs/kritik-548/laes-548.mjs`: **16/16** tjek grønne.
- `node outputs/kritik-548/verify-kritik-548.mjs --blok 1`: grøn (før commit 1).
- `node outputs/kritik-548/verify-kritik-548.mjs --blok 2`: grøn (før commit 2). Den tjekker:
  - grenen, at kun mine to mapper er ændret, ingen upstream, ASCII i commits,
  - at løftmodellen er ren,
  - de tal i JSON, som dokumenterne bygger på,
  - de tre dokumenters første linje og afsnit, 0 tankestreger.

  Til sidst kører den `npm run lint`.
- `npm run lint`: grøn (i verify).
- **Rettet undervejs i mine egne scripts:**
  - et nyt scenarie i `fejl-548.mjs` flyttede støjen for de senere afsnit, så tallene for tæer ud og high bar er rettet i dokumentet til den endelige kørsel,
  - et forventet tjek (2 cm hæl uden felt, én krop uden støj) holdt ikke og er byttet til 3 cm,
  - min kontrastmåling talte halvgennemsigtige baggrunde med,
  - citaterne læses nu fra sidens elementer i stedet for den flade tekst.

## Hvad er næste

**Yantra** (løftmodellen, `dist/maal-billede/`):
1. **L6**, linjen: navngiv de regler, der er tjekket, og sig hvad linjen ikke udelukker, fx *"Ligner ikke 'kun knæene' eller 'hoften skudt for langt tilbage' over målefejlen. Det udelukker ikke fejlen: 'kun knæene' ved sticking point overses i ca. hvert tredje billede."* I sko med hæl (feltet over 0) skal "kun knæene" stå som ikke tjekket.
2. **L9**, feltet: sig i feltets tekst og grænsen, at "samme ankelbøjning" er et valg, og at "hoften tilbage" i sko skal læses med forsigtighed. Bedst er ét rigtigt klip i vægtløftersko.
3. **L3:** flyt "og dér letter hælen i modellen" til grænsen.
4. **L7:** hintet siger "kameraet står skråt eller ikke ud for stangen" og "flere grader" i stedet for "mere end 4°".
5. **L8:** "hvert tredje til femte".
6. **Figurens kode i kapitel 6** ("Mit eget klip"), hvis Marc siger ja til valg 6, og ordrenumrene i Min krop og De tre løft (valg 8).

Med L6 og L9 rettet er mit svar ja; jeg måler det gerne igen med `fejl-548.mjs` og `side-548.mjs`.

**Setu** (LAES-SQUAT og artiklen):
1. **S2 og S3:** citér Marcs stikord hele, også over linjeskift. Mærk "Ikke besvaret …" som Dhruvas note.
2. **S1:** bed Dhruva om en konkret anbefaling til valg 7, gerne Setus egen, og sæt den ind i forhåndsvisningen.
3. **S8:** "seks fejlbilleder i alt" bliver til otte i kapitel 7's fold, i samme runde som valg 8 og 9.
4. **S4-S7 og S9** er små: parret i Kropstyper, "ordret i substans", en linje om at noterne er Setus, "Sådan er det målt" og 12 px.
5. **Marc kan svare i dag.** Ingen af fundene ændrer, hvad "squat udgiv forslag" gør for valg 1-6, 8 og 9.

**Hara (Coaching-planeten, delmål "Appen mærkbart bedre"):** intet i appen er ændret. Arbejdet rører sitets squat-artikel og fejlgenkendelsen i løftmodellen, ikke appen.

## Ærlige grænser

- **Blok 1:**
  - kun syntetiske, tegnede figurer og Marcs ene gulvbillede, intet rigtigt løft med en kendt fejl, intet klip i vægtløftersko,
  - pinhole uden linseforvrængning, mine dybder og min klikfejl fra 511,
  - tæer ud og "torsoen holdt i sko" er mine enkle modeller, ikke målinger,
  - L9 er det modsatte yderpunkt af Yantras valg; sandheden ligger formentlig imellem.
- **Blok 2:**
  - jeg har læst siden som Marc, men er ikke ham,
  - kun headless Chromium på Windows, ikke hans telefon,
  - talt selv på to af de seks artikler, ikke squat nu (sitets scripts tegner dens tabeller),
  - fagord og "forklaret" er min vurdering.
- Ingen push, ingen merge, ingen ændring af sitet, løftmodellen eller LAES-SQUAT.html, ingen atletdata ud over Marcs eget klip, ingen sub-agenter.
