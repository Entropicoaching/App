# Blok 1: dødløft- og bænkfigurerne, set som en styrkeløftcoach

Læst på løftmodellens `main` (`f1e84b3`, med 429 og 434 merget). Filerne er hentet med `git archive` og ikke rørt. Siderne `dist/doedloeft-figurer/index.html` og `dist/baenk-figurer/index.html` er vist i headless Chromium ved 390x844 (touch, 2x) og 1280x900. Kommando: `node outputs/kritik-441/figurer-441.mjs`.

Hver figur er fotograferet for sig med sin figurtekst, 23 i hver bredde: `outputs/kritik-441/fig-<bredde>-dl-*.png` (13 dødløft) og `fig-<bredde>-bp-*.png` (10 bænk). Toppen af hver side ligger i `side-<bredde>-dl|bp.png`. Målingerne står i `outputs/kritik-441/figurer-441.json`: bredder, mindste tekst, modellens egne tal, Marcs klip og tre ting, jeg selv har målt eller regnet. De tre ting er markeret "målt i SVG" eller "overslag" nedenfor.

Spørgsmålet til hver figur var det samme som i 384: ligner den det rigtige løft? For dødløftet så jeg på opstilling, stangen der forlader gulvet, knæhøjde og lockout, konventionelt og sumo. For bænken så jeg på buen, grebet, stangen på brystet og J-kurven.

## Det der holder

- **Stangen går lodret over midtfoden i dødløftet, og armene er strakte.** Skulderen står lidt foran stangen ved gulvet. Ved knæhøjde er stangen ved knæet (52,1 cm). Ved lockout er knæ og hofte låst (180°). Plade, gulv og midtfod er tegnet rigtigt i forhold til hinanden, og skiven har den rigtige størrelse (45 cm).
- **Retningerne i sumo passer:** mere oprejst, kortere hoftearm og kortere vej. Den konventionelle står svagt bagved, så forskellen kan ses.
- **Bænkens lockout ligner en bænk.** Stangen står lodret over skulderleddet, og armen er strakt. Balder, skulderblade og hoved ligger på bænken, og fødderne står på gulvet. J-kurven går den rigtige vej, mod hovedet på vej op.
- **Vinduet forfra viser grebet i samme skala i alle figurer** (skulderleddene 47,4 cm fra hinanden, målt i SVG). Uden vinduet kunne grebet ikke ses fra siden.
- **Tallene kan læses på telefonen.** Mindste tekst i figurerne er 12,5 px på 390 og 14,2 px på 1280 (målt). HTML-teksten er 14,4 px. Ingen af siderne ruller sidelæns på 390 eller 1280. Alle 23 billeder hentes.
- **Klippets figurer siger nu i selve billedet, at knæ og skinneben er upålidelige.** I 384 (F7) stod det kun i "Gå dybere".

## Fund i dødløftfigurerne

Alvor som i 374 og 384: vigtigt, irriterer, kosmetisk.

**D1. Opstillingen ligner et stivbenet løft med høj hofte, ikke et konventionelt dødløft. Alvor: vigtigt.**
- Sted: konventionel opstilling og stangen forlader gulvet (`fig-390-dl-01`, `-02`), og samme positur under klippet (`fig-390-dl-09`).
- Hvad coachen ser: skinnebenet står næsten lodret (4°). Knæet står 4,2 cm bag stangen, og hoften er højt oppe og langt tilbage (hofte 50°, torso 68° fra lodret, hoftens arm 43,8 cm). Ryggen er næsten vandret. En konventionel opstilling har skinnebenet skråt frem til stangen, knæet over eller lidt foran stangen, lavere hofte og en mere oprejst ryg.
- Marcs eget klip siger det samme. Ved gulvet er hoften 80° mod modellens 50° og torsoen 50° mod 68°. Begge er målt pålideligt (`dl-09`, hvor den grå hofte står langt bag den blå).
- Hvorfor: Yantras egen grænse. Stangen er låst over midtfoden, anklen står 7 cm bag, og stangen ligger 6 cm fra skinnebenets akse. Så kan skinnebenet ikke hælde. Det er det første billede på siden, og det ligner ikke det, Marc laver.

**D2. Opstilling og "stangen forlader gulvet" er næsten det samme billede. Alvor: irriterer.**
- Sted: `fig-390-dl-01` og `-02` (og sumo `-05`, `-06`).
- Hvad coachen ser: to næsten ens figurer (knæ +5°, hofte +7°, stangen 5 cm højere). En læser leder efter forskellen og finder den ikke. Yantra skriver selv, at forskellen er et modelvalg. En coach ville vise enten opstillingen eller afsættet, ikke begge.

**D3. Ved knæhøjde er knæet for bøjet, og det flytter hoften og hoftemomentet mere end billedet lader ane. Alvor: vigtigt for tallet, irriterer for billedet.**
- Sted: konventionel og sumo knæhøjde (`fig-390-dl-03`, `-07`).
- Hvad coachen ser: løfteren har stadig meget knæbøjning tilbage ved knæet (knæ 140°, sumo 142°). Låret hælder 39° fra lodret, så hoften sidder lavt og langt bag knæet. Det ligner, at stangen squattes op. Hos rigtige løftere er benene næsten strakte ved knæet, og resten af løftet er hoften (Escamilla 2001: 159°).
- Hvor meget det betyder (overslag, ikke modellen; regnet i `figurer-441.mjs` med samme skinneben, samme 6 cm fra knæled til stang og skulderen stadig 5 cm foran stangen). Med 159° ville hoften sidde 7,2 cm højere, og hoftens arm ville falde fra 34,0 til 21,2 cm. Torsoen ville gå fra 48° til 30°, og hoftemomentet ville groft falde fra 1078 til ca. 670 Nm. Kontrol: med 140° rammer overslaget modellens 34,0 cm og 48°.
- Torsoen på 30° er for oprejst. Marc er selv 45° ved knæhøjde (pålideligt målt), fordi rigtige løftere har skulderen længere foran stangen end 5 cm. Yantras egen regning med 15 cm giver kun 149°. Det, der er galt, er altså låret, ikke ryggen. Men tallet "hofte 1078 Nm ved knæhøjde" og faldet fra gulvet til knæet (1382 → 1078) er det, sitet vil citere, og det er sandsynligvis overvurderet med op til en tredjedel.

**D4. Lockout hælder som en planke, samme fejl som squattens F1. Alvor: vigtigt.**
- Sted: konventionel og sumo lockout (`fig-390-dl-04`, `-08`).
- Hvad coachen ser: hele kroppen er én ret linje, der hælder 5° frem fra anklen. Skulderleddet står 11,4 cm foran anklen (regnet af segmentlængderne). En lockout, som en dommer godkender, står rank med hoften igennem og skuldrene over hoften eller lidt bag den. Figuren ligner en løfter, der er ved at falde forover med stangen.
- Marcs eget klip ved lockout (`fig-390-dl-13`): det blå skelet knækker let i knæ og hofte (172° begge). Skulderen står kun få cm foran anklen (skønnet fra skærmbilledet), mens den grå model står skråt. Det er det sidste billede i serien, som i squatten.

**D5. Sumo kan ikke kendes som sumo fra siden. Alvor: vigtigt.**
- Sted: alle fire sumofigurer (`fig-390-dl-05` til `-08`).
- Hvad coachen ser: en konventionel løfter med korte lår. Den brede stand, fødderne der peger ud og knæene ud over tæerne er det, der gør et sumoløft, og intet af det kan ses fra siden. Torsoen står 57° ved gulvet, altså mere vandret end Marcs eget konventionelle løft (50°). Hoften er stadig 39 cm bag stangen. Et rigtigt sumoløft set fra siden har hoften tæt på stangen og ryggen tydeligt mere oprejst.
- Lockout: sumoen er et hoved lavere end den konventionelle bagved (stangen 70,9 mod 78,8 cm), fordi låret er projiceret. Det ligner en mindre person, ikke en bred stand.
- Bænken løste det samme problem med et vindue forfra. Sumo har brug for det samme vindue, ellers står teksten "85,3 cm stand, fødderne 40° ud" uden billede.

**D6. Klippets blå skelet er stadig ikke et dødløft før knæhøjde. Alvor: irriterer.**
- Sted: klip start, før knæ og knæhøjde (`fig-390-dl-09` til `-11`).
- Hvad coachen ser: det blå knæ står langt foran stangen, og skinnebenet hælder ca. 45°. Ved knæhøjde ville stangen gå gennem knæet. Det er 384's F7 uændret. Forskellen er, at figuren nu selv skriver "knæ og skinneben: upålidelige i videoen", og de er stiplet. Det redder læseren, men det, øjet ser først, er stadig et forkert knæ.

**D7. Kroppen er stadig tegnet som en dukke. Alvor: kosmetisk.**
- Armen er én stiv stang uden hånd og greb. Ryggen er en flad plade uden lændens svaj, og balden er en kantet kasse, som i squattens F9. Hovedet er stort og sidder foran skulderen.
- Ingen af delene ændrer tallene, men "ligner det et rigtigt løft" handler netop om dem.

## Fund i bænkfigurerne

**B1. Stangen rører for højt på brystet, og buen flytter ikke berøringen derhen, hvor buen er til for. Alvor: vigtigt.**
- Sted: stangen på brystet og alle bue- og grebfigurer (`fig-390-bp-02`, `-05` til `-10`).
- Målt i SVG: stangen rører 15,0 cm tættere på hovedet end brystets højeste punkt (middel bue). Ved stor bue er det 13,7 cm, og stangen ligger dér 6,1 cm under brystets top.
- Hvad coachen ser: stangen lander øverst på brystet, mellem kraveben og brystvorter. En konkurrenceløfter med bue rører på brystets højeste punkt, nederst på brystbenet. Det er dér, buen gør vejen kortest. I figuren ligger brystets top tomt med stangen foran.
- Hvorfor: berøringspunktet er fast (0,09 H fra skulderleddet langs brystkassen) og flytter kun med buen, ikke med grebet. Yantra skriver det som modelvalg uden kilde.

**B2. Underarmen er ikke lodret ved brystet; albuen ligger ude ved hoften og uden for hånden. Alvor: vigtigt.**
- Sted: alle figurer med stangen på brystet. Værst ved smalt greb (`fig-390-bp-08`).
- Hvad coachen ser: det første, en bænkcoach kigger efter, er "albuen under stangen". I figurerne hælder underarmen 25° fra siden og 26° forfra (middel/middel), og albuevinklen er 45°. Set forfra står albuen 11,2 cm uden for hånden (målt i SVG).
- Med smalt greb er albuen 38°, og underarmen hælder 47° fra siden. Armen er foldet sammen med albuen nede ved hoften, og det ligner ikke et close grip. Med stor bue og smalt greb er det 56°.
- Stangen ligger 13-18 cm over skulderleddet, og underarmen er Winters albue-håndled. Begge dele står i Yantras grænser. Figuren viser følgen tydeligt.

**B3. Midt i opturen: kyllingevinger forfra, og fra siden kan bøjningen ikke ses. Alvor: vigtigt.**
- Sted: `fig-390-bp-03`.
- Hvad coachen ser: forfra står overarmen 80° ud, og albuen står 17,1 cm uden for hånden (målt i SVG). Underarmen hælder 38° ind mod stangen. Det er den albue, en coach retter først. Hos rigtige løftere holder albuen sig omtrent under stangen hele vejen op.
- Fra siden er armen en lodret stang, fordi dens plan står næsten forfra. "Albue 81°" står i titlen, men billedet ligner en lockout med stangen lavere. Yantra skriver det som reglens følge, ikke en måling.

**B4. Buen er et knæk, ikke en bro. Alvor: irriterer.**
- Sted: bue-figurerne (`fig-390-bp-05` til `-07`).
- Hvad coachen ser: brystkassen er en stiv klods, der vippes. Buen ses som et hak mellem bryst og mave, med en lille mørk kile under (5-9 cm luft under brystkassens nederste ende, målt i SVG). Balder og bækken ligger fladt. En stor bue har en jævn bro fra skulderbladene til balderne, og brystet løftes tydeligt. Her løftes berøringspunktet kun 4,5 cm fra lille til stor bue, og tre forskellige buer ligner næsten det samme.
- En lille V-streg på brystet går igen i alle bænkfigurer (knækkets kile). Den ligner en fold i en trøje.

**B5. Småting forfra og i opstillingen. Alvor: kosmetisk.**
- Stangen i vinduet forfra slutter ved hænderne, som om løfteren holder yderst på stangen.
- Udgangsstilling og lockout er samme figur (Yantra skriver det i figurteksten). Det er ærligt, men det er to ens billeder.

## Pr. figur, kort

| Figur | Ligner det rigtige løft? | Fund |
|---|---|---|
| dl 01-02 Konv. opstilling, forlader gulvet | Nej, stivbenet med høj hofte | D1, D2 |
| dl 03 Konv. knæhøjde | Delvis. Stangen ved knæet, men for meget knæ tilbage | D3 |
| dl 04 Konv. lockout | Nej, hælder som en planke | D4 |
| dl 05-08 Sumo | Nej, ligner en konventionel med korte lår | D5 (og D1-D4) |
| dl 09-11 Klip start, før knæ, knæhøjde | Model som D1. Det blå knæ er forkert, men det er mærket | D6 |
| dl 12-13 Klip efter knæ, lockout | Ja, blåt og gråt ligger tæt | D4 (model) |
| bp 01, 04 Udgang, lockout | Ja | B5 |
| bp 02 Stangen på brystet | Nej, stangen rører højt, og underarmen hælder | B1, B2 |
| bp 03 Midt i opturen | Nej, kyllingevinger forfra | B3 |
| bp 05-07 Lille, middel, stor bue | Delvis. Buen er et knæk, og berøringen følger ikke med | B1, B4 |
| bp 08-10 Smalt, middel, bredt greb | Bredt næsten (albuen 6,6 cm uden for hånden). Smalt nej, armen er foldet sammen | B1, B2 |
