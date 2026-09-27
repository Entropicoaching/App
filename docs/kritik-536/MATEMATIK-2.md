matematikspillet føles som et eventyr: ja

Det er ja for en elev, der følger kortet. Fra 38 sekunder møder hun Mølleren, Ane venter synligt fra første opgave, og efter "Brød til alle" siger panelet "Grusgraven er åben: Grusgraveren venter". Så går hun derhen og hjælper Hans. De tre ting, jeg skrev som betingelse for et ja i 525 (M1, M6, M3), er lavet, og M4 med.

Det, der er tilbage:
- de samme 12 opgaver i forløb 1 (M1-rest),
- egenskaber, der intet gør (M2, Marcs valg),
- gentagne tal (M5),
- en travl elev, der stadig kan gå uden om alle personer og få flest niveauer (N1).

Det er forbedringer, ikke stoppere.

# Matematikspillet igen: elev-525 før og efter Ganitas 518 og 527

Bhishak, ordre 536, blok 2. Samme elev, terning, tidsmodel og 30 minutter som i 525. Der er to kørsler af `outputs/kritik-536/elev-536.mjs` (min `elev-525.mjs`):
- **Før:** `4bdda17`, 525's grundlag.
- **Efter:** `eventyr-fra-start` @ `4ceb54c`. Den har 518 (merget i main `9e411ed`) og 527's to blokke og tillægget. 527 har ingen blok 3 og ingen `RAPPORT-527.md` committet. Jeg har læst `docs/EVENTYR-FRA-START.md` og commit-beskederne i stedet.

Spillet er hentet med `git archive`. Matematik-træet er ikke rørt: det havde Ganitas egne ucommittede ændringer, da jeg startede.

**Eleven:** "Tulle" (et fantasinavn) har 70 % rigtige i første forsøg. Hun er spillet to gange med samme terning:
- **travl** svarer og vil videre.
- **følger** trykker på kortets primære knap.

For at eleven ikke skal sidde fast i 527's nye panel, har scriptet fået tre ting:
- Åbningsscenen læses.
- Den travle trykker "Fortsæt hos Mølleren", følgeren "Hjælp Ane" som før.
- Følgeren trykker "Gå til <sted>", når panelet siger et nyt sted, og der ikke er en person at hjælpe.

Før-kørslen giver præcis 525's tal (51/52/49/49 opgaver, første niveau 6:38 efter 12 opgaver, niveau 8/5, 0/3 quests, 7:45 uden noget nyt). Modellen er altså den samme.

## Før og efter (390 px; 1280 er ens bortset fra rul)

| | travl før | travl efter | følger før | følger efter |
|---|---|---|---|---|
| Opgaver på 30 min | 51 | 49 | 49 | 44 |
| Første person | aldrig | **0:38** (åbningsscenen) | 7:00 | **0:38** |
| Første "Hjælp" | aldrig | aldrig | 7:03 | 7:24 |
| Første niveau op | 6:38, efter 12 opgaver | 6:59, efter 12 | 6:38, efter 12 | 6:59, efter 12 |
| "Samme forløb igen" | 6 | 6 | 7 | 5 |
| heraf "spørg din lærer" | 3 (to ved 2 af 3/4) | **2** (kun ved 1 rigtig) | 4 | **3** (kun ved 1 af 3) |
| heraf "Tæt på. Én rigtig mere" | – | 4 | – | 2 |
| Nyt sted sagt i panelet | 0 | 2 (12:11, 20:55) | 0 | 1 (14:09) |
| Steder besøgt | kun Møllen | kun Møllen | kun Møllen | **Møllen og Grusgraven** (14:09) |
| Quests klaret | 0 | 0 | 3 | 3 (Mel til bageren, Brød til alle, **Sten til diget**) |
| Niveau / Hoved-Hånd-Hjerte | 8 / 8-1-1 | 7 / 7-1-1 | 5 / 5-1-1 | 5 / 3-3-1 |
| Udstyr | 1 af 9 | 1 af 9 | 2 af 9 | 2 af 9 |
| Historiens andel af ordene | 43 % | 48 % | 43 % | 48 % |
| Længste stræk uden noget nyt | 7:45 | 7:47 | 7:04 | **6:21** |
| 2/3 mod 2/5 | 5 | 5 | 8 | 0 (hun var i Grusgraven) |
| JS-fejl, vandret rulning, net | 0, nej, 0 | 0, nej, 0 | 0, nej, 0 | 0, nej, 0 |

## M1-M9

| | Fund i 525 | Nu (4ceb54c) | Status |
|---|---|---|---|
| M1 | høj: de første 6½ min er 12 ens opgaver uden person, forløb 1 kræver 3 af 3, to gange "samme forløb igen" | Åbningsscenen står over forløbet (49 ord), og scenen og alle tre svarknapper står på én skærm: 390 fra 8 til 672 px af 844, 1280 fra 170 til 677 af 900 (`E-efter-*-03-aabning.png`). "Ane, bagerkonen, venter med "Mel til bageren"" står låst i panelet ved hver opgave. Opgaverne er de samme: første niveau efter 12 opgaver og ca. 7 min | **delvis lukket**: personen og grunden er der fra første minut. De 12 ens opgaver er reglerne, som 527 med vilje ikke rører |
| M2 | høj: Hoved/Hånd/Hjerte gør intet; travl når "Mester" uden en quest | Uændret i koden. Hånd stiger nu hos følgeren (3), fordi hun kommer til Grusgraven. Travl når niveau 7 uden en quest | **åben**, Marcs valg |
| M3 | middel: nye steder åbner i stilhed | "Nye steder: Grusgraven er åben: Grusgraveren venter" med replik og "Gå til Grusgraven" (`E-efter-foelger-390-26-nyt-sted.png`). Følgeren går derhen 14:09 og hjælper Hans. 518's øjeblik på kortet er med | **lukket** |
| M4 | middel: "spørg din lærer" ved 2 af 3 | Kun ved 0-1 rigtige. Ved én fra kravet siger Mølleren "Tæt på. Én rigtig mere, så har du det." (4 gange hos den travle) | **lukket** |
| M5 | middel: 2/3 mod 2/5 igen og igen | Generatorerne er byte for byte som i 4bdda17. Den travle får 2/3 mod 2/5 5 gange, som før | **åben** (Ganita og Marc) |
| M6 | middel: næste opgave under "Hjælp Ane"; travl går uden om eventyret | Et valg: "Hjælp Ane" (primær) eller "Fortsæt hos Mølleren", og "Næste hos Mølleren: forløb 2 af 8" (`E-efter-travl-390-25-kort-efter-forloeb.png`). Den travle vælger "Fortsæt" to gange og klarer 0 quests | **lukket** som skrevet; resten er N1 |
| M7 | lav: 1280 er en 520 px søjle, første opgave to skærme nede | Søjlen er uændret, men siden ruller til scenen, så opgaven står på skærmen | **delvis lukket** |
| M8 | lav: Bigården uden Biavleren i scenen, en prik som ikon, første opgave "4 brædder" | Uændret på anden dag (`E-efter-390-61-bigaarden.png`). 518 lader Biavleren puste røg ved bistaderne på kortet, men kun når han er hjulpet | **åben** |
| M9 | lav: "den anden mølle", "Hoved steg til 2" | Begge står stadig (`broek-trappe.js:235`, `spil-app.js:623`) | **åben** |

## Nyt

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| N1 | middel | Den travle elev vælger "Fortsæt hos Mølleren" og hjælper aldrig nogen på 30 min, men får niveau 7. Følgeren hjælper tre og får niveau 5. Valget er nu ærligt, men det betaler sig stadig at springe eventyret over. Det nye sted bliver sagt to gange, og hun går ikke | Samme som M2: lad noget af niveauet eller titlen kræve en quest. Eller lad "Fortsæt" komme efter én quest, når en person står med "!" (Marc vælger) |
| N2 | lav | Følgeren er 6 min i Grusgraven (14:09-20:14) med Grusgraverens eget forløb, før hun når Hans' quest. Det er et nyt sted med en ny person, men det første, hun gør, er igen et forløb uden en quest | Som M1: en låst linje "Hans venter med "Sten til diget"" ved hver opgave i Grusgraven. Det gør 527 måske allerede, hvis Grusgravens forløb åbner en quest; jeg har ikke tjekket linjen der |

## Det der virker

- **Åbningsscenen** er god: tre linjer, figuren og en grund ("Ane har intet mel til morgenbrødet"). Man ser den uden at rulle, og den er væk ved første svar.
- **Valget efter forløbet** er tydeligt: "Hjælp Ane" står som den primære knap, og "Fortsæt" siger, hvad der venter.
- **"Tæt på. Én rigtig mere, så har du det."** er præcis den tone, 525 bad om.
- **Nye steder** står med personen og hans replik og en knap. En elev, der følger kortet, forlader nu Møllen og møder en ny person.
- **Teknik:** 0 JS-fejl, ingen vandret rulning og intet net på 390 og 1280. Alle opgaver havde facit i spillets generatorer (0 ukendte).

## Ærlige grænser

- **Eleven er en model, ikke et barn.** Tiden er modelleret: 0,4 s pr. ord, 10 s pr. opgave, 2 s pr. tryk og 3 s pr. rul.
- **Følgerens tryk på "Gå til" er min tilføjelse** til modellen. Den travle har ingen ny adfærd ud over "Fortsæt", som hun skal trykke for at komme videre.
- **518's øjeblikke og arbejdet på kortet er ikke set,** fordi tiden står fast i siden (`Date.now` låst for at låse saltet). Lyden er slået fra.
- **527's blok 3 og rapport findes ikke;** jeg har vurderet det committede (4ceb54c). 518 er vurderet sammen med 527, ikke alene.
- **"Anden dag" er en gemt tilstand,** ikke spillet frem.
