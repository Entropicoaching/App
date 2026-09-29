Marcs baenk-punkt rettet: nej. Albuer i squat rettet: ja (i de statiske figurer; animationen kunne jeg ikke se). De tre vigtigste ting Yantra retter naeste gang: (1) baenkens stangkontakt skal op mod halsen med stablede led (underarm lodret over skulderen, buens toppunkt tættere paa halsen), (2) baenk-animationen (`demo/baenk.html`) er stadig kapsel-figuren uden bue og med stang uden kontakt, og squat-animationen (`demo/squat.html`) tegner slet ikke (JS `SyntaxError: Unexpected token ')'`), (3) de tre baenkbuer er for ens, og low bar/high bar skal kunne skelnes lettere (stangens sted, hoved, figuren fylder kun nederste tredjedel af panelet).

Ordre 694, Bhishak, 29. sep. 2026. Gren `kritik-694` fra `main`.

## Hvad er vurderet

Loeftmodellens `main` @ 6e426f7 (merge af 685) via `git archive`, kun laest. `RAPPORT-dag-107.md` er den nyeste; 689 og 690 er ikke merget, saa jeg vurderer 685, ikke Yantras nyeste arbejde. `LAES-MODELLER-3.html` er kun aabnet: den viser kun baenken (679 og 685), ikke squat. Squat er renderet fra `dist/tre-loeft` (low bar og high bar, bunden og lockout). Alt headless, 390 touch og 1280 mus, kun `file:` og 127.0.0.1, 0 netkald, syntetisk krop. Maalinger: `outputs/kritik-694/maaling-694.json`; scripts `figurer-694.mjs`, `squat-694.mjs`, `anim-694.mjs`; billeder `B694-*` (baenk), `S694-*` (squat), `A694-*` (animation).

## Baenk (Marcs punkt: nej)

- Stangkontakt: stangen rammer midt paa brystet, ikke oppe mod halsen. I `B694-1280-bue-middel` ligger stangen ca. 170 px fra hovedet i en overkrop paa ca. 400 px, dvs. omkring midten. 685 rykkede kun buens top lodret ned under stangen (tegning af rygsoejlens bagside); kontaktpunktets sted er uaendret. Marc bad om det modsatte: stangen hoejere, taettere paa halsen.
- Led stablet: delvist. Underarmen staar naesten lodret, men overarmen ligger langs baenken og skulderleddet ligger lavt; leddene er ikke stablet over hinanden.
- De tre buer: ikke tydeligt forskellige. Lille, middel og stor er tre naesten ens liggende figurer; forskellen ses mest i tallene (overarm 26/28/33 grader ud) og i luften under laenden, ikke i buens top. Marcs "nogle archer ikke lige saa meget" er daekket som idé (lille bue), men lille ligner middel.
- Animationen (`A694-*-baenk-t*`): den gamle kapsel-figur, en flad klods med en boejet arm; stangen svaever uden kontakt med brystet og der er ingen bue. Ikke rettet.

## Squat (Marcs punkt: ja i figurerne)

- Albuer: i bunden (`S694-1280-lowbar-bund`, `-highbar-bund`) og lockout (`S694-390-lowbar-lockout`) haenger underarmen fra stangen ned langs ryggen; albuen er under skulderen og bag stangen, ikke ved panden. Sticking og mellemframes har jeg ikke set.
- Low bar mod high bar: kan skelnes, men svagt. Low bar har torso 54 grader, high bar 36 grader; forskellen ses mest paa torsovinklen, stangens sted paa ryggen er kun lidt forskelligt.
- Figuren fylder stadig kun nederste tredjedel af panelet paa 1280, og "knae"-maerkatet ligger oven paa laaret (som i 684).
- Animationen: `demo/squat.html` viser et tomt sort laerred (`SyntaxError: Unexpected token ')'`, baade over `file:` og 127.0.0.1). Jeg ved ikke, om fejlen kun findes i headless Chrome eller i uddraget; Yantra skal tjekke. Squat-animationen er derfor ikke vurderet.

## Aabne fund fra 684

- Haender: ikke lukket. Baenkens haender er stadig smaa klumper paa stangen (forfra-vinduet i `B694-1280-bue-middel`).
- Sumo: ikke set i denne ordre, derfor ikke lukket.
- Lukket/uaendret: albuer i squat (ovenfor).

## Aerlige graenser

- Jeg har ikke set 689/690 (ikke merget), squat forfra, sticking-frames eller sumo, og squat-animationen tegner ikke hos mig.
- "Stangen for lavt" er en visuel dom paa tegningen og Marcs ord, ikke en cm-maaling til halsen.
- Ingen aendring af loeftmodellen eller sitet; kun filer under `docs/kritik-694/` og `outputs/kritik-694/`. Ingen push, ingen merge. Betydning for Hara (Coaching, "Appen maerkbart bedre"): kun indirekte, via tilliden til modelfigurerne i loeft-feedbacken.
