Ordre 384

# Rapport: squat-opslagsværket med de nye figurer, læst en sidste gang som coach, før Marc får det (Bhishak)

Har arbejdet betydning for Hara: **ja, for Coaching-planeten, sporet med løftartikler** (ikke for delmålet "Appen mærkbart bedre", for appen er ikke rørt). Dommen er "klar til Marc: nej". Der er tre blokerende fejl, som kan rettes på et par timer, og tre figurer, der stadig ikke ligner det, en coach ser. Med listen her kan Setu og Yantra lukke dem i én omgang, før Marc åbner værket.

## Gren

Gren `kritik-384` fra `main` (`c616c1f`) i `entropi-app-wt2`. Ingen merges og ingen push.
- Commit 1 `d645c73`: blok 1. `scripts/kritik-384.mjs`, `verify:kritik-384` i `package.json`, `docs/kritik-384/FIGURER-384.md` (F1-F10) og skærmbilleder af alle 27 figurer og indlejringer i to bredder.
- Commit 2 `0be76c2`: blok 2. `docs/kritik-384/ARTIKEL-384.md` (status for Q1-Q22, A1-A7), artiklens synlige tekst, 71 skærmbilleder på 390 og rettelser i scriptets Q14- og Q22-tjek.
- Commit 3: blok 3. `docs/kritik-384/KRITIK-squat-378.md`, denne rapport og den fulde verificering. Hashen står i afleveringen.

Kilde, kun læst via `git archive`: sitet `squat-opslag-9` (`64cd729`). Intet er rettet i sitet.

## Hvad ændret

- **`scripts/kritik-384.mjs`** (ny). Squat-delen af `kritik-374.mjs` og fund-tjekkene fra sitets `kritik-378.mjs` er slået sammen og hardkodet til `squat-opslag-9`.
  - Al skrivning går gennem `ud()`, som stopper scriptet, hvis en sti ligger uden for `outputs/kritik-384/`. 374-koerslen overskrev gamle mapper, og det kan ikke ske her.
  - `--blok figurer` fotograferer hver figur og indlejring for sig og måler deres bredde og mindste tekst. Den bruger også panelet og vælgeren, som en coach ville.
  - `--blok artikel` læser artiklen med alle folde åbne og tjekker stilreglerne og Q1-Q22.
  - Uden argument kører begge blokke.
- **`docs/kritik-384/FIGURER-384.md`:** figurerne set som coach, F1-F10, og en tabel pr. figur.
- **`docs/kritik-384/ARTIKEL-384.md`:** stilregler, rød tråd, gyldighedsområder, status for Q1-Q22 og A1-A7.
- **`docs/kritik-384/KRITIK-squat-378.md`:** fundlisten øverst, sorteret efter alvor og med hvem der retter, og dommen på én linje.
- **`package.json`:** `verify:kritik-384`.

Fundene kort:
- **Blokerer:**
  - F4: et fejlbillede har forkerte momentarme.
  - F6/A1: skinnebensbilledets titel og første sætning siger det modsatte af figuren.
  - F7/A4: kapitel 6's målte skelet har knæet foran stangen, bygget af et skinneben, som teksten kalder upålideligt og siger ikke står i tabellen. Startbilledet mangler den grå figur, som teksten nævner.
- **Vigtigt:**
  - F1: det oprejste billede hælder frem fra anklen.
  - F2: front squat ligner ikke en front squat.
  - F3: safety bar har ingen arme og skiven gennem brystet.
  - A2: momenter i Nm uden stangvægt.
- **Holder:** de fire bøjede faser i kapitel 1 og lowbar/highbar ligner squats. Tallene kan læses på telefonen, og stilreglerne holder. Q1-Q15 og Q18-Q20 er lukket.

## Testresultat

`npm run verify:kritik-384` (begge blokke, `squat-opslag-9` `64cd729`, headless Chromium 390x844 touch 2x og 1280x900). Hele outputtet står i `outputs/kritik-384/resultat.txt`:

```
LUKKET Q1-Q16, Q18-Q20 (Q4: tabellen 311 px i ramme paa 311 px; Q7: mindste SVG-tekst 11.3 px, H/K 10.9 px;
       Q12: figur til nederste skyder 742/844 px)
AABEN  Q21: trykflader under 44 px paa 390: kapitel 6's syv knapper, 32 px
VENTER Q17: venter paa Marcs svar
VENTER Q22: [MARC: ...] 10, "Kommer"-boks: ja (med vilje til Marc)
Stil: tankestreger 0, "man skal" 0, interne navne 0, udraabstegn 0, forbehold sidst ja.
Laengde: 5312 ord lukket, 8143 aabne, 65.7 skaerme paa 390; siden siger "39 min. læsning". Konsol: 0. Vandret rulning paa 390: nej.
```

Scriptet siger, at Q16 er lukket, fordi de to sætninger fra 374 er væk. Min læsning siger, at den er delvis åben (A6). `npm run lint`: grønt, 0 fejl. Scriptet giver exit 0: fundene er en læsning, ikke en test.

## Hvad er næste

**1. Setu og Yantra retter de tre blokerende fejl** (liste og ansvar i `KRITIK-squat-378.md`):
- F4: fejlbilledet "Stangen foran midtfod" skal have de blå mærker 25,5 cm til hoften og 16,4 cm til knæet. Det er min udregning ud fra 5 cm og skal bekræftes af Yantra.
- F6/A1: titlen og første sætning skal passe til scenariet, fx "Stiv ankel ved en dybere squat". "Ønskede 45°" skal forklares eller rettes til referencens 40°.
- F7/A4: under "Start" skal der stå "model 1 finder ingen positur". Kapitel 6 skal enten tegne skelettet uden skinnebenet eller sige, at knæets placering er upålidelig. Folden "Skinnebenet" skal passe med tabellen.
- A2: én sætning med stangens vægt.
- F1-F3: tegn om, eller forklar i én sætning pr. figurtekst. Opstilling og lockout: "Modellen står med 9° skinneben for at holde balancen; på platformen er skinnebenet næsten lodret." Front squat og safety bar skal tegnes om.

**2. Læseguide til Marc (12 minutter på telefonen), rettet fra 378.** 378's trin 2 sendte ham til front squat "som har stangen på forreste deltoid", men det kan ikke ses på figuren (F2). Kapitel 7's skinnebensbillede er lagt til, fordi det er dér, teksten og billedet er uenige.
1. **Kapitel 1, Bund og Lockout (3 min).** Ligner de en squat? Bunden: torso 49°, hoften 3 cm under knæet, stangen 0,9 cm bag midtfoden. Lockout: knæet låst. Se på skinnebenet (9°) og stangen (4,5 cm bag midtfoden). Er det sådan, en godkendt lockout ser ud for dig?
2. **Kapitel 5, de fire stænger (2 min).** Lowbar mod highbar: 49° mod 37° i modellen og ca. 10° målt (afsnittet over figurerne). Ser front squat og safety bar rigtige ud?
3. **Kapitel 7, Good morning og skinnebenet ved ankelgrænsen (2 min).** Good morning: torsoen tipper 12,6° frem. Er det det, du kalder en good morning? Skinnebenet: er det, du ser her, hæle der letter, eller en stiv ankel?
4. **Kapitel 8, "Hvad jeg kigger efter" (2 min).** Andet afsnit giver stangens plads med figurernes tal: 0,9 cm bagved i bunden og 4,5 cm bagved oprejst. Er det din vinkel på stangen over midtfoden?
5. **Svar på de ti spørgsmål herunder i stikord (3 min eller mere).**

**3. De ti `[MARC: ...]`-spørgsmål, klar til at kopiere** (ordret fra siden, i sidens rækkefølge):
1. Kap 1, opstilling: Hvad ser du først, når en atlet stiller sig under stangen: foden, grebet eller stangens plads, og hvad tjekker du til sidst?
2. Kap 1, bund: Hvordan ser du udefra, at coret folder sammen i bunden: hvad er tegnet, og hvor tidligt ser du det?
3. Kap 1, sticking point: Hvor i opturen går dine atleter oftest i stå, og hvad er årsagen oftest: stangen, hoften, knæet eller coret?
4. Kap 4: Hvad betyder "føles naturligt" i praksis for dig: hvad spørger du atleten om, og hvad ser du efter, mens I prøver jer frem?
5. Kap 4: Hvad viser goblet squatten dig konkret om atletens bias, og hvilke svage punkter bygger du op bagefter?
6. Kap 5: Hvornår vælger du highbar, front squat eller safety bar til en atlet, ud over mobilitet og skader?
7. Kap 6: Hvad ser du selv de steder, hvor målingen og modellen skilles?
8. Kap 7: Hvilke tre fejlbilleder ser du oftest, og hvilke ligner en fejl, men er atletens naturlige position?
9. Kap 8: Hvad siger du til en atlet i bunden af en tung squat, og hvornår siger du ingenting?
10. Kap 8: Hvornår retter du bevidst ikke en squat, selvom den ser skæv ud?

**4. Venter:** Q17 og Q22 venter på Marcs svar. Når F1-F7 er rettet, kan `npm run verify:kritik-384` køres igen mod den nye gren. `REV` i scriptet skal så ændres, og figurerne skal ses igen.

## Ærlige grænser

- Kun Chromium-emulering (390x844 og 1280x900), ikke en rigtig telefon.
- "Ligner en rigtig squat" er min læsning som coach ud fra skærmbillederne. Ingen styrkeløftcoach ud over læsningen har set dem.
- F4's rigtige tal (25,5 og 16,4 cm) er min udregning ud fra 5 cm. Stangvægten på ca. 100 kg i A2 er regnet baglæns fra 49 Nm for 5 cm. Ingen af dem er læst i løftmodellen.
- F8's 6-7 px er skønnet fra skærmbilledet. Scriptet måler ikke tekst i canvas.
- Tjekkene for Q8-Q11, Q14-Q16 og Q18 er tekstmønstre. Q16 viser, at et mønster kan melde "lukket", selvom gentagelsen står der i ny form (A6).
- Panelets billeder er taget midt i animationen og skifter fra kørsel til kørsel (`fig-390-panel-*`, `artikel-390/025-026`). De viser figurens stil og ikke en bestemt fase.
- Scriptets første Q14-tælling var forkert (den talte "skulle" med små bogstaver). Det er rettet i commit 2.
- I dette worktree er filer under `outputs/kritik-skole/`, `outputs/kritik-skole-2/` og (kl. 20:29, efter min sidste kørsel kl. 20:28) `outputs/kritik-374/` ændret eller tilføjet af en anden proces undervejs. `kritik-384.mjs` skriver kun i `outputs/kritik-384/` og stopper, hvis en sti ligger udenfor. Jeg har ikke rørt dem, og de er ikke med i mine commits. Træet er rent for mine egne filer, men ikke for dem.
- Ingen push, ingen merges, ingen atletnavne. Sitet og løftmodellen er ikke rørt.
