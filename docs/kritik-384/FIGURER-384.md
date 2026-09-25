# Blok 1: figurerne i squat-opslagsværket, set som en styrkeløftcoach

Læst på `squat-opslag-9` (`64cd729`), headless Chromium, 390x844 (touch, 2x) og 1280x900. Kommando: `node scripts/kritik-384.mjs --blok figurer`. Hver figur og indlejring er fotograferet for sig med alle folde åbne: `outputs/kritik-384/fig-<bredde>-<nr>-*.png`, 27 i hver bredde. Panelet og vælgeren er også fotograferet i brug (`fig-390-panel-*`, `fig-390-vaelger-*`). Listen med bredder og mindste tekst står i `outputs/kritik-384/figurer.txt`. Intet er rettet i sitet.

Spørgsmålet til hver figur var: ligner den en rigtig squat (torso, knæ, hofte, fod, stang, hoved og arme)? Passer figurteksten og hovedteksten til det, billedet viser? Kan tallene læses på telefonen?

## Det der holder

- **Kapitel 1, de fem bøjede faser (nedtur, bund, vendepunkt, sticking point) og kapitel 5's lowbar og highbar ligner squats.** Torsoen har dybde og ryglinje, knæet går frem over tæerne, hoften går bagud, og hofteleddet ligger synligt under knæleddet i bunden. Stangen ses fra enden med skive og ligger på ryggen, og lodlinjen fra stangen rammer midtfoden inden for en centimeter. Highbar står mere oprejst end lowbar (37° mod 49°), og det kan ses.
- **Lockout har låste knæ nu** (179°), og de fire forbehold om en ulåst lockout er væk (Q2).
- **Tallene kan læses på telefonen.** H- og K-mærkerne i kapitel 1 og 5 er 10,6-10,9 px. Fejlbillederne har mindst 11,3 px tekst, og deres momenttabel er HTML. Figurteksterne er HTML i brødtekstens størrelse. Figurteksternes tal er de samme som figurernes titler og kontrolleres mod modellen (`data-m`, 378).
- **Kapitel 1, 5, panelet og anatomivælgeren tegner nu kroppen i samme stil** (silhuet, hoved, arm og skive). Kapitel 6 og fejlbillederne har stadig hver deres stil (rest af Q12).

## Fund i figurerne

Nummereret F1-F10, så de kan skelnes fra Q-fundene fra 374. Alvor som i 374.

**F1. Det oprejste billede hælder som en planke. Alvor: vigtigt.**
- Sted: kapitel 1, Opstilling, Unrack og Lockout (`fig-390-01`, `-02`, `-07`), anatomi-stillbilledet "Opstilling / lockout" (`fig-390-10`) og panelets startbillede.
- Hvad coachen ser: hele kroppen hælder fremad fra anklen, fordi skinnebenet står 9° med låst knæ. Stangen står 4,5 cm bag midtfoden. En lockout, som en dommer godkender, har et næsten lodret skinneben og stangen over midtfoden. Figuren ligner en løfter, der er ved at falde forover og holder sig oppe med stangen bagved.
- Teksten er ærlig om tallene ("det går kun op fordi resten af kroppens masse ligger foran midtfoden"), men den siger ikke, at 9° skinneben i toppen er modellens løsning og ikke det, man ser på platformen. Det er det første og det sidste billede i kapitlet.

**F2. Front squat ligner ikke en front squat. Alvor: vigtigt.**
- Sted: kapitel 5, Front squat (`fig-390-16`).
- Hvad coachen ser: stangen svæver foran brystets omrids, hovedet sidder langt fremme over stangen, og albuen er tegnet oven i hovedet. Brystet er smalt øverst, så skulderen og forreste deltoid, som figurteksten siger at stangen hviler på, ikke kan ses. 378 nævnte, at stangen lå "lidt foran brystets omrids", men på telefonen er det hele figuren, der ser forkert ud.

**F3. Safety bar har ingen arme og skiver gennem brystet. Alvor: vigtigt.**
- Sted: kapitel 5, Safety bar (`fig-390-17`).
- Hvad coachen ser: skivens cirkel er centreret i et punkt foran brystet, så skiven går gennem kroppen. Der er ingen arme. Figurteksten forklarer i 40 ord, at punktet er lastens tyngdepunkt, og at "selve stangen hviler på øvre trapezius", men billedet viser ingen stang på trapezius. En coach, der kender en safety bar, ser en figur uden stang på ryggen.

**F4. "Stangen foran midtfod" viser forkerte momentarme. Alvor: vigtigt.**
- Sted: kapitel 7, fejlbilledet "Stangen foran midtfod" (`fig-390-26`). Kilde: `assets/fejlbilleder/fejlbillede-balanceret-lowbar-stang-foran-midtfod.svg`.
- Målt: den blå (fejl-)figurs mærker siger "knæ 21,4 cm" og "hofte 20,5 cm", altså de samme tal som referencen, selvom stangen er flyttet 5 cm frem, og selvom den blå hoftestreg er synligt længere. Tabellen under figuren siger knæmoment -49 Nm og hoftemoment +49 Nm. Med stangen 5 cm frem burde armene være ca. 25,5 cm til hoften og 16,4 cm til knæet.
- Hvad coachen ser: figuren siger "intet ændret", og tabellen siger "meget ændret".

**F5. Mærkerne i fejlbillederne ligger oven i hinanden. Alvor: irriterer.**
- Sted: alle fire fejlbilleder (`fig-390-24` til `-27`).
- Hvad coachen ser: referencens guldfarvede "knæ 21,4 cm" og fejlens blå "knæ 14,1 cm" (good morning), "knæ 17,7 cm" (skinneben) og "knæ 21,4 cm" (stang foran) står på samme linje og dækker hinanden. Referencens mærker ligger desuden under den blå figur. Tallene er store nok, men det ene af to kan ikke læses.

**F6. Titlen "Skinnebenet presset forbi ankelgrænsen" siger det modsatte af billedet. Alvor: vigtigt.**
- Sted: kapitel 7 (`fig-390-25`).
- Hvad coachen ser: titlen lover et skinneben, der presses for langt frem (det, en coach kender som hæle der letter). Billedet og figurteksten viser et skinneben, der holdes tilbage ved grænsen ("klippet til ankelgrænsen, 35° mod ønskede 45°"). Løfteren sidder 5 cm dybere, torsoen hælder mere frem, og hælene står i gulvet.
- Figurteksten siger "ønskede 45°", men referencekroppens skinneben i bunden er 40° i kapitel 1, i kapitel 5 og i panelet. 378 meldte fundet til Yantra som modelfund. For Marc står det i teksten.

**F7. Kapitel 6: det målte skelet er ikke et dødløft, og startbilledet mangler modellen. Alvor: vigtigt.**
- Sted: kapitel 6, indlejringen ved "Knæhøjde" (`fig-390-18`) og stillbillederne "Start" og "Knæhøjde" (`fig-390-19`, `-21`).
- Målt: stillbilledet "Start" har kun det blå skelet. Den grå figur og stangen mangler, og SVG'en har 13 stier mod 25 i de andre fire. Figurteksten begynder med "Gråt: modellens figur".
- Hvad coachen ser: i "Start" og "Knæhøjde" står det blå knæ 15-20 cm foran stangen, med skinnebenet i ca. 45-49°. Ved knæhøjde i et dødløft ville stangen gå gennem knæet. Tabellen i indlejringen viser skinnebenet "48,8° ± 24,6 (tilpasset)", og "Gå dybere" siger, at skinnebenets vinkel "ikke er pålidelig i videoen" og "derfor ikke står i tabellen". Den står i tabellen, og den er tegnet ind i skelettet.

**F8. Kapitel 6's forklaring i canvas kan ikke læses på telefonen. Alvor: irriterer.**
- Sted: indlejringen i kapitel 6 (`fig-390-18`). Linjerne "Grå silhuet", "Blå: det målte skelet" og "Blå skygge" er tegnet i canvas og er ca. 6-7 px høje på 390 (skønnet fra skærmbilledet). Scriptet måler ikke canvas-tekst.

**F9. Arme, hals og hofte er stadig tegnet som en dukke. Alvor: kosmetisk.**
- Lowbar i det oprejste billede: overarmen hænger lodret foran ryggen, og underarmen går vandret tilbage til stangen. En coach venter albuer, der peger bagud og op, når stangen sidder lavt.
- Halsen sidder på brystets forkant, så hovedet ser skudt frem ud, især i front squat.
- Balden er tegnet som en kantet kasse med et hak under hofteleddet (nedtur og sticking point, `fig-390-03`, `-06`).
- Ingen af de tre ting ændrer tallene. Men "ser ikke realistiske ud" var Marcs ord om de gamle figurer, og det er de tre ting, han vil se først.

**F10. Anatomivælgerens figur er lille, og "Dybdekrav: ja" ligger oven i stregerne. Alvor: kosmetisk.**
- Sted: kapitel 3, vælgeren (`fig-390-09`, `fig-1280-09`). Kroppen fylder omkring en tredjedel af canvas, og mærket "Dybdekrav: ja" står oven i hofte- og baglårsstregerne. Stillbillederne under vælgeren er skarpere end vælgeren selv.

## Pr. figur, kort

| Nr. | Figur | Ligner en squat? | Tekst mod billede | Tal på 390 |
|---|---|---|---|---|
| 1-2, 7 | Kap. 1 opstilling, unrack, lockout | Nej, hele kroppen hælder frem (F1). Arme hænger (F9) | Passer (tallene) | 10,9 px |
| 3-6 | Kap. 1 nedtur, bund, vendepunkt, sticking | Ja. Kantet balde (F9) | Passer | 10,9 px |
| 8 | Panelet | Ja, samme stil som kap. 1 | Passer | HTML |
| 9 | Anatomivælgeren | Lille figur (F10) | Passer med tabellen | HTML-tabel |
| 10-13 | Anatomi-stillbilleder | Ja (opstilling som F1) | Passer | 12 px |
| 14-15 | Kap. 5 lowbar, highbar | Ja | Passer | 10,6 px |
| 16 | Kap. 5 front squat | Nej (F2) | Stangen "på forreste deltoid" ses ikke | 10,6 px |
| 17 | Kap. 5 safety bar | Nej (F3) | Teksten forklarer det, billedet ikke viser | 10,6 px |
| 18-23 | Kap. 6 dødløft | Model ja, målt skelet nej (F7) | "Gråt" mangler i Start (F7) | Canvas ca. 6-7 px (F8) |
| 24 | Good morning | Ja, torsoen tipper | Passer | 11,3 px, mærker overlapper (F5) |
| 25 | Skinneben og ankelgrænse | Figuren er fin | Titlen siger det modsatte (F6) | 11,6 px, overlapper (F5) |
| 26 | Stangen foran midtfod | Figuren er fin | Mærkerne er forkerte (F4) | 11,7 px, overlapper (F5) |
| 27 | For lidt dybde | Ja | Passer | 11,6 px |
