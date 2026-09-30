Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja, med tre forbehold. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft sumo smal/mellem, startstilling: hoften staar langt bag baade stang og knae og ryggen er lang og skraa, saa figuren ligner en dyb squat med lige arme; i rigtig sumo er hoften taettere paa stangen og overkroppen mere oprejst (`outputs/kritik-947/A947-1280-dl-sumo-smal-t2.png`, `A947-390-dl-sumo-smal-t2.png`; hoftereglen i `src/embed/deadlift-animation.js`; Marc vaelger reglen); (2) baenk, frontvinduet: stadig to arme og en graa klump uden hoved paa main; hovedomridset er lavet paa grenen ordre-939 men ikke merget (`A947-1280-baenk-stor-t0.png`, `A947-390-baenk-lille-t0.png`; `src/embed/bench-animation.js`); (3) squat paa 1280: figuren er lille i en stor sort flade, og haandcirklen + frontvinduet fylder paa 390 (`A947-1280-squat-lowbar-t2.png`, `A947-390-squat-highbar-t2.png`; `src/embed/squat-animation.js`; at skjule haandcirklen kraever Marcs ja).

# Rapport: Ordre 947, loeftfigurerne som de staar nu (Bhishak)

## 1. Hvad jeg vurderede
Yantras nyeste rapport paa main: `docs/RAPPORT-ordre-933.md` (main 1ffc1e8, hentet med git archive, dist + demo). Min seneste figur-kritik: 934 (dom: "Marcs domme holdt: ja ... ligner rigtige loeft: ja, med tre forbehold"). `LAES-MODELLER-3.html` er laest, ikke aendret; den beskriver ordre 939, som ligger paa grenen `ordre-939` og IKKE er merget i main. Jeg vurderer derfor main (det der er godkendt/merget) og skriver hvad 939 paastaar at lukke, uden at have set det. Jeg genbrugte 934-scriptet som `docs/kritik-947/tur-947.mjs` (headless, kun 127.0.0.1, fremmede netkald blokeret, syntetisk krop) paa 390 touch og 1280: squat low/high bar (side, forfra, animation), baenk lille/middel/stor bue, doedloeft konventionel, semi (49), sumo smal (65,6), sumo bred (82). 105 skaermbilleder i `outputs/kritik-947/`; jeg har set 11 af dem selv (sumo smal, bred, konventionel, baenk lille/stor, squat low/high). Maalinger: `maaling-947.json` (0 netkald; 1 harmloes 404).

## 2. Marcs domme
- Baenk: stangen paa buens top med staplede led, underarmen lodret i hver stor-bue-ramme jeg saa; laend 7,3 cm (lille) og 10,6 cm (stor), toppen 16,8 cm fra skulder paa stor bue. Toppen taettere paa halsen jo stoerre bue. Holder.
- Squat: albuen bag og under stangen, aldrig ved hovedet: low bar 12 cm bag / 20 cm under, high bar 9 cm bag / 24 cm under. Low bar kun lidt under high bar. Holder.
- Doedloeft: skinnebenet helt frem til stangen i start i alle stande (konventionel, semi, sumo smal, sumo bred). Fodbredden er et spektrum (32 til 82 cm). Holder.
- Intet er binaert: glidere/tre trin overalt. Holder.

## 3. Hvad ser stadig unaturligt ud
- Sumo smal og mellem, start: hoften staar meget langt bag stangen og knaeet, laaret ligger naesten vandret, ryggen er lang og skraa (hofte 12 cm over knae paa 390, 19 cm paa 1280). En erfaren sumoloefter staar med hoften taettere paa stangen og mere oprejst bryst; her ligner det en konventionel start med brede ben. Sumo bred (33 cm over knae midt i loeftet) ser rigtigere ud.
- Baenk, frontvindue paa main: to arme, en graa klump og en skulderlinje, intet hoved. Desuden vender armene skraat udad, som et V, hvilket er rimeligt for et bredt greb.
- Baenk stor bue: fod og laar ser nu acceptable ud (hael taet paa hoften, skinnebenet skraat); ikke laengere et fund.
- Squat 1280: lille figur i stor sort flade, haandcirklen fylder det oeverste venstre hjoerne. Squat 390: haandcirkel og frontvindue tager mere plads end figuren selv.
- Konventionel: naturlig (hofte 42 cm over knae foroven). Ingen anmaerkning.

## 4. Er mine seneste fund (934) lukket
1. Sumo smal hofte: delvist. 933 viste, at tallene (12 mod 27 cm) var taget paa to forskellige tidspunkter af loeftet, og det har jeg nu set: 12 cm paa 390 og 19 cm paa 1280 er samme opstilling paa to tidspunkter. Der er altsaa intet spring. Men selve startstillingen (hoften langt bag) er uaendret og ser stadig ikke ud som sumo. Mit fund 934 var daarligt formuleret; det rigtige fund er hoftens sted, ikke springet.
2. Baenk frontvindue: aabent paa main. Hovedomridset (stiplet) staar paa ordre-939 og paa LAES-MODELLER-3, men main har det ikke. Ikke set af mig.
3. Squat fylder lidt: aabent, afventer Marcs ja; 933 forklarede at figuren fylder ca. 60 % af hoejden i bunden.
Baenkens fod (934 fund 2b): ser nu ok ud for mig; 933 maalte hael 14 cm fra hoften paa stor bue.

## 5. Hvad jeg ikke kunne / mangler
- Jeg har ikke set ordre-939-grenen koere; det den aendrer (doedloeftens vindue forfra paa 390 og bænkens hovedomrids) staar som ikke verificeret. Laesesiden er foran main.
- 11 af 105 billeder set; ingen levende atlet eller sumofilm, saa "ser forkert ud" er en coachs oeje paa tegning, ikke maaling.
- Ingen kode eller site roert, ingen push/merge, ingen miljoevariabler roert. Filerne: `docs/kritik-947/` (server-947.mjs, tur-947.mjs, denne rapport) og `outputs/kritik-947/`. Arbejdet har ingen betydning for Hara.
