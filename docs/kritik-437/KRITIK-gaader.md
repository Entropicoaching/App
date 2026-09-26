# Kritik 437: gåderne set som elev (rating, dagens gåde, stime og de 330 lette gåder)

Skak `main` @ `b9f8303` (423 og 425 merget), læst som kopi via `git archive`. Alle tal kommer fra `outputs/kritik-437/*.json` og kan køres igen (kommandoerne står nederst). Ingen elevdata. Eleverne i browseren er scriptede, ikke rigtige børn.

**Klar til klassen: nej, fordi en elev der starter dårligt, falder over 300 point på 10 gåder og stadig ligger langt under start efter 10 rigtige i træk (K1). Beskeden siger "Løst! (løst uden hint)" samtidig med et rødt minus (K2). Og næsten halvdelen af gåderne skal spilles med sort på et bræt, der vises fra hvids side, uden et ord om hvem der trækker (K3).** Matematikken holder: ingen rating under bunden, dagens gåde er ens på alle pc'er, og stimen tæller rigtigt. De tre fund er små rettelser i Chaturangas kode, ikke en ny model.

## Fund

**K1. En elev der starter dårligt, styrtdykker og kommer ikke op igen, heller ikke når hun bliver god. Alvor: høj.**
Elev B i browseren (10 forkerte, så 10 rigtige i træk): 800 → **464** efter 10 gåder, og efter 10 rene løsninger i træk kun **627** (+163 i alt, −336 i alt). Tallene står i `elev-437.json`; `G-10-B-efter-gaade-10.png` og `G-20-B-efter-gaade-20.png` viser dem. Det skyldes K-trappen: fald i gåde 1-10 koster 22-42 point (K = 60 → 42), mens rigtige i gåde 11-20 kun giver 10-21 (K = 40 → 22). Samme mønster i simulationen (`rating-437.json`, `halvtreds`): 598. Selv en elev der løser præcis 10 af 20 i tilfældig rækkefølge, ender i gennemsnit på **775** (10 %-90 %: 730-823, 500 rækkefølger). En ny 50 %-elev ser altså sit tal falde. Ordren spurgte "føles det som fremgang?": for elev A (blandet) lidt, 800 → 824, men de sidste 8 gåder var 6 minusser (`G-20-A-efter-gaade-20.png`). For elev B nej.
Forslag: vis ikke tallet i de første 10 gåder ("Vi finder dit niveau: 4 af 10"), som lichess' "?". Eller hold K fast, indtil eleven har løst mindst 5, så en dårlig start ikke fryses fast.

**K2. "Løst! … (løst uden hint)" står sammen med et rødt minus, også når appen selv har vist løsningen. Alvor: høj (en 10-årig forstår det ikke).**
Et forkert træk, "Tag trækket tilbage", og så facit giver ordret: "Løst! Mat i 1. (løst uden hint) Rating 769 (−31). Din stime er i gang: 1 dag." Efter to forkerte træk viser appen løsningen på brættet ("Ikke den vej. Løsningen er vist på brættet - tag trækket tilbage og spil den."). Alligevel står der "Løst! Mat i 1. (løst uden hint) Rating 843 (−23)." (A gåde 1 og 6 i `elev-437.json`, `G-06-A-minus-efter-to-fejl.png`). Barnet læser tre ting: løst, uden hjælp, og et rødt tal. Kun det sidste passer til ratingen. "Uden hint" er ikke sandt, når løsningen blev vist.
Forslag: "Løst, men med et forkert træk først. Rating 769 (−31)." Og når løsningen er vist (fejl nr. 2), bør det tælle som et hint i teksten.

**K3. Gåder med sort i træk vises fra hvids side, og intet på skærmen siger, at sort trækker. Alvor: høj.**
47 % af puljen (2404 af 5068 lovlige) og 101 af de 330 lette har sort i træk (`rating-437.json`, `sortITraek`). I browseren havde elev A 12 og elev B 11 af 20 gåder med sort i træk. Alle blev vist med hvid nederst (`braetFraHvid`), og starteteksten var hver gang "Find det bedste træk." (`G-22-sort-i-traek.png`: en gaffel med sort i træk, sorte brikker øverst). Siden har ingen linje med "sort/hvid" og "træk/tur". Taktik siger "Sort i træk. Sæt mat i ét træk." (kritik 379), og Bibliotek og Taktik vender brættet (`tilstand.orientering`); Gåder gør ingen af delene. En begynder prøver at flytte en hvid brik, og der sker ingenting.
Forslag: vend brættet til den der trækker (som lichess), og skriv "Sort trækker. Find det bedste træk."

**K4. Ratingen, "+12/−8" og grafen ligger under skærmkanten på 390 × 844. Alvor: middel.**
Målt ved scroll 0 (`elev-437.json`, `maal`): ratingen står ved y = 1138 og grafen ved y = 1184. Skærmen er 844 høj. Imellem ligger brættet og knapperne (Vend brættet, Tavle, Tegnelag, Hvad sker der, Udseende). Uden at scrolle ser eleven kun tallet i beskeden over brættet ("Rating 769 (−31)"), og det forsvinder efter 0,9 s, når næste gåde kommer. Grafen ser eleven aldrig, mens hun løser.
Forslag: sæt rating + ændring på én linje over brættet, ved beskeden. Grafen kan blive, hvor den er.

**K5. "Vis et hint" + "Spring over" trækker ratingen ned uden et ord. Alvor: middel.**
Efter hint + spring faldt ratingen 14-40 point (A gåde 9: −20). Beskeden var "Find det bedste træk.", altså allerede den næste gåde. Faldet ses kun i tallet under skærmkanten (K4). Reglen er rigtig (423: ingen smutvej uden om et fald), men eleven får ikke at vide, at den findes.
Forslag: "Sprunget over efter et hint: −20." i ét sekund, før næste gåde.

**K6. "En lettere gåde efter tre forkerte" gør faldet større, ikke mindre. Alvor: middel.**
Efter tre forkerte sigter vælgeren 200 under (425). Tabes den lette gåde, er forventningen høj, og faldet stort. Elev B: gåde 4-10 kostede 29-42 (gåder på 315-515), mere end de tre første (22-32). Ved K = 54 og en gåde 200 under koster et tab 41 og en sejr giver 13. Den svage elev møder den lette gåde netop, når hun er mest usikker, og straffen er størst dér.
Forslag: tæl ikke den "lettere" gåde med i ratingen (som dagens gåde), eller brug halv K på den.

**K7. Ligevægten er 50 % rigtige. Det er hårdt for en klasse. Alvor: lav (et valg, ikke en fejl).**
En elev med fast styrke (Elo-model, 500 kørsler × 200 gåder) finder sin rating og ligger stille. Styrke 947 giver 946 efter 200 gåder, udsving (sd) 29 i gåde 101-200, højst 70 over 10 gåder, og hun løser 52 %. Det samme med 10 % gæt og 10 % sjusk: 939 og sd 31. Ordrens "en elev der løser 70 %" findes derfor kun, så længe gåderne er for lette. Løser hun 70 % uanset sværhed, stiger hun uden stop (1630 efter 200 gåder), for vælgeren giver hende gåder på hendes egen rating. Lichess gør det samme, men 10-årige har brug for flere succeser.
Forslag: sigt altid ca. 150 under ratingen (maalRatingForValg). Så giver ligevægten ca. 70 % rigtige.

**K8. Fem af de 60 lette gåder har et problem; én er en klar fejl. Alvor: middel.**
60 tilfældige (frø 437; 14 slå, 20 mat i 1, 12 red, 14 gaffel), søgt i dybde 5 + rolig søgning (generatoren brugte 3):
- **425-0076** (Slå den ubeskyttede, 355): facit er Kxc1 (+3), men b8=D forvandler med det samme (+8), og Dd1+ vinder lige så meget i dybden. Et barn forvandler. Appen siger "Ikke den vej". **Klar fejl.**
- **425-0052** (Slå den ubeskyttede, 325): begge sorte tårne hænger. Facit er Lxa6. Kxf4 slår også et frit tårn, men taber løberen bagefter (Ta4 binder den). God gåde, men en fælde på 325.
- **425-0022** (Slå den ubeskyttede, 365): to damer kan slå løberen på e6. Dhxe6 er **patt**, Dexe6 vinder. Appen siger kun "Ikke den vej" og forklarer ikke patten. For svær til 365.
- **425-0200** (Red din brik, 495) og **425-0247** (480): brikken reddes ét træk, men fribonden koster den alligevel. I dybde 5 er facit ikke bedre end alternativerne; i dybde 6 med skaks egen søgning er 0247 lige (−5/−5) og 0200 kun 1 bedre. Generatorens "mindst 2 bedre" holder kun i dybde 3.
- Desuden **425-0011** (Slå den ubeskyttede, 360): facit er at slå damen *med forvandling* (bxc8=D, valg i forvandlingsmenuen). Det er svært for en begynder på 360.
- Alle 60 er lovlige, alle har det rigtige tema, og alle 20 mat i 1 har præcis ét mattræk. I alle 14 gafler er modstanderens svar et tvunget kongetræk, og slaget i tredje træk er entydigt.
Omregnet til hele banken: ca. 5 af 60 (8 %), altså i størrelsesordenen 25 af 330 med noget, og ca. 5 med en klar fejl som 0076. Det er et skøn ud fra 60.

**K9. Grafen har intet startpunkt og ingen skala. Alvor: lav.**
Første punkt er ratingen efter gåde 1, ikke 800. Linjen strækkes fra min til maks, så et fald på 20 ser lige så stort ud som et på 300 (`G-21-A-tal-og-graf.png`: en "bjergtop" over 125 point; `G-21-B-…`: en dal over 300). En 10-årig kan læse "op og ned", men ikke "hvor meget" eller "er jeg over start". Beskrivelsen "Din rating over de sidste 9 gåder: fra 769 til 875" findes kun for skærmlæsere.
Forslag: en stiplet linje ved 800 (eller ved første rating) og tallet i hver ende.

**K10. Svage elever får de samme gåder igen. Alvor: lav.**
En elev der løser 30 % uanset sværhed, lander på 200-260 efter 200 gåder og ser 65 forskellige gåder i gåde 101-200 (styrke 250: 69). 79-86 % af hendes gåder er fra de 330 lette. Gentagelse kan være godt for læring, men det er de samme ca. 130 gåder på 300-399.

**K11. Dagens gåde: ens på alle pc'er, med to små huller. Alvor: lav.**
Tre separate Node-processer (hver sin rækkefølge af puljen) gav samme gåde på tre datoer. Det gælder også ved sommertid (28. mar 2027). 20 omrokeringer af puljen i samme proces gav også samme gåde. Hullerne:
- En pc med **forkert tidszone** (UTC) har kl. 00:30 dansk tid stadig "i går" og viser gårsdagens gåde.
- Kan Lichess-banken ikke pakkes ud (appens catch-gren), er kandidatlisten en anden (504 i stedet for 1110), og 364 af 365 dage giver en anden gåde. Det sker i praksis ikke.

Over et år: 332 forskellige gåder, 4 gentaget inden for 30 dage, alle lovlige og i 500-800. 43 dage er det en af de lette, 162 dage mat i 1, men også 27 dage mat i 3.

## Hvad der holder

- **Bunden holder.** 3000 simulerede elevforløb (6 elevtyper × 500) × 200 gåder: ingen rating under 400 i de første 20 og ingen under 200 bagefter. Heller ingen over 2500 (`bundBrudAntal: 0`). Den svageste (styrke 250) står på 400 efter 20 gåder og glider så ned til ca. 260.
- **Den stabile elev er stabil.** Elo-eleverne finder deres styrke inden for ±5 på 200 gåder (947 → 946, 653 → 653), og udsvinget er ca. 30.
- **Dagens gåde er ens** på tre pc'er og uafhængig af puljens rækkefølge. Den tæller ikke i ratingen.
- **Stimen tæller rigtigt:** 1, 1, 2, 3 dage og så 1 efter et hul; dagen efter et hul viser den 0.
- **De lette gåder er rene i det basale:** lovlige, rigtigt tema, entydig mat i 1, tvungne gafler. Fejlene i K8 ligger i det, en begynder *ser*, ikke i reglerne.
- Ingen sidefejl i browseren (40 gåder + gåden med sort i træk).

## Sådan er det målt

```
git -C C:\Users\Entropi\Desktop\skak archive main | tar -x -C <kopi>      # b9f8303; node_modules som junction til skak's
node outputs/kritik-437/gaader-437.mjs <kopi> 5 60     # K8: 60 lette gaader, dybde 5, 8 processer, ca. 4 min
node outputs/kritik-437/rating-437.mjs <kopi>          # K1, K6, K7, K10, K11, stimen: skaks egen ratingkode + den rigtige pulje
node outputs/kritik-437/elev-437.mjs <kopi>            # K1-K5, K9: headless Chromium 390 x 844, touch; elev A, B og en gaade med sort i traek
npm run verify:kritik-437
```

Eleverne i browseren løser gåden ved at finde stillingen i banken og spille facit. Hvilke gåder de får, afgør appens egen tilfældighed, så tallene skifter lidt fra kørsel til kørsel (fire kørsler: A 810-843, B 604-633). Mønstret er det samme hver gang.
