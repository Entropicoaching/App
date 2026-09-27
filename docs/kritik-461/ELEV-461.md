# ELEV-461: en elev, der lige har lært reglerne, prøver computeren og efter-partiet

Ordre 461, blok 1 (Bhishak). Skak `main` `1791bc0` (436, 448 og 454 merget), kun læst via `git archive`. Headless Chromium på 390 × 844 og 1280 × 800, `file://`, intet netværk. Eleven er min egen simulering og ikke appens motor (`outputs/kritik-461/elev-profiler-461.mjs`):
- **ny**: har lige lært reglerne. Tager tit en brik, ser mat i ét en gang imellem og tjekker sjældent, om brikken kan slås.
- **øvet**: har gået Lær skak igennem. Tager gratis brikker, redder tit en truet brik og giver gerne skak.
- **tilfældig**: en maskine med tilfældige træk, kun til sammenligning.

## Fund

- **E1 Spil starter i en gådestilling (blokerer for timen).** En elev åbner `skak.html` (frisk browser), og siden åbner på Gåder. Trykker eleven Spil, overtager brættet gådens stilling, uanset om "Mod en makker" eller "Mod computeren" er valgt. På 390 px var det et midtspil med sorts konge på e4, på 1280 px to sorte dronninger mod en hvid konge. Med "Mod computeren" og sort i trækket gik computeren straks i gang med at trække i den stilling. Kun "Start forfra" og derefter "Ja" giver startstillingen (`spil-start-461.json`, `b1-*-spil-start*.png`). 454's skaktime bruger netop `skak.html → Spil → Mod en makker`, så det første, 11 elever ser, er en forkert stilling.
- **E2 "Træn ..." efter partiet sletter partiet fra brættet (bør rettes).** Eleven trykker på vendepunktets knap, går til biblioteket og tilbage til Spil. Nu viser brættet bibliotekets stilling (vendt, "Sort trækker."), træklisten er tom, og vendepunkterne fra det gamle parti står stadig under et bræt, de ikke hører til (`b1-390-tilbage-fra-bibliotek.png`). Det har samme årsag som E1: Spil overtager stillingen fra den fane, man kom fra.
- **E3 En helt ny elev kan sjældent gøre partiet færdigt mod niveau 1 (bør rettes).** Den nye elev vandt 3 af 30 partier mod niveau 1. Eleven kom mindst 9 point (en dronning) foran i 16 af 30 partier, men var stadig ikke færdig efter 100 træk i 12 af 30. Matten er muren, ikke niveauet. Den øvede elev vandt 16 af 30. Niveau 1 giver faktisk brikker væk (14,6 % af trækkene uden for bogen mod den nye elev, næsten det samme som elevens egne 16,1 %). Men computeren sætter mat, når den er foran (9 af 13 gange med +9), og det gør den nye elev ikke (3 af 16).
- **E4 Resultatboksen siger det samme efter hvert tab (bør rettes).** Efter 7 af 7 browserpartier, som appen regnede som tabt (i 6 af dem gav mit script op efter 60 træk), stod der "Træn "Red din brik" i biblioteket" og "Du mistede en brik uden at få noget igen 4-11 gange". En begynder mister altid en brik, så tallet skiller ikke noget. Vendepunkterne lige under pegede kun på Red din brik 2 af 21 gange, så eleven får to forskellige råd på samme skærm (448 nævnte risikoen). Giver eleven op, fordi timen slutter, står der "Du tabte" og Red din brik, selv når eleven lå +15 eller +17 foran (parti 1 og 4, hvor mit script gav op efter 60 træk).
- **E5 Vendepunktet skjuler en fri dronning, når eleven også tabte noget (bør rettes).** Det sker i 2 af 13 "tabt"-punkter: nr. 6 ("Her tabte du et tårn", knap Gaffel) og nr. 8 ("Her tabte du en bonde", knap Hvad svarer). I begge tager det bedre træk (gxh3, Lxh3) en dronning, som ingen dækker. Det, eleven skal lære, er "tag dronningen" (Slå den ubeskyttede), ikke tabet. Reglen i `beskrivPunkt` tjekker "tabt-brik" før "overset-gevinst".
- **E6 Vendepunkterne bruger engelske bogstaver (bør rettes, lille).** Teksten under minibrættet siger "Du spillede Nd5+ ... Bedre: Nc3", "Bc1", "Rf8+". Træklisten på samme skærm er dansk ("Dd4+", "Thg1", "Tc7"). En dansk elev kender S, L, T og D, ikke N, B, R og Q.
- **E7 Den samme chance fylder to af tre pladser (pynt).** I 4 af 8 partier handler to af de tre vendepunkter om det samme bedre træk to træk i træk: cxd5+ (nr. 2-3), Lxh3 (nr. 7-8), a8=D (nr. 15-16) og Tf8+ (nr. 20-21). Slås de sammen, bliver der plads til et tredje, andet vendepunkt.
- **E8 Brikken eller lektien er forkert i nogle punkter (pynt).**
  - Nr. 3 siger "tabte en løber", men hxg4 tager springeren igen, så det var et lige byt.
  - Nr. 4 siger "kunne have vundet en løber", men Dxh7 vinder en bonde plus pres (appens linje på 5 halvtræk tæller et svartræk i dybde 2 med).
  - Nr. 14 viser Gaffel, men springeren på g1 hang allerede før trækket, så lektien er Red din brik (gaffelreglen tjekkes først).
  - Nr. 15-16 er en overset forvandling (a8=D), der kun får "Her blev din stilling meget dårligere" og Hvad svarer modstanderen?.
- **E9 Pilene kan forsvinde (pynt).** Går det spillede og det bedre træk ad samme linje (nr. 21: Tf7 mod Tf8+), ligger den røde pil under den grønne, og "rød pil" kan ikke ses. Kongetræk på ét felt giver pile, der næsten forsvinder i brikken (`b1-1280-makker.png`).
- **E10 Computeren lyder mest som et menneske, men har to maskine-tegn (pynt).** Menneskeligt:
  - Niveau 1 hænger dronningen tidligt (6...Dh4?? gxh4; 4...Dxa3 Lxa3).
  - Det går ud med dronningen i 13-16 % af de første ti træk.
  - Det ser mat i ét 13 af 18 gange (72 %) på niveau 1 og oftere på 2 og 3.

  Maskine-tegn:
  - Frem-og-tilbage-træk i 5,6-7,2 % af trækkene på niveau 1 og 4-5,9 % på niveau 2 (fx 6...Ld7 7...Lc8 og 20...Lc8 21...Lb7), mod 1,7-3,8 % på niveau 3.
  - Tårn- og kongetræk i åbningen i 3-7 % af de første ti træk (2...Tg8).

  Det ødelægger ikke illusionen for et barn.

## Vinder hun? 30 partier pr. niveau og elev i Node

`outputs/kritik-461/elev-node-461.mjs 30` bruger appens egen `vaelgNiveauTraek` fra skak-main. Eleven spiller hvid i halvdelen af partierne. Loftet er 200 halvtræk (100 træk), og mat, patt, tregangs-gentagelse og 50-træksreglen afslutter som i chess.js.

| Elev mod niveau | Vundet | Tabt | Remis | Ikke færdig efter 100 træk |
|---|---|---|---|---|
| ny mod niveau 1 | 3 af 30 | 13 | 2 | 12 af 30 |
| ny mod niveau 2 | 1 af 30 | 18 | 1 | 10 |
| ny mod niveau 3 | 0 af 30 | 29 | 0 | 1 |
| øvet mod niveau 1 | 16 af 30 | 3 | 4 | 7 |
| øvet mod niveau 2 | 9 af 30 | 10 | 3 | 8 |
| øvet mod niveau 3 | 3 af 30 | 19 | 4 | 4 |
| tilfældig mod niveau 1 | 1 af 30 | 27 | 2 | 0 |

Den nye elev mod niveau 1 kom mindst +9 foran i 16 af 30 partier og satte mat i 3 af dem. Den øvede elev satte mat i 14 af 23. Trappen 1-2-3 er jævn for den øvede elev (16, 9 og 3 sejre) og for stejl for den nye, fordi den nye ikke kan afslutte.

Lyder computeren som et menneske? Tallene er for computerens træk uden for åbningsbogen mod den nye elev:

| Niveau | Giver en brik væk | Lader en gratis brik stå | Ser mat i ét | Frem og tilbage | Dronning i de første 10 træk |
|---|---|---|---|---|---|
| Niveau 1 | 14,6 % | 2,5 % | 13 af 18 | 7,2 % | 16,3 % |
| Niveau 2 | 10,8 % | 5,4 % | 18 af 21 | 4,0 % | 14,0 % |
| Niveau 3 | 8,0 % | 2,7 % | 29 af 34 | 1,7 % | 16,2 % |

Til sammenligning giver en tilfældig maskine en brik væk i 36,7 % af sine træk. Niveau 1 er altså ikke tilfældigt. Det spiller som en elev, der lige har lært reglerne, og taber materiale lige så tit som den nye elev (16,1 %). Forskellen er, at det sætter mat, når det er foran.

## Browserpartierne (390 og 1280 px)

`outputs/kritik-461/elev-browser-461.mjs`: 8 partier mod niveau 1, 2 og 3 på begge bredder (JSON og skærmbilleder `b1-*`). Alle tjek er grønne:
- appens vendepunkter er de samme som `vendepunkter.js` i Node på samme træk (8 af 8);
- ingen sidelæns rulning;
- to pile i hver sin farve;
- "du" mod computeren og "hvid"/"sort" mod en makker;
- Fortryd mod en makker tager et træk tilbage;
- knappen åbner kompetencen i biblioteket på begge bredder;
- ingen sidefejl og intet netværk.

Eleven vandt parti 7 mod niveau 1 (38.a8=D#). Boksen sagde "Du vandt mod niveau 1!" og "Prøv niveau 2". Seks partier nåede mit loft på 60 elevtræk og blev opgivet af scriptet (se E4).

Makker på samme pc: brættet vender ikke efter hvert træk (a8 står øverst til venstre for begge). Det er som før og ikke et fund. Resultatboksen vises kun mod computeren.

## Tjek af 20 vendepunkter med en dybere søgning

`outputs/kritik-461/vendepunkter-dyb-461.mjs` regner hvert vendepunkt igen med samme motor:
- **Appen:** 4 halvtræk + slag til ende, loft 400.000 knuder.
- **Her:** 6 halvtræk + slag til ende, loft 12 mio. knuder. Stillingen efter det spillede og efter det bedre træk regnes særskilt i 5 halvtræk, så begge scorer er eksakte.
- **Brikken:** kontrolleres i en længere linje (bedste svar i dybde 4, op til 8 halvtræk).

Alle 21 nåede fuld dybde.

- **21 af 21 vendepunkter er rigtige.** Det spillede træk taber mindst 0,2 i vinderchance i dybde 6. Appens og min vurdering af faldet ligger højst 0,21 fra hinanden.
- **Det bedre træk er godt i 21 af 21.** Det er højst 0,1 fra det bedste i dybde 6 og mindst 0,2 bedre end det spillede. To gange vælger dybde 6 et andet, lige så godt træk (e4 for Sc3, d3 for d4).
- **Brikken i "Her tabte du ...":** rigtig i 12 af 13 (nr. 3 er et lige byt). "Her kunne du have vundet ...": automatisk 1 af 3. Med øjnene er det 2 af 3, for nr. 12 vinder dronningen for en springer. Nr. 4 overdriver.
- **Kompetencen:** min egen regel er enig med appen i 18 af 21. Min regel siger Red din brik, hvis den tabte brik allerede hang før trækket, og derefter gaffel, slag og "hvad svarer". Med øjnene peger knappen på den rigtige lektie i 16 af 21, på den forkerte i 3 (nr. 6, 8 og 14) og delvist i 2 (nr. 15-16).
- **Skjult gevinst:** 2 af 13 "tabt"-punkter har et bedre træk, der selv vinder mindst en let officer (E5).

Kolonnen "Fald" viser appen / dybde 6. Trækkene står, som appen skriver dem (engelske bogstaver, se E6).

| # | Bredde | Niveau | Træk | Appens tekst | Spillet → bedre | Fald | Knap i appen | Min dom |
|---|---|---|---|---|---|---|---|---|
| 1 | 390 | 1 | 17 | Her tabte du en springer. | Nd5+ → Nc3 (dybde 6: e4) | 0,41 / 0,42 | Hvad svarer modstanderen? | ja |
| 2 | 390 | 1 | 25 | Her blev din stilling meget dårligere. | Be2 → cxd5+ | 0,28 / 0,28 | Hvad svarer modstanderen? | ja (generisk, men rigtig) |
| 3 | 390 | 1 | 26 | Her tabte du en løber. | Bg4+ → cxd5+ | 0,34 / 0,35 | Hvad svarer modstanderen? | teksten er forkert: hxg4 tager springeren igen, lige byt |
| 4 | 390 | 2 | 7 | Her kunne du have vundet en løber. | Be2 → Qxh7 | 0,33 / 0,35 | Slå den ubeskyttede | teksten overdriver: Dxh7 vinder en bonde og giver pres, ikke en løber |
| 5 | 390 | 2 | 9 | Her tabte du en dronning. | Ra2 → Qxd7+ | 1,30 / 1,31 | Red din brik | ja |
| 6 | 390 | 2 | 13 | Her tabte du et tårn. | Bc1 → gxh3 | 0,93 / 0,85 | Gaffel med andre brikker | **nej**: gxh3 tager en fri dronning, og tabsteksten og Gaffel skjuler det |
| 7 | 390 | 3 | 16 | Her kunne du have vundet en dronning. | cxd5 → Bxh3 | 1,06 / 1,12 | Slå den ubeskyttede | ja |
| 8 | 390 | 3 | 17 | Her tabte du en bonde. | a4 → Bxh3 | 1,00 / 1,21 | Hvad svarer modstanderen? | **nej**: Lxh3 kan igen tage den frie dronning, og "tabte en bonde" er ikke lektien |
| 9 | 390 | 3 | 53 | Her tabte du en springer. | Ne7 → a7 | 1,10 / 1,11 | Hvad svarer modstanderen? | ja |
| 10 | 1280 | 1 | 22 | Her tabte du en løber. | Nb3 → Nc3 | 0,36 / 0,36 | Hvad svarer modstanderen? | ja |
| 11 | 1280 | 2 | 8 | Her tabte du en dronning og fik kun en bonde. | Kd1 → dxe6 | 1,40 / 1,38 | Red din brik | ja |
| 12 | 1280 | 2 | 32 | Her kunne du have vundet en dronning. | Nxd4 → Nd6+ | 0,73 / 0,78 | Gaffel med springeren | ja (dronningen for en springer) |
| 13 | 1280 | 2 | 42 | Her tabte du en springer. | Bd6 → Nc4 | 0,79 / 0,75 | Hvad svarer modstanderen? | ja |
| 14 | 1280 | 3 | 17 | Her tabte du en springer. | Ba8 → Rg2 | 1,16 / 1,23 | Gaffel med andre brikker | **nej**: springeren på g1 hang allerede, så lektien er Red din brik |
| 15 | 1280 | 3 | 55 | Her blev din stilling meget dårligere. | Ka5 → a8=Q | 1,07 / 1,11 | Hvad svarer modstanderen? | delvis: a8=D er overset, og teksten siger intet om forvandling |
| 16 | 1280 | 3 | 56 | Her blev din stilling meget dårligere. | Ka4 → a8=Q | 0,92 / 0,94 | Hvad svarer modstanderen? | delvis: samme a8=D som nr. 15 (dublet) |
| 17 | 390 | 1 | 10 | Her tabte du en springer. | Ng5 → d4 (dybde 6: d3) | 0,23 / 0,25 | Hvad svarer modstanderen? | ja |
| 18 | 390 | 1 | 16 | Her tabte du en dronning og fik kun en løber. | Qxf8+ → c5 | 0,79 / 0,82 | Byt rigtigt | ja |
| 19 | 1280 | 2 | 15 | Her tabte du en dronning og fik kun en bonde. | Qxa6 → e5 | 0,71 / 0,71 | Byt rigtigt | ja |
| 20 | 1280 | 2 | 41 | Her kunne du have sat mat i 2 træk. | Kg3 → Rf8+ | 1,99 / 1,99 | Mat i 2 | ja |
| 21 | 1280 | 2 | 42 | Her kunne du have sat mat i 2 træk. | Rf7 → Rf8+ | 2,00 / 2,00 | Mat i 2 | ja, men dublet af nr. 20, og den røde pil ligger under den grønne |

## Dom over blok 1

Vendepunkterne er rigtige: 21 af 21 holder i dybde 6, og det bedre træk er godt. Knappen peger på den rigtige lektie i 16 af 21. Det, der driller, ligger rundt om analysen: E1 og E2 (Spil overtager fremmede stillinger), E3 (en helt ny elev kan ikke afslutte), E4 (boksen siger altid Red din brik) og E5 (en fri dronning bliver til "du tabte"). Niveauerne lyder som mennesker. Niveau 1 er det rigtige sted at starte for en elev, der har gået Lær skak igennem (16 af 30 sejre). En helt ny elev skal have hjælp til at sætte mat, før niveau 1 føles vindbart.
