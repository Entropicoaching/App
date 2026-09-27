matematikspillet foeles stadig som et eventyr: ja

# Matematikspillet efter Ganitas 542 (kritik 552, blok 2)

Før: matematik `e085b2b` (527 merget). Efter: matematik `main` @ `f9ef917` (542 merget).
Begge hentet med `git archive`. Ganita arbejder imens på en ny gren i matematik-træet; den er
ikke rørt og ikke målt.

Eleven er min fra 525/536 (`outputs/kritik-552/elev-552.mjs`, en kopi af `elev-536.mjs`):
"Tulle", 70 % rigtige i første forsøg, modelleret ur (170 ord/min), 30 minutter, i to udgaver:
**den travle** (svarer og trykker "Fortsæt") og **følgeren** (hjælper, når hun kan). Headless
Chromium uden net, 390 px med touch og 1280 px med mus. Tilføjet i 552:

- **Terning:** `SEED` styrer både elevens terning og spillets salt (dagen flyttes). 525 er 536's
  kørsel; 7, 42 og 1234 er nye (kun 390 px).
- **Ankomsten læses:** 542's ankomst tæller som historie i uret (Ganita skrev, at mit script ikke
  læste den, så hans tider var lidt for gode). Før-kørslen har ingen ankomst.
- **Dag 3:** en gemt tilstand (Møllen 1-6 og Grusgraven 1-2 mestret, niveau 7), hvor Landsbygaden,
  Kirken og Sporvognen er åbne, men ikke besøgt. Eleven går til hvert sted fra kortet.
- `outputs/kritik-552/kort-552.mjs` måler Bigårdens skilt på kortet på 360, 390 og 1280.

## M8: Bigården

- **Biavleren står i scenen, og skiltet "Bigården" står på kortet** med en halmkube og en bi, på
  alle tre bredder, inden for kortet og uden at røre andre skilte eller "!" (`kort-552.json`,
  `M8-efter-390-kort.png`). Før 542 var der intet skilt.
- **Skiltet er tæt på, men rører ikke:** 3 px fra "Kirken og Landsbygaden" på 360, 8 px på 390 og
  28 px på 1280. Selve trykfladen (hele Bigården) er 41 × 45 px på 360 og ligger 28 px fra
  Kirkens knap, så et tryk rammer det rigtige sted. Men skiltet er kun 24 px højt, mod 44-49 px
  for de andre skilte, og "!" for Bistaderne står 6 px fra det (N5).
- **Første opgave passer til questen.** "Nye bistader" siger, at "honningen skal deles og sælges";
  opgaven er "Biavleren stiller 4 glas honning på bænken ved den gamle halmkube. 1/2 af glassene
  skal sælges, så der er penge til de nye bistader. Hvor mange glas skal sælges?" Det hænger
  sammen, og brædderne fra før er væk.

## M9: ordene

- "To sække mel er lige store. Bageren kan få 2/3 af den ene sæk eller 2/5 af den anden sæk.
  Hvilken portion er størst?" Den travle fik den 8 gange, følgeren 1 gang. En 11-årig kan læse
  den rigtigt: det er nu klart, at det er dele af to lige store sække, ikke to sække.
- "Niveau op!" siger nu "Din figur er blevet klogere: Hoved er nu 2. Fedt!" og ved niveau 3
  "... Hoved er nu 3. Du er nu lærling. Fedt!". Det forstås uden at kende ordet "Hoved" som et
  tal.

## M5: tallene

Hvor ofte eleven på 30 minutter får 2/3 mod 2/5 i samme opgave, og hvilke tal hun oftest ser
(mængden af tal i opgaveteksten). 390 px; 1280 er ens med terning 525.

| Terning | Udgave | 2/3 mod 2/5 før | efter | Oftest samme tal før | efter | Samme tekst igen før | efter |
|---|---|---|---|---|---|---|---|
| 525 | travl | 5 | **2** | "2 og 4" 6 | "3 og 5" 5 | 2 | 0 |
| 525 | følger | 0 | 0 | "2 og 4" 5 | "2 og 4" 5 | 0 | 0 |
| 7 | travl | 0 | 0 | "2 og 4" 5 | "2 og 4" 4 | 0 | 0 |
| 7 | følger | 1 | 1 | "4 og 6" 5 | "4 og 6" 5 | 2 | 1 |
| 42 | travl | 0 | 0 | "2 og 4" 4 | "2 og 4" 3 | 0 | 0 |
| 42 | følger | 0 | 0 | "2 og 4" 6 | "2 og 4" 6 | 0 | 0 |
| 1234 | travl | 3 | **2** | "2 og 4" 4 | "2 og 4" 3 | 2 | 1 |
| 1234 | følger | 0 | 0 | "4 og 6" 4 | "4 og 6" 3 | 2 | 1 |
| **I alt** | | **9** | **5** | | | **8** | **3** |

- **Med 536's terning (525) er det Ganitas tal:** den travle går fra 5 til 2 gange 2/3 mod 2/5,
  og det, hun oftest ser, går fra "2 og 4" (6 gange) til "3 og 5" (5 gange).
- **Med de andre terninger:** 2/3 mod 2/5 står 9 gange i alt før og 5 efter. Den travle med
  terning 1234 har det stadig 2 gange (før 3); de andre har det 0-1 gang, før og efter. Opgaver,
  der står ordret igen, går fra 8 til 3. Det, hun oftest ser, falder lidt eller står stille (fx
  "2 og 4" 6 gange hos følgeren med terning 42, før og efter). M5 er altså bedre, ikke løst: det
  ligger i de små talrum ved sværhed 2, som Ganita selv skriver.
- **Mellem forløb gentages tal stadig** (hukommelsen er pr. forløb). "3 og 5" 5 gange på 30
  minutter er fem forskellige opgaver med de samme to tal, fx "3 æbler mellem 5 børn". Det er
  ikke den samme opgave igen (0 ordrette gentagelser efter 542, mod 2 før hos den travle), men en
  elev, der ser "3" og "5" hvert sjette minut, mærker det. Det føles mindre som gentagelse end
  før, ikke som ingen.

## N2: Hans

| Følgeren, terning 525 | 390 før | 390 efter | 1280 før | 1280 efter |
|---|---|---|---|---|
| Kommer til Grusgraven | 14:09 | 14:13 | 14:03 | 14:07 |
| Hører om Hans | 20:11 (hans quest) | **14:34** (ankomsten) | 19:59 | **14:28** |
| Hans' quest | 20:14 | 20:41 | 20:02 | 20:26 |

- Følgeren hører om Hans **21 sekunder** efter, hun kom, i stedet for efter 6 minutter. Med
  ankomsten læst i uret er det 2 s mere end Ganitas 0:19.
- **Med de andre terninger (390):** følgeren hører om Hans 20-21 s efter, hun kom (terning 7:
  kom 19:23, hørte 19:43; 42: 11:59 og 12:20; 1234: 15:42 og 16:03). Før: med terning 42 efter
  3:51, med 1234 efter 9:02, med 7 slet ikke inden 30 minutter.
- **Men ventetiden på Hans' quest svinger:** 6:28 (525), 4:17 (42), 9:25 (1234), og med terning
  7 kommer den ikke inden 30 minutter (hun kom 19:23). Følgeren med 1234 ved altså i 9 minutter,
  at Hans venter, uden at kunne hjælpe ham (N8).
- Ankomsten og første svarknap står på samme skærm, når hun er rullet ned til panelet (390:
  ankomsten 200 px fra toppen, knappen slutter ved 840 af 844 px).
- Hans' quest kommer stadig cirka 6 minutter efter, hun kom (questreglen er urørt). Men nu ved
  hun, hvem hun arbejder for, og han står i scenen med en sten i favnen. Det er nok til, at de 6
  minutter har en retning.
- Den travle kommer aldrig til Grusgraven på 30 minutter (før og efter), så ankomsten når hende
  ikke. Hendes længste stræk uden noget nyt er 7:56 (før 7:47).

## Ankomsterne ved Landsbygaden, Kirken og Sporvognen

Dag 3 på 390 og 1280 (`E-efter-390-70/71/72-ankomst-*.png`):

| Sted | Ankomsten | Væk efter første svar |
|---|---|---|
| Landsbygaden | "Tulle kommer ind på Landsbygaden. Købmanden står i døren til butikken." + Købmanden: "Godt, du kom. Else venter på dig med "Æbler til gaden"." + "Klar "Tæl varerne" med mig først, så kan du hjælpe Else." | ja |
| Kirken | "Tulle kommer op til Kirken. Degnen står ved kirkedøren." | ja |
| Sporvognen | "Tulle kommer hen til Sporvognen. Konduktøren står ved holdepladsen med sit ur." | ja |

Før 542 stod der ingen ankomst på de tre steder. Stederne, personerne og questen passer med
spillet (Else og "Æbler til gaden" åbner efter "Tæl varerne"). Kirkens og Sporvognens ankomst er
kun én linje, fordi intet forløb dér åbner en quest; det er kort, men det siger, hvem der er der.

To ting falder i øjnene på Landsbygaden (og i Grusgraven, som har samme form):

- Lige under ankomsten står 527's låste linje: "Else venter med "Æbler til gaden". Klar "Tæl
  varerne", så står Else med et ! på Landsbygaden." Eleven læser det samme to gange i træk (N3).
- Anførselstegn i anførselstegn: `"Godt, du kom. Else venter på dig med "Æbler til gaden"."` En
  11-årig kan ikke se, hvor Købmanden holder op med at tale (N4).

## Marcs to valg

`docs/MARCS-VALG-542.md` (547 ord) kan læses af en lærer uden fagord. Hver mulighed har "Eleven
mærker:", og svarformen ("M2: A, N1: A") er klar. Spillets egne ord er der, men forklaret af
sammenhængen: "forløb" (et sted har flere), "quest" (to gange, "klarede quests" = personer, du
har hjulpet), "mestret". Tre steder kan en lærer ikke følge: "Efter 527" (et ordrenummer),
"docs/NIVEAU.md" (en fil) og "Hånd 3 åbner målestokken" (hvad er målestokken?).

To ting bør stå, før Marc vælger:

- **N1-A tager en titel fra den travle, som hun har i dag.** Niveau 7 er i dag "Svend". Med A står
  der "Niveau 7 · Lærling", til hun har hjulpet én person. Valget siger "Det rører hverken
  mestringen, niveauet eller valget" men ikke, at elever, der allerede er Svend eller Mester uden
  at have hjulpet nogen, rykker ned, når ændringen kommer (N6).
- **M2-A: "Hjerte tæller kun de personer, du har hjulpet"**, men "Den travle har Hjerte 1" og
  hun har hjulpet 0; følgeren har hjulpet 3 og har "Hjerte 4". Tallet starter på 1. En lærer vil
  undre sig (N7).

## Fund

| # | Alvor | Fund |
|---|---|---|
| N3 | lav | Landsbygaden og Grusgraven: ankomsten og den låste linje lige under siger det samme ("Else venter ... Klar "Tæl varerne" ..."). Ca. 20 ord læses to gange. |
| N4 | lav | Anførselstegn i anførselstegn i ankomsten (`"... med "Æbler til gaden"."`). Brug » « eller ' ' om questens navn. |
| N5 | lav | Bigårdens skilt er 24 px højt (de andre 44-49 px) og står 3 px fra "Kirken og Landsbygaden" på 360. Rører ikke og trykfladen er rigtig, men det ser klemt ind. |
| N6 | middel | MARCS-VALG N1-A siger ikke, at elever, der i dag er Svend eller Mester uden at have hjulpet nogen, mister titlen. |
| N8 | lav | Efter ankomsten venter følgeren 4-9 minutter på Hans' quest (terning 42, 525, 1234), med 7 over 10 minutter. Ankomsten lover "Hans venter på dig", men forløb 1 i Grusgraven skal mestres (3 af 3) først; en elev, der fejler, venter længe. Det er M1-rest (reglerne), ikke en fejl i 542. |
| N7 | lav | MARCS-VALG M2-A: Hjerte "tæller kun de personer, du har hjulpet", men tallene (travl 1, følger 4) starter på 1. |

## Dom

**matematikspillet foeles stadig som et eventyr: ja.** Bigården har en person og en grund, der
hænger sammen med opgaven; "Niveau op!" siger, hvad der skete med figuren; følgeren møder Hans,
når hun kommer, ikke 6 minutter senere; og de tre andre steder tager imod hende. Ingen fejl, intet
net, ingen vandret rulning. Det, der ikke er eventyr, er stadig reglerne (M2, N1, M1-rest), som er
Marcs valg. Den travle mærker ikke noget af 542's eventyr, fordi hun aldrig forlader Møllen.

## Ærlige grænser

- Eleven er min model, ikke et barn. Tiderne er modellens ur.
- Terning 7, 42 og 1234 er kun kørt på 390 px og uden dag 2/3.
- "Oftest samme tal" er mængden af tal i opgaveteksten; to opgaver med "3" og "5" tæller ens, selv
  om den ene er en brøk og den anden to tal.
- Om en 11-årig læser ankomsten eller springer den over, kan scriptet ikke vise; det læser alt.
- Marcs valg er vurderet af mig som lærer-læser, ikke af en lærer.
