matematikken klar til Marcs klasse: ja

Ja. Koden og laerer.html kan ikke lække noget om eleven: ikke navn, tid eller enhed. Intet kan sendes, og det tastede vises aldrig som HTML. At tage et forløb om kan ikke betale sig; loftet holder. 588 har lukket de tre punkter fra 583: niveau-linjen står nu ved svaret, klaret-skærmen er kortere, og "Øv her" er ærlig.

Men man kan farme på en anden måde (M7, middel): **ved at gætte hurtigt.** Min gætter trykker på en tilfældig knap uden at læse. På 20 minutter får hun Brøker 370-645 (Øvet til Dygtig). Den ærlige elev får 220-260 (Øvet). Hendes kode siger altså, at hun er stærkere end den elev, der regner. Det bør rettes, før Marc lader klassens time styre af koderne. Det skal ikke rettes, før klassen får spillet.

# Kritik 590, blok 1: matematikken efter Ganitas 578, 583 og 588

Bhishak, 28. sep 2026. Ordre 590.
- **Matematik `main` @ `a615468`** (578, 583 og 588 merget), hentet med `git archive`. Træet er ikke rørt.
- 588 blev merget, mens jeg målte. Jeg har derfor målt både før (`2774da7`, 583) og efter (`a615468`, 588).

## Hvad jeg målte

- **`outputs/kritik-590/elev-590.mjs`: min elev** fra 572, 20 minutter, 390 og 1280 px, den travle og følgeren, uden net. Eleven og uret er uændrede.
  - Før og efter med terning 525, efter også med terning 731.
  - Nyt i 590 er **gætteren** (`GAET=1`), kørt både før og efter. Hun læser ikke og trykker på en tilfældig knap, hun ikke har prøvet; uret giver 1 s at tænke og 1 s pr. tryk.
  - Hver bonus-, loft- og "Nyt niveau"-linje skrives med elevens ur, og "Øv her" øverst på Min helt læses til sidst.
  - `opsummer-elev-590.mjs` laver tallene nedenfor ud fra JSON-filerne `elev-590-{foer,efter}-*.json`.
- **`outputs/kritik-590/matematik-590.mjs`: 25/25 grønne** på `a615468`. Den var også 25/25 på `2774da7`, før 588 kom.
  - Reglerne i `src/faerdigheder.js` er kørt på alle 63 forløb og quests (del A).
  - I browseren på 390 (touch) og 1280 (mus), uden net:
    - "Vis min kode"
    - `laerer.html` med 25 syntetiske koder, fluebenet, HTML i feltet og én kode alene
    - elevens gemte spil på samme computer
- **Set med egne øjne:** Ganitas skærmbilleder fra 583 (`B1-klaret-390`, `B1-sent-390`) og 588 (`B1-svar-390`, `B1-klaret-390`, `B2-oev-her-midt-390`).
- Kun syntetiske elever ("Tulle", "Pip"). **0 netkald og 0 JS-fejl** i alle ni kørsler.

## Kan eleven farme point?

**Ved at tage et forløb om: nej.** Loftet holder, regnet på alle forløb og quests:
- 1.000 rigtige svar i et forløb, der ikke klares, giver højst værdien minus 10 (Møllen 1: 50 af 60).
- Et klaret forløb, der tages om 1.000 gange, giver 0 point mere (60 → 60).
- Møllen 1 om og om igen giver Brøker 50, og det er stadig Begynder. Øvet kræver 200.
- Et snydt gemt spil med `oevePoint` 99999 renses til loftet (50).
- At klare giver 20 point pr. rigtigt svar, at tage om giver 10. Om-tag kan ikke betale sig. Det er det samme, Ganita skriver i 588.

**Ved at gætte hurtigt: ja (M7).** Terning 525, 20 minutter. Tallene er ens før og efter 588:

| | ærlig travl | gætter travl | ærlig følger | gætter følger |
|---|---|---|---|---|
| Opgaver / rigtige i første forsøg | 32 / 20 | 280-290 / 75 | 31 / 20 | 274-286 / 83-84 |
| "+N" til færdigheden | 22 | 63 | 21 | 77 |
| Rygsækken efter 20 min | Brøker 220 (Øvet) | Brøker 370 (Øvet), Regn med brøker 210 (Øvet) | Brøker 260 (Øvet), Enheder 50-60 | **Brøker 645 (Dygtig)**, Enheder 120 og tre andre Begynder |
| Heltens niveau | 4 | 2 | 3-4 | 3 |

- **Hvorfor:**
  - Loftet gælder pr. forløb, og mestringen (3 rigtige i første forsøg) kan nås ved held, når eleven kan tage forløbet om så tit, hun vil.
  - Med tre svarknapper rammer hun rigtigt i 27 % i første forsøg, og ofte i andet (+5).
  - Hvert held giver hele værdien og det næste forløb.
  - Den travle gætter klarede Møllens forløb 1-6. Den gættende følger klarede Møllens 1-5, Grusgravens 1, Landsbygadens 1 og fem quests.
- **Hvad spillet selv gør:**
  - Heltens niveau vokser ikke med gætteriet (2-3 mod 4).
  - Spillet siger "Det er ikke første gang: spørg din lærer eller sidemanden om trinnet", når hun tager et forløb om igen. Det er godt, men det bremser ikke tallet.
- **Svar på 588's punkt 4:** erfaringen ved om-tag er ikke farmen. Den vokser ikke hurtigere end ved at spille videre, og den giver ikke niveau. Det er **færdighedspointene** og dermed koden, der farmes, og det sker gennem held og tempo, ikke gennem loftet.
- **Mit ur er hurtigt** (1 s pr. tryk). En elev, der gætter med 3 s pr. tryk, laver ca. en tredjedel så mange opgaver. Det er stadig ca. tre gange så mange som den ærlige elev, og det er nok til Øvet.

Mestringen må ikke røres (M2/N1 venter på Marc). Men tallet er "kun visning", så det kan rettes dér: se M7 under Fund.

## Ganitas punkter

**Fra 578:**
1. **Bonussen ses:**
   - "Bonus i rygsækken: **+20 Brøker** (nu 220)" står lige under klaret-linjen.
   - Når bonussen giver et niveau, står det i samme linje ("+50 Brøker (nu 200, nyt niveau: Øvet)", følgeren kl. 11:15).
   - Den behøver ikke flyve.
2. **Loftet** er rigtigt sat til om-tag (se ovenfor). Farmen går gennem gætteri (M7).
3. **Længst uden "+N" 3:20:** Ganitas gæt er rigtigt (M8). Med terning 525 er pausen fra 4:35 til 7:55 på begge bredder, før og efter 588:
   - 4:35: loft-linjen "Brøker vokser igen, når du klarer forløbet" (Møllens forløb 1, tredje gang).
   - 6:52: bonus +10 (klaret).
   - Tallet står altså stille i 2:17, og så kommer bonussen. Den tæller ikke som "+N".
   - Terning 731 har samme mønster: 3:30 fra 11:26, med loft kl. 12:01 og bonus +10 kl. 13:34.
4. **"+10 Brøker" på en telefon:** 13 px fed på grøn bund i 0,8 s, og kun ét tal pr. svar. Der flyver kun et tal til erfaringen, når færdigheden står ved loftet (0-6 gange på 20 min). M1 er lukket.
5. **Koden og persondata:** se nedenfor. Det er i orden (M11, lav).

**Fra 583 (og hvad 588 gjorde ved det):**
1. **Niveau-linjen:**
   - I 583 kom den på næste skærm. Min elev så 2 af 2 nye niveauer (i 572 så hun 0).
   - I 588 står den på svarets skærm i samme øjeblik: travl 1:10 og 18:44, 2 s tidligere end i 583.
   - **Men** "+10 Brøker" flyver hen over den i 0,8 s. I `B1-svar-390.png` kan "Nyt niveau i Brøker: Begynder" ikke læses under flyveren, og chippen viser stadig 0, mens linjen siger "(nu 10)".
   - På 390 presser linjen stadig opgavens tekst ind i en smal spalte ("Mølleren har 3 / lige store sække / på vognen").
   - Det er M12, og svaret på 588's punkt 1: ja, den skal hellere stå under "Rigtigt!".
2. **Klaret-skærmen (M10, lukket i 588):**
   - Den var ca. 1.860 px på 390 i 583. I 588 er den ca. 1.360 px (`B1-klaret-390.png`), og under klaret-linjen og bonussen står tre ting: Niels' "!" med valget, "Byen vågner" og en lukket "Mere: Nye steder · Mølleren fortæller".
   - Svar på 588's punkt 2: de tre er rigtige. Valget skal træffes nu, og "Byen vågner" er dér, tallet vokser.
   - "NIVEAU OP! Niveau 3 · Lærling" står stadig øverst som et andet slags niveau end Brøkernes. Det er heltens og hører til; det er ikke et fund.
3. **"Øv her" (M9, lukket i 588):**
   - Før pegede den på steder, eleven aldrig havde været (den travle: Grusgraven; følgeren: Landsbygaden).
   - Nu står der ærligt "Når du kommer til Grusgraven, kan du øve enheder og målestok dér", med knappen "Gå til Grusgraven".
   - Med terning 731 er følgeren lige kommet til Landsbygaden, og så står sætningen ikke (stedet er kendt). Det er rigtigt.
   - Svar på 588's punkt 3: sætningen med knap er ærlig nok. Knappen går til et åbent sted, så den skal ikke væk.
4. **Min elev med to terninger (588's punkt 5):**
   - Terning 525: 2 "Nyt niveau"-linjer og 3-5 bonuslinjer pr. kørsel.
   - Terning 731:
     - travl: Brøker 310 og Regn med brøker 20
     - følger: Brøker 260 og Enheder 120
     - 4-6 bonuslinjer og 2 "Nyt niveau"-linjer
     - længst uden "+N" 3:30 (travl) og 2:13 (følger)
   - Linjerne kommer, dér hvor jeg venter dem: ved svaret og under klaret-linjen.

## Persondata: kan koden eller laerer.html lække noget?

Nej, ikke navn, tid eller enhed (samme resultat på `2774da7` og `a615468`):
- **Koden er kun de syv niveauer:**
  - "400C-VBEP" læses tilbage til rygsækkens niveauer [3, 2, 1, 0, 0, 0, 0].
  - Samme fremskridt med et andet navn ("Pip"), en anden figur og et andet ur (en måned senere kl. 20:13) giver samme kode.
  - At vise koden ændrer intet i lageret, og boksen nævner intet navn.
- **Ingen farlige kald:** `spil.html` og `laerer.html` har ingen `fetch`, XHR, beacon, websocket, cookie, `userAgent` eller geolocation.
- **laerer.html med 25 syntetiske koder** (frø 590; små bogstaver, mellemrum, O for 0):
  - "25 koder læst." og 7 rækker. Forslaget er "Landsbygaden ... Del lige over".
  - Ingen kode står i resultatet.
  - Uden flueben er intet gemt. Med flueben gemmes det, og når fluebenet tages af, slettes det.
  - `<img src=x onerror=...>` vises som tekst og køres ikke. Resultatet bygges med `innerHTML`, men alt tastet går gennem `escapeHtml`.
- **Elevens gemte spil på samme computer:** laerer.html viser questbogens status (klaret, åben, låst; det er 417's valg), men figurens navn står ikke på siden.
- **Men koden er næsten altid unik (M11):**
  - 23 af 25 koder er entydige med frø 590, og 25 af 25 med frø 574.
  - Én kode alene giver "Svagest først (1 elev)" med elevens niveau i alle syv.
  - Det er elevens egne niveauer, som hun selv har vist, så det er ikke en lækage. Men "alle med de samme niveauer har den samme kode" kan læses, som om koden er anonym.

## Fund

M1-M6 er fra kritik 572. M1, M3 og M6 er lukket af 578/583, og M2's første halvdel af 578. M4 og M5 er Marcs.

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M7 | middel | En elev, der gætter hurtigt (1 s pr. tryk, tre knapper), får Brøker 370-645 (Øvet til Dygtig) på 20 min. Den ærlige elev får 220-260 (Øvet). Mestringen nås ved held, når forløbet kan tages om uden grænse, og hvert held giver hele værdien. Koden viser gætteren som stærkest. Det er det samme før og efter 588. | Kun visning: giv point undervejs kun for rigtigt i første forsøg (ikke +5 i andet). Eller lad et forløb, der klares efter mange om-tag (fx 3. gang eller mere), give bonussen uden svar-pointene. Mestringen røres ikke. Test med `GAET=1 node outputs/kritik-590/elev-590.mjs`. |
| M8 | lav | Længst uden "+N" (3:20) er et om-tag med loftet nået. Tallet står stille 2:17, til bonussen kommer (+10). | Intet ud over 578's loft-linje; den siger det. |
| M9 | lukket | "Øv her" pegede på et sted, eleven ikke havde været. | Lukket i 588: "Når du kommer til Grusgraven ...". |
| M10 | lukket | Klaret-skærmen var 2,2 skærme med fem ting under klaret-linjen. | Lukket i 588: 1.360 px, tre ting og "Mere". |
| M11 | lav | Koden er i praksis entydig (23-25 af 25), og én kode alene viser den ene elev. | Samme som skakkens S1: "Koden er dine tal, ikke dit navn", og lærersiden venter på 5 koder. Marcs valg. |
| M12 | lav | Niveau-linjen ved svaret står i chippens hjørne. "+10 Brøker" dækker den i 0,8 s, chippen viser det gamle tal imens, og linjen presser opgavens tekst ind i en smal spalte på 390. | Stil linjen under "Rigtigt!" i fuld bredde (588's eget forslag). |

## Ærlige grænser

- **Eleverne er modeller, ikke børn:** to terninger og en gætter, 390 og 1280 px, headless Chromium på Windows. Gætterens ur (1 s pr. tryk) er hurtigere end et barns, så tallene er et øvre skøn.
- **To fejl i mine egne prøver undervejs, begge rettet:**
  - Første kørsel fjernede alle "s" i bonus-, loft- og "Øv her"-teksten (`/s+/` i stedet for `/\s+/`, som 572's chip-linje også havde). Scriptet er rettet, og alle kørsler i `outputs/kritik-590/` er lavet efter rettelsen.
  - En figur med et udseende, der ikke findes ("hav"), blev afvist af spillet. Den bruger nu "skov".
- **Skærmene er Ganitas:** klaret-skærmen og linjen ved svaret er set i hans skærmbilleder fra 583 og 588, sammen med min elevs tidsstempler. Jeg har ikke selv taget dem igen.
- **Elevens reduced-motion-kørsel** er ikke kørt i 590.
- **Intet i matematik er rørt:** det er kun læst med `git archive`.
