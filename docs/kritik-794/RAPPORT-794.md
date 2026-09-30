MMORPG-følelse: halvvejs. Rodet: ja (kun niveau-op-/klaret-skærmen på 390, nu ca. 16 ting mens den venter, men ca. 25 så snart man trykker "Næste opgave"; forsiden er rolig). De tre vigtigste ting Ganita retter næste gang: (1) klaret-kortet bliver stående oven over det nye spørgsmål, og banner + klaret-kort er stadig to kort med tre "Gå til/Se"-knapper (`E794-main-390-10-klaret-hel.png`, `E794-main-390-6-niveauop.png`; `src/spil-app.js` omkring `klaret-fortsaet`, `.niveau-banner` i `src/spil.css`): slå banner og klaret-kort sammen til ét kort med én knap, læg "Gå til ..."/"Se det på kortet" bag "Mere", og fjern kortet, når "Næste opgave" er trykket; (2) Hånd står som "mål" og "fx meter", men "mål" læses af en 11-årig som "mål i fodbold", og Hjerte er stadig abstrakt (`E794-main-390-2-ny-foerste.png`, `E794-main-390-3-kort.png`; `src/hhh-forklaring.js`, `src/spil-app.js`): skriv "Hånd: måle og regne om, fx skridt til møllen" (og "måle" i boksen under tallet) og "Hjerte: hjælp Ane med hele hendes quest"; (3) helten vokser stadig ikke pr. "+N" på forsiden, kun ved niveau, og Hjerte kan ikke vokse af ærlig regning (`E794-main-390-5-svar-150ms.png` mod `E794-main-390-8-helt.png`, sim i `elev-main.json`; `src/spil-app.js`): lad hvert "+N" give et lille nyt udstyr eller en animation på selve figuren, og få Marc til at vælge, hvordan Hjerte vokser.

# Rapport 794: matematikspillet som det står nu, set med en 11-årigs og en lærers øjne

## Gren
`kritik-794` (fra `main`). Commit 1: skærmbilleder og elev-script. Commit 2: denne rapport. Spillet er hentet med `git archive main` til en midlertidig mappe og kørt lokalt derfra (tag `main`; det er commit b537a54 = merge af ordre 785, så 774, 778 og 785 er alle med). Jeg kørte også grenen `ordre-785` (før merget) og fik identiske tal og billeder; de dubletter er slettet.

## Hvad ændret
Ingen ændring af spillet. Nyt: `outputs/kritik-794/elev-794.mjs` (kopi af mit elev-788), skærmbilleder `E794-main-*` på 390 (touch) og 1280 (mus) og `elev-main.json`. Syntetisk 11-årig "Tulle": første gang, tre opgaver, niveau op, klaret forløb, plus 60 ærlige og 60 gættede svar. Læst: Ganitas RAPPORT-785 og RAPPORT-778 ("Hvad ændret", "Hvad er næste") og første linje af min kritik 788.

## Dom og fund
1. **MMORPG-følelse: halvvejs.** Tallet vokser synligt og animeret: "+5" flyder over figuren, erfaring tæller 30 → 32 → 40, "I denne time +10" popper op, "+1" ved Hoved, "NIVEAU OP! Niveau 3 · Lærling" og "Du har fået et træskjold". Ærligt spil giver niveau 15 på 60 opgaver. Men helten ændrer sig kun ved niveau (stav på 2, skjold på 3); mellem niveauerne ser figuren ens ud (`E794-main-390-5-svar-150ms.png`: kun tal og en lille "+5"). Hjerte står på 1 efter et helt forløb, og "Du har ikke hjulpet nogen endnu: løs alle en persons opgaver" står i Min helt. Det føles som et spil, hvor tallet vokser, men helten kun springer nu og da.
2. **Rod: ja, på én skærm.** Talt på 390, synlige elementer (skøn ±3, uden kortet nederst):
   - Første gang (`-2-ny-foerste.png`): ca. 20 (helt, navn, niveau, erfaring, tre bokser, "?", forklaringskort med tre linjer og "Forstået", "Min helt", historietekst). Rolig, 2,6 skærmhøjder.
   - Forside med opgave (`-3-kort.png`): ca. 20; opgaven starter ca. 385 px nede af 844. Rolig.
   - Niveau-op-/klaret-skærmen, ventende (`-6-niveauop.png`): ca. 16 (banner med fire linjer, replik, bonus, "Hvor nu?" med tre knapper, "Mere", "Næste hos Mølleren ...", "Næste opgave"). Det er markant bedre end 28 i 788, og "Næste opgave" er tydelig (mørk fyldt knap).
   - Samme skærm efter tryk på "Næste opgave" (`-10-klaret-hel.png`): ca. 25, for banner, klaret-kort og de tre knapper står stadig, og det nye spørgsmål med tre svar står under. Scriptet måler 93 ord, 16 tal, 9 knapper, 2,61 skærmhøjder.
   - Min helt (`-8-helt.png`): ca. 25, 2,81 skærmhøjder; den vælger eleven selv.
   Ingen vandret rulning. På 1280 (`E794-main-1280-6-niveauop-hel.png`) er kolonnen 720 px, knapperne ligger på en linje, og figuren er stadig lille (ca. 150 px) i forhold til skærmen; kortet fylder mest.
3. **Forstår en 11-årig Hoved, Hånd og Hjerte første gang?** Næsten. Kortet står åbent med det samme og lukkes med "Forstået"; "?" henter det igen. "Hoved er at regne: dele, brøker og klokken" og "Hjerte er at hjælpe en person på kortet med alle opgaver" er klare, og de tre bokser har nu et ord hver (regn, mål, hjælp). To knaster: "mål" under Hånd kan en 11-åring læse som "mål" i fodbold (målet), ikke "at måle"; og "fx meter" er et eksempel uden historie. Hjerte siger nu, hvad man gør, men ikke hvad man får.
4. **Er mine seneste fund (788) lukket?**
   - (1) Klaret-kortet for fyldt: delvist lukket. 785 fik næste spørgsmål til at vente på "Næste opgave" (ca. 28 → ca. 16 ting). Åbent: banner og klaret-kort er to kort, tre knapper, og kortet bliver stående oven over spørgsmålet.
   - (2) Ét ord og ét eksempel for Hånd/Hjerte, og 778 merget: lukket i main (778 er nu i main). Forbehold: "mål" er flertydigt og eksemplet er tørt (se ovenfor).
   - (3) Vækst pr. "+N" på forsiden og Hjerte: åbent, uændret. "Gæt giver erfaring": åbent (Marcs valg): gæt gav i simuleringen 325 erfaring på 60 opgaver, men niveau 1 og Hoved/Hånd 1.
   - 1280 smal kolonne (fra 781): lukket til 720 px; figuren kunne stadig være større på bred skærm.

## Testresultat
Elev-scriptet kørte headless (Chromium fra matematik-træets playwright, uret og Math.random låst, ingen OS-mus): 0 netkald og tom `fejl`-liste, 390 og 1280. Niveau op og klaret forløb nås begge steder. Simulering (390), 60 opgaver: ærlig niveau 15, erfaring 600, Hoved 9, Hånd 7, 14 mestret; gæt niveau 1, erfaring 325, Hoved 1, Hånd 1, 0 mestret. Tal for skærmene: første gang 113 ord/8 tal/4 knapper; forside med opgave 66/21/7; niveau-op-banner 105/8/5; klaret 93/16/9; Min helt 110/15/5 (ord/tal/knapper i viewporten).

## Hvad er næste
Ganita retter de tre ting i dommen i rækkefølge: (1) ét kort og én knap på klaret-skærmen, som forsvinder ved "Næste opgave" (mål: under ca. 15 ting også efter trykket); (2) "måle" i stedet for "mål" og et eksempel med en historie for Hånd og Hjerte; (3) vis vækst på selve helten pr. "+N" (fx et lille udstyrsstykke pr. 10 erfaring). Åbent til Marc: hvordan skal Hjerte vokse, og skal gæt give erfaring? Bhishak tjekker næste gang klaret-skærmen efter tryk på "Næste opgave" på 390, og om en 11-årig kan sige, hvad "mål" under Hånd betyder. Betydning for Hara: ingen.

## Ærlige grænser
- Kun en syntetisk elev i headless Chromium; ingen rigtig 11-årig har set det.
- Elementtal er skøn ±3; ord-/tal-/knaptal er målt af scriptet.
- Jeg har ikke set helten på niveau 15 på forsiden, og ikke 1280-billederne af Min helt enkeltvis.
- Læsningen af "mål" som fodboldmål er min vurdering, ikke testet på børn.
- `hoest.mjs --aflever` køres som sidste skridt; lykkes det ikke, er rapporten kun committet lokalt på `kritik-794`.
- Ingen push, ingen merges, ingen sub-agenter, ingen elevdata.
