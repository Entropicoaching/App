MMORPG-foelelse: halvvejs. Rodet: ja (klaret-siden og den nye elevs foerste skaerm; selve opgaven er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 (ellevte gang aabent, Marcs valg: spoerg ham i dag, ellers bliver det ved at staa) (skaerm: `E920-nu-390-9-aerlig-efter-60.png` og `elev-nu.json` under `m.390.sim.aerlig`; fil: Hoved-reglen og niveau-reglerne i `src/spil-app.js`; vis "Hoved er fuldt, nu vokser Haand" ved loftet); (2) Hoved/Haand/Hjerte-kasserne paa opgaveskaermen er stadig tre smaa tal, og det der vokser stort ved et rigtigt svar er "+10 erfaring" og "+5" over hovedet, ikke egenskaberne (skaerm: `E920-nu-390-5-svar-150ms.png`; fil: egenskabs-kasserne og `voksTal` i `src/spil-app.js` og `src/spil.css`; lad tallet i kassen taelle op stort ved svaret, og giv Hjerte samme glimt ved foerste hjaelp, saa godhed ogsaa laener sig); (3) klaret-siden har stadig 9 knapper, 19 tal og 115 ord paa 1,96 skaerme, "Mere" staar stadig lige oven paa den naeste opgave, og "+10" ligger ovenpaa "Niveau 15" i Niveau op-banneret i stillbilledet efter 60 opgaver (skaerm: `E920-nu-390-10-klaret.png`, `-hel.png` og `E920-nu-390-9-aerlig-efter-60.png`; fil: klaret-kortet og banneret i `src/spil-app.js` og `src/spil.css`; giv "+N" egen plads over eller under overskriften og skjul "Mere" til efter en tydelig "Naeste opgave"-knap).

Metode: `main` i matematik-traeet (HEAD b615fae, ordre 909 flettet), kun `spil.html` og `src` hentet med `git archive main spil.html src` til en midlertidig mappe (hele repoet er 1,9 GB). Mit elev-script (`docs/kritik-920/elev-920.mjs`, kopi af 913) koert headless paa 390 touch og 1280 mus, uden net (0 kald), 0 sidefejl, ingen vandret rulning, syntetisk elev "Tulle". Ganitas seneste rapport (909, "Hvad aendret" og "Hvad er naeste") er laest; der findes ingen nyere end 909.

## 1. MMORPG eller ikke (halvvejs)
Det der virker: Niveau op er et oejeblik ("Niveau 3 . Laerling" i stor serif, Hoved-tallet stort og groent, "Du har faaet et traeskjold"), og helten aendrer sig synligt (kappe, stav, skjold, stjerner; ved niveau 15 en fane og mange stjerner). Efter et rigtigt svar stiger "+5" over helten og "I denne time: +10 erfaring" staar stort i en groen kasse (`E920-nu-390-5-svar-150ms.png`). Eleven ser, at noget vokser.
Det der holder det tilbage: (a) det der vokser stort er erfaring, ikke de tre egenskaber; kasserne er smaa. (b) Hoved staar paa 9 fra opgave 40 til 60 (niveau 10 til 15, Haand 2 -> 5 -> 7): tallet eleven holder oeje med stopper uden en ord. (c) Hjerte er 1, indtil man har hjulpet en hel person; "det betaler sig at vaere et godt menneske" ses ikke i de 60 opgavers forloeb. Aerlig mod gaetter (60 opgaver hver, ny elev): aerlig naar niveau 15 og 14 mestrede forloeb, Hoved 9, Haand 7; gaetter sidder paa niveau 1, 0 mestrede, Hoved 1, Haand 1, 325 erfaring. Retfaerdigt: gaet giver ingen styrke. Ingen Cookie Clicker-foelelse: det er helten, ikke taelleren, der aendrer sig.

## 2. Rod: tael paa 390 (synligt uden scroll, maalt i browseren)
| Skaerm | ord | tal | knapper | skaermhoejder |
|---|---|---|---|---|
| Ny elev, foerste skaerm | 104 | 19 | 7 | 2,03 |
| Opgaven (daglig) | 66 | 21 | 7 | 1,90 |
| Niveau op-banner | 100 | 9 | 8 | 1,81 |
| Klaret-siden | 115 | 19 | 9 | 1,96 |
| Min helt | 139 | 15 | 5 | 1,47 |
Rodest er klaret-siden (115 ord, 9 knapper, "Mere" oven paa opgaven; banneret og klaret-kortet staar nu i samme kort, hvilket er roligere end for, 913: 125 ord). Naestrodest er den nye elevs foerste skaerm: forklaringsboks, "Forstaaet", "Min helt", opgave og kort konkurrerer (`E920-nu-390-2-ny-foerste.png`). Selve opgaven er rolig. Paa 1280: klaret 129 ord/21 tal/10 knapper/2,27 skaerme; Min helt 205 ord/23 tal/9 knapper. Sammenlignet med 913: Niveau op 107/12/1,84 -> 100/9/1,81 (lidt roligere), klaret 125 ord -> 115 (lidt roligere), knapper 8 -> 9 (maalt i forskellig tilstand; ikke en aendring jeg vil kalde en forvaerring). Gevinsten fra ordre 909 er reel, men lille.

## 3. Forstaar en 11-aarig Hoved, Haand og Hjerte?
Ja, naesten. Foerste skaerm: "Hoved er at regne: dele, broeker og klokken. Haand er at maale, fx hvor mange skridt der er til moellen. Hjerte er at hjaelpe en person, fx Ane, med alle hendes opgaver." Tre korte linjer, fed forkortelse, et eksempel hver, og "?"-knappen aabner dem igen. Boksen foldes efter foerste rigtige svar (`fold-920.mjs`: aabenFoer true, aabenEfter false). Min helt siger samme ordlyd for Haand ("Du maaler ting, fx hvor mange skridt der er til moellen, saa vokser den"). Det der stadig kan snuble en 11-aarig: "regn/maale/hjaelpe" under tallene er smaat, og hvorfor Hoved holder op ved 9 forklares ikke.

## 4. Mine seneste fund (913) og status
- Hoved staar stille paa 9: AABENT (Marcs valg, ellevte gang).
- Hoved/Haand/Hjerte-kasserne er smaa tal, erfaring er det der vokser stort: AABENT.
- Hjerte-glimt ved foerste hjaelp: AABENT (ikke set i stills).
- Klaret-siden: 8 -> 9 knapper (maalt), tal 19 -> 19, ord 125 -> 115; "Mere" er stadig foer naeste opgave: DELVIST.
- HHH-boks foldes efter foerste svar: LUKKET (bekraeftet igen).
- Haand-tekst ens paa foerste-skaerm og Min helt: LUKKET.
- NYT: "+10" ligger ovenpaa "Niveau 15" i banneret (`E920-nu-390-9-aerlig-efter-60.png`); kan vaere midt i en animation, tjek med et still efter animationen.

## 5. Hvad jeg ikke kunne, og Hara
- Ikke maalt: bevaegelse (glimt, taelleop); kun stills. Ikke testet paa rigtig telefon; 390 er emuleret touch. Ikke set med rigtige 11-aarige. Overlappet "+10" er set i et enkelt still.
- `git archive` af hele matematik-repoet hang tidligere, derfor kun `spil.html` og `src`.
- Levering via hoest.mjs: se afslutningen i chatten.
- Hara: intet i dette arbejde roerer Hara. Ingen Supabase, ingen miljoevariabler skrevet, intet aendret i matematikspillet eller appen.
- Ingen elevdata eller rigtige navne; kun syntetisk "Tulle" og "Ane" (spillets egen figur).
