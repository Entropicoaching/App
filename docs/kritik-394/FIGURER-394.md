# Blok 1: figurerne i squat-opslagsværket efter Yantras 385, set som en styrkeløftcoach

Læst på `squat-opslag-11` (`7356445`), headless Chromium, 390x844 (touch, 2x) og 1280x900. Kommando: `node scripts/kritik-394.mjs --blok figurer`. Hver figur og indlejring er fotograferet for sig med alle folde åbne: `outputs/kritik-394/fig-<bredde>-<nr>-*.png`, 27 i hver bredde. Dertil kommer panelet og vælgeren i brug (`fig-390-panel-*`, `fig-390-vaelger-*`). Listen med bredder og mindste tekst står i `outputs/kritik-394/figurer.txt`. Intet er rettet i sitet.

Spørgsmålet til hver figur var det samme som i 384. Ligner den en rigtig squat (torso, knæ, hofte, fod, stang, hoved, arme)? Passer figurteksten til billedet? Kan tallene læses på telefonen?

## Status for F1-F10

| Nr. | Fund i 384 | Nu | Status |
|---|---|---|---|
| F1 | Opstilling, unrack og lockout hælder som en planke | Benene står lodret, knæet er låst (179°), torsoen hælder 14° fra hoften, og stangen står 3,3 cm bag midtfodens mærke. Det ligner en lowbar-lockout. | **lukket** |
| F2 | Front squat: stangen svæver, albuen oven i hovedet | Stangen hviler på skulderens forside, albuen er højt og frem, og hovedet står over stangen. Torsoen er 22°, og knæet går langt frem over tæerne. Sådan ser en front squat ud. | **lukket** |
| F3 | Safety bar: ingen arme, skiven gennem brystet | Åget ligger bag nakken, og hænderne holder håndtagene foran. Skiven er tegnet som en flade ved siden af kroppen. Figurteksten forklarer prikken, ringen og skiven. | **lukket** |
| F4 | "Stangen foran midtfod" viste referencens momentarme | Mærkerne siger hofte 25,5 og knæ 16,4 cm, og figurteksten siger det samme. Det passer med tabellen: 5 cm gange 981 N er 49 Nm. | **lukket** |
| F5 | Referencens og fejlens mærker ligger oven i hinanden | Stadig i tre af fire. I good morning står guldets "knæ 21,4 cm" (grundlinje y 339,5) under det blå "knæ 14,1 cm" (hænger fra y 336,1), og i "Ankelgrænsen stopper skinnebenet" krydser den blå knæstreg det gyldne "knæ 21,4". Referencens knætal kan ikke læses i de to. I "For lidt dybde" står de to "hofte 20,5 cm" lige over hinanden, men de kan læses. | **åben**, irriterer |
| F6 | Titlen sagde det modsatte af billedet | Titlen hedder nu "Ankelgrænsen stopper skinnebenet". Figurteksten siger 40° klippet til 35° ved samme dybde, og det viser billedet: det blå knæ står længere tilbage, og hoften har samme højde. | **lukket** |
| F7 | Kapitel 6: det målte knæ foran stangen, og "Start" mangler den grå figur | "Start" har nu den grå figur. Knæ og skinneben er stiplet i alle fem billeder, og i indlejringen står der "knæ og skinneben: upålidelige i videoen". Figurteksten forklarer, at hoftens plads derfor også er usikker. Det blå knæ står stadig foran stangen, men nu siger billedet selv, at det ikke skal læses. | **lukket** |
| F8 | Kapitel 6's forklaring i canvas er ca. 6-7 px | Uændret. De fire linjer i indlejringens forklaring ("Grå silhuet ...", "Blå: ...", "Blå skygge ...", "Stiplet ...") er skønsmæssigt 6-7 px på 390 (`fig-390-18`). | **åben**, irriterer |
| F9 | Arme, hals og balde tegnet som en dukke | Armene er bedre: lowbar-albuerne peger bagud og op, og front squat har albuerne højt. Balden er stadig en kasse med flad underside i bund og sticking point, og hovedet er stort (næsten torsoens bredde). | **delvis**, kosmetisk |
| F10 | Anatomivælgerens figur er lille, og "Dybdekrav: ja" ligger på stregerne | Uændret (`fig-390-09`). Kroppen fylder ca. en tredjedel af canvas, og "Dybdekrav: ja" står oven i hofte- og lårstregerne. | **åben**, kosmetisk |

## Nye fund

Ingen nye fund, der blokerer. To små ting:

- **N1. Kapitel 1's bund: "hofte 20,5 cm" rører knæets streg** (`fig-390-04`). Dens "cm" står under startmærket på knæets streg. Setu nævnte det selv i 388 under ærlige grænser. Samme familie som F5. Alvor: kosmetisk.
- **N2. Kapitel 5 på 1280: mærkerne er 9 px** (230 px bred figur). De kan læses, men de er de mindste tal i artiklen på en skærm. På 390 er de 12 px. Setu nævnte det i 388. Alvor: kosmetisk.

Ikke fund, men værd at vide ved læsning af skærmbillederne: sidens klæbende topbjælke ("Entropi < ARTIKLER") ligger oven på toppen af nogle elementbilleder (`fig-390-09`, `-18`, `-26`). Det er et artefakt fra skærmbilledet, ikke en fejl på siden. I `figurer.txt` står kapitel 6's fem stillbilleder med bredden 0 px. Scriptet måler dem, før de er foldet ud, men skærmbillederne er fine.

## Pr. figur, kort

| Nr. | Figur | Ligner en squat? | Tekst mod billede | Tal på 390 |
|---|---|---|---|---|
| 1-2, 7 | Kap. 1 opstilling, unrack, lockout | Ja, låste knæ og stangen over foden (F1 lukket) | Passer | 12 px |
| 3-6 | Kap. 1 nedtur, bund, vendepunkt, sticking | Ja. Kantet balde (F9) | Passer | 12 px, bund rører (N1) |
| 8 | Panelet | Ja | Passer | HTML |
| 9 | Anatomivælgeren | Lille figur (F10) | Passer med tabellen | HTML-tabel |
| 10-13 | Anatomi-stillbilleder | Ja | Passer | 12 px |
| 14-15 | Kap. 5 lowbar, highbar | Ja | Passer | 12 px (9 px på 1280, N2) |
| 16 | Kap. 5 front squat | Ja (F2 lukket) | Passer: albuerne højt og frem | 12 px |
| 17 | Kap. 5 safety bar | Ja (F3 lukket) | Passer: åg, ring, skive forklaret | 12 px |
| 18 | Kap. 6 indlejring | Model ja; målt knæ stiplet og mærket upålideligt | Passer | Canvas 6-7 px (F8) |
| 19-23 | Kap. 6 stillbilleder | Grå figur i alle fem (F7 lukket) | Passer | - |
| 24 | Good morning | Ja, hoften op og torsoen frem | Passer | 11,7 px, knætal dækket (F5) |
| 25 | Ankelgrænsen stopper skinnebenet | Ja | Titel og tekst passer (F6 lukket) | 11,7 px, knætal dækket (F5) |
| 26 | Stangen foran midtfod | Ja | 25,5/16,4 passer med tabellen (F4 lukket) | 11,7 px |
| 27 | For lidt dybde | Ja | Passer | 11,6 px, læsbar |

## Dom over figurerne

Det, Marc ville se først, er nu i orden: opstilling og lockout, front squat og safety bar ligner det, en coach ser på platformen. Tallene i figurerne passer med teksten og tabellerne. Tilbage er F5, F8, F10 og resten af F9. De irriterer eller er kosmetiske, og ingen af dem giver et forkert billede af en squat.
