Ordre 613: to kritikker. Squat-artiklens nye kapitel 6 og jeg-form (Setu 607), og de seks Instagram-opslag (Setu 606) (Bhishak)

**Domme:**
- **Kapitel 6 på squat bedre: ja.**
- **Squat-artiklen klar til Marcs læsning: ja.**
- **Instagram 1-6 klar til Marcs godkendelse: nej.** 1, 4, 5 og 6 er klar. 2 og 3 rettes først.

## Gren

Grenen er `kritik-613`, lavet fra `main` @ `47b248b` (merge af kritik-610) i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter. Filer kun under `docs/kritik-613/` og `outputs/kritik-613/`.

- Commit 1 `6823d9d` kritik 613 blok 1: squat-artiklens nye kapitel 6 og jeg-formen.
- Commit 2: kritik 613 blok 2, Instagram og denne rapport. Hashen står i `git log`.

Målt på:
- **Sitet:** `udgivelse-squat-min-krop` @ `f3c1684` (ny kapitel 6) og `25d6a41` (gammel kapitel 6), hentet med `git archive`. `entropi-coaching-site-wt2` er ikke rørt.
- **Instagram:** `ordrer/kilder/setu-606/` og `Desktop/LAES-INSTAGRAM.html`, kun læst.
- **Seed-kørslen:** Setus kopi af løftmodellen `setu-607/lm/` (`207d4ec`), kun læst.

## Hvad ændret

Intet på sitet, i løftmodellen eller i Setus filer. Kun mine målinger og dokumenter.

### Blok 1: squat (`docs/kritik-613/SQUAT.md`)

**Kapitel 6 på squat er bedre.** Det er en squat i en squat-artikel, med kapitel 7's krop og Marcs hyppigste fejl. Tallene hænger sammen med kapitel 7, og tabellerne er enklere end dødløftets. Men kapitlet sammenligner modellen med sig selv, og den gamle var artiklens eneste rigtige løft.

**Jeg-formen holder.** Der er 0 "Marcs" i den synlige tekst. Kapitel 6 har slet ingen jeg-form, og Marcs stemme er væk fra kapitlet.

**Fund:**
- **Q1 (middel):** på 390 er kapitel 6's tabeller 640 px brede. Kolonnen "Kun knæene" ligger uden for skærmen.
- **Q2 (middel):** "alle fem/ti klik" og de to røde celler på modellens egen squat afhænger af seed 607.
  - Over 200 seeds siger siden "Ligner: Kun knæene" ved 852/1000 klik ved sticking point.
  - Den sande klikspredning er 2,2-2,7°.
- **Q3 (middel):** "Virkeligheden mod modellen" har ingen virkelighed, og svarlinjen på linje 487 er meta.
- **Q4-Q7 (lav):**
  - Q4: forbehold i brødteksten (488, 496, 515, 527).
  - Q5: "gule" og "orange" om samme mærke (492 og 82).
  - Q6: linje 536 er uforklaret.
  - Q7: LAES-SQUAT viser skærmbillederne i 1x og under hinanden.

**Resten er i orden:**
- Figurerne virker på 390 og 1280 uden net.
- LAES-SQUAT viser ny og gammel med begge svarlinjer.
- Ingen tankestreger, ingen dramatisk åbning og ingen atletnavne. Opfordringen er linje 398 (valg 1).

### Blok 2: Instagram (`docs/kritik-613/INSTAGRAM.md`)

Alle seks overholder reglerne:
- 0 tankestreger, 0 opfordringer, 0 atletnavne og 0 kilo.
- Neutral henvisning til entropicoaching.dk.
- Forbehold sidst.
- Ingen genkendelige atleter.

Opslag 4's tal står alle i artiklens kapitel 7, og opslag 5 er Marcs egen artikel næsten ordret.

**Fund:**
- **I1 (middel, nr. 3):** en sætning, der ikke kan læses ("rører ikke hele vejen længere mod fødderne"), og 10,5 mod 46,2 - 35,8 = 10,4.
- **I2 (middel, nr. 2):** "stangens vægt flytter ud til ..." er upræcis fysik, og -54 % kan læses som en fordel.
- **I3-I6 (lav):**
  - I3: nr. 2, slide 5 er forsvarende meta.
  - I4: nr. 1 bruger 183 cm-kroppens tal.
  - I5: nr. 3, bænkfigurerne er små.
  - I6: nr. 4, hælløftet er modellens ankelgrænse.

## Testresultat

| Kommando | Resultat |
|---|---|
| `node outputs/kritik-613/squat-613.mjs` | 15/15 grønne |
| `node outputs/kritik-613/k6-seeds-613.mjs` | 200 seeds, 1000 klik pr. billede (`k6-seeds-613.json`) |
| `node outputs/kritik-613/insta-613.mjs` | 11/11 grønne |
| `node outputs/kritik-613/verify-kritik-613.mjs --blok 1` | grøn |
| `node outputs/kritik-613/verify-kritik-613.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

## Hvad er næste

- **Marc:** vælger `squat kapitel 6: ny` eller `gammel` i LAES-SQUAT.html. Min anbefaling er ny, med Q1-Q3 rettet.
- **Setu retter på `udgivelse-squat-min-krop`, hvis Marc vælger ny:**
  - **Q1:** i kapitel 6's tabeller står "Kun knæene" som anden kolonne, og tabelteksten står uden for rullelaget, eller tabellerne vises som kort på smal skærm.
  - **Q2:** enten skriv "i denne runde" og ca. 85 % ved sticking point, eller brug båndet fra den kendte klikfejl (linje 534), så cellerne ikke afhænger af seed.
  - **Q3:** svarlinjen på linje 487 bliver fundet. Titlen er Marcs valg.
  - **Q4-Q7:** flyt 488 og 527 til "Gyldighed", skriv "orange" i 492, slet eller forklar 536, og tag LAES-SQUAT's skærmbilleder i 2x.
- **Setu retter i Instagram:**
  - **I1:** nr. 3, billedteksten.
  - **I2 og I3:** nr. 2, slide 4, slide 5 og billedteksten.
  - Kør derefter `node lav.mjs 2`, `node lav.mjs 3` og `node laeseside.mjs` igen. I4-I6 er valgfri.
- **Marc:** svarer derefter `instagram ok 1-6`.
- **Yantra (uændret fra 607):** jeg-formen skal ind i løftmodellens `maaltOverModel.js`, så en senere kopi ikke tager "Marcs" med tilbage.
- **Hara (Coaching-planeten, spor løftartikler):** squat-artiklen er et skridt nærmere Marcs læsning. Instagram-serien er to små rettelser fra hans godkendelse.

## Ærlige grænser

- Alt er målt i headless Chrome på Windows, ikke på en rigtig telefon og ikke i Instagram.
- Seed-kørslen viser, hvor robust tallene er over for klikstøjen, ikke om modellen er rigtig.
- Tallene i dødløft- og bænkopslagene er ikke regnet igen i løftmodellen.
- "Bedre" om kapitel 6 er min dom. Marc vælger.
- Hele squat-artiklen er ikke læst fagligt forfra. Kapitel 6 er læst fuldt, og jeg-formen og reglerne er tjekket i hele artiklen.
- Ingen push, ingen merge, ingen sub-agenter og ingen rigtige atleter eller klip.
