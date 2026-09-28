baenk-artiklen klar naar Marc har svaret: nej

Nej, men kun lige. Hvert tal i artiklen er regnet igen i løftmodellens egen kode på `main` (`37c9a27`), og alle passer. Det gælder også dem, Setu ikke kunne tjekke: centimetrene over skulderen, albuevinklerne og Nm for de ni kombinationer og kropstyperne. De 12 figurer er dist med kun navnet skiftet, kapitel 7 er fejlsiden efter 493, og de 8 spørgsmål står ordret og de rigtige steder. Siden holder på 390 og 1280 px uden net.

To ting skal rettes, før artiklen er rigtig i alt andet end Marcs svar (BA1-BA2, middel). Ingen af dem kræver Marc; det er en lille ordre til Setu:
- **BA1:** "mere bue ... længere mod fødderne" passer kun fra lille til middel bue. Fra middel til stor rører stangen 1,0 cm nærmere halsen.
- **BA2:** "8-10 cm ud er vurderet som tættere på, hvad man ser" er min dom fra 457. Den står umarkeret lige over bp-7, som spørger Marc om netop det.

# Kritik 572, blok 1: bænk-artiklen efter Setus 566

Bhishak, 28. sep 2026. Ordre 572.
- Grenen `artikel-baenk` @ `fb0cefa` er hentet med `git archive` fra `entropi-coaching-site-wt2`. Grenen er ikke skiftet.
- Løftmodellens `dist`, `src`, `kroppe` og `docs` er hentet fra `main` @ `37c9a27` (565 er merget efter `ede9fd0`; det rører kun Mål dit billede).
- `C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html` og Setus `RAPPORT-566.md` er kun læst.

## Hvad jeg målte

`outputs/kritik-572/baenk-572.mjs` → `baenk-572.json` og `B-*.png`. **31/31** tjek er grønne. Et grønt tjek på et fund betyder, at fundet er, som jeg beskriver det.
- **21 tal-sætninger:** hver står ordret i artiklen, og tallet er regnet af modellen selv: `baenkStillinger` og `baenkKrop` for referencekroppen (`kroppe/marc.json`, 183 cm), `beregn` i `treLoeft.js` for kropstyperne. Kapitel 7 er holdt op mod `dist/loeft-fejl`, buen som vip mod 554's tabel i `docs/FEJLGENKENDELSE.md`, og guard'en i Mål dit billede mod koden.
- **De 12 figurer:** token for token mod dist.
- **De 8 spørgsmål:** mod læsesidens "Står i teksten" (felt 11-18).
- **Siden:** headless Chromium på 390 (touch) og 1280 (mus), alle folde åbne. Kun `127.0.0.1` må svare; alt andet blokeres og tælles.

## Tallene og figurerne

**Tallene passer med main.** Også de tal, Setu skrev, at han ikke kunne tjekke:
- **Kapitel 1:** 17,5, 38,4 og 59,3 cm over skulderen; 25,1 og 0,8 cm fra lodlinjen; underarmen ca. 11° (10,7°) ved brystet og ca. 25° og 40° (25,1° og 40,3°) midt i opturen; 139/24, 66/91 og 65/−29 Nm.
- **Foldene:** 21,3 → 18,6 cm (dag 60), højst 60° med bredt greb og albuen 6,7 cm ud.
- **Kapitel 4 (Setus fjerde spørgsmål):** albuen 59,4° og 72,2° mod 66,4° og vejen +6,1 cm (40,1 → 46,2) er modellens tal i dag, ikke kun kladdens fra 468. Tre-løft på grenen viser de samme albuevinkler.
- **Kapitel 5:** brystets top 7,7 cm højere, −23 %, +7 %, +11 %, −9 %, +30 %, 7,6 → −0,6 cm og 10° → 48°. De ni kombinationer med Nm og albuevinkel står alle i modellen, og 1,5 cm under skulderen passer.
- **Buen som vip (Setus første spørgsmål):** −1,1, 1,7 og 6,2 cm er 554's tal for 183 cm og 120 kg. Det er `kroppe/marc.json`, altså samme krop som bænkfigurerne; kun længderne indgår. Guard'en i Mål dit billede er 5 cm over skulderen både på grenen og på main.
- **Kapitel 7 (Setus andet spørgsmål):** 80°, 9,8 cm, 54°, 5,0 → 22,4 cm, ×4,5 og +1,0 cm; 15,0 cm, 52°, 21,2 cm, ×4,3 og +2,6 cm. Alle 8 tabelrækker er fejlsidens, og ingen skulderprocent er tilbage.

**Men de to sætninger om buen (Setus første spørgsmål) passer ikke helt sammen, og den første er forkert (BA1).** I modellens egne buefigurer rører stangen 22,1, 25,1 og 24,1 cm mod fødderne fra skulderleddet. Skulderens arm i alt er 25,8, 28,4 og 27,6 cm. Fra middel til stor bue flytter stangen altså 1,0 cm mod halsen, også uden vippet. Det ses på `B-390-buen-figurer.png`. Artiklen siger tre steder, at mere bue lader stangen røre længere mod fødderne: under "Buen", i figurteksten og i bp-5. Skrives det rigtigt, hænger vip-afsnittet bedre sammen med figurerne: begge viser, at en stor bue kan trække stangen mod halsen.

**Figurerne:** alle 12 har samme antal elementer som dist. Kun `svg`-overskriften, `title` og `desc` er skiftet, og kun fra "Marcs mål i modellen" til "183 cm i modellen". Ingen figur har "Marc" tilbage, og alle 13 billeder har alt-tekst.

## Kilderne

- **Bartolomei m.fl. (2024), Larsen m.fl. (2020) og Mausehund m.fl. (2022)** siger det, artiklen bruger dem til, ifølge `docs/baenk-litteratur.md`:
  - kortere lodret vej med buet ryg
  - "wide and medium grip widths produced greater horizontal shoulder moments than the narrow"
  - sidelæns kræfter i hænderne
  - Artiklen bruger kun retningen, som kilderne kan bære. Bartolomeis tal er i løftmodellens uddrag læst fra en gengivelse af resultaterne, ikke fra PDF'en; artiklen bruger ingen af dem.
- **IPF 2026, afsnit 4.2 og 4.2.1:** Kapitel 1's to "Reglen"-folde er dækket af uddraget: 4.2 pkt. 2, 5, 6-8, og 4.2.1 pkt. 3, 4, 5, 7 og 11.
  - Kapitel 2's fold nævner 4.2.1 pkt. 2 og 9 og siger "fødderne må flytte sig, men skal blive flade, og de må ikke røre bænken". Kapitel 1's fold nævner pkt. 6. Ingen af dem står i løftmodellens uddrag (BA6).
- **Kildelinjerne** er "Modellens tal.", "Modelvalg.", "Modelgrænse." og "Løftmodellens dokumentation.". Der er ingen ordrenumre eller agentnavne i den synlige tekst.
- **Mål dit billede (Setus tredje spørgsmål):**
  - Kapitel 6's "ét stillbillede fra siden ... med stangen på brystet og midt i opturen" og kapitel 7's "holder et billede fra siden med stangen på brystet op mod de to fejl; fra siden ser de ens ud" er rigtige om værktøjet. De siger ikke, at det finder fejlen, så vejledningens betingelser behøver ikke stå der.
  - Kapitel 5's grænse på 5 cm er værktøjets egen.
  - Værktøjet på grenen er dist fra `346f791`, ikke main (BA8).

## [MARC]-stederne

**De rigtige steder:**
- Der er 10 steder: `bp-1` til `bp-8` én gang hver og to afledte.
- Hver af de 8 er ordret "Står i teksten" på læsesiden, med nummeret sat ind efter "MARC".
- Hvert spørgsmål står ved det, det spørger om: 4 ved brystet, 7 midt i opturen, 8 ved segmentmodellen, 5 ved buen, 6 ved grebet, 3 ved fejlene, 2 i kapitel 8.
- Uden `skjul-marc` ses alle 10, stadig uden vandret rulning.

**Holdninger i Marcs navn uden hans svar:**
- **Albuens stilling midt i opturen (BA2).** Folden under kapitel 1 siger: "8-10 cm ud er vurderet som tættere på, hvad man ser".
  - Det er min dom fra 457. Løftmodellens kode siger det selv: "Tallet er Bhishaks (457), ikke en måling". Læsesiden skriver også "Bhishak, kritik 457 (N1)" ved sætningen.
  - I artiklen står den umarkeret som en iagttagelse af løftere, lige over bp-7: "vil du se albuen inde ved kroppen hele vejen, eller lader du den gå ud på vej op?". Svarer Marc "inde", siger folden ham imod.
- **Kapitel 7's overskrift** siger "I bænken lander stangen 10-15 cm nærmere halsen". Det er fejlenes valgte størrelse, ikke noget, der sker i bænken (BA4).
- **"En løfter flytter ofte grebet med albuen"** (kapitel 7) er en coachingerfaring. Den står på fejlsiden på main, så den er ikke ny; men i Marcs artikel er det hans erfaring, der siges (BA9).

**Mangler der et?** Titlen "individuel variation" står umarkeret og forudsætter lidt af svaret på bp-1 (BA5); Setu har selv set det. Ellers mangler der intet:
- Forbeholdets sidste sætning ("Modellen siger noget om, hvad bue, greb og albue flytter, ikke om hvordan et bænkpres bør se ud") handler om modellen og svarer ikke på et af de 8 spørgsmål. Det er ikke som dødløftets DA3.
- Kapitel 8's sætning om modelobservationer og coach-dom er ikke en holdning.

## Marcs stilregler og siden

| Regel | 390 | 1280 |
|---|---|---|
| Tankestreger i den synlige tekst, alle folde åbne | 0 | 0 |
| Synlige `[MARC` eller `[ ]` | 0 (alle 10 skjult) | 0 |
| Atletnavne (fra appens `.gitignore`) | 0 | 0 |
| Interne navne og ordrenumre i den synlige tekst | 0 | 0 |
| "man skal" | 0 | 0 |
| Vandret rulning | nej | nej |
| JS-fejl / 404 | 0 / 0 | 0 / 0 |
| Billeder vist / brudte | 13 / 0 | 13 / 0 |
| Rammerne (tre-løft, Min krop) | 810 og 1011 px med indhold | 857 og 1076 px |
| Forsøg på at gå ud af huset | kun Google Fonts (blokeret) | kun Google Fonts |
| Sidens længde med alle folde åbne | 34,5 skærme | 24,2 skærme |

- **Andre stilregler:** ingen dramatisk åbning (den er Marcs, bp-1), og forbeholdet står kun nederst, før referencerne.
- **Læsetiden:** 2266 ord uden folde og uden `.marc` er 17,4 min ved 130 ord i minuttet. Siden siger 17.
- **Tabellerne på telefonen:** alle 5 er 480 px i en boks på 318-347 px og ruller selv; siden gør det ikke. Også oversigten med kun 3 kolonner ruller, fordi bredden er fast (BA10).
- Foldenes knapper er 44-48 px.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| BA1 | middel | "Med mere bue kommer brystets top højere op og længere mod fødderne" og "stangen rører længere mod fødderne" passer kun fra lille til middel bue. Modellen har stangen 22,1 / 25,1 / 24,1 cm mod fødderne og skulderens arm 25,8 / 28,4 / 27,6 cm. Fra middel til stor bue flytter stangen 1,0 cm mod halsen, og skulderens arm bliver kortere. Samme sætning står i bp-5 ("fordi stangen rører længere mod fødderne") og på løftmodellens egen figurside. | Skriv: fra lille til middel bue rører stangen 3 cm længere mod fødderne, fra middel til stor 1 cm tilbage mod halsen. Tag halvsætningen ud af bp-5 både i artiklen og på læsesiden, så de stadig er ordret ens. Yantra kan rette figursiden. |
| BA2 | middel | "8-10 cm ud er vurderet som tættere på, hvad man ser" (folden "Albuens stilling") er min dom fra 457, skrevet som en iagttagelse af løftere. Den står umarkeret lige over bp-7, der spørger Marc om albuen på vej op. | Skriv det som et modelvalg uden iagttagelse ("9 cm er et skøn, ikke en måling"), eller markér sætningen `bp-7 afledt`. |
| BA3 | lav | Læsesiden, som Marc svarer fra, viser bænkartiklen fra `baenk-kladde` (`19e41ee`): 90° ud, "ca. 16 cm", 55°, 22,5 cm, "Skulderens arm falder ... ca. 44 %" og "opdigtet referencekrop". Spørgsmålene er de samme, så svarene rammes ikke. Men det, Marc læser om kapitel 7, er fra før 493. | Setu: byg læsesidens bænkdel fra `artikel-baenk`, som DA10 for dødløftet. |
| BA4 | lav | Kapitel 7's kropssætning siger "I bænken lander stangen 10-15 cm nærmere halsen". Det er fejlenes valgte størrelse (9,8 og 15,0 cm); tabellerne går fra 5,4 til 20 cm. | "I modellen lander stangen ..." |
| BA5 | lav | Titel, beskrivelse, `og:`- og `twitter:`-titler og JSON-LD siger "individuel variation" umarkeret. Det passer med bp-1 a/b, ikke c. | Giv titlen `data-marc="bp-1 afledt"`, som DA4. |
| BA6 | lav | Kapitel 1 nævner 4.2.1 pkt. 6. Kapitel 2 nævner pkt. 2 og 9 og "fødderne må flytte sig, men skal blive flade, og de må ikke røre bænken". Ingen af dem står i løftmodellens uddrag i `docs/baenk-litteratur.md`. | Setu slår dem op i regelbogen (s. 21-23), som DA12. |
| BA7 | lav | Kildekoden har interne navne og ordrenumre i kommentarer: "Bhishaks dom (Ordre 457)", ORDRE 482/566 og `// Ordre 405`. | Fjern dem ved udgivelsen, som DA8. |
| BA8 | lav | Mål dit billede på grenen er dist fra `346f791`; `index.html` og `maal-billede.js` afviger fra main (560, 563, 565). Guard'en på 5 cm er den samme. | En egen ordre, som DA9. |
| BA9 | lav | "En løfter flytter ofte grebet med albuen" er en coachingerfaring i Marcs artikel. Den er fejlsidens på main. | Skriv "grebet kan flytte sig med albuen", eller lad Marc stå for "ofte". |
| BA10 | lav | Alle 5 tabeller ruller i boksen på 390, også oversigten med 3 kolonner. | Lad oversigten være så smal, som den kan. |

Rettes BA1-BA2, er dommen ja. BA3-BA10 kan tages samtidig, men de gør ingen tal forkerte.

## Ærlige grænser

- **Tallene:** jeg har regnet modellen på main igen. Er modellen forkert, er artiklen det også; det har jeg ikke vurderet her.
- **"9 cm giver ca. 70° ud"** med bredt greb er ikke regnet igen. Kun loftet på 60° og de 6,7 cm er.
- **Kilderne:** Bartolomei, Larsen, Mausehund og IPF er tjekket mod løftmodellens uddrag, ikke mod PDF'erne (uden net). BA6 kan derfor være et hul i uddraget og ikke i artiklen.
- **"Holdning i Marcs navn"** er min læsning. BA2 er min egen sætning fra 457, som jeg nu siger ikke skal stå umarkeret.
- **Browseren:** kun headless Chromium på Windows. Ingen rigtig telefon, og skrifttypen er blokeret, så linjeskiftene kan flytte sig lidt med den rigtige skrift.
- **Trærne:** intet er rørt i sitet, i løftmodellen eller på skrivebordet.
