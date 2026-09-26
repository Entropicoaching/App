# Kritik af squat-opslagsværket efter 388, den sidste læsning før Marc

**Klar til Marc: nej, fordi to steder i teksten stadig siger noget andet end tabellen lige ved siden af. Kapitel 6 kalder det upålidelige knæ for løftets største afvigelse og for et "nej", som tabellen ikke viser (N4). Kapitel 3's fold har gamle hoftetal (N3). Figurerne er derimod klar. F1-F4, F6 og F7 er lukket, og squatten ligner nu en squat. De to rettelser er tekst, ca. et kvarter for Setu, og derefter: ja.**

## Fundlisten

Alvor: **blokerer** (skal rettes, før Marc læser), **vigtigt** (en coach mister tilliden eller tråden), **irriterer**, **kosmetisk**. F er figurfund (blok 1, `FIGURER-394.md`), N er nye fund (blok 1 og 2, `ARTIKEL-394.md`), A er tekstfundene fra 384, og Q er fundene fra 374.

| Nr. | Fund | Sted | Alvor | Hvem retter |
|---|---|---|---|---|
| N4 | "Ved knæhøjde siger tabellen nej på knæet ... den største afvigelse i løftet" og "et 'ja' [på knæet] er en svag enighed". Tabellen siger "upålidelig" og har intet ja på knæet | Kap. 6, under tabellen | **vigtigt, retter før Marc** | Setu (to sætninger) |
| N3 | Folden "Bækkenet er ikke sit eget led" siger hoften 83° og 105°. Teksten over siger 89° og 107° | Kap. 3 | **irriterer, retter før Marc** | Setu (to tal) |
| N5 | "Stangens afstand til hoften vokser mest i anden halvdel af nedturen". Første halvdel flytter 14,3 cm, anden 9,8 cm | Kap. 1, nedtur | irriterer | Setu (én sætning) |
| F5 | Referencens knætal står under fejlens i good morning og ankelgrænsen, så det kan ikke læses | Kap. 7 | irriterer | Yantra (flyt de gyldne mærker op) |
| F8 | Forklaringen i indlejringens canvas er ca. 6-7 px på 390 | Kap. 6 | irriterer | Setu |
| N6 | "Stangen sænker næsten farten" giver ikke mening | Kap. 1, sticking point | kosmetisk | Setu |
| N1 | "hofte 20,5 cm" rører knæets streg i bundfiguren | Kap. 1 | kosmetisk | Yantra |
| N2 | Kapitel 5's mærker er 9 px på 1280 (12 px på 390) | Kap. 5 | kosmetisk | Setu (CSS) |
| F9 | Balden er en kasse, og hovedet er stort. Armene er rettet | Kap. 1, 5 | kosmetisk | Yantra |
| F10 | Vælgerens figur er lille, og "Dybdekrav: ja" står på stregerne | Kap. 3 | kosmetisk | Yantra |
| Q21 | Kapitel 6's syv knapper er 32 px høje på 390 | Kap. 6 | kosmetisk | Setu |
| Q17 | Marc er næsten fraværende i kapitel 1-3 og 6-7 | hele | venter på Marc | Marc |
| Q22 | 10 `[MARC: ...]` og "Kommer"-boksen | hele | venter (med vilje) | Marc |

**Lukket siden 384:**
- F1: opstilling, unrack og lockout.
- F2: front squat.
- F3: safety bar.
- F4: mærkerne i "Stangen foran midtfod".
- F6: titlen "Ankelgrænsen stopper skinnebenet".
- F7: kapitel 6's grå figur og stiplede knæ.
- A1-A7. A4's tabel er lukket, og resten er N4.
- Q1-Q16 og Q18-Q20.

**Delvis:** F9.

## Det der holder

- **Figurerne ligner squats.**
  - Opstilling og lockout står med låste knæ, lodrette ben og stangen over foden.
  - Front squat har albuerne højt og stangen på skulderens forside.
  - Safety bar har åg, håndtag og skive, og figurteksten forklarer dem.
  - Det var Marcs indvending ("lidt off og ser ikke realistiske ud"), og den gælder ikke længere.
- **Tallene passer.**
  - Kapitel 1's figurtekster, hovedtekst og mærker er ens i alle syv faser.
  - Kapitel 3's bøjninger er 180 minus ledvinklen.
  - Kapitel 5's vinkler og forhold er ens i figur, tekst og panel.
  - Kapitel 6's tabel har 0 forskelle mod løftmodellens `tal.json` (5b83412).
  - Kapitel 7's momenter følger 5 cm × 981 N = 49 Nm.
- **Stilreglerne holder.**
  - 0 tankestreger, 0 "man skal", 0 udråbstegn og 0 interne navne.
  - Forbeholdet står nederst, og der er ingen atletnavne.
  - 0 konsolfejl og ingen vandret rulning på 390.
- **Ærligheden holder.** Hvor modellen og målingerne er uenige (Wretenberg, sticking point, knævinklen i bunden, kapitel 6), siger teksten det.

## Grundlag

`npm run verify:kritik-394` (`scripts/kritik-394.mjs`) er min 384-måling i den udgave, Setu brugte som `kritik-386.mjs` i sitet. Den tjekker også A1-A7 og K6.

1. Scriptet trækker `squat-opslag-11` (`7356445`) ud med `git archive`.
2. Siden serveres lokalt, og headless Chromium kører på 390x844 (touch, 2x) og 1280x900.
3. Blok 1 fotograferer de 27 figurer og indlejringer for sig i begge bredder.
4. Blok 2 læser artiklen med alle folde åbne. Kapitel 6 sammenlignes med løftmodellens `5b83412`.

Scriptet skriver kun i `outputs/kritik-394/` og kontrollerer stien før hver skrivning. Fundene N3-N6 og alvoren er min læsning, ikke scriptets. Intet er rettet i sitet.
