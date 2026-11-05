# Prioriterede fødevarer til styrketræning

Formålet er at hjælpe med et enkelt fødevarevalg, ikke at udpege en fødevare,
der i sig selv gør en atlet stærkere. Progressiv styrketræning, tilstrækkelig
energi og samlet proteinindtag er vigtigere end et mærke på en enkelt vare.
Præferencer, pris, allergier og tolerancer afgør, hvilke muligheder der passer.

## Kildegrundlag og evidensniveau

Dette er et afgrænset fagligt notat med kendte referenceidentifikatorer, ikke
en ny systematisk litteratursøgning. Netadgang er ikke tilladt i denne opgave.
Referencerne er derfor **ikke hentet eller uafhængigt verificeret her**, og
nyere forskning er ikke kontrolleret. Kildestatus er fortsat
`kilde skal verificeres`, som i katalogets eksisterende `SOURCES`.
Kontrollér originalerne, før notatet bruges som verificeret rådgivningsgrundlag.

Niveauerne nedenfor er en redaktionel vurdering, ikke en formel GRADE-vurdering:
**høj** betyder konsistent samlet støtte til det angivne udfald;
**moderat** betyder mere betinget eller indirekte støtte;
**begrænset** betyder få direkte data, blandede resultater eller overførsel fra
andre populationer/udfald. En akut ændring i muskelproteinsyntese er ikke det
samme som dokumenteret større styrkefremgang over måneder.

| Emne | Hvad forskningen understøtter | Evidens og grænse | Praktisk fødevarevalg |
| --- | --- | --- | --- |
| Protein, kvalitet og leucin | Tilstrækkeligt protein understøtter muskeltilpasning til styrketræning. Essentielle aminosyrer og leucin bidrager til stimulering af muskelproteinsyntese. Samlet dagsindtag betyder mere end jagten på én bestemt fødevare. [1, 2] | **Høj** for protein som supplement til styrketræning, når det forbedrer den samlede proteindækning; mindre sikker ekstra gevinst ved allerede tilstrækkeligt indtag. **Moderat** for fødevarekvalitet/leucin ud fra akutte målinger; **begrænset** for at én leucinrig vare giver større langtidsstyrke ved sammenligneligt tilstrækkeligt protein. | Skyr, æg, fisk og kød er praktiske muligheder. Tofu og varierede bælgfrugter/korn kan indgå i en plantebaseret kost. Tilpas portioner og den samlede kost; planteprotein er ikke automatisk utilstrækkeligt. |
| Kulhydrat omkring træning | Kulhydrat bidrager til energi og glykogen. Tilgængelighed kan være vigtigere ved lange pas, høj volumen, faste eller kort restitution mellem pas. [3, 4] | **Moderat**, situationsafhængig støtte til træningspræstation; **begrænset** til universel ekstra styrkefremgang fra præcis timing. Mange almindelige styrkepas i spist tilstand kræver ikke ekstra kulhydrat under træningen. | Ris, pasta, kartofler, havre og frugt kan passe før/efter træning. Vælg mængde efter energi og belastning, og timing efter mavekomfort. Intet obligatorisk snævert vindue. |
| Kreatin via kost | Kød og fisk bidrager med kreatin; tilberedning og fødevaretype påvirker indholdet. De stærkeste præstationsdata gælder kreatinmonohydrat som tilskud sammen med træning. [5] | **Høj** for tilskudsrelateret styrke/højintens præstation, men **begrænset** for at prioritere bestemte hele fødevarer for samme effekt. Tilskudsstudier dokumenterer ikke, at normale kød-/fiskeportioner giver en tilsvarende dosis eller effekt. | Fisk eller en moderat mængde kød kan indgå, hvis det ønskes. Ingen anbefaling om mere rødt kød for at efterligne et tilskud. Vegetarer behøver ikke ændre kostvalg på grund af mærket. |
| Jern og D-vitamin | Jern er nødvendigt for bl.a. ilttransport; D-vitamin for bl.a. normal knogle- og muskelfunktion. At sikre tilstrækkelighed er relevant; mere er ikke automatisk bedre. [3, 6] | **Høj** for normale fysiologiske funktioner og betydningen af at undgå mangel; **begrænset/blandet** for ekstra styrke fra at øge indtaget hos allerede tilstrækkeligt dækkede atleter. Dette er ikke et løfte om effekt af en mærket vare. | Kød kan bidrage med hæmjern; bælgfrugter med ikke-hæmjern, hvis optagelse bl.a. påvirkes af C-vitamin og måltidet. Fed fisk kan bidrage med D-vitamin; berigelse af alternativer skal kontrolleres. Kostregistrering alene diagnosticerer ikke mangel; mulig mangel kræver faglig vurdering. |
| Fibre og mæthed i cut | Fiberrige fødevarer, grøntsager og bælgfrugter kan støtte mæthed og gøre et passende energiunderskud lettere at følge. Fiberens type, fødevarens struktur og den enkelte persons respons betyder noget. [6, 7] | **Moderat**, varierende evidens for mæthed/energiindtag; **begrænset** for direkte bedre styrkebevarelse fra fibre i sig selv. Mæthed er ikke dokumentation for muskelbevarelse. | Havre, linser og grønt er muligheder sammen med tilstrækkeligt protein og energi til træning. Store fibermængder lige før træning kan give mavegener. Et aggressivt cut kan forringe træningskvalitet uanset fødevarevalg. |

## Enkel, valgfri markering

`prioritet` er en streng med én af værdierne `basis`, `god`, `særlig`.
Hvis den er til stede, skal `prioritetBegrundelse` være en ikke-tom streng.
Begge felter kan udelades; de er da helt fraværende fra objektet. Ugyldige
niveauer, null og ufuldstændige par afvises med `TypeError`. Teksten trimmes.
Der er ingen automatisk markering ved navn eller makroindhold i `createFood`;
kun katalogets eksplicit valgte eksempler får felterne.

- **basis:** alsidig mulighed i den daglige kost, hvis den passer til personen.
- **god:** praktisk alternativ eller mulighed til et bestemt måltid/træningsbehov.
- **særlig:** kan være relevant for en bestemt næringsstofkontekst. Det betyder
  hverken bedre, nødvendig, mangel påvist eller mere bør spises.

Niveauerne er ikke en rangliste, og umarkerede varer er ikke dårligere. Der er
ingen forbudte varer. Eksemplerne er bevidst få og er ikke et komplet kostmønster.
Ingen ændret sortering, filtrering, målsætning, portion eller beregning følger af
mærkerne. De eksisterende temaer i `PRIORITIES` og kilder i `SOURCES` bevares.

| Eksisterende katalogvare | Niveau | Begrundelsens faglige grundlag og begrænsning |
| --- | --- | --- |
| Skyr naturel | basis | Mælkeprotein og essentielle aminosyrer [1, 2]; ingen registreret leucinmængde. |
| Kyllingebryst | god | Praktisk proteinmulighed [1, 2]; ikke nødvendig ved tilstrækkelig anden protein. |
| Tofu fast | god | Plantebaseret proteinmulighed [1]; portionsstørrelse og samlet kost afgør dækningen. |
| Havregryn | basis | Fuldkorn, kulhydrat og fibre [3, 6, 7]; individuel mæthed/mavekomfort, fiberindhold ukendt i kataloget. |
| Linser kogte | basis | Bælgfrugt med protein og fibre [1, 6, 7]; ingen påvist jern- eller proteindækning fra mærket. |
| Ris kogt | god | Kulhydrat tilpasset træningsbelastning [3, 4]; ingen universel timingfordel. |
| Broccoli | basis | Grønt til variation og volumen [6]; ingen selvstændig styrkegevinst dokumenteret. |
| Laks fersk | særlig | Fed fisk som mulig D-vitamin- og proteinkilde [1, 6]; ukendt D-vitaminindhold/dækning. |
| Hakket oksekød 8% | særlig | Muligt bidrag af hæmjern og kreatin [5, 6]; ukendte mængder/behov, almindelige kostråd om begrænsning af rødt kød gælder stadig. |

Begrundelserne er generel viden om fødevaretyper, **ikke målte næringsværdier**
for de konkrete varer. Den offentlige legacy-liste indeholder kun energi og
makroer. Katalogets `leucineG`, `ironMg`, `vitaminDUg` og `fibreG` forbliver
`null`. Kreatin er ikke et målt felt i den nuværende næringskontrakt. Der
opfindes ingen værdier, og mærkerne må ikke bruges til at udlede mangel/dækning.

Der tilføjes **ingen UI**. Atleten og coachen ser ingen nye mærker, råd,
rangeringer eller skærmbilleder i denne levering. Hvis et senere flow skal vise
mærket, er forslaget kun én kort markering med begrundelsen foldet væk, og intet
vises, når felterne mangler. Det kræver en særskilt UI-opgave og verificering af
kilderne. Ingen nye persondata eller produktionskoblinger indføres her.

## Referencer (ikke kontrolleret online i denne levering)

1. Jäger et al. (2017). *International Society of Sports Nutrition Position Stand:
   protein and exercise*. Journal of the International Society of Sports Nutrition.
   [doi:10.1186/s12970-017-0177-8](https://doi.org/10.1186/s12970-017-0177-8).
   Positionspapir; ikke i sig selv et fødevarerangeringsforsøg.
2. Morton et al. (2018). *A systematic review, meta-analysis and meta-regression
   of the effect of protein supplementation on resistance training-induced gains
   in muscle mass and strength in healthy adults*. British Journal of Sports Medicine.
   [doi:10.1136/bjsports-2017-097608](https://doi.org/10.1136/bjsports-2017-097608).
3. Thomas, Erdman & Burke (2016). *Nutrition and Athletic Performance*.
   Medicine & Science in Sports & Exercise.
   [doi:10.1249/MSS.0000000000000852](https://doi.org/10.1249/MSS.0000000000000852).
   Positionspapir om sportsernæring, ikke kun styrkesport.
4. Henselmans et al. (2022). *The Effect of Carbohydrate Intake on Strength and
   Resistance Training Performance: A Systematic Review*. Nutrients.
   [doi:10.3390/nu14040856](https://doi.org/10.3390/nu14040856).
5. Kreider et al. (2017). *International Society of Sports Nutrition position
   stand: safety and efficacy of creatine supplementation in exercise, sport,
   and medicine*. Journal of the International Society of Sports Nutrition.
   [doi:10.1186/s12970-017-0173-z](https://doi.org/10.1186/s12970-017-0173-z).
   Tilskudsevidens må ikke sidestilles med fødevareevidens.
6. Nordic Council of Ministers (2023). *Nordic Nutrition Recommendations 2023*.
   [doi:10.6027/nord2023-003](https://doi.org/10.6027/nord2023-003).
   Generel ernæring, herunder protein, jern, D-vitamin, fibre og fødevaregrupper;
   ikke dokumentation for ekstra styrke fra en bestemt vare.
7. Wanders et al. (2011). *Effects of dietary fibre on subjective appetite,
   energy intake and body weight: a systematic review of randomized controlled
   trials*. Obesity Reviews.
   [doi:10.1111/j.1467-789X.2011.00895.x](https://doi.org/10.1111/j.1467-789X.2011.00895.x).
   Ikke specifikt styrkeatleter i cut; overførsel er indirekte.
