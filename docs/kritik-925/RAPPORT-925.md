MMORPG-foelelse: halvvejs. Rodet: ja (klaret-siden og den nye elevs foerste skaerm; selve opgaven er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 (tolvte gang aabent, Marcs valg: spoerg ham i dag) (skaerm: `elev-nu.json` under `m.390.sim.aerlig` og `E925-nu-390-9-aerlig-efter-60.png`; fil: Hoved-reglen og niveau-reglerne i `src/spil-app.js`; vis "Hoved er fuldt, nu vokser Haand" ved loftet); (2) Hoved/Haand/Hjerte-kasserne paa opgaveskaermen er stadig tre smaa tal, og det der vokser stort ved et rigtigt svar er "+10 erfaring", ikke egenskaberne; "+4" ligger desuden oven i heltens ansigt (skaerm: `E925-nu-390-5-svar-150ms.png`; fil: egenskabs-kasserne og `voksTal` i `src/spil-app.js` og `src/spil.css`; lad tallet i kassen taelle op stort ved svaret, flyt "+N" op over hovedet, og giv Hjerte et glimt ved foerste hjaelp, saa godhed ogsaa loenner sig); (3) klaret-siden har stadig 9 knapper, 18 tal og 122 ord paa 1,96 skaerme, og "Mere" staar stadig lige oven paa den naeste opgave (skaerm: `E925-nu-390-10-klaret.png` og `-hel.png`; fil: klaret-kortet i `src/spil-app.js` og `src/spil.css`; skjul "Mere" til efter en tydelig "Naeste opgave"-knap og lad opgaven vente bag den).

Metode: `main` i matematik-traeet (HEAD b615fae, ordre 909 flettet; uaendret siden min 920), kun `spil.html` og `src` hentet med `git archive` til en midlertidig mappe. Mit elev-script (`docs/kritik-925/elev-925.mjs`, kopi af 920) koert headless paa 390 touch og 1280 mus, uden net (0 kald), 0 sidefejl, ingen vandret rulning, syntetisk elev "Tulle". Ganitas to nyeste rapporter (909 og 904, "Hvad aendret" og "Hvad er naeste") laest; min seneste matematik-kritik var 920 (foerste linje: halvvejs/ja).

## 1. MMORPG eller ikke (halvvejs)
Det der virker: Niveau op er et oejeblik ("Niveau 3 . Laerling" i stor serif, "Du har faaet et traeskjold"); helten aendrer sig synligt (kappe, stav, skjold, stjerner; ved niveau 15 en fane og mange stjerner, `E925-nu-390-9-aerlig-efter-60.png`). Efter et rigtigt svar staar "+10 erfaring" stort i en groen kasse (`E925-nu-390-5-svar-150ms.png`).
Det der holder det tilbage: (a) det der vokser stort er erfaring, ikke de tre egenskaber; kasserne er smaa. (b) Hoved staar paa 9 fra opgave 40 til 60 (niveau 10 til 15, Haand 2 -> 5 -> 7): tallet eleven holder oeje med stopper uden et ord. (c) Hjerte er 1, indtil man har hjulpet en hel person; "det betaler sig at vaere et godt menneske" ses ikke i de 60 opgavers forloeb. Aerlig mod gaetter (60 opgaver hver, ny elev): aerlig naar niveau 15, 14 mestrede forloeb, Hoved 9, Haand 7; gaetter sidder paa niveau 1, 0 mestrede, Hoved 1, Haand 1, 325 erfaring. Retfaerdigt. Det er helten, ikke taelleren, der aendrer sig, altsaa ikke Cookie Clicker; men kun halvvejs MMORPG, fordi tallet i kasserne ikke er det store.

## 2. Rod: tael paa 390 (synligt uden scroll, maalt i browseren)
| Skaerm | ord | tal | knapper | skaermhoejder |
|---|---|---|---|---|
| Ny elev, foerste skaerm | 104 | 19 | 7 | 2,03 |
| Opgaven (daglig) | 66 | 21 | 7 | 1,90 |
| Niveau op-banner | 101 | 9 | 8 | 1,81 |
| Klaret-siden | 122 | 18 | 9 | 1,96 |
| Min helt | 139 | 15 | 5 | 1,47 |
Rodest er klaret-siden (122 ord, 9 knapper, "Mere" oven paa den naeste opgave). Naestrodest er den nye elevs foerste skaerm: forklaringsboks, "Forstaaet", "Min helt", opgave og kort konkurrerer (`E925-nu-390-2-ny-foerste.png`). Selve opgaven er rolig (`E925-nu-390-4-opgave.png`). Tallene er praktisk talt identiske med 920 (klaret 115 -> 122 ord, tal 19 -> 18): main er ikke aendret.

## 3. Forstaar en 11-aarig Hoved, Haand og Hjerte?
Ja, naesten. Foerste skaerm: "Hoved er at regne: dele, broeker og klokken. Haand er at maale, fx hvor mange skridt der er til moellen. Hjerte er at hjaelpe en person, fx Ane, med alle hendes opgaver." Tre korte linjer, et eksempel hver, "?"-knappen aabner dem igen, boksen foldes efter foerste svar (`fold-925.mjs`: aabenFoer true, aabenEfter false). Under tallene staar regn/maale/hjaelpe, men i lille skrift, og hvorfor Hoved holder op ved 9 forklares ikke. Kasserne alene giver Hoved = regn, men Hjerte = hjaelpe siger ikke hvem eller hvordan.

## 4. Mine seneste fund (920) og status
- Hoved staar stille paa 9: AABENT (Marcs valg, tolvte gang).
- Hoved/Haand/Hjerte-kasserne er smaa tal, erfaring vokser stort: AABENT.
- Hjerte-glimt ved foerste hjaelp: AABENT (ikke set).
- Klaret-siden: 9 knapper, 18 tal, 122 ord; "Mere" foer naeste opgave: AABENT.
- "+10" oven paa "Niveau 15" i banneret: LUKKET som fejl i banneret (rent i `E925-nu-390-9-aerlig-efter-60.png`; var midt i en animation). Men "+4" ligger stadig oven i heltens ansigt paa opgaveskaermen (`E925-nu-390-5-svar-150ms.png`): NYT, lille.
- HHH-boks foldes efter foerste svar: LUKKET. Haand-tekst ens paa foerste-skaerm og Min helt: LUKKET.

## 5. Hvad jeg ikke kunne, og Hara
- Bevaegelse er kun set som stills (150/650 ms-billeder), ikke som film. 390 er emuleret touch, ingen rigtig telefon, ingen rigtige 11-aarige. Kun 390-billederne er set med oejne; 1280 er kun maalt og gemt.
- Kun main (b615fae) er vurderet; Ganita har ikke committet noget nyt siden 909.
- Levering via hoest.mjs blev afvist af tilladelses-klassifikatoren; den er ikke koert. Marc/Dhruva maa koere den (kommandoen staar i ordren).
- Hara: intet i dette arbejde roerer Hara. Ingen Supabase, ingen miljoevariabler skrevet, intet aendret i matematikspillet eller appen. Ingen elevdata; kun syntetisk "Tulle" og "Ane".

## Gren
kritik-925, base main. Commits: se `git log --oneline main..kritik-925`.

## Hvad aendret
Kun filer under docs/kritik-925/ og outputs/kritik-925/: elev-script, fold-script, skaermbilleder, elev-nu.json og denne rapport.

## Testresultat
`node docs/kritik-925/elev-925.mjs <mappe> nu`: 0 netkald, 0 sidefejl, ingen vandret rulning (390 og 1280). `node docs/kritik-925/fold-925.mjs <mappe>`: {aabenFoer:true, aabenEfter:false}.

## Hvad er naeste
Ganita: (1) Hoved-loftet ved 9 (spoerg Marc), (2) stort tal-opgang i Hoved/Haand/Hjerte-kasserne, "+N" vaek fra ansigtet, Hjerte-glimt, (3) klaret-siden: "Mere" efter en klar Naeste opgave-knap.

## Aerlige graenser
Kun stills, emuleret touch, ingen rigtige elever; kun main b615fae vurderet.
