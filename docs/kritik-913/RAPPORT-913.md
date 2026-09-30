MMORPG-foelelse: halvvejs. Rodet: ja (klaret-siden og den nye elevs foerste skaerm; selve opgaven er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 (tiende gang aabent, Marcs valg: spoerg ham); helten vokser (Haand 2 -> 5 -> 7) men det tal eleven holder oeje med stopper uden en ord (skaerm: `E913-nu-390-9-aerlig-efter-60.png` og `elev-nu.json` under `sim.aerlig`; fil: Hoved-reglen og niveau-reglerne i `src/spil-app.js`; vis "Hoved er fuldt, nu vokser Haand" ved loftet); (2) Hoved/Haand/Hjerte-kassen paa opgaveskaermen er stadig tre smaa "1/2"-tal: efter et rigtigt svar er det "+10 erfaring" og "+6" over hovedet, der vokser stort, ikke Hoved/Haand/Hjerte (skaerm: `E913-nu-390-5-svar-150ms.png`; fil: egenskabs-kasserne og `voksTal` i `src/spil-app.js` og `src/spil.css`; lad selve tallet i kassen taelle op stort i 1-2 sekunder ved svaret, og giv Hjerte samme glimt ved foerste hjaelp, saa godhed ogsaa laener); (3) klaret-siden har stadig 8 knapper, 19 tal og 125 ord paa 1,99 skaerme, og "Mere" staar stadig lige foer den naeste opgave i stedet for efter en klar hovedknap (skaerm: `E913-nu-390-10-klaret.png` og `-hel.png`; fil: klaret-kortet i `src/spil-app.js` og `src/spil.css`; skjul "Mere" og tal-linjerne til efter en tydelig "Naeste opgave"-knap).

Metode: main i matematik-traeet (HEAD eb04799, ordre 899 flettet) hentet med `git archive main spil.html src` til en midlertidig mappe (hele arkivet er 1,9 GB og hang; kun det spillet skal bruge blev hentet); mit elev-script (`docs/kritik-913/elev-913.mjs`, kopi af 907) koert headless paa 390 touch og 1280 mus, uden net (0 kald), 0 sidefejl, ingen vandret rulning, syntetisk elev "Tulle". Ganitas RAPPORT-899 og RAPPORT-895 laest (Hvad aendret, Hvad er naeste) og foerste linje af min egen 907. Skaermbilleder og `elev-nu.json` i `outputs/kritik-913/`.

## 1. MMORPG eller ikke (halvvejs)
Det der virker: Niveau op-banneret er et oejeblik ("Niveau 3 . Laerling" i stor serif, Hoved-tallet stort og groent, "Du har faaet et traeskjold"), og helten aendrer sig synligt (kappe, stav, skjold, stjerner). Efter et rigtigt svar stiger "+6" over helten og "I denne time: +10 erfaring" staar stort i en groen kasse (`E913-nu-390-5-svar-150ms.png`). Det er godt: eleven ser, at noget vokser.
Det der holder det tilbage: (a) det der vokser stort er erfaring, ikke de tre egenskaber; Hoved/Haand/Hjerte-kasserne er stadig smaa tal, og glimtet fra 899 (groent glimt og hop) kan jeg ikke se i stills (se afsnit 5). (b) Hoved staar paa 9 fra opgave 40 til 60 (niveau 10 til 15, Haand 2 -> 5 -> 7). (c) Det betaler sig at vaere et godt menneske: Hjerte er 1 indtil man har hjulpet en person med alle hendes opgaver; Min helt siger "Du har ikke hjulpet nogen endnu: loes alle en persons opgaver", som stadig laeses som en mangel, ikke en beloenning. Et lille Hjerte-glimt efter foerste hjaelp mangler.
Ærlig mod gaetter (60 opgaver hver, ny elev): aerlig naar niveau 15 og 14 mestrede forloeb; gaetter sidder paa niveau 1, 0 mestrede, 325 erfaring. Retfaerdigt: gaet giver ingen styrke. Der er nu ingen "Cookie Clicker"-fornemmelse: det er helten, ikke taelleren, der aendrer sig.

## 2. Rod: tael paa 390 (synligt uden scroll, maalt i browseren)
| Skaerm | ord | tal | knapper | skaermhoejder |
|---|---|---|---|---|
| Ny elev, foerste skaerm | 104 | 19 | 7 | 2,03 |
| Opgaven (daglig) | 66 | 21 | 7 | 1,90 |
| Niveau op-banner | 107 | 12 | 7 | 1,84 |
| Klaret-siden | 125 | 19 | 8 | 1,99 |
| Min helt | 139 | 15 | 5 | 1,47 |
Rodest er klaret-siden (125 ord, 8 knapper, "Mere" oven paa naeste opgave; dog roligere end 907: 9 -> 8 knapper, 20 -> 19 tal, og Niveau op staar nu over kortet uden bonus-linjer). Naestrodest er den nye elevs foerste skaerm: forklaringsboks, "Forstaaet", "Min helt", opgave og kort konkurrerer (`E913-nu-390-2-ny-foerste.png`). Selve opgaven (66 ord) er rolig. Paa 1280: klaret 129 ord/21 tal/9 knapper, helt-siden 205 ord/9 knapper. Ingen vandret scroll paa nogen skaerm.

## 3. Forstaar en 11-aarig Hoved, Haand og Hjerte?
Ja, naesten. Foerste skaerm: "Hoved er at regne: dele, broeker og klokken. Haand er at maale, fx hvor mange skridt der er til moellen. Hjerte er at hjaelpe en person, fx Ane, med alle hendes opgaver." Tre korte linjer med fed forkortelse og et eksempel: det er til at forstaa, og "?"-knappen aabner den igen. Boksen foldes efter foerste rigtige svar (`fold-913.mjs`: aaben foer, lukket efter). Min helt siger nu det samme om Haand ("Du maaler ting, fx hvor mange skridt der er til moellen, saa vokser den"): ordlyden er ens. Tilbage: "opgave-raekke" (Hjerte paa Min helt) er voksensprog, og et Hjerte, der kraever ALLE en persons opgaver, er svaert at overskue for en ny elev; Hoved-linjen i "?" siger ikke, hvorfor Hoved holder op ved 9.

## 4. Mine seneste fund (907) og status
- Hoved staar stille paa 9: AABENT (Marcs valg, tiende gang).
- Klaret-siden for mange knapper/tal, "Mere" foer hovedknappen: DELVIST (9 -> 8 knapper, Niveau op uden bonus-linjer, "Mere" er stadig foer naeste opgave).
- Haand-tekst paa Min helt forskellig fra foerste-skaermen: LUKKET (samme ordlyd begge steder).
- Tallet vokser kun i banneret (mit MMORPG-forslag): AABENT for selve Hoved/Haand/Hjerte-tallet (kun erfaring og "+6" vokser paa opgaveskaermen).
- Hjerte-glimt ved foerste hjaelp: AABENT.
- HHH-boks foldes efter foerste svar: LUKKET (bekraeftet igen).

## 5. Hvad jeg ikke kunne, og Hara
- Ikke maalt: 899s groenne glimt paa Hoved/Haand i bevaegelse (kun stills paa 150/650 ms og slut; egenskabskasserne staar ens i alle tre). Ikke testet paa rigtig telefon; 390 er emuleret touch. Klassebrug med 11-aarige er ikke set; dommen er en laerers og en emuleret elevs.
- `git archive main` af hele matematik-repoet er 1,9 GB og hang to gange (tar/Expand-Archive); jeg hentede kun `spil.html` og `src`, hvilket er nok til at koere spillet.
- Levering via hoest.mjs: se afslutningen i chatten; rapporten er committet paa kritik-913.
- Hara: intet i dette arbejde roerer Hara. Ingen Supabase, ingen miljoevariabler skrevet, intet aendret i matematikspillet eller appen.
- Ingen elevdata eller rigtige navne; kun syntetisk "Tulle" og "Ane" (spillets egen figur).

## Gren
kritik-913, base main. Commits: se `git log --oneline main..kritik-913`.

## Hvad aendret
Kun filer under docs/kritik-913/ og outputs/kritik-913/: elev-script, fold-script, 39 skaermbilleder, elev-nu.json og denne rapport. Matematikspillet er ikke roert.

## Testresultat
`node docs/kritik-913/elev-913.mjs <mappe> nu`: 0 netkald, 0 sidefejl, ingen vandret rulning (390 og 1280). `node docs/kritik-913/fold-913.mjs <mappe>`: {aabenFoer:true, aabenEfter:false}.

## Hvad er naeste
Ganita: (1) Hoved-loftet ved 9 (spoerg Marc), (2) lad Hoved/Haand/Hjerte-tallet taelle op stort ved svaret og giv Hjerte et glimt ved foerste hjaelp, (3) skjul Mere og tal-linjer paa klaret-siden til efter en klar Naeste opgave-knap.

## Aerlige graenser
Ikke set i bevaegelse: 899s groenne glimt (kun stills). Ikke testet paa rigtig telefon eller med rigtige 11-aarige; 390 er emuleret touch. Kun main i matematik-traeet (eb04799) er vurderet.
