Ordre 494

# To kritikker: "Mål dit billede" (Yantra 484) og gentjek af Min krop efter Yantras 488

**Mål dit billede klar til sitet: nej.** B1-B4 skal rettes først. Det er små rettelser i tekst og standardvalg, og der skal ikke regnes ny fysik. Se `docs/kritik-494/MAAL-BILLEDE-KRITIK.md`.
- Skiven er standard som skala og giver en advarsel på næsten hvert billede.
- Uden Min krop regner siden med 178 cm.
- Skulderen er beskrevet som leddet, ikke acromion.
- Dødløftets knæ-fase tjekkes ikke.

Marc kan bruge siden hver uge nu med fem regler.

**Min krop klar til sitet: ja.** M1-M6 er lukket, og M7 er et valg for sitet. Et nyt lavt fund, M8, holder den ikke tilbage. Se `docs/kritik-494/MIN-KROP-GENTJEK.md`.

Planet: coaching. Spor: spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5. Det har betydning for Hara (Coaching, delmålet "Appen mærkbart bedre"): Mål dit billede er det værktøj, Marc kan bruge hver uge på atleternes videoer.

## Gren

`kritik-494` fra `main` (`999dc20`) i `entropi-app-kritik`.
- `c5a525f`: blok 1, Mål dit billede.
- Blok 2 (gentjek og rapport): hashen står i `git log`.

Intet er pushet eller merget. Filerne ligger kun under `docs/kritik-494/` og `outputs/kritik-494/`, plus én linje `verify:kritik-494` i `package.json`. Intet i løftmodellen er ændret. `entropi-loeftmodel-dhruva` er kun læst, og 488-grenen `min-krop-klar` (`af7172f`) er hentet med `git archive` til min scratchpad.

## Hvad ændret

**Blok 1: Mål dit billede** (`MAAL-BILLEDE-KRITIK.md`, `outputs/kritik-494/maal-regning-494.mjs` og `maal-side-494.mjs`). Jeg har brugt siden som coach på 390 px med touch (tryk og træk) og på 1280 px med mus. Billederne var:
- tre syntetiske billeder: modellens egne stillinger, set med et pinhole-kamera 3 m væk eller uden perspektiv
- Marcs to billeder fra 462, med mine egne klik, også bevidst forkert (hoften ved bæltet, skulderen midt i leddet, 2 cm fingerfejl)

Svar på Yantras fire spørgsmål:
1. **Punkterne:** hofte, knæ, ankel og midtfod er rigtigt beskrevet, men skulderen skal være acromion (B3). Bæltet og knæskallen skal nævnes som "ikke her" (B5). Hoften ved bæltet flytter torso og knæ 8-11°.
2. **10 % og skiven:** grænsen er fin, men skiven er den forkerte standard. Den står ½ m nærmere kameraet, så ved 2-4 m viser kontrollen 71-86 %, og advarslen står der altid (B1). Marcs klip (69-77 %) passer med regningen ved 2 m. Vinklerne flytter under 0,5°, men stang–hofte bliver 4-11 cm for kort (Marc: 17,4 mod 25,3 cm). Brug kroppens længder som standard og skiven som kontrol med 75-105 %.
3. **Balancepunktet:** ja, det er rigtigt at holde stangen op mod det. Men stangens vægt er forudfyldt med 270 kg, og ved 100 kg flytter punktet fra 3,3 til 5,8 cm (B6). Det er modellens stilling, ikke atletens, og forskelle under ca. 3 cm kan ikke læses.
4. **Knæhøjde:** Marcs "knæhøjde"-billede er ikke fra knæhøjde. Stangen står 24-32 cm under knæet, og knæet har flyttet sig 1,4° fra gulvbilledet. Modellen åbner knæet 1,7° pr. cm, så 119,6° mod 146,3° er to faser. Det gælder også 462's "knæhøjde" og forbeholdets "8-10°" (B4).

**Blok 2: Min krop gentjek** (`MIN-KROP-GENTJEK.md`, `outputs/kritik-494/min-krop-494.mjs`). M1-M7 er målt med mine tre kropstyper og 114 %-kroppen, regnet med Yantras egne funktioner og på siden på 390 og 1280:
- M1-M6: lukket.
- M7: ikke rettet (siden er 9841 px), et valg for sitet.
- M4: min 471 var forkert. Modellen havde allerede en hånd, og mine "+8 cm" flyttede stangen 11 cm.
- Nyt, M8 (lav): hoftepunktet 5 cm for højt på både lår og overkrop giver 111 % og 90 %, en sum på 100 % og en figur med 10-13° forskel, der ikke findes.

## Testresultat

- `node outputs/kritik-494/maal-regning-494.mjs`: 14/14 tjek grønne.
- `node outputs/kritik-494/maal-side-494.mjs`: 20/20 tjek grønne, headless Chromium uden net, touch på 390 og mus på 1280.
- `node outputs/kritik-494/min-krop-494.mjs`: 28/28 tjek grønne.
- `npm run verify:kritik-494` (blok 1 + 2): grøn. Den læser kun de gemte målinger og holder dokumenternes tal op mod dem.
- `npm run lint`: grøn.

Ingen sider lavede netkald, ingen side kunne rulles vandret, og Mål dit billede skrev intet til browserens lager.

## Hvad er næste

**Yantra retter (Mål dit billede, før sitet):**
- **B1:** kroppens længder som standard skala, når kroppen er kendt. Skiven bliver en kontrol med vinduet 75-105 % og forklaringen "skiven står nærmere".
- **B2:** et felt til højde (og vægt), når Min krop er tom.
- **B3:** skulderen = "skulderens yderste knoglespids (acromion), toppen af skulderen, ikke midt i leddet", med samme ord som Min krop.
- **B4:** i dødløftets knæ-fase skal siden sige det, når stangen står mere end ca. 5 cm under knæet. Ret forbeholdets "8-10°" til kun at gælde gulvet, og kig på 462's "knæhøjde" (billede 30).
- **B5 og B6:** "ikke bæltet / ikke knæskallen / midt på foden, ikke skoen". Tærsklen skal være 4° eller 3 cm, som i Min krop. Stangens vægt skal være et tomt felt.
- **B7-B10, når der er tid:** en tallinje under billedet, skalaknappen må ikke slette skivens punkter, en linje om den skjulte fod, og et rigtigt squatklip.
- **Min krop, frivilligt:** M8, et tjek af lår mod overkrop over ca. 18 point, og i M1 et ord om retningen ("eller en mere oprejst overkrop").

**Setu må kopiere til værktøjssiden:**
- **Min krop nu, når 488 er merget:** `dist/min-krop/` som egen side (`index.html`, `min-krop.js`), eller `kort.html` indlejret. Ikke en iframe midt i en artikel (M7). Kopier fra main efter merge af `min-krop-klar` og ikke fra min scratchpad-kopi.
- **Mål dit billede ikke endnu.** `dist/maal-billede/` først, når B1-B4 er rettet. Linket fra Mål dit billede til `../min-krop/index.html` forudsætter, at de to ligger som søskende-mapper, og det skal holdes, når de kopieres.

**Marc (hver uge, indtil B1-B6 er rettet):**
1. Skriv atletens mål i Min krop i samme browser.
2. Tryk "Brug kroppens længder som skala".
3. Skriv stangens rigtige vægt.
4. Klik skulderen på toppen (acromion) og hoften en håndsbredde under bæltet.
5. Læs kun forskelle over ca. 4° eller 3 cm, og tjek i dødløftets knæ-fase, at stangen faktisk står ud for knæet.

## Ærlige grænser

- **Kameraet i blok 1 er en model:** et pinhole-kamera med leddene 10-19 cm og skiven 69 cm fra midtlinjen. Størrelsen passer med Marcs klip, men er ikke målt i et fitnesscenter.
- **De syntetiske billeder er tegninger af modellens egne stillinger,** ikke mennesker i tøj. Mine klik på Marcs klip er ét forsøg af én person, og klikfejlenes størrelser (8, 5, 4 og 3 cm) er typiske, ikke målte.
- **Min krop er gentjekket på grenen `min-krop-klar` før merge.** Ændres den, gælder gentjekket ikke.
- **Alt er kørt i headless Chromium på Windows,** ikke Safari på en telefon. Touch er sendt som CDP-touchhændelser.
- **Ingen atletdata:** kun syntetiske kroppe og Marcs eget klip fra 462, som allerede ligger i løftmodellen. Intet nyt billede fra klippet er lagt i dette repo. Ingen push, ingen merges, ingen sub-agenter.
