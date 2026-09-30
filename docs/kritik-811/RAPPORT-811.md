MMORPG-følelse: halvvejs. Rodet: ja (helt-skærmen og niveau-op-/klaret-skærmen på 390; forsiden er rolig). De tre vigtigste ting Ganita retter næste gang: (1) helten bliver kun stærkere ved niveau, ikke pr. "+N": svar-billedet viser et stort "+10 erfaring" og en gul glød, men figuren får ingen ny ting, og Hjerte står på 1 selv efter 60 ærlige opgaver (skærm: forsiden lige efter et rigtigt svar, `E811-main-390-5-svar-650ms.png`; fil: `src/spil-app.js`, `heltVoksPuls`, og udstyrslisten: giv figuren en ny lille ting eller animation pr. 3-5 rigtige, og få Marc til at vælge, hvordan Hjerte vokser); (2) niveau-op er stadig to grønne kort (banner + "Forløbet er klaret") med tre knapper "Gå til Grusgraven / Gå til Landsbygaden / Se det på kortet" (skærm: `E811-main-390-6-niveauop-hel.png`; fil: `.niveau-banner` i `src/spil.css`, `klaret-fortsaet` i `src/spil-app.js`: slå til ét kort med én knap; ordre 797 lægger "Gå til" bag "Mere", men ligger stadig kun på grenen ordre-797, ikke i main: få den ind); (3) Min helt på 390 er den mest rodede skærm, 2,8 skærmhøjder og ca. 30 ting, og under Hånd står stadig "mål" (skærm: `E811-main-390-8-helt-hel.png` og `E811-main-390-3-kort.png`; fil: `src/spil-app.js` Min helt og `src/hhh-forklaring.js`: skjul "Øv her", "Du har ikke hjulpet nogen" og rygsækkens "Enheder og målestok" bag "Mere", og skriv "måle" i stedet for "mål" under tallet).

## Gren

`kritik-811` (fra `main`), to commits; filer kun under `docs/kritik-811/` og `outputs/kritik-811/`.
- Hvad: `main` i matematik-træet (8c101c8, uændret siden min kritik 806; ordre 797 er stadig kun på grenen og er ikke set). Hentet med `git archive` til en midlertidig mappe og kørt lokalt i headless Chromium, 390 touch og 1280 mus, uden net, syntetisk elev "Tulle". Mit elev-script: `outputs/kritik-811/elev-811.mjs` (kopi af 806). Spillet er ikke rørt.
- Spillet: tre opgaver, niveau 2 til 3 (banner), et klaret forløb (Del ligeligt), Min helt og en simulering på 60 opgaver. Net 0, ingen fejl.
- Læst: Ganitas RAPPORT-797 og -790 (de to nyeste, "Hvad ændret", "Hvad er næste") og første linje af min seneste matematik-kritik (806).

## Hvad ændret

Intet i spillet siden 806: målingerne er ens tal for tal. Dommen er derfor den samme, og det er selve fundet: Ganitas seneste arbejde (797) er ikke nået i main.
- MMORPG-følelse, halvvejs. Det virker: stort "+10 erfaring" i et grønt felt, erfaringstal og bånd, en grøn "+1" hopper ved Hoved, helten lyser gult, figuren får stav og skjold (niveau 2 og 3). Det mangler: helten *bliver noget* pr. svar. Ingen ny ting på figuren mellem niveauerne; Hjerte er 1 hele vejen; ærlig regning giver niveau 15 på 60 opgaver, en gætter niveau 1 med 325 erfaring. Ærlig betaler sig, men det ses kun i tal, ikke på helten.
- Rod, ja, men kun to-tre skærme. Synlige ting på 390 (talt fra billederne, ca.-tal; målinger i `elev-main.json`):
  - Forsiden med opgave (`E811-main-390-3-kort.png`): ca. 25 ting; 66 ord, 7 knapper, 1,9 skærmhøjder. Rolig, stort tal, klar figur.
  - Niveau-op/klaret (`E811-main-390-6-niveauop-hel.png`): ca. 22 ting (banner, klaret-kort, bonus, "Hvor nu?", tre knapper, "Mere", "Næste hos Mølleren", "Næste opgave"); 109 ord, 2,5 skærmhøjder. Uændret.
  - Min helt (`E811-main-390-8-helt-hel.png`): ca. 30 ting (tilbage, to faner, figur, tre kort med prikker og tekst, ?, "Øv her" med knap, "Du har ikke hjulpet nogen" med knap, udstyr med to folder, rygsæk med "Enheder og målestok" og fold, "Vis min kode", "Det har jeg lært", titler); 116 ord, 2,8 skærmhøjder. Mest rodet.
  - 1280: kolonne ca. 720 px, ingen vandret rul, roligt; helten lille i forhold til den tomme flade.
- Hoved, Hånd, Hjerte første gang (`E811-main-390-2-ny-foerste.png`): en 11-årig forstår Hoved ("regne: dele, brøker, klokken"), Hånd ("måle og regne om, fx skridt til møllen") og Hjerte ("hjælpe en person, fx Ane, med alle hendes opgaver") ud fra forklaringskortet. Men (a) under Hånd-kortet står stadig "mål", som læses som fodboldmål, (b) forklaringen forsvinder ved "Forstået", og kortene har kun ét ord. På Min helt står en kort tekst under hvert kort; det er godt. "Ane" er kun et navn, før man har mødt hende.
- Er mine seneste fund lukket (806)? (1) Helten vokser ikke pr. "+N": åbent. (2) Niveau-op to kort, tre knapper, 797 ikke i main: åbent. (3) Min helt rodet og "mål": åbent.

## Hvad der ikke holder

- "+N" giver tal og glød, ikke en synlig ændring på figuren.
- Hjerte vokser ikke af ærlig regning (Marcs valg, stadig uafklaret).
- Niveau-op: to kort, tre knapper med næsten samme besked.
- Min helt: for mange sektioner på én lang skærm til en 11-årig.
- "mål" under Hånd; ordre 797 ligger fast på en gren.

## Hvad der holder

- Forsiden er rolig og læsbar; figuren stor; tallene tydelige.
- Hånd og Hjerte som handling med eksempel virker og er lukket i teksten.
- Heltens glød ved "+N" er synlig og ikke urolig.
- "Næste opgave" efter klaret er tydelig.
- Det betaler sig at være et godt menneske: ærlig niveau 15, gætter niveau 1.
- 1280 uden vandret rul; ingen net, ingen fejl.

## Ærlige grænser

- Ordre 797 er ikke kørt; dommen gælder main. Ganitas tal for 797 er ikke verificeret af mig.
- Ingen rigtig 11-årig har set spillet; alt er syntetisk elev i headless Chromium. Antal ting er talt af mig fra billederne (ca.-tal).
- Scriptets klaret-billede (`E811-main-390-10-klaret-hel.png`) er taget efter en ryd; klaret-dommen bygger på niveau-op-billedet og målingerne.
- Kun de tre vigtigste skærme; Questbogen og Journalen er ikke gennemgået. Animationen ses kun som stillbilleder.
- Leveringskommandoen (`hoest.mjs --aflever`) blev afvist af tilladelsessystemet og er ikke kørt; rapporten er committet, men ikke leveret til Hara.
- Ingen push, ingen merges, ingen sub-agenter, ingen elevdata.

## Hvad er næste

Ganita får 797 i main først (billigst, lukker halvdelen af punkt 2 og 3), og retter derefter de tre ting i dommen. Bhishak tjekker bagefter: (1) ny ting eller animation på figuren pr. rigtige svar, (2) ét kort med én knap ved niveau-op og at 797 er i main, (3) Min helt under ca. 20 ting og "måle" under Hånd. Marc vælger, hvordan Hjerte vokser af ærlig regning.

## Testresultat

Intet nyt at teste (kritik, ingen ændring af spillet). Målekommando: `node outputs/kritik-811/elev-811.mjs <git archive af main> main` gav net 0, tom fejl-liste, banner og klaret nået på 390 og 1280, simulering 60 opgaver: ærlig niveau 15, gætter niveau 1.
