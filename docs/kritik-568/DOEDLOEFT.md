doedloeft-artiklen klar naar Marc har svaret: nej

Nej, men kun lige. Alle tal i brødteksten, billedteksterne og foldene står i løftmodellens main (`ede9fd0`), og alle 17 figurer er dist's med kun navnet skiftet. Kildelinjerne siger det, kilderne siger. De 10 spørgsmål står de rigtige steder og ordret som på læsesiden. Siden holder på 390 og 1280 px uden net.

Tre ting skal dog rettes, før artiklen er rigtig i alt det andet (DA1-DA3, middel). Ingen af dem kræver Marc; det er en lille ordre til Setu, som kan gå samtidig med svarene:
- **DA1:** kapitel 7 følger fejlsiden fra før løftmodellens 493.
- **DA2:** skønnet "10-15 % for høje" gælder et løft som det målte, ikke "et rigtigt løft".
- **DA3:** forbeholdets sidste sætning svarer på dl-2, før Marc har svaret.

# Kritik 568, blok 1: dødløft-artiklen efter Setus 561

Bhishak, 28. sep 2026. Ordre 568.
- Grenen `artikel-doedloeft` @ `1793972` er hentet med `git archive` fra `entropi-coaching-site-wt2`. Grenen er ikke skiftet.
- Løftmodellens `dist` er hentet fra `main` @ `ede9fd0`, og `docs/` er læst med `git show`.
- `C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html` er kun læst.

## Hvad jeg målte

`outputs/kritik-568/doedloeft-568.mjs` → `doedloeft-568.json` og `D-*.png`. **29/29** tjek er grønne. Et grønt tjek på et fund betyder, at fundet er, som jeg beskriver det.
- **21 tal-sætninger:** hver står ordret i artiklen, og tallet står i dist på main (`doedloeft-figurer`, `marcs-doedloeft`, `loeft-fejl`) eller i `docs/doedloeft-litteratur.md`.
- **Kapitel 4:** mod tre-løft på main i browseren.
- **De 17 figurer:** token for token mod dist.
- **De 12 [MARC]-steder:** mod læsesidens "Står i teksten".
- **Siden:** headless Chromium på 390 (touch) og 1280 (mus), alle folde åbne. Kun `127.0.0.1` må svare; alt andet blokeres og tælles.

## Tallene og figurerne

**Tallene passer med main.** Det gælder alle tal, jeg har holdt op:
- **Kapitel 1:** opstilling, knæhøjde og lockout (vinkler, 22,5/52,1/79,8 cm, momentarme og Nm, skulderen 5 og 12 cm, 264 Nm ved lockout).
- **Kapitel 3:** 0,73 mod mit overslag 0,71, og skulderens 132 Nm (= 270 kg · 9,81 · 5 cm).
- **Kapitel 5:** 85 cm og 40°, 50° mod 61°. 14-15 % og 17-21 % er regnet efter: 13,7/14,7 og 16,6/21,1 %. Vejen er 49,4 mod 57,3 cm.
- **Kapitel 6:** de fem tabeller og 4 af 22. Stangen frem: 8-9 %, 68° → 59°, 4,9 → 0,4 cm bag og 0,1 foran, og 0,3-0,4 cm for kropsvægten.
- **Kapitel 7:** 11,9 cm, 14°, +12/+13 %, anklen −20 %, 4 cm fri, 6,1-6,5 cm, +16/+35 %, armen −54 % og anklen +104 %.

**Kapitel 4 (Setus første spørgsmål)** er tre-løft på main:
- lange lårben 67,8° mod 61,5°
- lange arme 59,6° mod 51,4°, vejen 49,0 mod 55,0 cm, altså 6,0 cm kortere
- lang torso 91,0° mod 99,9°

Tre-løfts egen linje under figuren siger "hoften bøjer 8° mindre (51° → 60°)". Det er tre-løfts afrunding, ikke artiklens (DA7). Tre-løft og Min krop på grenen er samme bytes som dist på main.

**Figurerne (Setus fjerde spørgsmål):** alle 17 har samme antal elementer som dist. Kun disse er skiftet:
- `svg`-overskriften, `title` og `desc`
- "Marcs mål" til "183 cm og 120 kg", og "Marcs klip" til "klippet"
- lockoutmomentet i de to lockoutfigurer til "moment: ikke vist, se teksten"

Ingen figur har "Marc" tilbage. "Armen, der holder stangen ind mod benene" siger det samme i tekst, tabel ("Armen") og figur ("armens tag −54 %"). Kapitel 7's sætning om, at armen slipper (Setus femte spørgsmål), er fejlsidens egen på main: "Når det slippes, flytter stangens vægt ud til hofte, lænd, knæ og ankel."

**Men kapitel 7's tabeller er ikke main (DA1).** Se Fund.

## Kilderne

- **Escamilla m.fl. (2001) (Setus tredje spørgsmål):** teksten siger "20 løftere i konventionel stil ved Special Olympics 1999 ... ca. 159° ± 6 ved knæpassagen". Det er, hvad kilden siger ifølge `docs/doedloeft-litteratur.md`, kilde 2: 40 løftere, 20 konventionelle, tabel 1, KP 159° ± 6.
  - Tallet kan blive, fordi folden siger, hvem der er målt, og kun bruger det til at sige, at 146° er et kompromis.
  - Løfterne er lettere og kortere end referencekroppen (76 kg, 167 cm, 138 kg på stangen). Det behøver folden ikke sige.
  - Men samme kilde har torsoen på 79° ± 7 fra lodret ved afsættet (11° fra vandret), altså **mere** vandret end modellens 61°. Det rammer DA2.
- **IPF 2026, afsnit 4.3 og 4.3.1:**
  - Opstillingsfolden er dækket af litteraturens uddrag: start, "any rising", fødderne og vippet mellem forfod og hæl.
  - Lockoutfoldens låste knæ, oprejst med skuldrene tilbage, deltamusklen, "Down" og lårstøtten er også dækket.
  - "Sætter den sig en smule, når skuldrene kommer tilbage, er det ikke en grund til underkendelse" står ikke i løftmodellens uddrag af 4.3/4.3.1 (DA12).
- **Kildelinjerne** er "Modellens tal.", "Modelvalg.", "Modelgrænse." og "Løftmodellens dokumentation.". Ingen ordrenumre eller agentnavne i den synlige tekst.
- **Mål dit billede i kapitel 6 og 7 (Setus andet spørgsmål):**
  - "holder et billede ved gulvet og ved knæhøjde op mod de samme to fejl, også i sumo" er rigtigt om værktøjet. Det siger ikke, at værktøjet finder fejlen, så vejledningens betingelser behøver ikke stå her.
  - Men værktøjet på grenen er dist fra `346f791`. Det er ikke main, som har video (560), Hop til (563) og rettelserne efter min 558 (DA9).

## [MARC]-stederne

**De rigtige steder:**
- Der er 12 steder: `dl-1` til `dl-10` én gang hver, og to afledte.
- Hver af de 10 er ordret "Står i teksten" på læsesiden, med nummeret sat ind efter "MARC".
- Hvert spørgsmål står ved det, det spørger om (4 ved opstillingen, 6 ved knæhøjde, 10 ved lockout, 8 ved kropstyperne, 7 ved sumo, 2 og 9 ved klippet, 5 ved fejlene, 3 i kapitel 8).
- Uden `skjul-marc` ses alle 12, stadig uden vandret rulning.

**Holdninger i Marcs navn uden hans svar.** Tre steder siger artiklen noget, som Marc selv skal afgøre eller kunne sige imod:
- **Forbeholdet** slutter: det målte træk "siger noget om modellens grænser, ikke om hvordan dødløft bør se ud". Det er svar c på dl-2 (Setus forslag). Svarer Marc a ("sådan skal et konventionelt træk se ud"), siger forbeholdet ham imod (DA3).
- **Kapitel 7's billedtekst:** "en løfter flytter ofte også kroppen for at holde balancen". "Ofte" er en coachingerfaring. Main har ændret den til "modellen kan ikke sige hvor" (DA1).
- **Kapitel 1's lockout:** "En løfter, der har låst, læner sig en smule tilbage". Sætningen står lige over dl-10, som spørger Marc om netop det at læne sig tilbage. Klippet i kapitel 6 står ved lockout med hoften på 172° og torsoen 3,5° (DA5).

**Mangler der et?** Titlen "individuel variation i trækket" står umarkeret, og den forudsætter svar a eller b på dl-1 (DA4). Setu har selv set det. Ellers mangler der intet: kapitel 8's to sætninger om modelobservationer og coach-dom er ikke holdninger.

## Marcs stilregler og siden

| Regel | 390 | 1280 |
|---|---|---|
| Tankestreger i den synlige tekst, alle folde åbne | 0 | 0 |
| Synlige `[MARC` | 0 (alle 12 skjult) | 0 |
| Atletnavne (fra appens `.gitignore`) | 0 | 0 |
| Interne navne og ordrenumre i den synlige tekst | 0 | 0 |
| Vandret rulning | nej | nej |
| JS-fejl / 404 | 0 / 0 | 0 / 0 |
| Billeder vist / brudte | 17 / 0 | 17 / 0 |
| Rammerne (tre-løft, Min krop) | 810 og 1011 px med indhold | 857 og 1076 px |
| Forsøg på at gå ud af huset | kun Google Fonts (blokeret) | kun Google Fonts |
| Sidens længde med alle folde åbne | 38,3 skærme | 26,3 skærme |

- **Andre stilregler:** ingen dramatisk åbning (den er Marcs, dl-1), intet "man skal", og forbeholdet står nederst før referencerne.
- **Læsetiden:** brødtekst, figurtekster og forbehold uden folde og uden `.marc` er 2346 ord, altså 18,0 min ved 130 ord i minuttet. Siden siger 18.
- **Tabellerne på telefonen:** alle 8 er bredere end boksen på 390 (480 mod 318-347 px) og ruller selv. Siden gør det ikke. I kapitel 7 er det netop kolonnerne Knæ og Armen, der ligger uden for skærmen (DA11, `D-390-kap7-knae-procent.png`).
- Foldenes knapper er 44-48 px.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| DA1 | middel | Kapitel 7 følger fejlsiden fra før løftmodellens 493 (`ae48739`). Tabellerne har knæet i procent: −92 % ved skinnebenet 7°, og +102/+132/+162 % ved stangen frem. Et "+132 %" læses som "knæet får mere at bøje", men det er strækmomentet, der vokser. Main siger det derfor i ord ("vil bøje mindre", "vil strække mere"). Billedteksten "en løfter flytter ofte også kroppen" er 476's; main siger "ligger et andet sted; modellen kan ikke sige hvor". Main har også sætningen om, at hofte og lænd får endnu mere at holde, hvis løfteren flytter sig bagud (halvvejs +24 % / +57 %); den mangler i artiklen. | Tag kapitel 7's tabeller, billedtekst og forbehold fra `dist/loeft-fejl/index.html` på main: knæet i ord, "modellen kan ikke sige hvor" og sætningen om bagud. |
| DA2 | middel | "Sandsynligvis 10-15 % for høje for et rigtigt løft" står tre steder: kapitel 1's fold "Ryggen", kapitel 3's fold og forbeholdet. Kapitel 1 skriver også "Modellen hælder torsoen mere end et målt træk". Skønnet er mit fra 457 og gælder "et løft som Marcs", altså klippet i kapitel 6. Main skriver "(et skøn: 10-15 %)". Den eneste kilde i artiklen (Escamilla) har torsoen på 79° ± 7 ved afsættet, mere vandret end modellen. | Skriv "for det målte træk i kapitel 6 (et skøn)" og "end det målte træk i kapitel 6". |
| DA3 | middel | Forbeholdets sidste sætning ("siger noget om modellens grænser, ikke om hvordan dødløft bør se ud") er svar c på dl-2. Den er ikke markeret. | Markér bisætningen som en del af dl-2 (afledt), og skriv den, når Marc har svaret. |
| DA4 | lav | Titel, beskrivelse, `og:`- og `twitter:`-titler og JSON-LD siger "individuel variation i trækket" umarkeret. Det passer med dl-1 a/b, ikke med c. | Giv titlen `data-marc="dl-1 afledt"` i Setus liste, så den tjekkes, når Marc har svaret. |
| DA5 | lav | "En løfter, der har låst, læner sig en smule tilbage, og så er hoftemomentet næsten nul" er min sætning fra 457. Den er skrevet som fakta om løftere, står over dl-10 og passer ikke med klippets lockout (hofte 172°, torso 3,5°). | Gør den betinget: "Læner løfteren sig en smule tilbage, er hoftemomentet næsten nul." |
| DA6 | lav | Kapitel 6's svar-linje siger, at krop og stang står over midtfoden "netop med stangen 3-4 cm foran". Main siger 4,2 cm, og ved 3 cm (kapitel 1's model) er tyngdepunktet 1,4 cm bag. | "med stangen ca. 4 cm foran midtfoden". |
| DA7 | lav | Tre-løfts linje under figuren i kapitel 4: "hoften bøjer 8° mindre (51° → 60°)". Afrundet ser det ud som 9°; de præcise tal er 51,4 → 59,6. Linjen står i løftmodellen, ikke i artiklen. | Yantra: regn forskellen af de viste, afrundede tal, eller vis én decimal. |
| DA8 | lav | Kildekoden har interne navne og ordrenumre i kommentarer: "Bhishaks dom (Ordre 457)", "Yantras", ORDRE 477/482/561 og `// Ordre 405`. De ses ikke på siden, men i kilden. Squat-artiklen har det samme i sine scripts. | Fjern dem ved udgivelsen, begge artikler. |
| DA9 | lav | Mål dit billede på grenen er dist fra `346f791` (`index.html` og `maal-billede.js` afviger fra main): uden video, Hop til og 558-rettelserne. | En egen ordre (Setus punkt 4). |
| DA10 | lav | Læsesiden, som Marc svarer fra, viser kladden på `baenk-kladde` (`19e41ee`), ikke `artikel-doedloeft`. Den har de gamle tal i kapitel 4 (60,9° og 6,9 cm), "skulderen ca. 54 % mindre", "opdigtet referencekrop" og "(Ordre 468)". Spørgsmålene er de samme, så svarene rammes ikke, men det Marc læser om kapitlerne, er forældet. | Setu: byg læsesidens artikel-del fra `artikel-doedloeft`, før Marc læser den. |
| DA11 | lav | Alle 8 tabeller ruller sidelæns i boksen på 390. I kapitel 7 er Knæ og Armen uden for skærmen. | Færre kolonner på telefonen, eller "Stang fra midtfod" ud af kapitel 7's tabel (den står i rækkens navn). |
| DA12 | lav | Lockoutfoldens "sætter den sig en smule, når skuldrene kommer tilbage, er det ikke en grund til underkendelse" står ikke i løftmodellens uddrag af IPF 2026, 4.3/4.3.1. Uddraget af 4.3.1 pkt. 1 slutter ved "final position". | Setu slår sætningen op i regelbogen (s. 24-25) eller tager den ud. |

Rettes DA1-DA3, er dommen ja. DA4-DA12 kan tages i samme omgang, men de gør ingen tal forkerte.

## Ærlige grænser

- **Tallene:** kun tallene i de 21 sætninger og kapitel 4 er holdt op mod main maskinelt. Resten har jeg læst mod dist med øjnene.
- **Kilderne:**
  - Escamilla og IPF er tjekket mod løftmodellens uddrag i `docs/doedloeft-litteratur.md`, ikke mod PDF'erne selv (uden net).
  - DA12 kan derfor være et hul i uddraget og ikke i artiklen.
- **Skønnene er mine:** "10-15 %" og 0,71 er mine skøn fra 457, ikke modellens.
- **"Holdning i Marcs navn"** er min læsning. Marc kan godt mene det, der står; pointen er, at det står, før han har sagt det.
- **Browseren:** kun headless Chromium på Windows. Ingen rigtig telefon, og skrifttypen er blokeret, så linjeskiftene kan flytte sig lidt med den rigtige skrift.
- **Trærne:** intet er rørt i sitet, i løftmodellen eller på skrivebordet.
