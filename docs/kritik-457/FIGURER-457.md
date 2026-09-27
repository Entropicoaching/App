# Blok 1: mine 441-fund på de nye dødløft- og bænkfigurer

Løftmodellens `main` er `0869560`, hvor 447 og 452 er merget. Filerne er hentet med `git archive` og ikke rørt. Kommando: `node outputs/kritik-457/figurer-457.mjs`. Det er mit 441-script. Målingerne er de samme, og kun figurlisterne følger de nye filnavne. Der er tilføjet tre ting, som er markeret "457" i scriptet: hoftearmen regnet med Marcs egen torso, albuens valg midt i bænkens optur og tre tegn i dødløftets SVG'er. Siderne er vist headless i Chromium ved 390x844 (touch, 2x) og 1280x900.

Hver figur er fotograferet for sig med sin figurtekst. Det giver 20 figurer i hver bredde: 11 dødløft og 9 bænk (`outputs/kritik-457/fig-<bredde>-dl|bp-*.png`). Toppen af hver side ligger i `side-<bredde>-dl|bp.png`, og tallene står i `outputs/kritik-457/figurer-457.json`. Ingen af siderne ruller sidelæns på 390 eller 1280. Den mindste tekst i en figur er 12,1 px på 390 (klip, før knæ) og 13,8 px på 1280, og HTML-teksten er 14,4 px. Alle 40 billeder bliver hentet.

Jeg har set hver figur igennem med samme spørgsmål som i 441: ligner den det rigtige løft?

## Status for D1-D7 og B1-B5

Kriterierne er dem fra `verify-kritik-441.mjs`. Hvor 441-kriteriet kun kunne sige "åben", står grænsen for lukket her i tabellen, og `verify-kritik-457.mjs` regner den ud fra JSON'en.

| Fund | 441 (f1e84b3) | Nu (0869560) | Status | Bevis |
|---|---|---|---|---|
| D1 opstilling | skinneben 4°, torso 68°, knæet 4,2 cm bag stangen | skinneben 14°, torso 61°, knæet 0,8 cm fra stangen. Marcs torso er 50° | **delvis** | `fig-390-dl-01`, `-07` |
| D2 opstilling = afsæt | to næsten ens figurer | én figur ("en statisk model har ingen slack") | lukket | 11 figurer, ingen "forlader gulvet" |
| D3 knæhøjde | knæ 140° / sumo 142° | knæ 146° / sumo 148°, hoftearm 30,1 cm | **delvis** | `fig-390-dl-02`, `-05` |
| D4 lockout | torso 5°, skulderen 11,4 cm foran anklen | torso 0°, skinneben 0°, skulderen over anklen | lukket | `fig-390-dl-03`, `-06` |
| D5 sumo | torso 57°, intet vindue | torso 50°, vindue forfra i 3 af 3 sumofigurer | lukket | `fig-390-dl-04` til `-06` |
| D6 klippets knæ | blåt knæ foran stangen, stiplet | knæ og skinneben tegnes ikke, "ikke vist: upålidelige" i de 3 figurer til og med knæhøjde | lukket | `fig-390-dl-07` til `-09` |
| D7 dukken | arm uden hånd, flad ryg, kantet balde, rundt hoved | hånd om stangen i 6 af 6 modelfigurer, rund balde, lændens svaj, ovalt hoved | lukket | `fig-390-dl-01` til `-06` |
| B1 berøring | 15,0 cm foran brystets top | 0,1 cm (lille bue −2,8, stor bue −1,5 cm) | lukket | `fig-390-bp-01`, `-04` til `-06` |
| B2 albuen ved brystet | underarm 25° fra siden, albuen 11,2 cm uden for hånden, smalt greb foldet (38°) | underarm 11°, albuen 0 cm uden for hånden, smalt greb 60° og 17° fra siden | lukket | `fig-390-bp-01`, `-07` |
| B3 midt i opturen | overarm 80° ud, albuen 17,1 cm uden for hånden | overarm 25° ud, 0 cm | lukket forfra (se N1) | `fig-390-bp-02` |
| B4 buen | brystet 4,5 cm højere fra lille til stor | stangen på brystet 7,7 cm højere, stangen inden for 3 cm af brystets top | lukket | `fig-390-bp-04` til `-06` |
| B5 småting | stangen slutter ved hænderne, udgang som egen figur | stangen går over hele vinduet, udgang = lockout (sagt i figurteksten) | lukket | `fig-390-bp-03` |

Ti af tolv er lukket, og D1 og D3 er delvise. Det er det samme, som Yantra målte i 452. Jeg er enig i, at D5 er lukket, selv om sumoens lockout stadig står 7,9 cm lavere end den konventionelle (71,9 mod 79,8 cm), og selv om mit 441-kriterium stadig slår ud på det. Vinduet forfra viser nu, at benene står skråt, og så ligner det ikke længere en mindre person.

## Det, jeg ser som coach

**D1. Opstillingen ligner nu et konventionelt dødløft, bare med høj hofte. Alvor: delvis, acceptabel som modelgrænse.**
- `fig-390-dl-01`: skinnebenet hælder frem til stangen, knæet står over stangen, og skulderen står lidt foran. Stangen står over midtfoden, og armene er strakte. Det er en løfter med lange lår og høj hofte, og den slags løftere ser jeg jævnligt. Det er ikke længere et stivbenet løft.
- Afstanden til Marc er torsoen: 61° mod hans 50° (pålideligt målt i klippet, `fig-390-dl-07`, hvor den blå linje fra hofte til skulder står tydeligt mere oprejst end den grå krop). Hoftevinklen (51° mod 80°) er ikke et fair mål. Den regnes mod låret, og lårets retning kommer fra klippets knæ, som klippet selv kalder upålideligt.
- Hvad det betyder for tallet (overslag, ikke modellen): hoftearmen er torsoens længde gange sinus til torsovinklen minus skulderens 5 cm foran stangen. Med modellens torso giver det 41,0 cm, som er modellens eget tal. Med Marcs 50° giver det 35,6 cm. Modellens hoftemoment ved gulvet (1294 Nm) er altså ca. 13 % højere end for et løft som Marcs. Balancen er ikke regnet med.

**D3. Knæet ved knæhøjde er et kompromis, og det er et rimeligt kompromis. Alvor: delvis, acceptabel som modelgrænse.**
- `fig-390-dl-02`: skinnebenet er lodret, stangen står ved knæet, hoften er bagude, og skulderen står foran stangen. Det ligner en løfter ved knæet. Der er stadig lidt knæ tilbage (146°), men billedet ser ikke længere ud, som om stangen bliver squattet op.
- Marcs torso ved knæhøjde er 45° mod modellens 53°. Hvis torsoen var Marcs, ville hoftearmen være 25,4 cm i stedet for 30,1 cm. Modellens 987 Nm er altså højt for et løft som Marcs, ligesom ved gulvet.
- Faldet fra gulvet til knæet holder. Modellens hoftearm falder til 0,73 af gulvets arm, og med Marcs torso i begge stillinger falder den til 0,71. Det er det tal, sitet bør bruge: hoftens moment falder ca. en fjerdedel fra gulvet til knæet, og knæets moment skifter fortegn (−132 Nm). Knæet strækker altså ikke længere.
- Mit 441-overslag med Escamillas 159° (hoftearm 21,2 cm, torso 39°) holder ikke balancen. Yantras model gør, og den siger, at 159° kræver torsoen ca. 60°, hvilket er længere fra Marc end 53°. Mit overslag skal derfor ikke bruges som mål. 159° er et gennemsnit for konkurrenceløftere. Marcs eget klip står mere oprejst end det, 159° ville kræve i modellen, så 159° er ikke målet for hans løft.

**D4-D7.** Lockout står rank, og låsningen ligner en godkendt lockout (`fig-390-dl-03`). Sumo kan kendes på vinduet forfra: standen, fødderne ud, knæene over tæerne og armene inden for knæene (`fig-390-dl-04`). Klippet viser ikke længere et forkert knæ. Efter knæhøjde ligger det blå og det grå tæt (`fig-390-dl-10`, `-11`). Dukken har hånd, balde og svaj.

**Bænken.** Stangen rører brystets højeste punkt, underarmen står næsten lodret ved brystet, og albuen står under hånden forfra (`fig-390-bp-01`). Smalt greb ser ud som et close grip, ikke som en foldet arm (`fig-390-bp-07`). Den store bue løfter brystet tydeligt, og de tre buer kan skelnes (`fig-390-bp-04` til `-06`). Lockout og J-kurven er som i 441.

## Nye fund

**N1. Bænk midt i opturen fra siden: underarmen hælder 53° mod fødderne. Alvor: irriterer.**
- Sted: `fig-390-bp-02`. Forfra er B3 lukket, og albuen står under hånden. Men fra siden står albuen 21 cm mod fødderne, og armen ligner et spidst "<" med albuen nede ved ribbenene. Det er Yantras spørgsmål 1, og svaret står nedenfor.

**N2. Bænksidens tekst om buen er forældet. Alvor: irriterer.**
- Sted: afsnittet "Buen" på `dist/baenk-figurer/index.html`. Der står stadig "et vip af brystkassen" og "berøringspunktet flytter sig nærmere skulderen". Forbeholdet længere nede siger, at buen er en jævn bro, og at stangen rører brystets højeste punkt, og det er det, figurerne viser. Den ene sætning modsiger resten af siden.

**N3. Lockout-momentet på 264 Nm er et statisk artefakt. Alvor: kosmetisk for billedet, men tallet må ikke citeres.**
- Sted: `fig-390-dl-03`, `-06` og tabellen "Hofte og lænd side om side". Hoften, lænden og knæet har alle 264 Nm ved lockout, ens for konventionel og sumo, fordi stangen hænger 10 cm foran en helt lodret krop. En løfter, der har låst, læner sig en smule tilbage med skuldrene bag hoften, og så er hoftemomentet næsten nul.

**N4. Sumo fra siden: skinnebenet hælder 14° frem som i det konventionelle. Alvor: kosmetisk.**
- Sted: `fig-390-dl-04`. I sumo går knæet ud over tæerne, ikke frem, så skinnebenet står næsten lodret set fra siden. Vinduet forfra viser det rigtige, så det er kun sidebilledet, der er for konventionelt.

## Svar på Yantras to spørgsmål

**1. Skal albuen lidt ud til siden midt i opturen?** Ja, lidt. Både det nuværende (albuen 0 cm uden for hånden forfra og 21 cm mod fødderne fra siden) og 441's kyllingevinge (17 cm uden for hånden) ligner ikke det, en coach ser. Det, man ser hos gode bænkere, er "tuck og så flare": albuen er inde ved brystet og går lidt ud på vej op. Med stangen, hvor modellen har den (38,4 cm over skulderen, næsten over den), kan albuen kun dreje om linjen fra skulder til hånd (`midtAlbueValg` i JSON'en):

| Albuen uden for hånden forfra | Mod fødderne fra siden | Underarm fra lodret, siden / forfra | Albuens arm i alt |
|---|---|---|---|
| 0 cm (nu) | 21,2 cm | 53° / 0° | 21,2 cm |
| 8 cm | 17,1 cm | 42° / 23° | 18,9 cm |
| 10 cm | 15,2 cm | 38° / 27° | 18,2 cm |
| 14 cm | 9,2 cm | 24° / 34° | 16,8 cm |

Mit forslag er 8-10 cm uden for hånden, altså underarmen ca. 25° forfra. Så ligner armen en bænker, der presser, set fra begge sider. Det vigtige for sitet er, at albuens arm i alt næsten ikke ændrer sig (21 → 18 cm). Albuemomentet midt i opturen (104 Nm mod skulderens 66) er derfor ikke et produkt af valget. Det kommer af, at stangen allerede står over skulderen, og at albuen er bøjet 83°. Det er pynt på billedet, ikke en betingelse for sitet.

**2. Er 12 cm skulder foran stangen ved knæhøjde med knæ 146° et rimeligt kompromis?** Ja. Ved knæet står en god løfters skuldre tydeligt foran stangen, med armhulerne over eller lidt foran den, og 12 cm til skulderleddet ligger inden for det, jeg ser. Torsoen på 53° ligger mellem Marcs 45° og de ca. 60°, som Yantras model siger, at 159° ville kræve. Knæet på 146° ligger mellem det, Marcs klip antyder, og Escamillas gennemsnit. Jeg ville ikke jagte 159° længere. Jeg ville skrive grænsen på siden.

## Er D1 og D3 acceptable som modelgrænser?

Ja, hvis teksten på siden siger tre ting:
1. Modellen løfter med højere hofte og en mere vandret ryg end Marcs klip: 61° mod 50° ved gulvet og 53° mod 45° ved knæet. Det skyldes, at kroppen er bygget af længder udledt af højden, ikke målt med målebånd.
2. Hoftemomenterne i Nm er modellens, og for et løft som Marcs er de sandsynligvis 10-15 % for høje. Det, der holder, er forholdet: hoften har ca. en fjerdedel mindre at holde ved knæet end ved gulvet, og knæet er holdt op med at strække.
3. Knæet ved knæhøjde (146°) er et kompromis mellem litteraturen og Marcs klip, ikke en måling.

Billederne ligner nu løftet. Grænserne går på tallene, ikke på det, øjet ser, og tal kan en tekst tage forbehold for.
