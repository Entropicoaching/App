Maal dit billede klar til sitet: nej. Skiven er standard som skala, og ved almindelig filmafstand (2-4 m) giver den cm-tal, der er 14-29 % for små, så advarslen står der hver gang, og modellen tegnes for stor (B1). Uden Min krop regner siden med en krop på 178 cm og har intet højdefelt (B2). Siden beder om skulderen "midt i leddet", mens modellen bruger acromion, og det giver 4° i torsoen (B3). Siden holder et billede op mod "knæhøjde" uden at se, at stangen står 24-32 cm under knæet (B4). Alle fire er små rettelser. Kan Marc bruge den hver uge nu? Ja, med fem regler (se sidst). Fund B1-B10.

# Kritik 494, blok 1: "Mål dit billede" (Yantra 484)

Bhishak, 27. sep 2026. Jeg har kun læst i `entropi-loeftmodel-dhruva` (main `655e4cb`, 484 merget) og intet ændret dér. Siden er brugt headless i Chromium uden net: på 390 px med touch (tryk og træk som finger via CDP) og på 1280 px med mus.

**Billederne:**
- **Tre syntetiske billeder**, tegnet ud fra modellens egne stillinger:
  - dødløft ved gulvet, gennemsnitskrop, 3 m
  - squat i bunden, krop A i Min krop, 3 m
  - dødløft i knæhøjde, krop B, uden perspektiv
- **Marcs to billeder fra 462** (`outputs/videomaal/marc-doedloeft-270-start.png` og `-knaehoejde.png`), med mine egne klik. Intet nyt billede fra klippet er lagt i dette repo.

**Regnedelen** bruger Yantras egne funktioner. Et pinhole-kamera står 2-10 m fra løfteren, lige ud for stangen og i hoftehøjde. Leddene sidder 10-19 cm ude på kroppens nære side, og skivens nav sidder 69 cm ude.

**Kropstyperne** er de samme som i 471:
- A: lange lår, kort overkrop
- B: korte lår, lang overkrop, korte arme
- C: lange arme
- desuden 160 cm og 196 cm uden Min krop

**Filerne:**
- Scripts: `outputs/kritik-494/maal-regning-494.mjs` (14 tjek) og `maal-side-494.mjs` (20 tjek)
- Tal: `maal-regning-494.json` og `maal-side-494.json`
- Billeder: `M-*.png` (skærmbilleder) og `syn-*.png` (de syntetiske billeder)

## Hvad virker

- **Værktøjet måler det, modellen regner.** Uden perspektiv giver de seks punkter modellens egne vinkler tilbage (torso 61,5°, knæ 99,9° ved gulvet), og skalaens kontrol viser 100 %. Med krop B og Min krop er billedets kolonne lig "Model, dine mål" inden for 0,1°.
- **Touch på 390 virker.** Otte tryk sætter otte punkter, og de lander, hvor fingeren trykker. Et træk flytter det nærmeste punkt, og tabellen følger med. Lup, Fortryd og Start forfra gør det, de skal.
- **Samme tal på begge bredder:** mine klik på Marcs klip giver det samme på 390 og 1280 (torso 45,9° begge steder).
- **Intet forlader browseren.** Ingen netkald, intet skrevet til lageret og ingen vandret rulning på 390 og 1280.
- **Vinklerne tåler perspektivet.** Med kameraet 3 m væk flytter torso, hofte og knæ under 0,5°, og stangen foran midtfoden flytter under 1 cm. Perspektivet rammer cm-tallene, ikke vinklerne.
- **To coaches er enige inden for et par grader.** Mine klik på Marcs klip ligger 2,2-2,6° fra Yantras på torsoen (45,9 mod 48,5 og 41,6 mod 43,8). Det passer med regningen: 2 cm fingerfejl pr. punkt giver 90 % af torsoerne inden for 2,6°.
- **Siden holder sig til modellens resultater.** Tabellen viser kun dem, og det modellen selv vælger, står under den. Den gode regel fra 471 er holdt.

## Yantras fire spørgsmål

### 1. Punkternes beskrivelse

Modellens led er ankel = malleol, knæ = ledspalten, hofte = trochanter og skulder = **acromion** (`src/render.js`, `src/minKrop.js`: overkroppen måles fra trochanter til acromion).

**Hvor meget en systematisk klikfejl flytter tallene** (orthografisk gennemsnitskrop, `klikfejl` i json):

| Klikfejl | Squat bund | Dødløft gulv | Dødløft knæhøjde |
|---|---|---|---|
| Hoften ved bæltet/hoftekammen (8 cm op) | torso +7,5°, knæ +10,5° | torso +8,4°, knæ +9,0° | torso +7,9°, knæ +4,8° |
| Hoften 3 cm for højt | torso +2,6°, knæ +3,9° | torso +3,0°, knæ +3,5° | torso +2,8° |
| Hoften i balden (5 cm bag) | torso +3,4°, stang–hofte +5 cm | hofte −4,8° | hofte −8,3°, knæ −5,2° |
| Skulderen midt i leddet (4 cm under acromion) | torso +3,6°, hofte −3,6° | torso +4,1°, hofte −4,1° | torso +3,8° |
| Knæet på knæskallen (3 cm frem) | knæ −2,6° | knæ −5,2° | knæ −7,1° |
| Midtfoden midt på skoen (2 cm frem) | stang −2 cm | stang −2 cm | stang −2 cm |
| Anklen 2 cm for lavt | knæ +1,6° | knæ +0,6° | 0 |

**Hver beskrivelse for sig:**
- **Hoften:** beskrivelsen er rigtig ("knoglefremspringet på siden af hoften, ikke balden"). Men den hyppigste fejl er bæltet og hoftekammen, og den er den dyreste: 8-11°. På Marcs klip flyttede hoften ved bæltet torsoen 10,9° og knæet 11,0°.
- **Skulderen er forkert beskrevet.** "Midt i skulderen" er leddet, ikke acromion, og den fejl lægger 4° til torsoen hver gang (B3).
- **Knæet:** "midt i knæet" er rigtigt, men "ikke knæskallen" mangler (−5 til −7° i dødløftet).
- **Midtfoden:** "midt mellem hæl og tå" er modellens definition (hæl + ½ fodlængde). I sko ligger skoens midte 1-2 cm foran, og det er hele den afstand, man vil måle (B5).
- **Anklen** er den mindst følsomme.

### 2. 10 %-grænsen og skiven som standard

Grænsen er fin, men skiven er den forkerte standard. Skivens nav sitter 69 cm fra løfterens midtlinje, og leddene sidder 10-19 cm ude. Skiven står altså ca. ½ m nærmere kameraet end de punkter, man klikker.

**Skalakontrol ved forskellige afstande** (skinneben + lår + overkrop målt med skiven, som andel af de rigtige):

| Kamera fra løfteren | 2 m | 3 m | 4 m | 6 m | 10 m |
|---|---|---|---|---|---|
| Skalakontrol (alle fire kroppe, squat og dødløft) | 71 % | 81 % | 86 % | 91 % | 95 % |
| Advarsel (grænse 10 %) | ja | ja | ja | nej | nej |
| Dødløft gulv: stang–hofte med skiven | −11,4 cm | −7,4 cm | −5,4 cm | −3,6 cm | −2,1 cm |
| Squat bund: stang–hofte med skiven | −6,1 cm | −3,9 cm | −2,9 cm | −1,9 cm | −1,1 cm |
| Samme med kroppens længder | +0,3 til 0,6 cm | +0,2 til 0,4 cm | ≤ 0,3 cm | ≤ 0,2 cm | ≤ 0,1 cm |

- **Det er ikke kroppen, der bestemmer tallet.** Alle fire kropstyper giver det samme (±0,3 procentpoint), fordi det er geometrien.
- **Marcs klip bekræfter regningen.** Kameraet stod tæt på: siden viser 69 % og 77 %, og regningen giver 71 % ved 2 m.
- **Konsekvens:** med skiven som standard advarer siden på praktisk talt hvert billede fra et fitnesscenter. Modellen tegnes 15-40 % for stor (`M-390-marc-start.png`: den gule figur er langt større end Marc), og alle cm-tal på kroppen er for små. På Marcs klip gav skiven og kroppen stang–hofte 17,4 mod 25,3 cm.
- **Stangen foran midtfoden** er det eneste cm-tal, skalaen ikke betyder noget for: 2,0 mod 2,8 cm, fordi tallet er lille.

Mit svar er derfor:
- **Brug kroppens længder som standard,** når kroppen er kendt (Min krop eller et højdefelt, B2).
- **Brug skiven som kontrol med et andet vindue.** 75-100 % er normalt: skiven står nærmere. Under ca. 75 % står kameraet for tæt på. Over ca. 105 % sidder et punkt forkert, eller billedet er taget skråt.
- 10 % er en god grænse for "uenig" i den anden retning, men ikke for skiven, som altid er større.

### 3. Dødløftets stang mod balancepunktet

Ja, det er rigtigt at holde stangen op mod balancepunktet og ikke mod de valgte 3 cm. Det er et resultat, ikke et valg. Men tre ting skal med:

- **Stangens vægt flytter punktet, og feltet er forudfyldt med 270 kg** (Marcs løft). Balancepunktet ved gulvet:

  | Stangens vægt | 60 kg | 100 kg | 140 kg | 180 kg | 270 kg |
  |---|---|---|---|---|---|
  | Balancepunkt | 7,1 cm | 5,8 cm | 4,9 cm | 4,3 cm | 3,3 cm |

  Glemmer coachen at rette vægten, er modellens tal op til 4 cm forkert. Det er mere end det, man vil se (B6).
- **Det er modellens balancepunkt, ikke atletens.** Det hører til modellens stilling (stiv ryg, ingen hånd, torso 8-10° mere vandret). En forskel på billedets stang og modellens tal kan derfor være kroppens stilling og ikke stangens plads. Bedre: regn balancepunktet for billedets egen stilling (de klikkede led, tabellens masser, armene fra skulder til stang). Så betyder "stangen står X cm foran, hvor dit billede er i balance" noget om atleten. Det er Yantras valg, om det er værd at bygge nu.
- **Klikket har en usikkerhed på ca. 2 cm:** 90 % inden for 2,3 cm med 2 cm fingerfejl, plus 1-2 cm fra skoens midte. Forskelle under ca. 3 cm i den række er ikke til at læse (B5).

### 4. Knævinklen ved knæhøjde

Yantras forklaring (stangen står lavere end modellens knæhøjde) er rigtig, men for forsigtig. Billedet er slet ikke fra knæhøjde:
- **Stangen står 24-32 cm under knæet** (skiven: 24,2 cm, kroppen: 31,6 cm). Fra startbilledet er stangen løftet ca. 15 cm.
- **Knæet har flyttet sig 1,4°:** Yantras klik giver 121,4° og 122,8°, mine 118,0° og 119,6°.
- **I modellen åbner knæet 1,7° pr. cm,** stangen stiger mellem gulv og knæ (99,9° ved gulvet, 121,6° ved 32 cm, 147° ved 50,7 cm).

119,6° mod 146,3° er altså to forskellige faser, ikke atleten mod modellen.

**Det rammer også 462.** Billede 30 hedder "knaehoejde", og 462's "knæhøjde"-tal (torso 45,2°) er ikke fra knæhøjde. Ved samme stanghøjde, ca. 36 cm efter perspektivet, er modellens torso 61,8° og ikke 52,9°. Forskellen mellem film og model er dér nærmere 16-20° end 8-10°. Forbeholdet "typisk 8-10°" hviler derfor kun på gulvbilledet.

**Ret:** siden har både stangen og knæet og kan regne stangens højde i forhold til knæet. Står stangen mere end ca. 5 cm under knæet (≈ 8° i knæet), skal siden sige det: "Stangen står ca. 25 cm under knæet. Vælg et billede senere i løftet, eller brug Dødløft gulv" (B4).

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| B1 | høj | Skiven er standard som skala, men står ½ m nærmere kameraet end kroppen. Ved 2-4 m viser kontrollen 71-86 %, så advarslen står der altid, og modellen tegnes 15-40 % for stor. Stang–hofte bliver 4-11 cm for kort (Marc: 17,4 mod 25,3 cm). | Kroppens længder som standard, når kroppen er kendt. Skiven som kontrol med vinduet 75-105 %. |
| B2 | middel | Uden Min krop er kroppen tabellens 178 cm, og der er intet højdefelt. En løfter på 160 eller 196 cm får advarslen på et perfekt billede (90 % og 110 %), og kroppens skala tager 10 % fejl. | Et felt til højde (og vægt) på siden, der bruges, når Min krop er tom. |
| B3 | middel | Skulderen: siden siger "midt i skulderen" (leddet), mens modellen og Min krop bruger acromion. 4 cm giver torso +3,6 til +4,1° og hofte −3,6 til −4,1° i alle faser. | "Skulderens yderste knoglespids (acromion), toppen af skulderen, ikke midt i leddet." |
| B4 | middel | Fasen tjekkes ikke. I Marcs "knæhøjde"-billede står stangen 24-32 cm under knæet, og siden viser knæ 119,6° mod modellens 146,3° uden et ord. 462's "knæhøjde" er samme billede. | Tjek stangens højde mod knæet i dødløftets knæ-fase, og skriv det over 5 cm. Yantra retter "8-10°" i forbeholdet til kun at gælde gulvet. |
| B5 | middel | Hoften ved bæltet flytter torso og knæ 8-11° (Marc: 10,9° og 11,0°), knæskallen flytter knæet 5-7°, og skoens midte flytter stangen 2 cm. Forbeholdet siger "klik igen hellere end at tolke 1-3°", men 2 cm fingerfejl giver hofte ±3,2°, knæ ±4,5° og stang ±2,3 cm. | Hofte: "ikke hoftekammen eller bæltet: en håndsbredde under bæltet, ca. ud for skridtet". Knæ: "ikke knæskallen". Midtfod: "midt på foden, ikke skoen". Og samme tærskel som Min krop efter 488: under ca. 4° eller 3 cm tolkes ikke. |
| B6 | middel | Stangens vægt er forudfyldt med 270 kg (squat 120 kg). Ved 100 kg flytter balancepunktet fra 3,3 til 5,8 cm, og en glemt vægt giver modellen forkert med op til 4 cm. | Tomt felt, og rækken siger "skriv stangens vægt", til den er skrevet. |
| B7 | lav-middel | Tallene står langt fra billedet: på 390 ligger tabellen 1726 px (2 skærme) under billedets bund, på 1280 ca. én skærm. Man kan ikke se et tal ændre sig, mens man trækker. | Een linje med torso, hofte, knæ og stang lige under billedet, der opdateres under træk. |
| B8 | lav | "Brug kroppens længder" frem og tilbage sletter skivens to punkter. Tabellen siger "kræver skala" igen, og vejledningen beder om skivens kant. | Gem punkterne og skjul dem i stedet. |
| B9 | lav | Skjult fod: i Marcs startbillede er foden bag skiven. Yantras greb (klik foden i et senere billede fra samme stillestående kamera) står kun i rapporten. På 390 ligger midtfoden (2) og skivens nederste kant (8) 5 CSS-px fra hinanden, og et træk 3 px ved siden af midtfoden tog skivens kant. | En linje under "Sådan klikker du" om den skjulte fod. Skivens kant kan klikkes ved navet og øverste kant i stedet (22,5 cm), så punkt 8 ikke lander på gulvet ved foden. |
| B10 | lav | Bænkpres og squat er ikke prøvet på et rigtigt billede, kun på syntetiske og modellens egne. | Et af Marcs squatklip (fx 0838-bunden i `outputs/videomaal/`) før siden viser squat på sitet. |

## Klar til sitet og til Marc

- **Sitet: nej, endnu.** En fremmed coach med et billede fra 3 m får en advarsel hver gang, en model der er for stor, og et torsotal der er 4° for vandret, fordi skulderen er beskrevet forkert. Det må ikke stå på sitet. B1-B4 er tekst og få linjer i `src/embed/maalBillede.js` og `src/maalBillede.js`. B5 og B6 er tekst. Efter B1-B6: ja.
- **Marc hver uge: ja nu, med fem regler:**
  1. Atletens mål skal stå i Min krop i samme browser.
  2. Tryk "Brug kroppens længder som skala".
  3. Skriv stangens rigtige vægt.
  4. Klik skulderen på acromion (toppen af skulderen) og hoften en håndsbredde under bæltet.
  5. Læs kun forskelle over ca. 4° eller 3 cm, og tjek selv i dødløftets knæ-fase, at stangen faktisk står ud for knæet.

## Ærlige grænser

- **Kameraet er en model:** et pinhole-kamera med leddene på faste afstande fra midtlinjen (10-19 cm) og skiven på 69 cm. Tallene flytter sig lidt med standbredde og skiver, men retningen og størrelsen (cm-tal 14-29 % for små med skiven ved 2-4 m) passer med Marcs klip (69-77 %).
- **De syntetiske billeder er tegninger af modellens egne stillinger.** De viser ikke, hvor svært det er at finde et led under tøj.
- **Mine klik på Marcs klip er ét forsøg af én person.** Jeg klikkede selv og brugte ikke Yantras fodgreb: foden i startbilledet er gættet under skiven.
- **Klikfejlene (8 cm til bæltet, 4 cm til leddets midte, 3 cm til knæskallen) er typiske størrelser,** ikke målte.
- **Siden er prøvet i headless Chromium,** ikke i Safari på en iPhone. Touch er sendt som CDP-touchhændelser.
