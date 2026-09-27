matematikspillet foeles som et eventyr: nej (fund M1-M9; eventyret er bygget og virker, når eleven når det, men de første 6½ minut og de tal, der vokser, er opgaver med pynt)

# Matematikspillet set af en elev i 5. klasse, 30 minutter på 390 og 1280 px

Bhishak, ordre 525, blok 1. Spillet er Ganitas `main` @ `4bdda17` (505 merget, 499 og 489 med), hentet med
`git archive` til en midlertidig mappe. Matematik-træet, hvor Ganita arbejder på `liv-og-hak` (518), er ikke rørt.
518 er ikke committet og ikke vurderet.

**Eleven** er syntetisk: "Tulle", et fantasinavn, 70 % rigtige i første forsøg (60 % i andet, 50 % i tredje) og en
fast terning. Hun er spillet to gange med samme terning:
- **travl** svarer på den opgave, der står i panelet, og ruller forbi det, der står over den.
- **følger** læser kortet efter hvert forløb og trykker på dets primære knap ("Hjælp Ane") eller et "!" på kortet.

**Tiden** er en model, ikke et stopur: 0,4 s pr. ord hun læser (en langsom læser, 150 ord/min), 10 s at tænke pr.
opgave, 2 s pr. tryk og 3 s pr. rul. Hun spiller, til modellens ur siger 30 minutter.

Bagefter ser hun Min helt, questbogen og journalen. En "anden dag" er en gemt tilstand, hvor Møllens forløb 1-6 og
Anes og Niels' kæder er klaret, så hun kan møde Biavleren og Bigården. Den tilstand er et spring, ikke spillet frem.

**Scripts:**
- `outputs/kritik-525/elev-525.mjs` → `elev-525.json` og `E-*.png`: headless Chromium, 390 px (touch) og 1280 px,
  uden netværk.
- `variation-525.mjs` → `variation-525.json`: Møllens 8 forløb over 500 salte med spillets egne generatorer.

## Hvad hun oplevede

| | travl, 390 | travl, 1280 | følger, 390 | følger, 1280 |
|---|---|---|---|---|
| Opgaver på 30 min | 51 | 52 | 49 | 49 |
| Rigtige i første forsøg | 35 (69 %) | 36 | 32 (65 %) | 32 |
| Opgaver før noget sker (første "Niveau op!") | 12 (6 min 38 s) | 12 | 12 | 12 |
| "Samme forløb med nye tal" | 6, heraf 3 med "spørg din lærer" | 6 (3) | 7 (4) | 7 (4) |
| Quests klaret | **0** | 0 | 3 (Mel til bageren, Brød til alle, Ænderne i åen) | 3 |
| Niveau efter 30 min | **8, "Mester"** | 8 | 5, "Svend" | 5 |
| Udstyr i Min helt | 1 af 9 (Målestokken) | 1 af 9 | 2 af 9 (+ Bagerhuen) | 2 af 9 |
| Hoved / Hånd / Hjerte | 8 / 1 / 1 | 8 / 1 / 1 | 5 / 1 / 1 | 5 / 1 / 1 |
| Steder besøgt | kun Møllen | kun Møllen | kun Møllen | kun Møllen |
| Historiens andel af ordene hun læste | 43 % | 42 % | 43 % | 43 % |
| Længste stræk uden noget nyt | 7 min 45 s | 7 min 36 s | 7 min 4 s | 7 min 1 s |
| Rul for at nå det, hun skulle trykke på | 16 | 11 | 9 | 6 |
| JS-fejl, vandret rulning | 0, nej | 0, nej | 0, nej | 0, nej |

Travl og følger er ens på 390 og 1280, fordi terningen og saltet er de samme. Forskellen er kun rul og layout.

## Tidslinjen, som følger (390)

- **0:00-0:18: Lav din figur.** Navn, fire kapper og "Start eventyret".
- **Første skærm:** portrættet, tre felter med "1" (Hoved, Hånd, Hjerte), tre knapper og kortet. Ingen person siger
  noget. Den første opgave står 1562 px nede, næsten to skærme under (1791 px på 1280) (`E-foelger-390-01-*`).
- **0:37-6:38: "Lige store dele", 12 opgaver.** Alle har formen "delt i n lige store stykker, k er sået/spist/fyldt:
  ▰▰▱▱. Hvor stor en del ...". Forløbet kræver 3 af 3 i første forsøg.
  - 2:10: hun har 2 af 3 og får "Her er det samme forløb med nye tal".
  - 4:00: igen med 1 af 3, og nu med "Det er ikke første gang: spørg din lærer eller sidemanden om trinnet".
  - 5:38: igen med 2 af 3, og samme linje om læreren (`E-*-11-samme-forloeb-igen.png`).
- **6:38: Niveau 2,** "Hoved steg til 2". Byen vågner (kværnhjulet, 12 → 19 indbyggere), og under det står et gult
  kort: "Ane, bagerkonen, står med et ! ved møllen og har brug for din hjælp. [Hjælp Ane]"
  (`E-foelger-390-25-kort-efter-forloeb.png`). **Her begynder eventyret.**
- **7:00-8:47: Mel til bageren.** Anes egne opgaver (melkrukker og sække). Takkekortet siger: melsække på kortet,
  og "Hvad nu? Ane: Kom tilbage, når du har mestret "Del ligeligt"." Det virker: hun ved, hvorfor hun skal videre.
- **13:24: Brød til alle.** Bagerhuen, og figuren har den på, også på kortet. Takkekortet siger, at Niels står med et
  "!", når "Hvilken portion er størst?" er klaret. **Det er det bedste øjeblik i de 30 minutter.**
- **14-20 min: "Hvilken portion er størst?".** 2/3 mod 2/5 kommer igen og igen (8 gange i 30 min; tre af teksterne
  kommer ordret to gange). "Bageren kan få 2/3 sæk fra den ene mølle eller 2/5 sæk fra den anden", men der er kun én
  mølle i landsbyen.
- **21:00-22:34: Ænderne i åen** med Niels. Ænderne står bagefter i åen på kortet.
- **22-29 min:** "Samme mel, nye poser". "1/2 sæk i poser à 1/6" kommer 4 gange, og hun får løsningen vist to gange.
- **30 min:** Niels' "Melposer til markedet" er lige begyndt.
- **Hun har aldrig været andre steder end Møllen.** Grusgraven er åben siden 11 min og Kirken siden 20 min, men
  ingenting har sagt det.

## Fund

| # | Vægt | Fund | Hvem |
|---|---|---|---|
| M1 | høj | De første 6½ minut er 12 ens opgaver uden person og uden historie, og to gange "samme forløb igen" | Ganita |
| M2 | høj | Det, der vokser, gør intet: Hoved/Hånd/Hjerte er kun tal, og niveauet løber fra questene | Ganita, Marc vælger |
| M3 | middel | Nye steder åbner i stilhed; på 30 min forlader hun aldrig Møllen | Ganita (518 blok 2 er på vej) |
| M4 | middel | "Spørg din lærer eller sidemanden" kommer 3-4 gange på 30 min til en elev med 2 af 3 | Ganita |
| M5 | middel | Samme tal igen og igen i forløb 3 og 4 (2/3 mod 2/5, 1/2 i poser à 1/6) | Ganita |
| M6 | middel | Den travle elev får "Mester" uden en eneste quest; næste opgave står under "Hjælp Ane" | Ganita |
| M7 | lav | På 1280 er spillet en 520 px søjle, kortet 476 px bredt og den første opgave to skærme nede | Ganita |
| M8 | lav | Bigården: ingen Biavler i scenen, en prik som ikon, og første opgave passer ikke til hans sætning | Ganita |
| M9 | lav | Små ord: "den anden mølle", "Hoved steg til 2" uden forklaring | Ganita |

### M1 (høj): de første 6½ minut

"Start eventyret" fører til et skema med tre ettaller og et kort, og ingen i landsbyen siger noget. Opgaven står
næsten to skærme nede på begge bredder. Forløb 1 kræver 3 af 3 i første forsøg. En elev med 70 % klarer det med
sandsynlighed 0,34, så hun skal i snit køre det cirka 3 gange: 9-12 opgaver af præcis samme slags, før det første
hak. Tulle brugte 12 og 6 min 38 s.

Det er her, en 10-årig beslutter, om det er et eventyr eller et opgaveark. Ane og hendes "!" venter lige bag
forløbet, men eleven ved det ikke.

Forslag, uden at røre mestring eller regler:
- En åbningsscene på 2-3 linjer, hvor Mølleren (eller Ane) møder figuren og siger, hvad der er galt i landsbyen.
- Rul direkte til opgaven efter "Start eventyret".
- Lad "Mel til bageren" (Anes) være synlig som "låst, klar Lige store dele" i panelet fra første opgave, så eleven
  ved, at der venter en person.

### M2 (høj): "number get bigger" uden kraft

Hoved, Hånd og Hjerte bruges ingen steder i spillet ud over at blive vist (`spil-app.js:1180-1182`, `helten.js:71`).
På 30 minutter står Hånd og Hjerte på 1 hos begge elever, for Møllen giver kun Hoved. Den travle elev når niveau 8,
"Mester", på 29 min 23 s, med 1 af 9 ting og uden at have hjulpet et eneste menneske.

I et eventyr eller MMORPG betyder stærkere, at man kan noget nyt: et sted, en vej eller en genstand, der gør en
forskel. Her er det eneste med virkning Målestokken (et ekstra forsøg i Grusgraven, som hun ikke har besøgt).
Titlen "Mester" efter en halv time med brøker gør også de næste titler små.

Forslag (Marc vælger):
- Knyt noget synligt til egenskaberne, fx "Hjerte 3: Konduktøren hilser" eller en ny sti, eller fjern de to felter,
  der står stille.
- Lad titlerne komme lidt senere, eller lad dem kræve en quest.

### M3 (middel): nye steder åbner i stilhed

Grusgraven åbner ved Møllens forløb 2 (cirka 11 min) og Kirken ved forløb 3 (cirka 20 min). Hængelåsen forsvinder fra knappen på
kortet, men intet kort, ingen replik og ingen "Næste:"-linje siger det. "Næste:" peger altid på Mølleren. Hverken
den travle elev eller følgeren forlod Møllen på 30 minutter, og kortet med fire andre steder var pynt.

Ganitas 518 blok 2 ("nyt sted folder sig ud på kortet") retter præcis det. Den er ikke committet og ikke set.
Sætningen i takkekortet eller efter forløbet bør også sige "Grusgraven er åben: Grusgraveren venter".

### M4 (middel): "spørg din lærer"

Linjen "Det er ikke første gang: spørg din lærer eller sidemanden om trinnet, før du går i gang igen" kommer fra
anden gentagelse, uanset hvor tæt hun var. Tulle fik den 3 gange (følger 4) på 30 minutter, og tre af gangene havde
hun 2 af 3 eller 2 af 4 rigtige. For en elev, der næsten kan det, lyder det som "du er for dårlig til det her".

Forslag: kun ved 0-1 rigtige i første forsøg. Ved 2 af 3 kan Mølleren sige "tæt på, én til".

### M5 (middel): samme tal igen

Målt over 500 salte med spillets egne generatorer (`variation-525.json`):
- I forløb 3 er 9 % af opgaverne netop parret 2/3 og 2/5.
- I forløb 4 er 8 % af dem "1/2 og 1/6".
- 5-7 % af opgaverne i forløb 1-4 er ordret en tidligere opgave i samme forløb (runde 0-3).

Tulle ramte et uheldigt salt: 2/3 mod 2/5 8 gange (følger) og 5 gange (travl). En elev, der har set det fire gange, svarer på mønsteret, ikke på
brøkerne, og keder sig. Det rører sværheden, så det er Ganitas og Marcs valg, om talparrene skal spredes mere.

### M6 (middel): den travle elev går uden om eventyret

Kortet efter forløbet (`E-foelger-390-25-*`) er godt: grøn replik, et gult "!"-felt med en primær "Hjælp Ane" og så
"Byen vågner". Men den næste opgave står allerede under det, i samme panel. En elev, der vil videre, ruller og
svarer, og så er Ane væk fra skærmen. Hendes "!" på kortet står 41-83 px over skærmen på begge bredder.

Den travle elev klarede 0 quests og fik niveau 8. Følgeren klarede 3 og fik niveau 5. Spillet belønner at springe
eventyret over med flere niveauer.

Forslag: vis først den næste opgave, når eleven har valgt ("Hjælp Ane" eller "Fortsæt hos Mølleren").

### M7 (lav): 1280 px

Alt står i en søjle på cirka 520 px, midt i en skærm på 1280. Kortet er 476 x 860 px. Den første opgave står 1791 px
nede, og det, eleven ser uden at rulle, er skemaet og den øverste halvdel af kortet. På en skole-pc er landsbyen
mindre end på en telefon. Kortets høje form er Ganitas valg fra 505 (egnens rigtige form), men opgavepanel og kort
kunne stå side om side på en bred skærm.

### M8 (lav): Bigården

Anden dag (gemt tilstand): Biavlerens "!" er 24 x 24 px og kan trykkes. Scenen har halmkuben, markerne, blomster og
bier, men ikke Biavleren selv (`E-390-61-bigaarden.png`). Ved navnet står en brun prik, hvor Mølleren har et ikon.

Hans sætning er "først skal honningen deles og sælges", men den første opgave er "4 brædder, 1/2 af dem er savet
ud". Min helt på anden dag er god: 2 af 9, to titler og de grå ting med hvem der giver dem.

### M9 (lav): små ord

- "2/3 sæk fra den ene mølle eller 2/5 sæk fra den anden": der er én mølle.
- "Hoved steg til 2" siger ikke, hvad Hoved er (se M2).
- Takkekortets "Hvad nu?" er godt og skal ikke ændres.

## Det, der virker

- **Når eleven er i eventyret, er det et eventyr.**
  - Ane kommer igen, historien går videre fra mel til brød, og bagerhuen kommer på figuren på kortet.
  - Takkekortet siger, hvad man fik, og hvad der nu venter hos hvem.
  - Det er der, hun får lyst til mere.
- **Min helt** er spillets stærkeste MMORPG-side: "2 af 9", og hver grå ting siger præcis, hvem der giver den. Det
  giver noget at gå efter.
- **Questbogen** er overskuelig (Nye, Senere med præcis låsetekst, Det du har fået).
- **Byen vågner** efter hvert forløb (hjul, kornvogn, bro, lygter og indbyggertal) giver et hak hvert 3.-6. minut,
  når forløb 1 er overstået.
- **Teknik:** 0 JS-fejl, ingen vandret rulning og intet netværk på begge bredder. Alle 201 opgaver havde facit i
  spillets generatorer (0 ukendte).

## Hvad der skal til for et ja

1. M1: en åbningsscene og en person fra første minut.
2. M6: et valg efter forløbet i stedet for næste opgave under kortet.
3. M3: et sted, der åbner, skal siges (518 blok 2).
4. M2: Marc beslutter, om egenskaberne skal kunne noget, eller om de skal væk.

M4 og M5 er små ændringer i tekst og talvalg. Når 1-3 er på plads, vil den samme elev efter min model møde Ane inden
for de første 2-3 minutter og besøge et andet sted inden for 30 minutter.

## Ærlige grænser

- Eleven er en model, ikke et barn. Keder sig og forvirret er mine skøn ud fra, hvad hun ser og hvor længe, ikke
  noget, et barn har sagt. Tiden er modelleret, ikke målt.
- 70 % er ét valg. En svagere elev bliver længere i forløb 1 og får flere "spørg din lærer". En stærkere møder Ane
  før.
- "Anden dag" er en gemt tilstand, ikke spillet frem. Kortet efter 505 er set som billede, ikke gået igennem sted for
  sted.
- Lyd er ikke hørt (slået fra som standard). Animationerne er ikke vurderet, fordi tiden står fast i siden
  (`Date.now` låst for at låse saltet).
- 518 (liv og hak) er ikke committet og derfor ikke set. Den kan rette M3 og en del af hakket.
