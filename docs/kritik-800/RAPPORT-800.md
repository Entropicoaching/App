MMORPG-følelse: halvvejs. Rodet: ja (kun helt-skærmen og niveau-op-/klaret-skærmen på 390; forsiden er nu rolig nok). De tre vigtigste ting Ganita retter næste gang: (1) heltens udstyr vokser stadig kun ved niveau, ikke pr. "+N", og Hjerte kan ikke vokse af ærlig regning (skærm: forsiden, svar-billedet `E800-main-390-5-svar-650ms.png`; fil: `src/spil-app.js`; ordre 790 blok 2 på grenen ligger klar med en lysende helt, men er ikke i main: få den ind og lad helten få en ny ting pr. 3-5 rigtige); (2) Hånd og Hjerte er stadig kun halvt forklaret i main: "Hånd er at måle og regne om, fx meter" og "Hjerte er at hjælpe en person på kortet med alle opgaver" (skærm: `E800-main-390-2-ny-foerste.png`; fil: `src/hhh-forklaring.js`; 790 blok 1 har "skridt til møllen, Ane" på grenen: få den i main og læg forklaringen som et lille billede på hvert af de tre kort); (3) helt-skærmen på 390 er den mest rodede (ca. 32 ting, 2,8 skærmhøjder) og niveau-op-kortet har stadig banner + klaret-kort + tre "Gå til/Se"-knapper (skærm: `E800-main-390-8-helt.png` og `E800-main-390-6-niveauop.png`; fil: `.niveau-banner` i `src/spil.css`, `klaret-fortsaet` i `src/spil-app.js`: slå banner og klaret-kort sammen til ét kort med én knap, og læg "Gå til ..." bag "Mere").

## Hvad jeg har set
Gren: kritik-800
- Hvad: `main` i matematik-træet (b537a54, ordre 785; grenen med ordre 790 er ikke merget og er ikke set). Hentet med `git archive` til en midlertidig mappe og kørt lokalt i headless Chromium, 390 touch og 1280 mus, uden net, syntetisk elev "Tulle". Mit elev-script (`outputs/kritik-800/elev-800.mjs`, kopi af 794) og en lille kontrol (`klaret-800.mjs`).
- Spillet: tre opgaver, niveau 2 til niveau 3 (banner), et klaret forløb (Del ligeligt), Min helt, og en simulering på 60 opgaver (ærlig: niveau 15; gætter: niveau 1). Net 0, ingen fejl.
- Læst: Ganitas RAPPORT-785 og -778 ("Hvad ændret", "Hvad er næste") og første linje af min egen seneste matematik-kritik (794).

## Dommen
- MMORPG-følelse, halvvejs: tallet vokser synligt (svar-billedet viser "+10 erfaring" og en grøn "+1" ved Hoved, erfaringstallet tæller op, og et bånd fylder), og figuren får udstyr ved niveau (stav på 2, skjold på 3). Men det sker først ved niveau; hvert rigtigt svar giver kun et tal og en boks. Helten bliver ikke stærkere, mens man spiller, kun når banneret kommer. Hjerte er 1 hele vejen igennem en ærlig runde. Det er en fin belønningsskærm, ikke et MMORPG endnu. Det er ikke Cookie Clicker: ærlig regning slår gætning (niveau 15 mod 1 efter 60 opgaver), og det er godt.
- Rod, ja, men kun to skærme. Synlige ting på 390 (talt fra billederne, skærmen som den åbner):
  - Forsiden med opgave (`E800-main-390-3-kort.png`): ca. 28 ting (figur, navn, niveau, ringe, erfaring, tre kort med tal, ?, Min helt, ny quest, sted, titel, stjerner, spørgsmål, Brøker-pille, tre svar). Målt 66 ord, 7 knapper, 1,9 skærmhøjder. Rolig nok, stort tal og klar figur.
  - Niveau-op/klaret (`E800-main-390-6-niveauop.png`, `E800-390-klaret-uden-ryd-hel.png`): ca. 22 ting i første skærm (banner med fire linjer, klaret-kort, bonus, "Hvor nu?", tre knapper, "Mere", "Næste hos Mølleren", "Næste opgave"), 109 ord, 2,5 skærmhøjder. Bedre end 794 (ca. 16 ventende, men ikke længere ca. 25 efter "Næste opgave"): spørgsmålet ligger nu ikke oven på klaret-kortet (kontrolleret: 0 svarknapper, "Næste opgave" synlig). Men banner og kort er stadig to kort.
  - Min helt (`E800-main-390-8-helt.png`): ca. 32 ting (tilbage, titel, to faner, navn, niveau, rang, ringe, tekst, figur, tre kort med prikker og tekst, ?, "Øv her" med knap, "Du har ikke hjulpet nogen"), 2,8 skærmhøjder, den mest rodede.
  - 1280: kolonnen er 720 px og helten større; ingen vandret rul; roligt, men figuren er stadig lille i forhold til den tomme flade (`E800-main-1280-3-kort.png`).
- Hoved, Hånd, Hjerte, første gang (`E800-main-390-2-ny-foerste.png`): Hoved forstår en 11-årig ("regne: dele, brøker og klokken"). Hånd "at måle og regne om, fx meter": halvt; "mål" under tallet læses stadig som fodboldmål, og "fx meter" giver ikke et billede. Hjerte "at hjælpe en person på kortet med alle opgaver": abstrakt; hvem, og hvordan? Kortene under forklaringen har kun ét ord ("regn", "mål", "hjælp"). Forklaringsboksen er stor på første skærm (ca. 1/4) og skal krydses af, hvilket er fint.
- Er mine seneste fund lukket (794)? Punkt 1 (klaret-kort oven over nyt spørgsmål): lukket i 785; banner + kort to kort og tre knapper: åbent. Punkt 2 (Hånd "mål", Hjerte abstrakt): åbent i main, men 790 blok 1 på grenen retter det. Punkt 3 (helten vokser ikke pr. "+N"): åbent i main; 790 blok 2 på grenen retter det delvist, ikke set af mig.

## Hvad der ikke holder
- "+N" giver kun et tal, ikke en ændring på helten (åbent siden 741).
- Hjerte vokser ikke af ærlig regning; Marc har ikke valgt hvordan.
- Helt-skærmen konkurrerer om blikket: figuren, tre kort med prikker og tekst, "Øv her", "Du har ikke hjulpet", udstyrslisten.
- Banner og klaret-kort er to grønne kort med hver sin overskrift ("Niveau 3!" og "Forløbet er klaret") og tre knapper.

## Hvad der holder
- Forsiden er rolig, figuren stor, tallene tydelige; "Næste opgave" efter klaret er tydelig og ny opgave venter (785 holder).
- Ærlig regning belønnes langt mere end gætning; gætning ender ikke i noget, der ligner en helt.
- 1280 uden vandret rul, ingen net, ingen fejl.

## Hvad der ikke er gjort eller set
- Ordre 790 (grenen, ikke merget) er ikke kørt; dommen gælder main. Ganita bør få den i main, hvis dens ændringer er gode; jeg har ikke set dem.
- Ingen rigtig 11-årig har set spillet; alt er syntetisk elev i headless Chromium. Antal ting på skærmene er talt fra billederne af mig (ca.-tal), ikke af et script; scriptets ord/knap-tal står i `elev-main.json`.
- Kun de tre vigtigste skærme; Questbogen og Journalen er ikke gennemgået i denne omgang.
- Scriptets klaret-billede (`E800-main-390-10-klaret*.png`) er taget efter en ryd, der klikkede "Næste opgave", så spørgsmålet ses der; brug `E800-390-klaret-uden-ryd*.png` til dommen.
- Ingen push, ingen merges, ingen sub-agenter, ingen elevdata, matematikspillet er ikke rørt.

## Hvad det betyder for Hara
Intet, arbejdet berører ikke Hara.
