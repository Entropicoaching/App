# Kritik af squat-opslagsværket efter 369, læst som en coach på telefonen

**Klar til Marc: nej, fordi tre fejl, en kritiker kan rette på en halv dag, står netop dér, hvor læseguiden i RAPPORT-369 sender ham hen:**
- Kapitel 8 kalder "stangen over midtfoden" modellens balancebetingelse, men kapitel 1 viser stangen 4,6 cm bag midtfoden i første og sidste figur (Q1).
- Kapitel 4's ankelgrænser (25°, 35° og 45°) findes ikke i panelet, som viser 45° for alle seks kombinationer (Q3).
- Fejlbillederne og anatomitabellen kan ikke læses på telefonen (Q4, Q7).

**Når Q1-Q9 er rettet: ja.** De ti `[MARC: ...]`-spørgsmål kan sendes til ham nu, uafhængigt af rettelserne.

Grundlag: `npm run verify:kritik-374` (`scripts/kritik-374.mjs`) trækker sitet ud på `squat-opslag-7` (`a3e46de`) med `git archive`, serverer det lokalt og kører headless Chromium på 390x844 (touch, 2x) og 1280x900. Artiklen er læst på den renderede side, fra top til bund: først med foldene lukket, derefter med alle "Gå dybere" åbne. Den synlige tekst ligger i `outputs/kritik-374/squat-390-tekst-aabne-folder.txt`. Skærmbilleder af hvert kapitel, skærm for skærm, ligger i `outputs/kritik-374/squat-390-*.png` og `squat-1280-*.png`. Tallene står i `maalinger.json` under `squat-390` og `squat-1280`. Intet er rettet i sitet.

## Det der holder

- Ingen tankestreg (em- eller en-dash) i den synlige tekst med foldene åbne. Intet "man skal", ingen atletnavne, ingen interne navne (Yantra, RAPPORT, ordre) og ingen "[ ]". Forbeholdet står nederst. Konsollen er tom, og der er ingen vandret siderulning på 390.
- Introen er rolig og i Marcs stemme, og titlen holder hvad den lover. De tre kigge-punkter står nu i introen.
- Længde: 5149 ord med foldene lukket (48 skærme på 390) og 7886 med alle folder åbne (65 skærme). "38 min. læsning" passer.

## Fund

Alvor: **blokerer** (skal rettes før Marc læser), **vigtigt** (en coach mister tilliden eller tråden), **irriterer**, **kosmetisk**.

**Q1. Stangen over midtfoden modsiger sig selv. Alvor: blokerer.**
- Sted: kapitel 8, "Hvad jeg kigger efter", 2. afsnit ("Stangen over midtfoden er modellens balancebetingelse, og faserne i kapitel 1 viser hvor den står undervejs"). Desuden introen og kapitel 1, "Balancen" ved opstilling, unrack og lockout.
- Hvad læseren oplever: Marcs første kigge-punkt er stangen over midtfoden. Kapitel 2 siger rigtigt, at betingelsen er det *samlede tyngdepunkt*. Men kapitel 1's første og sidste figur viser stangen 4,6 cm bag midtfoden, med teksten "det går kun op fordi resten af kroppens masse ligger foran midtfoden". Når kapitel 8 så kalder stangen over midtfoden for modellens betingelse, ser coachen, at hans vigtigste cue og modellen siger to ting, og det står i hans eget kapitel.
- Forslag: kapitel 8 skal sige "tyngdepunktet over midtfoden", og hvad stangens afstand til midtfoden er i modellen (1,3 cm i bunden, 4,6 cm bag i toppen).

**Q2. Kapitlet om faser begynder og slutter med en figur, som teksten selv kalder forkert. Alvor: vigtigt (kendt, FIGUR-FUND A).**
- Sted: kapitel 1, figurerne for opstilling og lockout (`squat-390-faserne-02.png`).
- Hvad læseren oplever: "Lockout" viser bøjede knæ (172°), 8° torso og stangen bag midtfoden. Teksten forklarer det fire gange: i figurteksten, under "Ledvinkler", i "Samme position som lockout" og i "Modellens topposition". Coachen ser en lockout, der ikke er godkendt, og læser fire forbehold om den.
- Forslag: indtil løftmodellen er rettet, skal forklaringen stå ét sted, og de tre andre skal væk.

**Q3. Ankelgrænsen i teksten findes ikke i panelet. Alvor: blokerer.**
- Sted: kapitel 4, "Gå dybere" under Ankelmobilitet ("25° for lang lårknogle, 35° for balanceret og 45° for lang torso"), og kapitel 7, "Hælene letter" ("ankelgrænse på 35°").
- Målt: panelet viser "ANKELGRÆNSE, SKINNEBEN HØJST 45°" for alle seks kombinationer af kropstype og stang, både på 390 og 1280 (`panelKombinationer`).
- Hvad læseren oplever: coachen trykker på "Lang lårknogle" for at se grænsen på 25°, og der står 45°. Tallene går heller ikke op i sig selv, for lang lårknogle skal bruge 33° (lowbar) og 43° (highbar) for at nå dybden (samme kapitel). Med en grænse på 25° kunne den ikke squatte.

**Q4. Anatomitabellen i kapitel 3 viser et komma i tre celler og gemmer procenten på telefonen. Alvor: vigtigt.**
- Sted: kapitel 3, tabellen under vælgeren, stillingen "Bund".
- Målt: kolonnen "Andel af eget max" viser "," for sædemuskel, baglår og adduktor, både på 390 og 1280 (`tabeller[0].kommaCeller: 3`). Årsagen er sidens eget script, der erstatter tankestreger (`artikel-squat.html` linje 1027 og 1044): det gør tabellens tomme "—" til ", ".
- På 390 er tabellen 480 px bred i en rulleramme på 311 px. Kolonnerne "Andel af eget max" og "Status" ligger uden for skærmen, og intet viser, at man kan rulle (`squat-390-anatomien-02.png`). Læseren ser muskel, vinkel og momentarm, men ikke den procent, som teksten under tabellen handler om.

**Q5. "Ledvinkel" betyder to ting. Alvor: vigtigt.**
- Sted: kapitel 3, tabellens kolonne "LEDVINKEL" (knæ 117.1°), mod kapitel 1 (knæ 63° i bunden).
- Hvad læseren oplever: kapitel 3's indledning forklarer, at vinklerne her er fleksion. Alligevel står der "Ledvinkel" over fleksionen i tabellen, og kapitel 1 bruger ordet om det modsatte. Omvendt bliver "hofte 22°" i kapitel 1 ikke forklaret (180° = strakt), og en coach, der tænker i hoftefleksion, læser 22° som en næsten strakt hofte.

**Q6. "IPF-dybde: ja" står stadig på figuren. Alvor: vigtigt.**
- Sted: kapitel 3, anatomivælgerens canvas (`squat-1280-anatomien.png`, `squat-390-anatomien-02.png`). Fejlteksten "Ingen skinnebensvinkel giver en mulig positur ved IPF-dybde" står også i `squat-anatomi.js` (ikke set på siden).
- Hvad læseren oplever: kapitel 2 siger udtrykkeligt, at modellens 3 cm ikke er dommernes vurdering. Figuren siger så "IPF-dybde: ja". Setu 369 rettede ordet i SVG-kopierne, men canvas-teksten tegnes af JS og blev ikke fanget.

**Q7. Figurernes tekst kan ikke læses på telefonen. Alvor: vigtigt.**
- Kapitel 7's fire fejlbilleder og kapitel 3's fire anatomi-stillbilleder er SVG'er, der er 1100 px brede, vist 316 px brede (skala 0,29). Den indlejrede tekst er derfor 2,9-4,9 px på 390 og ca. 6 px på 1280 (`squat-390-fejlbilleder-02.png`, `squat-1280-fejlbilleder.png`). Det gælder titlen, "Moment før / efter"-tabellen og en hel "Problem eller bias?"-tekst.
- Kapitel 6's fem stillbilleder har 6 px tekst. Kapitel 1's og 5's mærker "H" og "K" er 6,5 px, og figurteksten henviser til dem.
- Hvad læseren oplever: grå streger, hvor der burde være tal. I "Good morning" dækker den blå figur næsten den guldfarvede helt (4 cm, 0,2°), så fejlen ikke kan ses.

**Q8. "Good morning" er ikke en good morning. Alvor: vigtigt (fagligt).**
- Sted: kapitel 7, Good morning.
- Hvad læseren oplever: definitionen er "hoften rejser sig tidligt i forhold til torsoen". I modellen stiger hoften 4 cm, mens torsoen ikke hælder mere (0,2°), og det koster 0,9 og 1,5 Nm. En coach kender good morning som den squat, hvor brystet falder, og torsoen tipper frem, fordi hoften kører først. Kapitlet konkluderer, at den koster "kun lidt". Det kan læses, som om fejlen er ufarlig, og modellen har aldrig vist den.
- Forslag: skriv scenariet om som "hoften løftet ved uændret torso", eller tag det ud, til modellen kan tippe torsoen.

**Q9. Valgus forklaret forkert, og tællingen går ikke op. Alvor: vigtigt (let at rette).**
- "Knævalgus, knæet der vandrer indad eller udad". Valgus er indad, og udad er varus.
- "To fejlbilleder kan modellen slet ikke tegne", men afsnittet gennemgår tre (valgus, obliquitet og tilt). "Gå dybere" siger "seks i alt: de fire med figur, plus knæ indad og bækkenets bevægelser (obliquitet og tilt)", og det giver syv.

**Q10. Vendepunktets tal passer ikke med hinanden. Alvor: irriterer.**
- Kapitel 1, vendepunkt: "Modellen når sit første hastighedstop 0,38 s efter bunden" (figurteksten har 0,4 s). "Gå dybere" siger, at toppet ligger "11 % inde i opturens tid", og lockout siger, at opturen tager 2,8 s.
- 0,38 s af 2,8 s er 13,6 %, mens 11 % ville være 0,31 s. En omhyggelig læser regner efter.

**Q11. Kapitel 6 lover mere enighed, end det har. Alvor: vigtigt.**
- Tabellen viser grønt "ja" (inden for båndet) i 5 af 5 rækker ved knæhøjde, også knæet med en afvigelse på -25,7° og et bånd på ±33,6°. Først under "Gå dybere" står det, at "inden for" er "mildt".
- "Model 1 / Model 2" er knapper uden forklaring, indtil man åbner "Modelversion". Dér står, at Model 2 er "standard i resten af opslaget og finder ingen positur ved lockout".
- Stadig i teksten: "Stangen er en anden sag" (LÆSNING-369 udpegede den) og "Det er grunden til at sammenligne". Minustegnene er blandede (−25,7 mod -2,6).
- Kapitlet er stadig et dødløft i en squatartikel ("Squat-udgaven kommer"), og det er kendt.

**Q12. Panelet på telefonen: figuren og skyderne kan ikke ses samtidig. Alvor: vigtigt (touch).**
- Målt: der er 1068 px fra toppen af figuren til bunden af ankelskyderen i et vindue på 844 px, og 1077 px på 1280x900 (`panelSamtidig`, `squat-390-segmentmodellen-skyder-i-syne.png`).
- Coachen flytter skinnebensskyderen og ser kun tallene. For at se kroppen ændre sig skal han rulle op.
- Panelet og anatomivælgeren tegner stangen som en vandret streg på en pindefigur, mens kapitel 1 og 5 tegner den fra enden med skive og krop. Kapitel 7 har en tredje stil. Det er tre tegnestile i ét værk.

**Q13. Decimalpunktum. Alvor: kosmetisk.**
- Panelet: "1.3 cm", "63.7°", "1.72 : 1", "3.0 cm", "MINDST 23.0°". Anatomitabellen: "117.1°" og "2.3". Fejlbillederne: "36.2 -> 36.2".
- Resten af artiklen bruger komma.

**Q14. Stil og proces i synlig tekst. Alvor: irriterer.**
- "den kraft gruppen SKULLE levere" står med versaler i HTML-legenden i kapitel 3. 369 rettede det kun i SVG'erne.
- Filnavnet "RajagopalLaiUhlrich2023" står i brødteksten.
- "Licensen på modelfilen er endnu ikke bekræftet" er en procesnote til læseren og blokerer desuden udgivelse.
- Overskriften "BÆKKENET ER IKKE SIT EGET LED ENDNU" bruger "endnu" som projekthistorie.
- "I bunden af en tung squat ligger den reelle vinkel typisk over 120°" står uden kilde.

**Q15. Meta-kommentarer om strukturen, der er tilbage. Alvor: irriterer.**
- Følgende står stadig:
  - "se kapitlets indledning" (figurteksten til opstilling)
  - "Stillingerne står også som stillbilleder med samme legende som vælgeren"
  - "Panelet i kapitlet om segmentmodellen har en kontakt"
  - "større end i målingerne herunder"
  - "Kristiansen m.fl. (2021), se referencerne"
  - "Knævinkler og momenter fra målingerne står ved bunden i kapitel 1"
  - "samme ledmoment-funktion som resten af kapitel 2 og 3"
  - "Forbeholdet nederst." (brugt som kildelinje)
- Otte henvisninger til andre kapitler i alt.

**Q16. Gentagelser, der er tilbage. Alvor: irriterer.**
- (a) Legenden "Hvad stregerne bygger på" (ca. 150 ord, kapitel 3) og "Hvad figurerne bygger på" i "Gå dybere" er næsten ordrette.
- (b) "Opstilling og lockout er samme positur i modellen" står tre gange i kapitel 3, og samme pointe står fire gange i kapitel 1.
- (c) Definitionen af den naturlige position står i introen, i kapitel 4's første sætning og i kapitel 8.
- (d) "Model-proxy" om anklen står både i kapitel 4's indledning og i "Gå dybere".
- (e) "Balancen. Foden: tyngdepunktet er stadig over midtfoden." står i syv faser, og i fire af dem uden ny oplysning.

**Q17. Den røde tråd: Marc er der kun i begyndelsen og slutningen. Alvor: vigtigt (afhænger af Marcs svar).**
- Den synlige tekst har 18 ord i første person (jeg, min, mine, mit) og 203 med "model".
- Kapitel 1 har 1646 ord (13,5 skærme med foldene lukket). Kapitel 8 har 247 ord (1,6 skærm), og halvdelen er en "Kommer"-boks med to spørgsmål.
- Tråden intro → kapitel 4 → kapitel 8 kan følges ("prøve sig frem, bias, svage punkter"). Men imellem er kapitel 1-3 og 6-7 en modelrapport.
- "Udefra" under vendepunkt og sticking point er målinger fra litteraturen, ikke noget coachen ser.
- Der mangler én bro: hvordan Marc bruger panelet ("Min krop") med en rigtig atlet. Det kan først skrives, når han har svaret.

**Q18. Forbeholdene står også i toppen. Alvor: vigtigt for læsbarheden.**
- Reglen om forbehold nederst holdes formelt, men "referencekrop" står 37 gange og "i modellen" 47 gange.
- Kapitel 1 åbner med tre afsnit om metode og forbehold (ca. 1,5 skærm på 390), før den første fase kommer. Kapitel 2, 3 og 5 åbner på samme måde.
- Forslag: metoden kan flyttes til "Gå dybere" eller til Forbehold, så "Balanceret referencekrop, lowbar" står én gang i hver figurtekst.

**Q19. Kapitel 5's hovedtekst giver kun modellens forskel. Alvor: vigtigt.**
- Torsoen hælder 64° ved lowbar mod 45° ved highbar i hovedteksten. Målingerne (ca. 10° forskel, og ingen forskel hos 10 styrkeløftere) står kun i "Gå dybere".
- Front squat (29,1°) og safety bar (29,5°) ligger begge ved loftet på modellens torsospænd (15-30°). "Omtrent som ved front squat" er altså et resultat af modelvalget, og det står ikke.

**Q20. Anatomikapitlet siger mindst om de muskler, en coach spørger om. Alvor: vigtigt (kendt fra LÆSNING-369 c).**
- Sædemuskel, baglår og adduktor står som "uden for modellens område" halvvejs nede, i bunden og ved sticking point, altså netop dér, hvor de arbejder.
- Det står i hvert underafsnit, men ikke i kapitlets første sætning. Læseren opdager det først i tabellen.

**Q21. Små trykflader. Alvor: kosmetisk.**
- Kapitel 6's knapper til stillingerne er 32 px høje, og "Modellens figur" er 19 px (under 44 px).
- Panelets knapper og skydere er store nok.

**Q22. Synligt ufærdigt. Alvor: kosmetisk nu, blokerer udgivelse (kendt).**
- Der står ti `[MARC: ...]` og en "Kommer"-boks. Det er med vilje til Marc.

## Pr. kapitel, kort

| Kapitel | Skærme (390, lukket) | Rød tråd | Figur og indlejring på telefonen | Værste fund |
|---|---|---|---|---|
| Intro | 1,5 | Klar, Marcs stemme | ingen | ingen |
| 1 Faserne | 13,5 | Modelrapport i skabelon, Marc kun i bunden | Figurerne kan læses (210 px), H/K 6,5 px | Q1, Q2, Q10 |
| 2 Segmentmodellen | 2,0 | To afsnit, ingen bro til brug | Panelet virker, figur og skyder ikke på samme skærm | Q3, Q12, Q13 |
| 3 Anatomien | 6,9 | Tung, næsten uden Marc | Tabellen skjuler kolonner, 3 kommaer, stillbilleder med 3-4 px tekst | Q4, Q5, Q6, Q20 |
| 4 Kropstyper | 2,5 | Marcs kerne, kort | Ingen figur (bruger panelet) | Q3 |
| 5 Stang og variant | 4,2 | Marc i første afsnit | Fire figurer kan læses | Q19 |
| 6 Virkeligheden | 3,3 | Dødløft, metode | Tabellen kan læses, stillbilleder med 6 px tekst, 32 px knapper | Q11 |
| 7 Fejlbilleder | 6,7 | Mekanisk (undersøg/bias/problem) | SVG-tekst 3-4 px, Good morning usynlig | Q7, Q8, Q9 |
| 8 Min praksis | 1,6 | Marc, men halvt tomt | ingen | Q1, Q17 |

## Rækkefølge for Setu

1. Q1, Q3, Q4, Q6, Q9: tekst- og scriptrettelser, en time.
2. Q7: vis fejlbillederne og anatomi-stillbillederne i fuld bredde med tekst, der kan læses, eller flyt deres tal ud i HTML. Tag Q12 i samme omgang.
3. Q5, Q8, Q10, Q11, Q19: afgrænsning og tal.
4. Q13-Q16, Q18: stil.

Q2 og Q20 venter på løftmodellen, og Q17 venter på Marcs svar.
