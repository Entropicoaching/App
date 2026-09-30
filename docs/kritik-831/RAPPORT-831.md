Marcs domme holdt: ja. Ligner rigtige loeft: ja, naesten (stillingerne ligner; men squat-animationen paa 390 er stadig en lille figur i et hjoerne, sumo-ryggen er vandret i starten, og baenkens hoved er lille). De tre vigtigste ting Yantra retter naeste gang: (1) squat-animationen paa 390 (`A831-390-squat-lowbar-t2.png`; `src/embed/squatAnimation.js`): figuren fylder stadig kun nederst til venstre og hele hoejre halvdel under haandlupen er tom, tredje kritik i traek; centrer figuren og goer den 1,5 gange stoerre; (2) sumo fra siden (`A831-1280-dl-sumo-bred-t0.png` "ryg 8,6 grader mere vandret", `A831-390-dl-sumo-bred-t1.png` "ryg samme vinkel"; `src/embed/deadliftAnimation.js`, `src/doedloeftFigurer.js`): spoegelsens tekst siger to ting i to billeder af samme loeft, og i starten ser sumo ud som en konventionel med bredt stand (ryggen flad); giv sumo en mere oprejst ryg i starten, og paa 390 roerer teksten "mod konv. (stiplet):" stadig skinnebenet, saa flyt den ind i den tomme venstre halvdel; (3) baenkens hoved (`A831-390-baenk-stor-t2.png`; `src/baenkFigurer.js`, `HOVED_SKALA` 0,75): hovedet er for lille i forhold til skuldre og bryst og ligger som en klump under skulderen, saa en coach laeser figuren som skaev; saet hovedet til ca. 0,9 og luk hals-til-skulder-overgangen.

# Ordre 831, Bhishak, 30. sep. 2026

## Gren

`kritik-831` (fra `main`). Filer kun under `docs/kritik-831/` (denne rapport og tre scripts `tur-831.mjs`, `squat-stang-831.mjs`, `server-831.mjs`, kopieret fra 826 med nyt ordrenummer) og `outputs/kritik-831/` (117 filer: `T831-` stille figurer, `A831-` animationer, `S831-` squat bund/sticking/lockout og `maaling-831.json`). Set paa Yantras `main` (dd8408d, ordre 807 merget; nyeste rapport `docs/RAPPORT-ordre-807.md`), hentet med `git archive` og serveret paa 127.0.0.1. Har `LAES-MODELLER-3.html` aabnet kun til laesning (overskrifter og svarlinjer; den viser de to nye aendringer oeverst).

## Hvad aendret

Intet i loeftmodellen eller sitet. Jeg har taget alle billederne om paa 390 og 1280 og set et udvalg taet: squat bund low/high (1280), squat low bar bund (390), squat-animation low bar (390), baenk tre buer (1280), stor bue i lockout (390), doedloeft konventionel og sumo bred (1280), sumo bred (390).

## Testresultat

Ingen kodetest koert (jeg aendrer intet). Maaling: 0 sideudefra-kald; paa 390 een konsolfejl, en 404 paa en ressource (samme som i 826, ingen figur mangler); paa 1280 ingen. Alle tre loeft, alle stillinger og alle animationer aabnede uden fejl.

## Dom: Marcs domme, rigtige loeft og tidligere fund

- Baenk: holder. Underarmen er lodret under stangen i lockout (`A831-390-baenk-stor-t2.png`); toppen rykker taettere paa skulderen jo stoerre bue (21,1 / 19,1 / 16,8 cm i `A831-1280-baenk-tre-buer.png`), tre forskellige buer. Halsen er en glat form nu og ikke den gamle kasse.
- Squat: holder nu. Low bar staar 3,7 cm under skulderen, high bar 1,1 cm over: 4,8 cm forskel, et par cm (`S831-1280-lowbar-bund.png`, `S831-1280-highbar-bund.png`). Albuen er bag og under stangen (17 cm bag / 19 cm under low bar, 11 / 23 high bar), aldrig ved hovedet. Stangens sted er et spektrum.
- Doedloeft: holder. Skinnebenet staar mod stangen i starten (`A831-1280-dl-konventionel-t0.png`), og fodbredden er et spektrum (stand 32 til 82 cm, konventionel, mellemting, sumo). Sumo har lavere hofte (8,4 cm), som det skal vaere.
- Ligner rigtige loeft: ja, naesten. Det en erfaren coach ser foerst er squat-figurens lille fylde paa 390, sumo-ryggen i starten og baenkens lille hoved.
- Mine seneste fund (826): (1) low bar 6,4 cm for langt nede: LUKKET af ordre 807 (nu 4,8 cm). (2) sumo: halvt lukket; teksten siger ikke laengere "mere vandret" i alle billeder (390 t1 siger "ryg samme vinkel"), men start-billedet paa 1280 siger stadig "8,6 grader mere vandret", og teksten oven paa skinnebenet paa 390 er ikke flyttet. (3) squat-animation 390: aaben, uaendret.

## Hvad er naeste

Yantra tager de tre punkter i foerste linje i den raekkefoelge. Punkt 1 er billigst (layout) og er taget op tre gange. Punkt 2 hoerer under Marcs dom om sumo-ryggen; retningen er hans. Punkt 3 er en tegning og rammer ingen beregning. Marc svarer paa LAES-MODELLER-3 "modeller ok" eller "modeller ret: ...". Dette arbejde har ingen betydning for Hara.

## Ærlige grænser

Headless Chrome, stille billeder og fem tidspunkter pr. animation, ikke film paa en telefon. Jeg har set et udvalg af de 117 filer taet, ikke alle; high bar paa 390, baenk lille/middel og 360 px er ikke set denne gang. Tallene (4,8 cm, 8,6 grader, 8,4 cm) staar i figurens egen tekst, ikke maalt af mig paa en atlet. Hovedets "0,9" er min vurdering af udseendet, ikke en maaling. Kun syntetiske kroppe.
