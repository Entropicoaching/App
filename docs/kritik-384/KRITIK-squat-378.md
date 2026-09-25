# Kritik af squat-opslagsværket efter 378, læst en sidste gang som coach

**Klar til Marc: nej, fordi tre fejl ses på to minutter lige der, hvor læseguiden sender ham hen: et fejlbillede viser forkerte momentarme (F4), et andet har en titel, der siger det modsatte af billedet og teksten (F6/A1), og det første og det sidste billede i kapitel 1 samt front squat og safety bar ligner ikke det, en coach ser på platformen (F1-F3), og det var netop hans indvending mod de gamle figurer.**

## Fundlisten

Alvor: **blokerer** (skal rettes før Marc læser), **vigtigt** (en coach mister tilliden eller tråden), **irriterer**, **kosmetisk**. F er figurfund (blok 1, `FIGURER-384.md`), A er tekstfund (blok 2, `ARTIKEL-384.md`), og Q er fundene fra 374.

| Nr. | Fund | Sted | Alvor | Hvem retter |
|---|---|---|---|---|
| F4 | Mærkerne i "Stangen foran midtfod" siger knæ 21,4 og hofte 20,5 cm, samme tal som referencen, selvom stangen er flyttet 5 cm, og tabellen siger ±49 Nm | Kap. 7 | **blokerer** | Yantra (SVG) eller Setu (beskæringsscriptet) |
| F6 + A1 | "Skinnebenet presset forbi ankelgrænsen": titlen og første sætning siger, at skinnebenet går for langt frem. Figuren og andet afsnit siger, at det holdes tilbage ved grænsen, og at knæet kommer mindre frem. "ønskede 45°" mod referencens 40° | Kap. 7 | **blokerer** | Setu (titel og tekst), Yantra (scenariet) |
| F7 + A4 | Kapitel 6: det målte skelet står med knæet 15-20 cm foran stangen ved start og knæhøjde. Det skyldes skinnebenet, som teksten kalder upålideligt og siger ikke står i tabellen, men som står der og er tegnet. Stillbilledet "Start" mangler den grå figur, men figurteksten siger "Gråt: modellens figur" | Kap. 6 | **blokerer** | Setu (tekst), Yantra (skelettet) |
| F1 | Opstilling, unrack og lockout: hele kroppen hælder frem fra anklen (skinneben 9° med låst knæ), og stangen står 4,5 cm bag midtfoden. Modellen vælger 5,0° torso, kanten af sit søgeområde | Kap. 1, 3, panelet | vigtigt | Yantra (model), Setu (én sætning i figurteksten) |
| F2 | Front squat: stangen svæver foran brystet, hovedet er skudt frem over stangen, og albuen er tegnet oven i hovedet | Kap. 5 | vigtigt | Yantra (tegning) |
| F3 | Safety bar: ingen arme, skiven går gennem brystet, og stangen på trapezius, som figurteksten nævner, er ikke tegnet | Kap. 5 | vigtigt | Yantra (tegning) |
| A2 | Momenter i Nm uden stangvægt. Regnet baglæns ca. 100 kg | Kap. 1, 7 | vigtigt | Setu (én sætning), Yantra (bekræft vægten) |
| F5 | Fejlbillederne: referencens og fejlens mærker ligger oven i hinanden | Kap. 7 | irriterer | Yantra |
| F8 | Kapitel 6's forklaring i canvas er ca. 6-7 px på telefonen | Kap. 6 | irriterer | Setu |
| A3 | Good mornings "Værd at undersøge" bruger et kriterium, der ikke passer til scenariet (hoftemomentet stiger) | Kap. 7 | irriterer | Setu |
| A5 | "tegner torsoen som én stiv linje" passer ikke til de nye figurer | Kap. 1, 8 | irriterer | Setu |
| A6 | Gentagelser: "krav" defineret fire gange, lårets 32,5° fire gange, hoften uden for modellen fire gange, kapitel 5's tal tre gange (rest af Q16) | Kap. 1, 3, 5 | irriterer | Setu |
| Q21 | Kapitel 6's syv knapper er 32 px høje på 390 | Kap. 6 | kosmetisk | Setu |
| F9 | Arme, hals og balde tegnet som en dukke: lowbar-albuer hænger nede, halsen sidder på brystets forkant, balden er en kasse med et hak | Kap. 1, 5 | kosmetisk | Yantra |
| F10 | Anatomivælgerens figur er lille, og "Dybdekrav: ja" ligger oven i stregerne | Kap. 3 | kosmetisk | Yantra |
| A7 | "Balancen." om lordose, et manglende mellemrum, "frame", to små meta-henvisninger | Kap. 1, 5, 7 | kosmetisk | Setu |
| Q17 | Marc er næsten fraværende i kapitel 1-3 og 6-7 | hele | venter på Marc | Marc |
| Q22 | 10 `[MARC: ...]` og "Kommer"-boksen | hele | venter (med vilje) | Marc |

**Lukket siden 374:** Q1-Q15 og Q18-Q20. Q16 er delvis lukket (A6). Q21 er stadig åben. Q17 og Q22 venter på Marc.

**Når F4, F6/A1 og F7/A4 er rettet (tekst og mærker, et par timer), og F1-F3 er tegnet om eller i det mindste forklaret i figurteksten: ja.** De ti `[MARC: ...]`-spørgsmål kan sendes til ham nu, uafhængigt af rettelserne. De står i `RAPPORT-384.md`.

## Det der holder

- Kapitel 1's bøjede faser og kapitel 5's lowbar og highbar ligner squats, som en styrkeløftcoach kender dem. Bunden viser dybden, knæet foran tæerne, hoften bagud og stangen på ryggen over midtfoden. Marcs "lidt off og ser ikke realistiske ud" gælder ikke længere for de fire bøjede faser.
- Tallene kan læses på telefonen: H/K er 10,9 px, fejlbillederne har mindst 11,3 px, og tabellerne er HTML.
- Stilreglerne holder: 0 tankestreger, intet "man skal", ingen atletnavne, ingen interne navne, forbeholdet nederst, 0 konsolfejl og ingen vandret rulning.
- Tallene i kapitel 1 og 8 passer med figurerne, kapitel 3's procenter passer med vælgeren, og kapitel 5's torsovinkler passer med figurerne.
- Hvor modellen og målingerne er uenige (Wretenberg, sticking point og knævinklen i bunden), siger teksten det ærligt.

## Grundlag

`npm run verify:kritik-384` (`scripts/kritik-384.mjs`) trækker sitet ud på `squat-opslag-9` (`64cd729`) med `git archive`, serverer det lokalt og kører headless Chromium på 390x844 (touch, 2x) og 1280x900. Blok 1 fotograferer hver af de 27 figurer og indlejringer for sig i begge bredder, og blok 2 læser artiklen med alle folde åbne. Scriptet skriver kun i `outputs/kritik-384/`, og det kontrollerer stien før hver skrivning. Intet er rettet i sitet.
