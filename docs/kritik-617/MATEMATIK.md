Matematikken stadig klar til Marcs klasse: ja
Marcs M2/N1 opfyldt: ja

**Ja og ja**, for det, der er på `main` (`42e0ae2`, 605 og 612 merget). Den ærlige elev, der hjælper, ligger aldrig under den travle, hverken efter 20 eller 40 minutter og med alle tre terninger. Den sjove konsekvens tager intet fra eleven, og "Fortsæt" og "Hjælp" står der begge ved hvert eneste valg (134 af 134). Der er 0 JS-fejl og 0 netkald i alle 40 elevforløb.

**Men én ting skal Ganita se på, før klassen spiller længe (M17, middel):** en gætter, der hjælper, bliver den bedste i spillet. Med terning 525 når han niveau 7½ efter 20 minutter, mod 4½ for den ærlige hjælper og 3 for den travle. Før 605 nåede han 3½. Grunden er, at en quest klaret med 2 af 3 nu giver et halvt niveau, og at han kan prøve den samme quest igen og igen. 612's grænse på en tredjedel rammer ham ikke. Målt med sidens eget "Rigtigt!" rammer han 28-41 % i første forsøg. Det er lige ved grænsen og lige under den svage ærlige (43 %).

# Kritik 617, blok 1: matematikspillet efter Ganitas 605 og 612

Bhishak, 28. sep 2026. Ordre 617.

**Spillet:** `C:\Users\Entropi\Desktop\matematik`, hentet med `git archive`. Træet er ikke rørt.

| Udgave | Hash | Hvad |
|---|---|---|
| `main` før 605 | `c096c38` | 602 merget |
| `main` med 605 | `4630a20` | det, ordren nævner |
| `ordre-612` | `26c3a37` | 612 blok 1 og 2; mens jeg målte, blev 612 merget |
| `main` med 612 | `42e0ae2` | samme `src/` og `spil.html` som `26c3a37` (`git diff --stat` er tom) |

Ganitas `outputs/RAPPORT-605.md` og `RAPPORT-612.md` på `main` er læst.

## Hvad jeg målte

**Min elev fra 603** er kopieret til `outputs/kritik-617/elev-617.mjs`. Kun det, hun læser, og målingen er ændret:
- **605's nye linjer læses som takkekortet** (0,4 s pr. ord, en langsom læser i 5. klasse). Det gælder den sjove linje, "kommer forbi", Hjerte på takkekortet og det lappede kort. Ganitas kørsler læste dem ikke.
- **Den sjove linje logges.** Jeg logger, om den og første svarknap står på samme skærm, gedebid, gæster på figuren, og om "Hjælp ..." og "!" stadig er der.
- **Hvert valg efter et forløb logges:** står "Fortsæt" og "Hjælp" der begge?
- **Et øjebliksbillede ved 20 minutter,** så én kørsel på 40 minutter også giver 20-minutterstallene.
- **Rigtigt i første forsøg efter sidens eget "Rigtigt!"** (Ganitas 612, punkt 1), også i de opgaver, min facit ikke kender.

`koer-elever-617.sh` (a, b, c og d) kører 17 kørsler med 40 elevforløb i headless Chromium. Det er 390 touch og 1280 mus uden net, 40 minutter på elevens ur (d: 20). `opsummer-elev-617.mjs` laver `elev-617-tabel.json`. Eleven hedder "Tulle", og der er kun syntetiske data.

### Hjælperen mod den travle (70 %, niveau, 390; 1280 er ens undtagen ét sted)

| Terning | Min | Travl før 605 | Hjælper før 605 | Travl 605 | Hjælper 605 | Hjælperens Hoved-Hånd-Hjerte 605 |
|---|---|---|---|---|---|---|
| 525 | 20 | 4 | **3** | 3 | **4½** | 3-1-3 |
| 525 | 40 | 9 | **6** | 8 (1280: 9) | **9** | 3-3-5 |
| 731 | 20 | 5 | 4½ | 5 | **5½** | 3-2-3 |
| 731 | 40 | 7 | 7 | 7 | **10** | 3-4-5 |
| 311 | 20 | 4 | 3½ | 4 | **5** | 3-1-3 |
| 311 | 40 | 8½ | 10 | 9½ | **13½** | 3-4-7 |

- **Hjælperen ligger ikke under** i nogen af de 10 sammenligninger på 605 (390 og 1280). Før 605 lå hun under i 4 af dem.
- **Efter 40 minutter er hun foran** med 1-4 niveauer ved alle tre terninger på 390 og lige med den travle ved 525 på 1280. Ganita skrev "lige, ikke mere"; det er mere end det.
- **Hun har en følger** på kortet og Hjerte 3-7, mod 1 hos den travle.
- **Tallet i rygsækken (Brøker) er stadig den travles:** 370-490 mod 260-280 hos hjælperen. Hjælp giver niveau og Hjerte, ikke færdighed. Det er, som Ganita skrev, og efter min vurdering rigtigt: "hvad du kan" er ikke blevet til "hvor mange du har hjulpet".
- **Reduced motion** (731): samme tal som uden, 0 JS-fejl.

### Den sjove konsekvens (travl, 390 og 1280)

| | 525 | 731 | 311 |
|---|---|---|---|
| "Fortsæt" trykket på 40 min | 2 | 2 | 2 |
| Første gang (390) | 7:44, geden | 4:13, geden | 2:36, geden |
| Anden gang (390) | 21:13, bierne | 17:09, bierne | 17:23, bierne |
| Linjen og første svarknap på én skærm | ja (390: linjen 251-397 px, knappen slutter 736 af 844) | ja | ja |
| "Hjælp Ane"/"Hjælp Niels" stadig i panelet og "!" på kortet | ja | ja | ja |
| Opgaver på 40 min, før → efter | 66 → 66 | 68 → 67 | 66 → 64 |

- **Intet tages.** Niveau, Hoved, quests og point er de samme som før 605, bortset fra én ting: den tid, det tager at læse linjen.
- **Den tid er ikke nul (M16).** Linjen er 49 ord (geden) og 41 ord (bierne). Min læser bruger 16-20 s på den, to gange på 40 minutter.
  - Ved terning 525 kommer den travles niveau 4 derfor kl. 20:30 i stedet for 20:11, og niveau 9 lige efter 40 minutter. Derfor står der 3 og 8 i tabellen i stedet for 4 og 9.
  - Ved 731 og på 1280 flytter det intet. Det er læsetid, ikke en straf i point. Men det er den eneste pris.
- **Hjælper hun senere,** lappes kortet (311, travl: "Og Mølleren har klistret hjørnet på dit kort igen").

## Ganitas punkter

**605, punkt 1: "Føles konsekvensen sjov og ikke som straf for en 11-årig?"** Ja, efter min vurdering, med én undtagelse.
- **"Helt fint, Ane klarer sig nok"** giver lov først. Det er det vigtigste ord i linjen.
- **Geden, der "tygger og ser meget tilfreds ud",** og bierne, der "synes, du dufter af honning", er sjove, ikke skyld. "Geden kigger skuffet" kommer kun, når eleven har hjulpet, og så er det geden, der har tabt. Det er et glimt i øjet.
- **Undtagelsen: gedebiddet er næsten ikke til at se** (M16). I Ganitas `B2-kort-gedebid-390.png` er det et stiplet hjørne i kortets egen farve, øverst til venstre. Jeg skulle lede efter det. Bierne kan ses (10 px, tre stykker om figuren).
- **Linjen er lang.** 49 ord i kursiv er seks linjer på 390. Et barn, der vil videre, læser den måske ikke; et barn, der læser den, betaler 20 s.

**605, punkt 2: "Kør din elev med flere terninger og på 1280. Holder 'ikke under'? Og med din svage ærlige elev?"**
- **Tre terninger** (525, 731, 311), 390 og 1280: ikke under i nogen (tabellen ovenfor).
- **Den svage ærlige elev (40 %)** får intet ud af at hjælpe (M15). Terning 525, 40 minutter:
  - Hun trykker "Hjælp" 4-5 gange og bruger cirka 9 minutter i quests (fra første opgave til hvilen: 2:07, 2:20, 2:12 og 2:19).
  - Alle hviler: "Du fik dem alle løst! 1 af 3 sad i første forsøg. Næste gang vil jeg gerne se 2."
  - Hun ender med Hjerte 1, ingen følger, ingen "kommer forbi" og 0 hjulpne. Det samme på `main` med 612.
  - Hun når niveau 4 mod den travles 2. Men forskellen er terningen og ikke hjælpen: hun har klaret samme antal forløb (4), og ingen af hendes niveauer kommer fra en quest.

**605, punkt 3: "Gætteren i questbogen."** Det er M17. Gætteren (1 s pr. tryk), terning 525, 390:

| | Travl før 605 | Travl 605 | Hjælper før 605 | Hjælper 605 | Hjælper 612 |
|---|---|---|---|---|---|
| Niveau efter 20 min | 2 | 2 | 3½ | **7½** | **7½** |
| Niveau efter 40 min | 4 | 6 | 3½ | **9** | **9** |
| Hjerte efter 40 min | 1 (2 hjulpne) | 3 | 1 (6 hjulpne) | **7** | **7** |
| Brøker efter 40 min | 455 | 455 | 445 | 445 | **610** |

- **Han hjælper 17 gange på 40 minutter** og klarer 6 quests. Den første klarer han kl. 5:57. Mellem forsøgene hviler questen kun til næste forløb, og han tager forløbene på et par minutter.
- **Han er Mester (niveau 8) kl. 24:25.** Den ærlige hjælper når niveau 9 efter 40 minutter (525).
- **Hver klaret quest giver et halvt niveau til**, når personen "kommer forbi". Af hans 8 "Niveau op" på 40 minutter kommer 2 fra forløb, 2 fra quests og 4 fra "kommer forbi".
- **Med terning 731 går det ham dårligt** (niveau 1 efter 20 min, begge udgaver). Det afhænger altså af terningen, men 525 er ikke en sjælden terning: 525 er den, alle vores kørsler starter med.

**605, punkt 4: "Den travle ser konsekvensen sjældent."** 1-2 gange på 20 minutter og 2 gange på 40 minutter, med alle tre terninger. Efter min vurdering er det nok til, at hun ser den, og for lidt til at blive en straf. Geden først og bierne bagefter virker. Gedebiddet på kortet ser hun ikke (M16).

**612, punkt 1: "Kan du tælle rigtigt i første forsøg fra sidens eget 'Rigtigt!'?"** Ja. `.quest-besked--korrekt` efter første tryk, `main` `42e0ae2`, 20 minutter, 390:

| Elev | Terning | Min facit | Sidens "Rigtigt!" |
|---|---|---|---|
| gætter, travl | 525 | 75 af 281 (27 %) | **99 af 281 (35 %)** |
| gætter, hjælper | 525 | 83 af 273 (30 %) | **112 af 273 (41 %)** |
| gætter, travl | 731 | 36 af 269 (13 %) | **75 af 269 (28 %)** |
| gætter, hjælper | 731 | 44 af 271 (16 %) | **81 af 271 (30 %)** |
| svag ærlig, travl og hjælper | 525 | 13 af 30 og 13 af 31 | **13 af 30 (43 %) og 13 af 31 (42 %)** |

- **Ganita havde ret:** min facit tæller gætteren for lavt. Spillet ser 28-41 %, ikke 27-30 %.
- **En tredjedel skiller dem ikke sikkert.** Gætteren ligger på begge sider af grænsen, og ved 525 (hjælper, 41 %) er han lige under den svage ærlige (42-43 %).
- **Det er ikke overraskende:** alle opgaver i kørslerne har 3 knapper, så et blindt gæt rammer en tredjedel. En grænse, der ligger præcis ved gættets forventning, lader halvdelen af gætterens forløb gå igennem.
- **Pr. forløb er det værre,** for et forløb har kun 3-4 opgaver, og 2 af 4 er nok.

**612, punkt 2: "Pauserne ved loftet."** Ikke målt særskilt. Den svage ærlige ser stadig "står stille" 5-6 gange på 40 minutter med 612, nu med "en tredjedel" i linjen. Den første står kl. 3:10 efter "0 af dine 4 svar", som på 605.

**612, punkt 3: "Står 'står stille' nu kun efter andet eller tredje forsøg?"** Delvis målt. Om linjen kommer efter første eller andet forsøg, har jeg ikke logget pr. tryk. Men den ærlige 70 %-elev ser den slet ikke længere (3 og 2 gange på 605, 0 på 612). Mit M13 fra 603 er lukket.

**612, punkt 4: "Knapper med 2 muligheder."** I mine 36 elevforløb har alle opgaver 3 knapper (`knapper: {"3": ...}` i JSON'en). Jeg har ikke set en med 2. Et gæt rammer altså 33 % i første forsøg, ikke 50 %.

**Ordren: "Rammer grænsen gætteren og ikke den svage ærlige elev (M14)?"**
- **Den svage ærlige: ja, hun er hjulpet.** Brøker efter 40 minutter går fra 190/295 (605) til 300/355 (612), og "Halv værdi" forsvinder (3 og 1 gang → 0). M14 er lukket for hende.
- **Gætteren: nej, han rammes ikke.** Hans Brøker går fra 455/445 til 630/610 efter 40 minutter. Det er over den svage ærlige (300/355) og over den ærlige 70 %-elev (390/260). Det genåbner mit M7 fra 590 og indgår i M17.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M15 | middel | Den svage ærlige elev (40 %) får intet ud af at hjælpe. Hun prøver 4-5 quests på 40 minutter, bruger cirka 9 minutter på dem, og alle hviler (0-1 af 3). Hjerte 1, ingen følger, ingen "kommer forbi". "Det betaler sig altid at hjælpe" gælder ikke hende. | Ganita og Marc: fx at personen takker og går med på kortet efter et forsøg, hvor alle blev løst, uden niveau. Hjerte og niveau må ikke gives for forsøget, for så farmer gætteren det (M17). |
| M16 | lav | Den sjove linje er 41-49 ord og koster en læsende elev 16-20 s hver gang (to gange på 40 min). Ved terning 525 kommer den travles niveau 4 derfor kl. 20:30 i stedet for 20:11. Gedebiddet på kortet er et stiplet hjørne i kortets egen farve og er næsten ikke til at se. | Ganita: gør linjen kort (cirka 20 ord; "Helt fint, Ane klarer sig nok. Men Møllerens ged snupper et hjørne af dit kort. Den ser meget tilfreds ud." er 20). Giv biddet en synlig kant. |
| M17 | middel | Gætteren (1 s pr. tryk, terning 525) bliver den bedste, når han hjælper. Niveau 7½ efter 20 min mod 4½ (ærlig hjælper) og 3 (travl). Mester kl. 24:25. 612: Brøker 630/610 mod 390/260 for den ærlige 70 %-elev. Grænsen på en tredjedel ligger ved gættets forventning (spillet ser 28-41 %). Genåbner M7. | Ganita: en quest, der har hvilet, bør kræve mestring (3 af 3), før den giver et halvt niveau, eller 2 af 3 kun gælde første forsøg. Grænsen i rygsækken skal over en tredjedel for at ramme gætteren (fx 40 %, som stadig er under den svage ærliges 42-43 %), men det er tæt; Marc vælger. |

**Lukket:** M13 (den ærlige 70 %-elev ser ikke "står stille" efter 612) og M14 for den svage ærlige (612).

**Genåbnet:** M7 (gætteren over den, der regner), nu som M17.

**Står som Marcs valg:** M2 (nu opfyldt, se første linje), N1 A+ (titler, der kræver hjælp, er ikke bygget), M4, M5, M11 og N8.

## Ærlige grænser

- **Kun min model-elev, ikke et barn.** Gætteren trykker hvert sekund i 40 minutter (554 opgaver). Et rigtigt barn gør det næppe så længe. Men han viser, hvor spillet kan farmes.
- **Min læser læser alt,** også den sjove linje. Ganitas læste den ikke. Et barn ligger et sted imellem.
- **Terninger:** 525, 731 og 311 for 70 %-eleven; 525 for den svage; 525 og 731 for gætteren. Tallene svinger meget med terningen (gætteren: 7½ mod 1).
- **1280** kun for 525 og 731 (70 %). Den svage og gætteren kun på 390.
- **Sidens "Rigtigt!"** er kun talt i de fire kørsler i gruppe d (20 min). De andre bruger min facit.
- **612 blev merget, mens jeg målte.** Kørslerne på `26c3a37` gælder for `main` `42e0ae2`, for koden er den samme.
- **Gedebiddet og bierne** er vurderet på Ganitas skærmbilleder og mine tal, ikke med et barns øjne. Duerne er ikke set.
- **Headless Chromium på Windows,** ikke en telefon eller skole-pc.
- **Kun syntetiske elever** ("Tulle"). Matematik-træet er ikke rørt, og intet er pushet.
