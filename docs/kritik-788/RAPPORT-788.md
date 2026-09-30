MMORPG-følelse: halvvejs. Rodet: ja (kun niveau-op-/klaret-skærmen på 390, stadig ca. 28 ting; forsiden er rolig). De tre vigtigste ting Ganita retter næste gang: (1) niveau-op-/klaret-kortet på 390 er kun lidt roligere efter 778 og har stadig banner, klaret-kort, bonus, "Hvor nu?", tre knapper, "Mere" og et nyt spørgsmål med tre svar under hinanden (`E788-o778-390-10-klaret-hel.png`, `E788-o778-390-6-niveauop.png`; kortet i `src/spil-app.js`, `.niveau-banner` i `src/spil.css`): slå banner og klaret-kort sammen til ét kort med én "Fortsæt"-knap, læg "Gå til ..."/"Se det på kortet" bag "Mere", og lad næste spørgsmål vente til efter "Fortsæt"; (2) 778 skal merges, ellers er Hånd stadig tre ord (`E788-nu-390-2-ny-foerste.png` mod `E788-o778-390-2-ny-foerste.png`; `src/hhh-forklaring.js`, `src/spil-app.js`): på `main` står Hånd som "bruge" på forsiden og "Mål og regn om, så vokser den" i Min helt, på ordre-778 "mål" og "fx meter" alle steder, men Hjerte-teksten "hjælpe en person på kortet med alle opgaver" siger stadig ikke, hvad man gør, og "meter" er et eksempel uden en historie: skriv fx "Hånd: mål og regn om, fx skridt til møllen" og "Hjerte: hjælp Ane med hele hendes quest"; (3) helten vokser ikke synligt pr. "+N" på forsiden, og Hjerte kan ikke vokse af ærlig regning (`E788-o778-390-3-kort.png` mod `E788-o778-390-8-helt.png`, sim i `elev-o778.json`; `src/spil-app.js`): lad hvert "+N" på forsiden give et lille nyt udstyr eller en animation på selve figuren, og få Marc til at vælge, hvordan Hjerte vokser, og om gæt skal give erfaring.

# Rapport 788: matematikspillet som det står nu, set med en 11-årigs og en lærers øjne

## Gren
`kritik-788` (fra `main`). Commit 1: skærmbilleder og elev-script. Commit 2: denne rapport. Spillet er hentet med `git archive` (kun `spil.html`, `matematik.html`, `src`, `data`, `package.json`) til midlertidige mapper og kørt lokalt derfra, to gange: (a) `main` (nyeste commit d1c135a, ordre 774) og (b) grenen `ordre-778` (commit 2f8a024), som er committet men ikke merget. Tag `nu` = main, `o778` = ordre-778. Spillet er ikke ændret.

## Hvad ændret
Ingen ændring af spillet. Nyt: `outputs/kritik-788/elev-788.mjs` (kopi af elev-781), skærmbilleder `E788-nu-*` og `E788-o778-*` på 390 (touch) og 1280 (mus), `elev-nu.json` og `elev-o778.json`. Syntetisk 11-årig "Tulle": første gang, tre opgaver, niveau op, klaret forløb, plus 60 ærlige og 60 gættede svar. Læst: Ganitas RAPPORT-774 og RAPPORT-771 (de to nyeste i `main`; "Hvad ændret" og "Hvad er næste") og første linje af min egen seneste matematik-kritik (781). Betydning for Hara: ingen.

## Dom og fund
1. **MMORPG-følelse: halvvejs.** Tallet vokser synligt: "+40 erfaring", "+1" ved Hoved og "Niveau 3 · Lærling" springer i øjnene, og ærligt spil giver niveau 15 på 60 opgaver. Helten på forsiden er stor (ca. 140 px), har stav og ved niveau 3 et skjold. Men mellem to niveauer ændrer forsidehelten sig næsten ikke, det store billede med kappe ligger stadig i Min helt (`E788-o778-390-8-helt.png`), Hjerte står på 1 hele vejen ved ærligt spil, og 1280 er stadig en smal kolonne (`E788-nu-1280-6-niveauop.png`). At gætte giver stadig erfaring (325 på 60 opgaver, niveau 1), så "det betaler sig at være et godt menneske" er ikke stramt; det er Marcs valg.
2. **Rod: ja, på én skærm.** Talt på 390, synlige elementer (skøn ±3, ikke DOM-måling), uden kortet nederst:
   - Første gang (`E788-nu-390-2-ny-foerste.png`): ca. 20 (helt, navn, niveau, erfaring, tre bokser, "?", forklaringskort med tre linjer og "Forstået", "Min helt", historietekst). Rolig nok, 2,6 skærmhøjder.
   - Forside med opgave (`-3-kort.png`): ca. 20; opgaven starter ca. 385 px nede af 844. Rolig.
   - Niveau-op/klaret, `main` (`E788-nu-390-10-klaret-hel.png`): ca. 32. Niveau med "+1", "I denne time"-boks, tre bokser med "+1", "Min helt", banner, klaret-kort, "Hvor nu?", tre knapper, "Mere", nyt spørgsmål. 2,67 skærmhøjder.
   - Niveau-op/klaret, `ordre-778` (`E788-o778-390-10-klaret-hel.png`): ca. 28. "+1" ved Niveau og "I denne time" er væk, men resten står, 2,61 skærmhøjder. Målt af scriptet (ord/tal/knapper): banner 115/13/7, klaret 120/16/6.
   Ingen vandret rulning. Min helt (ca. 25 ting, 2,81 skærmhøjder) er også lang, men den vælger eleven selv.
3. **Forstår en 11-årig Hoved, Hånd og Hjerte?** Halvvejs. Kortet står med det samme og kan lukkes med "Forstået"; "?" henter det igen. "Hoved = regne" og "Hjerte = hjælpe" er klare. På `main` er Hånd stadig tre ord: "bruge" (forsiden), "bruge matematikken: mål og regn om, fx meter" (forklaringen) og "Mål og regn om, så vokser den" (Min helt). På `ordre-778` hedder det "mål" alle steder og "Hånd er at måle og regne om, fx meter", og Min helt siger "fx meter, så vokser den": bedre, næsten forståeligt. Hjerte: "hjælpe en person på kortet med alle opgaver" (778) er bedre end "til alle er løst", men en 11-årig ser stadig ikke, hvornår Hånd eller Hjerte vokser, og Hjerte vokser aldrig af ærlig regning.
4. **Er mine seneste fund (781) lukket?**
   - (1) Klaret-kortet for fyldt: delvist lukket i 778 (ikke i `main`): "+1" ved Niveau og "I denne time" fjernet. Åbent: banner og klaret-kort er stadig to kort, tre knapper, "Mere" og nyt spørgsmål under.
   - (2) Ét ord og ét eksempel for Hånd/Hjerte: lukket i 778 (ikke i `main`), med forbehold: eksemplet "meter" er tørt, Hjerte-teksten siger ikke, hvad man gør.
   - (3) Synlig vækst pr. "+N" på forsiden og Hjerte: åbent, uændret. Gæt giver erfaring: åbent (Marcs valg).
   - Ny: 778 er committet, men ikke merget. Marc ser `main`, så 774-versionen er den, klassen får, indtil den merges.

## Testresultat
Elev-scriptet kørte headless (Chromium fra matematik-træets playwright, uret og Math.random låst, ingen OS-mus) på begge versioner: 0 netkald og tom `fejl`-liste, 390 og 1280. Klaret forløb og niveau-op nås begge steder. Simulering (390), 60 opgaver, ens i begge versioner: ærlig niveau 15, erfaring 600, Hoved 9, Hånd 7, 14 mestret; gæt niveau 1, erfaring 325, Hoved 1, Hånd 1, 0 mestret. Hjerte er ikke målt i scriptet (står på 1 i billederne). Jeg har set 6 billeder enkeltvis (390: første gang, niveau-op og klaret på main; klaret på 778); resten er kun målt.

## Hvad er næste
Ganita retter de tre ting i dommen i rækkefølge: (1) ét kort og én "Fortsæt"-knap i stedet for banner + klaret-kort + tre knapper + nyt spørgsmål (mål: under ca. 15 ting); (2) merge 778 og skriv Hånd/Hjerte som en handling med et eksempel fra spillet; (3) vis vækst på selve helten pr. "+N". Åbent til Marc: hvordan skal Hjerte vokse, og skal gæt give erfaring? Bhishak tjekker næste gang, om klaret-kortet er under ca. 15 ting, og om en 11-årig kan sige, hvad Hånd er, uden at spørge.

## Ærlige grænser
- Kun en syntetisk elev i headless Chromium; ingen rigtig 11-årig har set det.
- Elementtal er skøn ±3; ord-/tal-/knaptal er målt af scriptet.
- Jeg har ikke set 1280-billederne enkeltvis i denne omgang, og ikke helten på niveau 15 på forsiden.
- Ordren sagde `main`; da 778 (som svarer på mine fund) kun ligger på en gren, kørte jeg begge og skrev forskellen.
- Leveringen med `hoest.mjs --aflever` blev afvist af tilladelsessystemet og er ikke kørt; rapporten er kun committet lokalt på `kritik-788`.
- Ingen push, ingen merges, ingen sub-agenter, ingen elevdata.
