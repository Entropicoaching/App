matematikken stadig klar til Marcs klasse: ja

**Ja.** Det, der er på `main` (`c63394a`, 596), er klar. Linjen under "Rigtigt!" og bonussens "+N" gør det, Ganita skriver. En ærlig elev har ingen pause over 2:37 uden "+N", og der er 0 JS-fejl og 0 netkald i alle 22 elevforløb.

**602 er ikke merget.** Den ligger på `ordre-602` (`88f5ddc`, `bb5c678` og, mens jeg målte, `3cf77fd` med rapporten; koden er den samme som `bb5c678`). Den lukker det meste af mit M7 i koden, men den rammer den forkerte elev hårdest (M14): en ærlig elev, der har svært ved det, går fra Brøker 165 til 95 og venter op til 10 minutter på et "+N". Det bør Marc og Ganita se på, før 602 merges. Det gør ikke `main` mindre klar.

# Kritik 603, blok 2: matematikken efter Ganitas 596 og 602

Bhishak, 28. sep 2026. Ordre 603.

**Spillet:**
- `C:\Users\Entropi\Desktop\matematik`, hentet med `git archive`. Træet er ikke rørt. Det står på Ganitas `ordre-602` med ucommittede filer.
- `main` @ **`c63394a`** (596 merget).
- `ordre-602` @ **`bb5c678`** (to commits, ikke merget), målt der. Mens jeg målte, committede Ganita `3cf77fd` (blok 3): kun rapporten, hans kørsler og én linje i `scripts/ordre-602.mjs`; `src/` og `spil.html` er de samme som `bb5c678`. Hans `outputs/RAPPORT-602.md` er læst. Hans tal for gætteren (225 og 435) er mine.
- Ganitas `outputs/RAPPORT-596.md` på `main` er læst.

## Hvad jeg målte

**Min elev fra 590** er kopieret til `outputs/kritik-603/elev-603.mjs` med tre nye knapper, og kun eleven er ændret:
- `TRYK_S=3`: gætterens ur, 3 s pr. tryk i stedet for 1 s. Ganitas punkt 1.
- `P1=0.4`: en ærlig elev, der har svært ved det. Rigtigt i første forsøg 40 % i stedet for 70 %. Ganitas punkt 2.
- `GENINDLAES=1`: en gætter, der genindlæser siden før hver ny opgave. Ganitas punkt 3.

Linjerne "står stille" og "Halv værdi" logges med elevens ur. `koer-elever-603.sh` kører 9 kørsler, 22 elevforløb med travl og følger. Headless Chromium, 390 touch og 1280 mus, 20 minutter på elevens ur, uden net. `opsummer-elev-603.mjs` laver tallene nedenfor.

**Alle 22 elevforløb:** 0 JS-fejl og 0 netkald.

### Tallene (Brøker i rygsækken efter 20 min, travl / følger, 390)

| Elev | `main` (596) | `ordre-602` | Niveau (koden) 596 → 602 |
|---|---|---|---|
| ærlig, 70 %, terning 525 | 220 / 260 | 220 / 260 | Øvet / Øvet → Øvet / Øvet |
| gætter, 1 s pr. tryk, 525 | **370 / 645** | **225 / 435** | Øvet / **Dygtig** → Øvet / Øvet |
| gætter, 3 s pr. tryk, 731 | 50 / 50 | 35 / 35 | Begynder → Begynder |
| ærlig, men 40 %, 525 | 165 / 160 | **95 / 125** | Begynder → Begynder |
| gætter, genindlæser før hver opgave, 525 | | 50 / 50 | Begynder |

### Pauser og linjer (390)

| Elev | "+N" i alt 596 → 602 | længst uden "+N" 596 → 602 | "står stille" set (602) |
|---|---|---|---|
| ærlig, 70 %, travl | 25 → 23 | 2:37 → 3:00 | 3 gange |
| ærlig, 70 %, følger | 25 → 25 | 2:28 → 2:53 | 2 gange |
| ærlig, 40 %, travl | 23 → **10** | 2:37 → **10:18** | 2 gange, plus "Halv værdi" 2 gange |
| ærlig, 40 %, følger | 22 → **11** | 2:40 → **7:17** | 3 gange, plus "Halv værdi" 1 gang |

På 1280 er pauserne de samme inden for 6 s. Andelen rigtige i første forsøg er:

| Elev | Rigtige i første forsøg |
|---|---|
| gætteren | 27-30 % (75 af 280, 83 af 274) |
| den svage ærlige | 43 % (13 af 30) |
| den ærlige | 62-65 % |

## Ganitas punkter

**602, punkt 1: "Kør gætteren igen, anden terning og 3 s pr. tryk. Er koden så rigtig?"**
- **Med 3 s pr. tryk** (terning 731) når gætteren kun Brøker 50 på `main` og 35 på 602. Det er under den ærlige. Et langsomt gæt betaler sig ikke, og det gjorde det heller ikke før.
- **Den hurtige gætter** (1 s, 525) er der, hvor M7 var: 370 og 645 på `main`, 225 og 435 på 602.
- **Koden viser kun niveauet.** Den kan ikke længere vise gætteren over den ærlige, for begge er Øvet. Før var følgergætteren Dygtig.
- **Tallet i rygsækken** er stadig 435 mod 260 for følgeren. Så M7 er lukket i koden og halvt lukket i tallet.

**602, punkt 2: "En ærlig elev, der har svært ved det. Er Halv værdi og står stille ærligt og venligt nok?"**

Ærligt: ja. Venligt: nej, ikke for hende. Det er M14:
- **Hun mister mere end gætteren.** 165 → 95 er 42 % af hendes tal. Gætteren mister 39 % (370 → 225).
- **Hun venter længst.** Hendes længste pause uden "+N" går fra 2:37 til 10:18.
- **Hun ser linjen, hvor den gør mest ondt.** Den første, hun ser, står under "Rigtigt!": "Brøker står stille: 0 af dine 4 svar i forløbet var rigtige i første forsøg" (Ganitas eget `B2-staar-stille-390.png`, med "+5 i andet forsøg" lige under).
- **Den halve værdi er for altid.** Et klaret forløb med halv værdi kan ikke hæves (Ganitas egen grænse). Når hun senere kan det, tæller det ikke.

**Tallene skiller de to ad ved en tredjedel, ikke ved halvdelen.** Gætteren rammer 27-30 % i første forsøg, som man venter med tre knapper. Den svage ærlige rammer 43 %. En grænse på en tredjedel ville ramme gætteren og ikke hende. Halvdelen er heltens egen regel (NIVEAU.md regel 2), så grænsen er Marcs valg.

**602, punkt 3: "Genindlæsning."**
- **Før hver opgave:** siden starter runden forfra efter en genindlæsning. Min gætter, der genindlæser før hver opgave, ser kun forløbets to første opgaver igen og igen: 146 opgaver, Brøker 50, ingen "+N" efter 1:46. Det kan et barn ikke farme.
- **Mellem to runder** er ikke målt. Der kan hullet, Ganita beskriver, stadig være. Det er det samme som i heltens niveau-regel, og det har ingen elev ramt i mine kørsler.

**602, punkt 4: "Questbogen."** En quest, der har hvilet, er ikke prøvet. Følgerens to quests (Anes "Mel til bageren" og "Brød til alle") er klaret på begge udgaver med bonus og takkekort og 0 JS-fejl.

**596, punkt 1: "Forstår eleven, at Nyt niveau i Brøker hører til chippen?"** Ja, efter min vurdering:
- Linjen siger selv "Brøker", det samme ord som chippen, og chippen får den grønne kant.
- Den står nu, hvor eleven kigger efter "Rigtigt!" (Ganitas `B1-svar-390.png`).
- "+10 Brøker" flyver op mod chippen og binder de to sammen.

**596, punkt 2: bonussens "+N".**
- **Det er der.** Hos den ærlige travle slutter pausen efter om-taget nu med et "+N" (længste pause 2:37 mod 3:20 i 590).
- **Hastigheden** (1,1 s) har jeg ikke målt ud over Ganitas billeder. "Under folden på 390" kan jeg ikke afgøre fra min elev, for hun læser banneret og ruller.

**596, punkt 3: "Om-tag ved loftet, er det nok?"** Ja. Pausen er 2:25-2:37 på `main` og slutter med bonussen. Mere er Marcs valg.

**596, punkt 4: "Takkekortet efter en quest."** Følgeren klarer Anes to quests på 390 og 1280. "Bonus i rygsækken: +35 Brøker (nu 85)" og "+40 Brøker (nu 220)" står ved takkekortet (8:50 og 13:30 på uret), med 0 JS-fejl. At flyveren flyver dér, har jeg ikke talt.

**596, punkt 5: "Kør din elev med en anden terning og REDUKT=1".**
- **Terning 731** med reduced motion på 602: 0 JS-fejl og Brøker 310 og 260.
- **"+N"** tælles ikke med reduced motion, for der flyver intet. Tallet står fra start, som Ganita skriver.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M7 | lav | Halvt lukket af 602 (ikke merget): gætteren (1 s) får 225 og 435 mod 370 og 645. Koden viser nu samme niveau som den ærlige (Øvet), men følgergætterens tal er stadig 435 mod 260. | Ingen, hvis M14 løses med en lavere grænse; ellers står den som lav. |
| M13 | lav | 602: den ærlige elev (70 %) ser "står stille" 2-3 gange på 20 min og mister op til 2 "+N". Hendes længste pause vokser 23-25 s (2:37 → 3:00). Ganitas rapport (`3cf77fd`) siger "Den ærlige elev ser ingen af linjerne". | Ganita: ret sætningen i rapporten. Løses sammen med M14. |
| M14 | middel | 602: den ærlige elev, der har svært ved det (40 %), rammes hårdest. Brøker 165 → 95 og 160 → 125. "+N" 23 → 10. Længste pause 2:37 → 10:18. Første linje "0 af dine 4 svar" står under "Rigtigt!". Den halve værdi kan ikke hæves bagefter. | Marc: vælg grænsen. En tredjedel skiller gætteren (27-30 %) fra den svage ærlige (43 %) i mine kørsler; halvdelen gør ikke. Ganita: overvej, om den halve værdi kan hæves, når forløbet senere klares med mindst grænsen. Merge 602 efter valget. |

**Lukket:** M8 (pausen ved om-tag slutter med "+N", 596) og M12 (linjen ved svaret, 596).

**Står som Marcs valg:** M2, N1, M4, M5 og M11. Ingen af dem er rørt.

## Ærlige grænser

- **Kun min model-elev, ikke et barn.** Tiderne er en model, og gætteren trykker tilfældigt på knapper, hun ikke har prøvet. Et rigtigt barn, der gætter, gør det måske halvt.
- **Min elevs facit** kender 140-180 af gætterens opgaver ikke (spillets nye opgaver). Hun gætter uanset.
- **Terninger:** kun 525 og 731. 40 %-eleven og genindlæsningen kun på 525.
- **Genindlæsning** er kun målt før hver opgave, ikke mellem runder.
- **Headless Chromium på Windows,** ikke en telefon eller skole-pc.
- **Reduced motion:** kun at spillet kører uden fejl, ikke hvordan det føles.
- **602 er målt på `bb5c678`.** `3cf77fd` kom undervejs og ændrer ingen kode.
- **Kun syntetiske elever** ("Tulle"). Ingen elevdata, matematik-træet er ikke rørt, og intet er pushet.
