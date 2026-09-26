# Ordre 416, blok 2: de 14 quests

Kilde: matematik `main` @ `89abfd2`, kun læst (kopi). Tre målinger:

- `outputs/kritik-416/questene-416.mjs` → `questene-416.json`: 300 salte pr.
  quest med `bogOpgaver` (runde 0, som spillet), opgaveteksterne som
  skabeloner (tal → #), en grov ordliste pr. quest ud fra grunden, antal
  svarmuligheder, og hvad eleven har mestret, når hver quest tidligst åbner.
- `outputs/kritik-416/browser-416.mjs` → `browser-416.json`, `Q-01` til `Q-05`:
  (A) en landsby med alle 14 klaret, hver ting på kortet målt på 390 px;
  (B) en **gætte-elev**: ny figur, regner aldrig, prøver knapperne oppefra,
  trykker på alle "!".
- Min egen gennemlæsning af skabelonerne (ordlisten er grov; dommen i
  tabellen er min, tallet er ordlistens).

## Tekst mod grund (Q-fund med før/forslag)

"Passer" = opgaven handler om det, personen bad om hjælp til.

| # | Quest | Grunden handler om | Opgaverne handler om | Passer | Dom |
|---|---|---|---|---|---|
| 1 | Mel til bageren | mel, dele sækkene | melsække 27 %, bagerens brød og kage 48 %, **møllerens mark, der er sået, 25 %** | ~27-75 % | delvis |
| 2 | Brød til alle | dele brød mellem gårdene | brød/kage/mel delt mellem karle og bagere ~64 %, æbler og marken ~36 % | ~64 % | delvis |
| 3 | Ænderne i åen | hvilken portion er størst | "hvilken portion er størst" (sæk, poser) 67 %, deling (brød, æbler) 33 % | 67 % | passer |
| 4 | Et nyt bed | hegn om og areal af blomsterbedet | skolestuens bort, degnens køkkenhave, præstens have, kirkegulvet | **0 %** | passer ikke |
| 5 | Lys til høstgudstjenesten | købe lys, pengene skal passe | lys 21 %, ellers salmebøger, kager, bænke, stole, æbler | 21 % | passer ikke |
| 6 | Det nye klokkereb | reb i m, snore i cm og mm | søm, skinne, vejen til landevejen, blyant, "hvilken enhed passer" | **0 %** | passer ikke |
| 7 | Sten til diget | måle hver sten | sten på linealen 23 %, ellers søm, kvist, pind | 23 % | svag |
| 8 | Stien over bakken | hvilke mål til stien | linealen (kvist, pind, søm), "hvilken enhed passer" | **0 %** | passer ikke (enhed-opgaverne er tæt på "hvilke mål") |
| 9 | Målepælene | hele vejen rundt om marken | hegn rundt om en *grusplads* 75 %, omregning 25 % | 75 % | passer næsten (mark → grusplads) |
| 10 | Æbler til gaden | æblernes pris og at dele pengene | æbler 26 %, ellers æg, bolsjer, kage, saft, rugbrød | 26 % | svag |
| 11 | Kassen skal stemme | skomagerens kasse | købmandens saft, æg, kartofler, dåser, bolsjer | **0 %** | passer ikke |
| 12 | Bedstemor kommer | hvornår sporvognen er fremme | sporvognen fremme kl., afgangstavlen | 100 % | passer |
| 13 | Den sidste vogn hjem | køreplanen | turens minutter, hvornår den senest skal køre | 100 % | passer |
| 14 | Høstmarkedet | "alle boderne mangler en hånd" | blanding fra møllen, grusgraven og købmanden | (per design) | passer som samlequest |

**Samlet:** 4 passer (3, 12, 13, 14), 1 næsten (9), 3 delvis/svag (1, 2, 7, 10),
**5 passer ikke (4, 5, 6, 8, 11)**. Det er ikke enkelte uheld: generatorerne
er stedets, med stedets personer (Degnen, Købmanden, Grusgraveren), så når
questgiveren er en anden end stedets egen person, taler opgaven om en anden.

Før/forslag, konkret (til Ganita, uden ny regnetype, uden ny sværhed):

- **Q1 Mel til bageren.** Før: "Ovnen er varm ... hjælpe mølleren med at dele
  sækkene?" og så "Mølleren har delt sin mark i 6 lige store stykker, og 3 er
  sået". Forslag: giv brøktrappens trin 1 en `kulisse`-parameter (som
  måletrappen allerede har med `KIRKE_KULISSE`), og lad questen vælge
  melsække/brød: "Ane har 6 lige store sække mel i bageriet, og 3 er tomme.
  Hvor stor en del er tomme?".
- **Et nyt bed.** Før: "Skolestuen er 7 m lang og 4 m bred. Degnen vil sætte en
  bort langs alle fire vægge." Forslag: en `BED_KULISSE` til
  `omkredsTrinOpgave`/`arealTrinOpgave`: "Bedet ved kirken er 4 m langt og 2 m
  bredt. Hvor mange meter hegn skal Graveren bruge?".
- **Det nye klokkereb.** Før: "Et søm i skuret er 3 cm. Hvor mange mm er det?"
  Forslag: omregnOpgave med ting fra kirken: "Klokkerebet er 12 m. Hvor mange cm
  er det?", "Snoren er 3 cm og 4 mm".
- **Kassen skal stemme.** Før: "Købmanden får 6 kasser med 12 flasker saft".
  Forslag: skomagerens skabeloner i `pris`/`kasse`: "Søren solgte 4 par sko à 35
  kr", "Et par træsko koster 18 kr. Han får 50 kr. Hvor meget skal han give
  tilbage?".
- **Stien over bakken.** Linealen passer ikke til en sti. Forslag: kun
  `maal2` ("hvilken enhed passer") med sti-kulisse ("Stien over bakken er 300
  ___ lang") eller en anden quest-grund, der passer til linealen ("Hans skal
  vide, hvor lange pælene til stien er").
- **Lys, Æbler, Sten til diget.** Rækkefølge-problem, ikke tekst-problem: de
  rigtige skabeloner findes (lys, æbler, sten). Forslag: lad `bogOpgaver`
  vælge blandt generatorens skabeloner dem, der indeholder questens ord, når
  de findes (et `kulisse`- eller `emne`-filter i generatoren), ellers som nu.

## Belønningen: synlig og forståelig?

| Belønning | Type | På 390 px | Forståelig? |
|---|---|---|---|
| Melsække | kort | 20 x 20 px ved møllen | ja på takkekortet; på kortet ses de kun med ringen |
| Bagerhuen | figur | på portrættet og figuren på kortet | ja; men "huen daler ned" sker på portrættet 275 px over skærmen (blok 1) |
| Ænder i åen | kort | 31 x 13 px, i kortets nederste kant | næsten usynlige uden ringen |
| Blomsterbedet | kort | 26 x 13 px | lille |
| Lys i kirkevinduet | kort | 20 x 22 px | lille, men "lyser" |
| Klokkerens hjælper | titel | under navnet | ja, **men kun den nyeste titel vises**: med "Sporvognens ven" forsvinder "Klokkerens hjælper" fra hovedet (Q-01) |
| Stendiget | kort | 48 x 11 px | ja |
| Stien over bakken | genvej | 44 x 79 px, 14 % under "Grusgraven"-knappen og 27 % under "Sporvognen" | tegnet, **gør intet** (413 siger det selv). En 10-årig, der får en "genvej", vil gå den |
| Stråhatten | figur | portræt og kort | ja |
| Æbleboden | kort | **16 x 12 px** i kortets højre kant | nej, mindst af alle |
| Halstørklædet | figur | portræt og kort | ja |
| Bænken | kort | 23 x 24 px | lille |
| Sporvognens ven | titel | under navnet | ja |
| Høstmarkedet | kort | 38 x 23 px, vimpler | ja |

Takkekortet ("Du fik: ... Den står nu på kortet og bliver stående") er klart
hver gang, og questbogens "Det du har fået" samler det. Selve kortet med alle
14 klaret (Q-02) er tæt: 13 personer, landsbyens egne trin og belønningerne
er tegnet i samme stil og størrelse, så man ikke kan se, hvad *man selv*
har fået. Belønningen er synlig i øjeblikket, ikke bagefter.

## Kæderne

Logiske og korte: Ane 1 → 2, Graveren → Kirsten → Klokkeren, Hans → Hans →
Maren, Else → Søren, Inger → Poul, og Karen som finale (kræver quests fra tre
steder). Låseteksten er præcis ("Klar først ...", "Mestr Møllens forløb 1-2").

Et brud på questbogens egen regel ("en quest åbner først, når eleven har mødt
de trin, den bruger"):

- **Et nyt bed** åbner med Kirken (Møllens forløb 1-3) og bruger måletrappens
  **omkreds (trin 4) og areal (trin 5)**, mens Grusgraven kan stå på 0 af 6.
  I blok 1 stod Graverens "!" der efter 9 minutter med "Grusgraven: 0 af 6".
  (Kirkens egne forløb har samme valg fra 402; questbogen arver det.)

Resten holder: hver `broek N`/`maal N` kræver forløb N eller en quest, der
gør det.

## Kan man klare en quest ved kun at gætte?

**Ja, og det er let.** Alle opgaver har 3 svarmuligheder (et par af Ingers
har 4), og der er 3 forsøg (`MAKS_FORSOEG`). En elev, der trykker på
knapperne oppefra, **rammer altid rigtigt inden "Løsningen"**, får "Rigtigt!"
og **+10 erfaring hver gang**. 413's "0 ved Løsningen" rammer aldrig en
systematisk gætter. Questene har intet mestringskrav.

Gætte-eleven (B, `browser-416.json`): 7 gættede opgaver i Møllen (aldrig
mestret) giver niveau 3, så **Landsbygaden åbner uden mestring**. Efter 10
opgaver har hun **Æbleboden**, efter 20 **Halstørklædet**, efter 38 hele
Købmandens kæde (pengeposen) og **niveau 7**, med 7-10 af 38 rigtige i
første forsøg (et tilfælde pr. kørsel, saltet er frit). Møllen og Grusgraven er
lukkede for hende (mestring), og dermed 11 af 14 quests.

**Er det et problem?** For de 11 quests bag mestring: lille. Man skal kunne
trinnet for at se questen, og questens tre opgaver er kun et ærinde. For
**Æblerne og Kassen**: ja. Det er den korteste vej fra start til to
belønninger, og den går gennem at trykke på knapper. Det er præcis
"Cookie Clicker"-følelsen, Marc ikke vil have. Og "Rigtigt!" efter tredje gæt
fortæller eleven, at hun kunne det.

## Eventyr eller opgaveliste?

**En opgaveliste med et eventyrs rammer.** Rammen er god: navngivne folk,
en sætning om hvorfor, et "!" på kortet, en tak og noget man får. Men:

- Questbogen er en liste i tre afsnit, og det første barnet ser, er
  "Låst (13)" med lås-tekster i spillets fagsprog ("Mestr Møllens forløb 1-2").
- Inde i questen er det "0 af 3 opgaver løst" og tre opgaver om nogen
  andre end personen (tabellen ovenfor). Personen siger intet undervejs;
  der er ingen scene, der ændrer sig.
- Personerne står kun som små figurer (ca. 10-15 px) på kortet; i panellet
  er Ane en farvet prik foran navnet, mens stedets egen scene (møllen) står
  over hende.
- Det der gør det til et eventyr, findes i små bidder: Anes to quests
  hænger sammen (mel → brød → hue), Hans' sti fører til Marens mark,
  og Karens høstmarked samler alle. Det er de øjeblikke, der virker.
