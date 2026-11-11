# Husstandskost (ordre 72)

Kostplan for to styrkeløftere, der bor sammen: samme ret til begge, hver sin
portion i gram. Modulet har ingen personoplysninger, ingen lagring og ingen
netkald. Personens mål (energi på træningsdag og hviledag, protein,
fedtgulv og fordeling over dagen) gives af kalderen.

- `opskrifter.mjs`: 30 opskrifter. 4 morgenmad, 4 madpakkefrokoster, 4
  mellemmåltider før træning, 4 aftensnacks og 14 aftensmåltider fra 9
  køkkener. Hverdagsretterne tager højst 30 minutter. Ingredienser er
  katalognavne fra `../foedevarer/`; gram er katalogtilstanden (kogt ris,
  pasta, bulgur, couscous og kartofler; råt kød og fisk).
- `menu.mjs`: 14-dagesmenu. Ingen aftensmad gentages. Aftensmaden mandag,
  onsdag og fredag laves dobbelt og bliver frokost dagen efter.
- `plan.mjs`: skalerer hver portion, så protein rammer måltidets andel, og
  kulhydratvaren (`flex`) fylder energien. Rammer kulhydratvaren en
  portionsgrænse, tager fedtvaren (`fedtflex`, højst fire gange
  grundmængden) resten, og ellers flyttes energien til dagens andre måltider.
  Er dagens fedt under personens gulv, flyttes energi fra kulhydrat til fedt.
  En dag godkendes, når energi er inden for 5 %, protein inden for -5/+10 %,
  fedtet over gulvet, og hvert måltid består realismeprøven.
- `indkoeb.mjs`: samlet indkøbsliste pr. uge grupperet efter butiksafdeling
  i almindelige pakninger fra Netto og Dagli'Brugsen. Kogte vægte omregnes
  til tørvare med afrundede køkkenregler (ris 2,8, pasta 2,4, bulgur 2,7,
  couscous 2,3, kartofler 1,1 for skræl).
- `anbefalinger.mjs`: kildebelagte intervaller i samme format som
  `../anbefalinger.mjs`. Det videnskabelige kostbilag har forrang.

## Ændringer i realismeprøven

- Nye almindelige varer (27) med portionsgrænser, fx kvark, proteinmælk,
  kyllingelår, mørbrad, torsk, bulgur, couscous, kidneybønner og spinat.
- Øvre grænse hævet for kogt ris, pasta, bulgur og couscous (450 til 550 g) og
  kogte kartofler (500 til 600 g). Grund: en løfter på 190 cm og 95 til 105 kg
  i overskud spiser aftensmad omkring 1.000 kcal. 550 g kogt ris er cirka 200 g
  tør ris, en normal portion for den størrelse.
- Nedre grænse sænket for græsk yoghurt 2 % (100 til 40 g), fordi den også
  bruges som tzatziki og dressing, og hytteost (100 til 50 g) som pålæg.
- Smør, mel, tomatpuré, sesam, salsa og cremefraiche tæller som tilbehør.

## Uge 3 og 4 (ordre 96)

- `AFTENSMAD_VINTER` i `opskrifter.mjs`: 14 nye vinterretter fra 10 køkkener
  (dansk, nordisk, ungarsk, marokkansk, koreansk, spansk, fransk, italiensk,
  indisk og amerikansk). Ingen gentager en ret fra de første 14 dage.
- `lavMenuUge34(start)` i `menu.mjs`: 14 dage fra mandagen i uge 3. Samme
  regler som de første 14 dage, og morgenmad og mellemmåltider fortsætter
  rotationen. `lavMenu14` giver præcis samme menu som før.
- Realismeprøven har fået 10 almindelige vintervarer: hvidkål, porre, blomkål,
  rosenkål, grønkål, søde kartofler, rødkål (glas), kikærter, hakket
  svinekød og rejer. Hamburgerryg regnes som mager svinekam, oksekød i tern
  som oksefilet og burgerboller som franskbrød.

Prøver: `husstand.test.mjs` (syntetiske løftere).
