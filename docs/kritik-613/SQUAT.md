Kapitel 6 på squat bedre: ja. Squat-artiklen klar til Marcs læsning: ja

# Kritik 613, blok 1: squat-artiklens nye kapitel 6 og jeg-formen (Setu 607) (Bhishak)

## Hvad jeg målte

- **Sitet:** `udgivelse-squat-min-krop` @ `f3c1684` (ny kapitel 6) og `25d6a41` (gammel kapitel 6 med jeg-form). Begge er hentet med `git archive` fra `entropi-coaching-site-wt2`, og træet er ikke rørt. Linjenumrene nedenfor er `artikel-squat.html` på `f3c1684`.
- **Læst to gange:** som en kyndig træner (tallene, metoden og om kapitlet siger det, det lover) og som en nysgerrig løfter (kan jeg følge det på telefonen?).
- **`outputs/kritik-613/squat-613.mjs`:** 15/15 grønne. Google Chrome headless på 390 med touch og 1280 med mus. Alt net uden for den lokale server er afbrudt, også Google Fonts. Ny og gammel kapitel 6 er begge målt, og `LAES-SQUAT.html` er åbnet som `file://`. Resultater i `squat-613.json`, skærmbilleder `Q-*.png`.
- **`outputs/kritik-613/k6-seeds-613.mjs`:** Setus måling (`setu-607/lm/k6.mjs`, løftmodel `207d4ec`) kørt igen med 200 støj-seeds i stedet for kun seed 607. Det giver 1000 klik pr. billede (`k6-seeds-613.json`). Setus kopi er kun læst.

## Er kapitel 6 på squat bedre end det gamle på dødløft?

**Ja.** Men den skal rettes i to ting (Q1 og Q2), før Marc læser den som færdig.

**For den nye:**
- Kapitlet er en squat i en squat-artikel.
- Det bruger den krop og den fejl, som kapitel 7 allerede har vist: "kun knæene", Marcs egen hyppigste fejl.
- Det viser, hvad målingen kan skelne i de to faser, Mål dit billede kender.
- Tabellerne er enklere end den gamle kapitel 6's. Den gamle havde fem stillinger, "upålidelig" i tre, model 1 mod model 2 og et knæ på 180°, som ingen løfter står med.
- Tallene hænger sammen. Alle 20 afvigelser er målt minus model inden for afrunding. Kun knæenes målte tal passer med kapitel 7's figur, hvor tallene er: knæ 30°, hofte 47°, torso 40°, stangen 2,9 cm foran og armen til hoften 15,7 cm. De målte er 29,2°, 47,5°, 39,7°, 3,1 cm og 15,1 cm. Modellens 48,5°, -1,0 cm og 21,7 cm er kapitel 7's reference.

**Imod den nye:**
- Der er ingen virkelighed i "Virkeligheden mod modellen". Billedet er modellens egen tegning, og fejlen er modellens egen fejlfigur. Kapitlet viser altså, at målingen kan skelne modellen fra sig selv.
- Den gamle kapitel 6 var artiklens eneste rigtige løft og det eneste sted, hvor Marc var med med sit eget klip.
- En kyndig træner ser, at det er en selvtest (Q3).

Alligevel er en squat, der passer i artiklen, bedre end et dødløft, der ikke gør. FILM-KLIP-kommentaren (linje 485) er den rigtige vej til virkeligheden senere.

## Jeg-formen

- **Holder:** 0 "Marc"/"Marcs" i den synlige tekst før forfatterlinjen. Det eneste "Marc" er forfatternavnet (linje 754) og sidefoden.
- **Jeg-form:** 24 linjer i artiklen er i jeg-form ("jeg", "min", "mit").
- **Kapitel 6 (484-544) har ingen jeg-form.** Det er ikke et brud, for kapitlet er rent beskrivende. Men Marcs stemme er væk fra kapitlet, og det står ikke nogen steder, at eksemplet er hans. Setu siger det selv i 607.
- **Den gamle kapitel 6 på `25d6a41`:** "Mit eget klip, 270 kg" og "mit målte skelet" står i indlejringen, og der er 0 JS-fejl på 390 og 1280.

## Brud på skrivereglerne

- **Tankestreger:** 0 i den synlige tekst.
- **Dramatisk åbning:** ingen.
- **Atletnavne:** ingen.
- **Opfordringer:** linje 398 "Skriv dine egne mål ind" (LAES-SQUAT valg 1 retter den). Linje 396 "kan du selv skrue på længderne" er en beskrivelse, ikke en opfordring.
- **Meta om struktur:** i kapitel 6 er det linje 487 ("Metoden vises her på en low bar-squat."), som siger, hvad kapitlet gør, ikke hvad det finder. I resten af artiklen er det linje 103 ("Figuren viser to af dem."), 263 (hvilke kapitler hver krop gælder), 327-328 og 549. LAES-SQUAT tæller 37 i alt, og de øvrige er "Gå dybere"-foldene.
- **Forbehold oppe i teksten:**
  - I kapitel 6: linje 488 ("Billedet her er ikke en løfter"), tabelteksterne på linje 496 og 515 ("ikke at modellen rammer") og linje 527 ("ikke hvad en bestemt løfter gør ... usikkerhed i målingen").
  - Resten af artiklen: linje 58 (valg 7) og mange "Modelvalg"/"ikke et litteraturtal".
  - LAES-SQUAT skriver om den nye, at "forbeholdene står i Gå dybere nederst i kapitlet". Det er kun delvist rigtigt.

## Figurerne på 390 og 1280 uden net

- **Figurerne:** begge SVG'er indlæses. De er 324 px brede på 390 og 230 px på 1280. Der er 0 JS-fejl, 0 fejl 404 og ingen sidelæns rulning af siden. Det eneste afbrudte kald er Google Fonts, og så falder skriften tilbage.
- **Tabellerne:** på 390 er de 640 px brede i en ramme på 350 px (Q1).

## Viser LAES-SQUAT.html gammel og ny, så Marc kan vælge på mobilen?

**Ja:**
- Boksen øverst har begge svarlinjer (`squat kapitel 6: ny` / `squat kapitel 6: gammel`).
- Begge kapitler er skærmbilleder, der kan rulles. På 390 står de under hinanden, ikke side om side, som siden selv skriver.
- Der er 0 JS-fejl og ingen sidelæns rulning.

**Svagheder:**
- Skærmbillederne er 350 px i 1x og bløde på en 3x-telefon (Q7).
- Valg 6 har stadig "Nu: Marcs eget klip" som nuværende tekst. Boksen "Dit svar 28. sep" retter det.
- "Hele artiklen" nederst viser den gamle kapitel 6, og det står der.

## Fund

| Fund | Alvor | Hvad | Hvad Setu gør |
|---|---|---|---|
| Q1 | middel | På 390 er begge tabeller i kapitel 6 640 px i en ramme på 350 px. Man ser kun "Led" og "Modellens squat, målt". Kolonnen "Kun knæene", som kapitlet handler om, og kolonnen "Model" ligger uden for skærmen, og tabelteksten skal rulles sidelæns linje for linje (`Q-390-ny-k6.png`). | Sæt "Kun knæene" som anden kolonne og skriv tabelteksten under tabellen uden for rullelaget. Tabellerne kan også stilles op som kort på smal skærm. |
| Q2 | middel | "ved alle fem klik" (507, 526) og "ved alle ti" (536) er seed 607. Over 200 seeds siger siden "Ligner: Kun knæene" ved 999/1000 klik i bunden, men kun 852/1000 ved sticking point. De to røde celler på modellens egen squat (knæet i bunden ±1,0°, torsoen ved sticking ±1,7°) er også seed-held. Den sande klikspredning på vinklerne er 2,2-2,7°, og med den er modellens egen squat inden for på 89-95 % af runderne. Desuden sammenligner "inden for" et gennemsnit af fem med én kliks spredning. | Enten skriv "i denne runde" og "ca. 85 % ved sticking point", eller brug båndet fra den kendte klikfejl, som artiklen selv angiver (534), så cellerne ikke afhænger af seed. |
| Q3 | middel | Kapitlet hedder "Virkeligheden mod modellen", men sammenligner modellen med sig selv. Svarlinjen (487) siger ikke, hvad kapitlet finder. | Svarlinjen bliver fundet, fx "Målingen skiller kun knæene fra modellens squat på knæet og stangen over midtfoden, i bunden også på torso og hofte." Om titlen skal ændres, til fx "Modellen målt fra siden", er Marcs valg. |
| Q4 | lav | Forbehold i brødteksten i kapitel 6 (488, 496, 515, 527), og LAES-SQUAT siger, at de står i "Gå dybere". | Flyt 488's "ikke en løfter" og 527 til "Gyldighed". Tabelteksternes definition af "inden for" kan blive. |
| Q5 | lav | Linje 492 kalder midtfoden "den gule streg", linje 82 kalder den "det orange mærke", og det er samme farve (#c8923a). | Skriv "orange" i 492. |
| Q6 | lav | Linje 536: "stangen i billedet af kun knæene står lavere end i modellens sticking point" er uforklaret for en løfter. | Slet den, eller forklar i én sætning, at siden også tjekker, om billedet er fra den fase, man har valgt. |
| Q7 | lav | LAES-SQUAT: skærmbillederne er 1x (350 px) og står under hinanden på 390, mens teksten siger "side om side". | Tag dem i 2x, og skriv "under hinanden på telefonen". |

## Ærlige grænser

- Headless Chrome på Windows, ikke en rigtig telefon.
- Min seed-kørsel bruger Setus kopi af løftmodellen (`207d4ec`) og hans kamera. Tjekket er, hvor robust tallene er over for støjen, ikke om modellen er rigtig.
- "Bedre" er min dom som kritiker. Marc vælger.
- Jeg har ikke læst hele artiklen fagligt igen (den er kritiseret i tidligere ordrer). Jeg har læst kapitel 6 fuldt, jeg-formen og reglerne i hele artiklen.
- Ingen push, ingen merge, ingen sub-agenter og ingen rigtige atleter eller klip.
