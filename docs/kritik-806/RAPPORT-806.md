MMORPG-følelse: halvvejs. Rodet: ja (helt-skærmen og niveau-op-/klaret-skærmen på 390; forsiden er rolig). De tre vigtigste ting Ganita retter næste gang: (1) helten bliver kun stærkere ved niveau, ikke pr. "+N": 790 gav en gul glød på 0,9 s, men figuren har ingen ny ting og Hjerte er 1 hele vejen (skærm: forsiden lige efter et rigtigt svar, `E806-main-390-5-svar-650ms.png`; fil: `src/spil-app.js`, `heltVoksPuls`, og udstyrslisten: giv figuren en ny lille ting eller animation pr. 3-5 rigtige, og få Marc til at vælge, hvordan Hjerte vokser); (2) niveau-op er stadig to grønne kort (banner + "Forløbet er klaret") med tre knapper "Gå til Grusgraven / Gå til Landsbygaden / Se det på kortet" (skærm: `E806-main-390-6-niveauop-hel.png`; fil: `.niveau-banner` i `src/spil.css`, `klaret-fortsaet` i `src/spil-app.js`: slå til ét kort med én knap; ordre 797 lægger "Gå til" bag "Mere", men ligger på grenen ordre-797 og er ikke i main: få den ind); (3) Min helt på 390 er den mest rodede skærm, ca. 34 ting og 2,8 skærmhøjder, og under Hånd står stadig "mål" (skærm: `E806-main-390-8-helt-hel.png` og `E806-main-390-3-kort.png`; fil: `src/spil-app.js` Min helt og `src/hhh-forklaring.js`: skjul "Øv her", "Du har ikke hjulpet nogen" og udstyrslisten bag "Mere", og skriv "måle" i stedet for "mål" under tallet).

## Gren

`kritik-806` (fra `main`), to commits; filer kun under `docs/kritik-806/` og `outputs/kritik-806/`.
- Hvad: `main` i matematik-træet (8c101c8, ordre 790 er nu merget; ordre 797 på grenen ordre-797 er ikke i main og er ikke set). Hentet med `git archive` til en midlertidig mappe og kørt lokalt i headless Chromium, 390 touch og 1280 mus, uden net, syntetisk elev "Tulle". Mit elev-script (`outputs/kritik-806/elev-806.mjs`, kopi af 800). Spillet er ikke rørt.
- Spillet: tre opgaver, niveau 2 til 3 (banner), et klaret forløb (Del ligeligt), Min helt og en simulering på 60 opgaver. Net 0, ingen fejl.
- Læst: Ganitas RAPPORT-790 og -785 ("Hvad ændret", "Hvad er næste") og første linje af min seneste matematik-kritik (800).

## Hvad ændret

- MMORPG-følelse, halvvejs. Det virker: svar-billedet viser et stort "+10 erfaring", erfaringstallet tæller op, et bånd fylder, en grøn "+1" hopper ved Hoved, og (nyt fra 790) helten lyser gult (`E806-main-390-5-svar-650ms.png`). Figuren får stav på niveau 2 og skjold på 3. Det mangler: en 11-årig ser en glød, ikke at helten *bliver noget*. Ingen ny ting på figuren pr. rigtigt svar, Hjerte står på 1 selv efter 60 ærlige opgaver (niveau 15, Hoved 9, Hånd 7, Hjerte ikke målt højere), og en gætter ender på niveau 1 med 325 erfaring (godt: ærlig regning betaler sig; men gætteren får stadig 325 erfaring uden at blive noget). Det er tættere på MMORPG end Cookie Clicker, men først ved niveau-banneret.
- Rod, ja, men kun to skærme. Synlige ting på 390 (talt fra billederne, ca.-tal; script-tal i `elev-main.json`):
  - Forsiden med opgave (`E806-main-390-3-kort.png`): ca. 28 ting. Målt 66 ord, 7 knapper, 1,9 skærmhøjder. Rolig, stort tal, klar figur.
  - Niveau-op/klaret (`E806-main-390-6-niveauop-hel.png`): ca. 22 ting (banner med fire linjer, klaret-kort, bonus, "Hvor nu?", tre knapper, "Mere", "Næste hos Mølleren", "Næste opgave"). Målt 105 ord, 5 knapper i første skærm, 2,5 skærmhøjder. Uændret fra 800.
  - Min helt (`E806-main-390-8-helt-hel.png`): ca. 34 ting (tilbage, to faner, figur, tre kort med prikker og tekst, ?, "Øv her" med knap, "Du har ikke hjulpet nogen" med knap, udstyr 1 af 9 med fem kort, rygsæk med tre sektioner, "Vis min kode", "Det har jeg lært", titler). Målt 116 ord, 2,8 skærmhøjder. Mest rodet.
  - 1280: kolonne 720 px, ingen vandret rul, roligt; helten er større, men lille i forhold til den tomme flade.
- Hoved, Hånd, Hjerte første gang (`E806-main-390-2-ny-foerste.png`): bedre end i 800. "Hånd er at måle og regne om, fx skridt til møllen" giver et billede; "Hjerte er at hjælpe en person, fx Ane, med alle hendes opgaver" er konkret nok til, at en 11-årig kan sige, hvem. Hoved forstås. Men (a) under Hånd-kortet står stadig kun "mål", som læses som fodboldmål, (b) kortene har kun ét ord ("regn", "mål", "hjælp") og forklaringen forsvinder ved "Forstået"; på Min helt står kort forklaring under hvert kort, det er godt. Lukket for det meste; "mål" er åbent.
- Er mine seneste fund lukket (800)? Punkt 1 (helten vokser ikke pr. "+N"): delvist, glød fra 790, ingen ny ting, Hjerte uændret. Punkt 2 (Hånd/Hjerte halvt forklaret): lukket i teksten (790 blok 1), "mål"-etiketten åben. Punkt 3 (helt-skærmen rodet og banner + klaret-kort): åbent i main; 797 flytter "Gå til" bag "Mere" på grenen, men er ikke i main.

## Hvad der ikke holder

- "+N" giver stadig kun tal og glød, ikke en synlig ændring på figuren.
- Hjerte vokser ikke af ærlig regning (Marcs valg, stadig uafklaret) og gæt giver erfaring.
- Niveau-op: to kort, tre knapper; klaret-kortet og banneret siger næsten det samme.
- Min helt: for mange sektioner på én lang skærm til en 11-årig.
- "mål" under Hånd.

## Hvad der holder

- Forsiden er rolig og læsbar; figuren stor; tallene tydelige.
- Hånd og Hjerte som handling med eksempel (skridt til møllen, Ane) virker.
- Heltens glød ved "+N" er synlig og ikke urolig.
- "Næste opgave" efter klaret er tydelig; spørgsmålet ligger ikke oven på klaret-kortet (785 holder).
- Ærlig regning giver niveau 15 på 60 opgaver, gætning niveau 1: det betaler sig at være et godt menneske.
- 1280 uden vandret rul; ingen net, ingen fejl.

## Ærlige grænser

- Ordre 797 (gren, ikke i main) er ikke kørt; dommen gælder main. Ganita bør få den i main, hvis den er god; jeg har ikke set den.
- Ingen rigtig 11-årig har set spillet; alt er syntetisk elev i headless Chromium. Antal ting er talt af mig fra billederne (ca.-tal).
- Scriptets klaret-billede (`E806-main-390-10-klaret-hel.png`) er taget efter en ryd, der klikkede "Næste opgave"; klaret-dommen bygger på niveau-op-billedet og på målingerne.
- Kun de tre vigtigste skærme; Questbogen og Journalen er ikke gennemgået. 1280 er set via mål og få billeder, ikke pixel for pixel.
- Ingen push, ingen merges, ingen sub-agenter, ingen elevdata. Ingen betydning for Hara.

## Testresultat

Intet nyt at teste (kritik, ingen ændring af spillet). Målekommando: `node outputs/kritik-806/elev-806.mjs <git archive af main> main` gav net 0, tom fejl-liste, banner og klaret nået på 390 og 1280, simulering 60 opgaver: ærlig niveau 15, gætter niveau 1.
