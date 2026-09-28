doedloeft-artiklen klar naar Marc har svaret: ja. baenk-artiklen klar naar Marc har svaret: ja.

Begge ja. DA1-DA3 og BA1-BA2 er rettet, som jeg bad om i 568 og 572, og ingen af rettelserne har gjort et tal forkert. Af de mindre fund er DA4-DA6, DA8, DA10, DA12, BA3-BA7 og BA9 lukket. Tilbage er kun det, der aldrig var Setus i denne ordre: DA7 (Yantra), DA9/BA8 (Mål dit billede fra main) og DA11/BA10 (tabellerne ruller i boksen på telefonen). Læsesiden er ordret ens med de to grene.

To nye små ting, begge lave og ingen af dem i artiklerne:
- **DA13:** sidetallene i Setus rapport og uddrag er én for lave.
- **DA14:** løftmodellens uddrag af regelbogen mangler stadig de to sætninger.

# Kritik 582, blok 1: dødløft- og bænkartiklen efter Setus 575

Bhishak, 28. sep 2026. Ordre 582.
- `artikel-doedloeft` @ `1c85d55` og `artikel-baenk` @ `d33a6f1` er hentet med `git archive` fra `entropi-coaching-site-wt2`. Jeg har ikke skiftet gren dér; den står på `vaerktoejer`.
- Løftmodellens `dist`, `src`, `kroppe` og `docs` er hentet fra `main` @ `cc4dd7d`. Main indeholder `37c9a27`, og fejlsiden, figurerne, tre-løft, Min krop, litteraturen og bænkmodellen er uændrede siden. Kun Mål dit billede er flyttet (571).
- `C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html`, Setus `RAPPORT-575.md` og `ipf-2026-uddrag.txt` er kun læst.
- IPF Technical Rulebook 2026 v3 er hentet som PDF fra powerlifting.sport til en midlertidig mappe og læst med `pdftotext`. Sha256 er `cf3aac6c…`, og PDF'en ligger ikke i repoet.

## Hvad jeg målte

`outputs/kritik-582/artikler-582.mjs` → `artikler-582.json` og `A-*.png`. **35/35** tjek er grønne.
- **Hvert DA og BA:** holdt op mod grenen, mod fejlsiden og figurerne på main, og mod regelbogens PDF. BA1's centimeter er regnet i bænkmodellen på main (`baenkStillinger`, `kroppe/marc.json`).
- **Hvad 575 ellers har rørt:**
  - Dødløftet: 20 linjer ind og 19 ud i artiklen og kun det fælles stilark derudover.
  - Bænken: 14 ind og 13 ud.
  - Jeg har læst hver ændret linje (`git diff --word-diff`). Resten af teksten er den, jeg holdt op i 568 og 572.
- **Læsesiden:** alle tekstblokke i begge artikler (p, li, figurtekst, celler, overskrifter, folde) sammenlignet med læsesidens to artikler, begge veje. De 18 "Står i teksten" er sammenlignet med artiklernes [MARC].
- **Siderne:** headless Chromium på 390 (touch) og 1280 (mus), alle folde åbne. Kun `127.0.0.1` må svare; alt andet blokeres og tælles.

## Dødløftet

**DA1 er lukket.** Kapitel 7 er fejlsiden på main:
- **Tabellerne:** begge tabeller, 7 rækker, har fejlsidens tal. Knæet står i ord: "vil bøje mindre" og "skifter retning" ved skinnebenet, "vil strække mere" ved stangen frem.
  - Ingen knæprocent er tilbage (−92, +102, +132, +162).
  - "Stang fra midtfod" er taget ud af den anden tabel.
- **Billedteksterne:** de tre sætninger står ordret på fejlsiden, også "modellen kan ikke sige hvor" og forbeholdet om ryggen.
- **Sætningen om bagud** (halvvejs +24 % / +57 %) står ordret, som på fejlsiden.
- **Svar-linjerne** siger det samme som fejlsiden: "momentarmen om hofte, lænd og knæ" og "fra bag midtfoden frem mod forfoden". Fejlsiden har 2,5 cm bag og 2,0 cm foran.
- **Intet af 476-teksten er tilbage:** "flytter ofte også kroppen", "hvert leds", "fra hælen frem mod tæerne", "lade skulderen glide" og "holder op med at hjælpe" er væk.
- **Én forskel er tilbage:** i tabellernes modelrække står knæet som "0 %", hvor fejlsiden har en streg. Det er ændringen fra modellen til sig selv, så det er rigtigt. Det er ikke et fund.
- **Skærmbillede:** `A-390-dl-kap7-tabel.png`.

**DA2 er lukket.** "10-15 %" står tre steder, og alle tre siger nu "for det målte træk i kapitel 6 (et skøn)". Kapitel 1 siger "end det målte træk i kapitel 6", og "et rigtigt løft" står ingen steder.
- **Setus spørgsmål:** kan mit skøn fra 457 bære det? Ja. Skønnet var for et løft som klippet, og main skriver det selv som "(et skøn: 10-15 %)".
- **Kapitel 3:** folden siger "fordi modellens ryg er mere vandret end dér (11° ved gulvet, 8° ved knæet)". Det er forskellen 61 − 50 og 53 − 45 fra kapitel 6, så den peger på det rigtige.
- "Sandsynligvis ... (et skøn)" er to forbehold i samme sætning. Det er ærligt og ikke forkert.

**DA3 er lukket.** Forbeholdets sidste bisætning er taget ud. Nederst i forbeholdet står nu `dl-2 afledt`: "hvad det målte træk siger (om modellens grænser, eller om hvordan et konventionelt træk bør se ud), skrives her ud fra svaret på 2".
- **Setus spørgsmål:** er det det rigtige sted? Ja. Forbeholdet slutter nu med "ét klip, én krop og én gentagelse" (`A-390-dl-forbehold.png`), og det er sandt uanset Marcs svar.
- Markeringen står lige under forbeholdet, hvor sætningen skal ind, og er skjult for læseren.

**De mindre:**
- **DA4:** titlen er markeret `dl-1 afledt` lige under overskriften. Markeringen nævner, at "individuel variation i trækket" også står i beskrivelsen, delingstitlerne og JSON-LD. Alle fire steder er fundet.
- **DA5:** "Læner løfteren sig en smule tilbage, er hoftemomentet næsten nul."
- **DA6:** svar-linjen siger "ca. 4 cm" (main: 4,2).
  - Overskriften "Stangen 3-4 cm foran midtfoden" og dl-2's "3-4 cm" er stadig der.
  - Det er rigtigt: de handler om klippet (3,8 cm ved gulvet), ikke om modellen. Jeg har holdt dem op, før jeg lod dem stå.
- **DA8:** ingen interne navne eller ordrenumre i artiklens html eller i `artikel-doedloeft.css`.
  - Squat-stilarkene har dem stadig: `artikel-skabelon.css` 1 og `artikel-opslag.css` 19.
  - `artikel-skabelon.css` er allerede på sitets main.
  - Setu har ret i, at de hører til squat-udgivelsen.
- **DA10:** læsesiden er bygget fra grenene. Se nedenfor.
- **DA12 er lukket:** sætningen står ordret i regelbogen, 4.3 pkt. 4: "If the bar settles as the shoulders come back (slightly downward on completion) this should not be reason to disqualify the lift."
  - Lockoutfoldens danske tekst siger det samme.
  - Kildelinjen "4.3, punkt 2 til 4, og 4.3.1, punkt 1 til 4" passer: 4.3.1 pkt. 1-4 er "downward movement", "stand erect", "lock the knees" og "supporting the bar on the thighs".
  - Det var et hul i løftmodellens uddrag, som jeg skrev i 568, ikke i artiklen.

**Tilbage, men ikke Setus i denne ordre:**
- **DA7:** tre-løfts linje på main siger stadig "hoften bøjer 8° mindre ved opstillingen (51° → 60°)".
- **DA9:** Mål dit billede på grenen er ikke main.
- **DA11:** begge tabeller i kapitel 7 er 480 px i en boks på 318 px på 390 og ruller selv. Siden gør det ikke.

## Bænken

**BA1 er lukket.** Modellen på main giver stadig stangen 22,1 / 25,1 / 24,1 cm mod fødderne ved lille, middel og stor bue. Teksten siger nu: "Fra lille til middel bue rører stangen 3 cm længere mod fødderne, og fra middel til stor 1 cm nærmere halsen."
- **Halvsætningen i bp-5** er taget ud, ordret ens på grenen og på læsesiden.
- **De tre gamle "længere mod fødderne"** er væk.
- **Vip-afsnittet** siger "modellens middel bue". Det passer, for vippet regnes oven på middel.
- **Setus spørgsmål:** er svar-linjen "Hvor stangen rører, flytter sig kun et par cm" rigtig nok? Ja.
  - Over hele spændet fra lille til stor er det 2,0 cm, og det største skridt er 3,0 cm.
  - Tallene står i afsnittet lige under, så svar-linjen behøver dem ikke (`A-390-bp-buen-svar.png`).
- Løftmodellens egen figurside siger stadig "med mere bue ligger det punkt højere og længere mod fødderne". Det er Yantras, ikke artiklens.

**BA2 er lukket.** Folden siger nu: "De 9 cm uden for hånden er et modelvalg og et skøn, ikke en måling." "Armen lignede ikke et bænkpres" og "8-10 cm ud er vurderet som tættere på, hvad man ser" er væk.
- **Setus spørgsmål:** er det nok, eller skal sætningen også markeres `bp-7 afledt`? Det er nok.
  - Sætningen siger nu kun noget om modellen, og intet om løftere, som Marc kan sige imod.
  - Svarer Marc "albuen inde" på 7, er folden stadig sand om modellen.
- **Sætningen bagefter:** "Med albuen lodret under hånden forfra stod den 21 cm mod fødderne fra siden" står nu uden sin begrundelse. Den er sand, bare lidt nøgen. Det er ikke et fund.

**De mindre:**
- **BA3:** læsesiden er bygget fra grenen.
- **BA4:** "I modellen lander stangen 10-15 cm nærmere halsen".
- **BA5:** titlen er markeret `bp-1 afledt`.
- **BA6 er lukket.** Regelbogen har ordret:
  - 4.2 pkt. 2: "Foot movement is permissible but must remain flat on the platform. During the set-up on the bench, the athlete is not allowed to place his/her feet on the bench."
  - 4.2.1 pkt. 2: "head, shoulders, or buttocks".
  - 4.2.1 pkt. 6: "the bar is touching the belt".
  - 4.2.1 pkt. 9: "Any contact of the lifter's feet with the bench or its supports ... Foot movement is permissible but must remain flat on the platform".
  - Artiklens danske tekst og kildelinjer passer med dem.
- **BA7:** ingen interne navne i bænkartiklens html. Stilarket er samme blob på begge grene (`89383080`), så de to grene giver ingen konflikt ved merge.
- **BA9:** "grebet kan flytte sig med albuen".

**Tilbage, men ikke Setus i denne ordre:**
- **BA8:** Mål dit billede fra main.
- **BA10:** alle 5 tabeller ruller i boksen på 390.

## Læsesiden

Læsesiden er ordret ens med artiklerne:
- **Tekstblokkene:** alle 417 i dødløftet og 326 i bænken står ordret i læsesidens to artikler.
- **Ud over dem** har læsesiden kun sine egne noter:
  - overskriften
  - én note med grenens hash (`1c85d55` og `d33a6f1`, "uden ændringer")
  - "Læsesiden: figuren kan indstilles på sitet. Her står den, som den åbner." under hver indlejret figur
- **Spørgsmålene:** de 18 "Står i teksten" er ordret artiklernes [MARC], nu med nummeret.
- **Intet fra kladden er tilbage:** hverken "opdigtet referencekrop", "90° ud", "ca. 44 %", "54 % mindre", "60,9°" eller "(Ordre 468)".
- **Forslagene** til dødløft 2 og bænk 7 er rimelige:
  - 2 henviser nu til den markerede sætning nederst i artiklen.
  - 7 kalder de 9 cm et modelvalg og et skøn, som folden.
- **Siden på 390 og 1280:** ingen sidelæns rulning, 0 tankestreger, 0 atletnavne, 0 JS-fejl, og intet går ud af huset ud over skrifterne.

## Marcs stilregler og siden

| Regel | Dødløft 390 | Dødløft 1280 | Bænk 390 | Bænk 1280 |
|---|---|---|---|---|
| Tankestreger i den synlige tekst, alle folde åbne | 0 | 0 | 0 | 0 |
| Synlige `[MARC` | 0 | 0 | 0 | 0 |
| [MARC] uden `skjul-marc` (stadig uden sidelæns rulning) | 14 | 14 | 11 | 11 |
| Atletnavne / interne navne i den synlige tekst | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Sidelæns rulning | nej | nej | nej | nej |
| JS-fejl / 404 / brudte billeder | 0 / 0 / 0 af 17 | 0 / 0 / 0 af 17 | 0 / 0 / 0 af 13 | 0 / 0 / 0 af 13 |
| Forsøg på at gå ud af huset | kun skrifterne | kun skrifterne | kun skrifterne | kun skrifterne |

[MARC]-tallene er 12 + to nye afledte (dl-1 og dl-2) i dødløftet og 10 + én ny afledt (bp-1) i bænken.

Læsetiden er stadig rigtig:
- **Dødløftet:** 2348 ord, altså 18,1 min ved 130 ord i minuttet. Siden siger 18.
- **Bænken:** 2268 ord, altså 17,4 min. Siden siger 17.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| DA1-DA6, DA8, DA10, DA12 | | Lukket (se ovenfor). | |
| DA7 | lav | Stadig åben: tre-løfts linje "8° mindre (51° → 60°)" på main. | Yantra. |
| DA9 | lav | Stadig åben: Mål dit billede på grenen er ikke main. Main har nu også 571. | En egen ordre til Setu, når Mål dit billede er klar (blok 2). |
| DA11 | lav | Stadig åben: kapitel 7's tabeller ruller i boksen på 390 (480 mod 318 px), nu med 6 kolonner i stedet for 7. | Kan vente til udgivelsen. |
| DA13 | lav | Setus sidetal er én for lave. Setu skriver 4.3 pkt. 4 "s. 24" og 4.2.1 "s. 22-23", men PDF'ens trykte sidetal er 25 og 24. 4.2 står på s. 22. Sidetallene står kun i Setus rapport og uddrag, ikke i artiklerne. Uddragets 40 linjer står alle ordret i PDF'en. | Ret sidetallet i uddraget, hvis det skal bruges igen. |
| DA14 | lav | Løftmodellens `docs/doedloeft-litteratur.md` har stadig ikke "If the bar settles ...", og `docs/baenk-litteratur.md` har ikke "Foot movement is permissible ...". Artiklerne er rigtige, men den næste, der tjekker mod løftmodellens uddrag, finder det samme hul som jeg i 568 og 572. | Yantra: tilføj de to sætninger fra PDF'en. |
| BA1-BA7, BA9 | | Lukket (se ovenfor). BA3 er lukket med læsesiden. | |
| BA8 | lav | Stadig åben, som DA9. | Som DA9. |
| BA10 | lav | Stadig åben, som DA11. | Som DA11. |

Ingen middel eller høj. Artiklerne mangler nu kun Marcs 18 svar og de tre afledte, der skrives ud fra svar 1 og 2.

## Ærlige grænser

- **Tallene:** jeg har regnet BA1's centimeter i modellen igen og holdt kapitel 7 op mod fejlsiden. Resten af tallene har jeg ikke regnet igen. De står i linjer, som 575 ikke har rørt, og som jeg holdt op i 568 og 572.
- **Regelbogen:** jeg har brugt samme PDF som Setu (v3), hentet nu, og kun læst afsnit 4.2, 4.2.1, 4.3 og 4.3.1. Om IPF har lagt en nyere version ud, har jeg ikke undersøgt.
- **Mine egne vurderinger:**
  - "Kun et par cm" er rigtig nok (2,0 og højst 3,0 cm).
  - "Et modelvalg og et skøn" er nok uden markering.
  - `dl-2 afledt` står det rigtige sted.
  - Alle tre er mine læsninger, ikke Marcs.
- **Browseren:** kun headless Chromium på Windows. Ingen rigtig telefon, og skrifttypen er blokeret, så linjeskiftene kan flytte sig lidt med den rigtige skrift.
- **Trærne:** intet er rørt i sitet, i løftmodellen eller på skrivebordet.
