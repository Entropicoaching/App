skakken stadig klar til eleverne: ja

K13-K17 er lukket, som Chaturanga skriver i 556, og nr. 1 fra listen (#13) virker på telefonen og på projektoren.

Et nyt fund (K26, middel) ligner K13: i "Find feltet" står feltets navn over skærmen efter Start, når eleven har rullet ned til knappen. To små (K24, K25) handler om, hvad "mindst halvdelen" og "højst ca. 100 over" betyder i K17.

# Kritik 568, blok 2: skakken efter Chaturangas 556

Bhishak, 28. sep 2026. Ordre 568. Skak `main` @ `04e25e7` (556 er merget). Hentet med `git archive` (skak.html, laerer.html, data, src); skak-træet er urørt.

**Målingen:** `outputs/kritik-568/skak-568.mjs` → `skak-568.json`, `skak-568.log` og `S-*.png`. **58/58** tjek er grønne. Et grønt tjek på et fund betyder, at fundet er, som jeg beskriver det.
- Headless Chromium uden net: 360 x 780 og 390 x 844 med touch, 1280 x 800 med mus, og 360 x 640 som lav telefon. Alt andet end file/data/blob afvises og tælles: **0 netkald og 0 JS-fejl** i alle kørsler.
- Uret er falsk fra 28. sep 2026 kl. 10.
- Eleven er 12 år og uden navn. Hun trykker, som en elev gør. Mit script ruller ikke efter trykket, og brættet måles 100 ms og 1,2 s efter.

## K13 brættet efter et tryk

Lukket. Efter hvert tryk står hele brættet og statuslinjen på skærmen, allerede efter 100 ms, på alle tre bredder:

| Tryk | 360 (brættet, px) | 390 | 1280 |
|---|---|---|---|
| "Partiet i operaen" i listen | 73-417 (før: 1083 over) | 73-447 | 108-644 |
| "Kongejagten" i listen | 95-439 | 73-447 | 108-644 |
| "Næste kendte parti" | 73-417 | 73-447 | 108-644 |
| "Øv gafler" i "Øv et tema" | 138-482 | 138-512 | 152-689 |
| "Øv" i Mit bibliotek | 138-482 | 138-512 | 152-689 |
| "Gentag nu" dagen efter en fejl | 138-482 | 138-512 | 237-774 (flyttede sig ikke) |

- Statuslinjen står over brættet med det, eleven skal vide ("Hvid trækker (Paul Morphy). Find det træk, der blev spillet.", "Sort trækker. Find det bedste træk.").
- På en lav telefon (360 x 640) står brættet 73-417 efter operaen og 138-482 efter "Øv gafler", og statuslinjen 6-57.
- Skærmbilleder: `S-390-k13-opera.png`, `-oev-gafler`, `-gentag` og `S-360x640-k13-gafler.png`.

## K14 Lasker-teksten

Lukket. På alle tre bredder:
- **O-O-O#:** "Løst! Lasker spillede Kd2#, men O-O-O# er også mat.", og historien vises (`S-390-k14-ooo.png`).
- **Kd2#:** "Løst! Præcis sådan spillede Edward Lasker."
- **Med hint først:** "Løst (med hjælp)! Lasker spillede Kd2#, men O-O-O# er også mat."
- **På brættet (chess.js):** i sidste stilling er både Kd2# og O-O-O# mat. Partiet sluttede med Kd2#.

## K15 Steinitz

Lukket. Teksten er nu: "Det huskes for tårnet på e7, som sort ikke kan slå: slår kongen, bliver den jaget ud i et angreb, og slår dronningen, taber sort en officer." Det er rigtigt på brættet:
- Efter 22.Txe7+ kan sort slå med kongen og med dronningen.
- 22...Dxe7 23.Txc8+ Txc8 24.Dxc8+ kan spilles, og bagefter har hvid 12 i officerer mod sorts 9.
- "Jaget ud i et angreb" lover ikke mat, og det er ærligt, fordi appens motor ikke kan vise den lange mat.
- For en 12-årig er sætningen let at følge.

## K16 Réti

Lukket. "De var unge mestre på 21 og 23 år og blev senere blandt verdens bedste. ... Réti ofrede dronningen på d8, gav dobbeltskak med løber og tårn i 10. træk og satte mat med løberen i 11. træk."
- **På brættet:** dronningen til d8 i 9. træk, 10.Lg5+ er skak fra to brikker (løberen på g5 og tårnet på d1), og 11.Ld8# er mat med løberen.
- **Aldrene** passer med min hukommelse: Réti er født 1889 og Tartakower 1887. Ligesom Chaturanga har jeg ikke slået dem op uden net.

## K17 lichess-andelen i temaerne

Lukket, som det er lovet: 7 af 10 er et gennemsnit.

**20 tryk pr. tema** i de seks temaer (mat i 1, mat i 2, gaffel, binding, spyd, afdækket angreb), hver gang med en ny elev:

| Elev | Lichess af 120 | Pr. tema (af 20) |
|---|---|---|
| Ny (800), 360 | 93 (78 %) | 11-19 |
| Ny, 390 | 90 (75 %) | 11-19 |
| Ny, 1280 | 94 (78 %) | 14-19 |
| 1200, 390 | 80 (67 %) | 9-20 |
| 1200, 1280 | 91 (76 %) | 13-20 |

- **Første kørsel:** her fik en ny elev på 360 9 af 20 i gaffel. Det er denne rapports første kørsel af scriptet; tallene ovenfor er den sidste.
- **Modstanderens træk:** hver eneste lichess-gåde havde modstanderens træk markeret på brættet (`sidst-fra`/`sidst-til`), og en elev ser 16-20 forskellige gåder på 20 tryk.
- **Dagens gåde:**
  - På de lige dage (28/9 og 30/9) er den en lichess-gåde (762 og 736). Den 29/9 er den ikke (778).
  - To elever får den samme på samme dato.

## Nr. 1 fra listen (#13)

**"Med brikkerne" i "Find feltet"** virker på alle tre bredder:
- valget står der
- 32 brikker i udgangsstillingen
- 10 af 10 felter fundet med tryk midt på feltet, også de 3-5 med en brik på
- hjælpeteksten siger, at brikkerne står som i starten af et parti

Felterne er 38 px på 360, 42 px på 390 og 44 px på 1280. Det er brættets egen størrelse. Min elev ramte hver gang, men en rigtig finger på 38 px er ikke målt.

**Klasseøvelsen i `laerer.html`** (1280, falsk ur):
- "Find feltet" viser 0:30 og "Gør klar: Spil → Koordinater → Find feltet".
- Den fælles nedtælling ender i "Start!", og uret går til 0:00.
- Tre borde under "Fundet".
- Projektoren viser "Klassens koordinater" med bord 9 først (22 felter) og "Sig dit antal felter til læreren" (`S-1280-13-klassens-koordinater.png`).
- Stormens ene bord og koordinaternes tre bliver, hvor de hører til, når jeg skifter frem og tilbage, også efter genindlæsning.
- Der gemmes kun bordnumre og tal.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| K24 | lav | "Mindst halvdelen fra lichess" er et gennemsnit, ikke et loft. I 30 temakørsler fik én elev 9 af 20 (1200, binding), og i første kørsel fik en ny elev 9 af 20 i gaffel. Over alle seks temaer er det 67-78 %. | Intet at rette i appen. Skriv "i gennemsnit 7 af 10" i MOD-LICHESS og rapporterne. |
| K25 | lav | En ny elev (800, mål 650) fik lichess-gåder op til 1048. Rapporten siger "højst ca. 100 over" elevens rating. Loftet gælder kun kravet om 3 usete inden for 250. Selve valget blandt lichess-gåderne udvider vinduet til 400 om målet, når de nære er set. I gaffel er den letteste lichess-gåde 673, og der er 15 i 400-900. | Chaturanga: brug LICHESS_VINDUE også i valget (tag fra hele temaet, når ingen usete lichess-gåder ligger inden for 250), eller ret sætningen. Punkt #18 (lette lichess-gåder) løser resten. |
| K26 | middel | I "Find feltet" (også "Med brikkerne") står feltets navn og uret over brættet, og Start-knappen under det. Har eleven rullet ned til Start, ser hun brættet, men ikke hvilket felt hun skal finde: navnet står 35 px over skærmen på 360, 53 px over på 1280 og 1 px over på 390 (`S-360-13-efter-start.png`). Appen ruller ikke. Det koster sekunder i en øvelse på 30, også i klasseøvelsen. | Samme greb som K13: rul, så feltets navn, uret og brættet står på skærmen, når der trykkes Start (`rulMaal`). |

## Ærlige grænser

- **Emuleret, ikke rigtigt:** headless Chromium på Windows, ikke en telefon; touch er Playwrights emulering. En rigtig 12-årig finger på felter på 38 px er ikke målt.
- **Kun 20 tryk:** K17 er 20 tryk pr. tema pr. elev, uden at løse gåderne. Andelen for en elev, der løser og stiger i rating, er ikke målt. Første kørsel af scriptet gav andre enkelttal (fx gaffel 9/20); gennemsnittet lå i samme område.
- **Mit bibliotek:** mit script løste kun én gaffel, før det ikke kunne slå den næste op. K13-trykket i Mit bibliotek er derfor en række-"Øv"-knap, ikke "Øv gafler" under "Dit svageste tema". Det måler det samme: brættet efter et tryk i biblioteket.
- **Uden net:** Réti og Tartakowers aldre og Steinitz' mat er efter min hukommelse, ikke slået op.
- **Klasseøvelsen** er kun målt på 1280 med projektoren i samme vindue. Ikke på en rigtig projektor eller med elever, der siger deres tal.
- Ingen rigtige elever. Intet i skak er rørt.
