MMORPG-foelelse: halvvejs. Rodet: ja (klaret-siden og den nye elevs foerste skaerm; selve opgaven er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 (niende gang aabent); Haand vokser 2 -> 5 -> 7, men eleven faar ingen besked om hvorfor Hoved staar (skaerm: `E907-nu-390-9-aerlig-efter-60.png` og `elev-nu.json` under `sim.aerlig`; fil: Hoved-reglen i `src/spil-app.js` og niveau-reglerne; vis "Hoved er fuldt, nu vokser Haand" ved loftet; Marcs valg, spoerg ham); (2) klaret-siden har stadig 9 knapper, 20 tal og 125 ord paa 2,03 skaerme, og "Mere" staar stadig foer "Naeste opgave" (skaerm: `E907-nu-390-10-klaret-hel.png`; fil: klaret-kortet i `src/spil-app.js` og `src/spil.css`; skjul "Mere" og tal-linjerne til efter "Naeste opgave", saa der er en hovedknap); (3) Min helt-siden har stadig den gamle, svaere Haand-tekst "Maal og regn om, fx skridt til moellen, saa vokser den", mens foerste-skaermen siger "Haand er at maale, fx hvor mange skridt der er til moellen" (skaerm: `E907-nu-390-8-helt.png`; fil: Haand-tekstkortet paa helte-siden i `src/spil-app.js`; skriv samme ordlyd begge steder: "Haand: du maaler ting, fx hvor mange skridt der er til moellen").

Metode: main i matematik-traeet (HEAD 419d656, ordre 899 blok 1+2) hentet med `git archive` til en midlertidig mappe; mit elev-script (`docs/kritik-907/elev-907.mjs`, kopi af 901) koert headless paa 390 touch og 1280 mus, uden net (0 kald), syntetisk elev "Tulle". Ganitas RAPPORT-888 og RAPPORT-895 laest (Hvad aendret, Hvad er naeste), og foerste linje af min egen 901. Skaermbilleder og `elev-nu.json` i `outputs/kritik-907/`.

## 1. MMORPG eller ikke (halvvejs)
Det der virker: Niveau op-banneret er nu et rigtigt oejeblik: "Niveau 3 · Laerling" i stor serif, det nye Hoved-tal (3) stort og groent, "Du har faaet et traeskjold", og helten er synligt en anden (kappe, stav, skjold, stjerner) paa Min helt-siden. Bonus "+40 Broeker" er stor og tydelig. Det foeles som at blive staerkere.
Det der holder det tilbage: (a) tallet vokser kun i banneret; paa selve opgaveskaermen staar Hoved/Haand/Hjerte som tre smaa "1"-tal, og eleven ser dem ikke taelle op naar hun svarer. (b) Hoved staar paa 9 fra opgave 40 til 60 mens niveauet stiger fra 10 til 15: helten vokser (Haand 2 -> 5 -> 7), men det ene tal eleven har laert at holde oeje med stopper uden forklaring. (c) Det betaler sig at vaere et godt menneske: Hjerte staar paa 1 indtil man hjaelper en person med alle hendes opgaver; "Du har ikke hjulpet nogen endnu" paa helte-siden foeles som en anklage, ikke en belonning. Godhed boer give et synligt og hurtigt udslag (fx et Hjerte-glimt efter foerste hjaelp, som Hoved/Haand allerede faar i 899).
Gaetter mod aerlig (60 opgaver hver, ny elev): aerlig naar niveau 15 og 14 mestrede forloeb; gaetter sidder paa niveau 1 med 0 mestrede. Det er retfaerdigt: gaet giver ingen styrke.

## 2. Rod: tael paa 390 (synligt uden scroll, maalt i browseren)
| Skaerm | ord | tal | knapper | skaermhoejder |
|---|---|---|---|---|
| Ny elev, foerste skaerm | 104 | 19 | 7 | 2,03 |
| Opgaven (daglig) | 66 | 21 | 7 | 1,90 |
| Niveau op-banner | 114 | 14 | 7 | 1,88 |
| Klaret-siden | 125 | 20 | 9 | 2,03 |
| Min helt | 136 | 15 | 5 | 1,45 |
Klaret-siden er rodest: 9 knapper, 20 tal, over to skaerme, og "Mere" staar foer hovedknappen. Naestrodest er den nye elevs foerste skaerm: forklaringsboks, "Forstaaet", "Min helt", opgave og kort konkurrerer. Selve opgaven (66 ord) er rolig. Ingen vandret scroll. Paa 1280: klaret 130 ord/21 tal/9 knapper, helt-siden 202 ord.

## 3. Forstaar en 11-aarig Hoved, Haand og Hjerte?
Halvvejs, men bedre end sidst. Foerste skaerm (`E907-nu-390-2-ny-foerste.png`): "Hoved er at regne: dele, broeker og klokken. Haand er at maale, fx hvor mange skridt der er til moellen. Hjerte er at hjaelpe en person, fx Ane, med alle hendes opgaver." Hoved og Hjerte er klare, Haand er nu forstaaeligt. Men paa Min helt staar en anden Haand-tekst ("Maal og regn om ..."), og en forklaring der siger to ting er ingen forklaring. "regn om" og "opgave-raekke" er voksensprog. "?"-knappen er tydelig og aabner forklaringen igen.

## 4. Mine seneste fund (901) og status
- Hoved staar stille paa 9 (niende gang): AABENT (Marcs valg).
- Klaret-siden 9 knapper/19-20 tal: AABENT (117 -> 125 ord, 2,03 skaerme; "Mere" er stillere, men staar stadig foer hovedknappen).
- HHH-boksen aaben oven paa foerste opgave: LUKKET. `docs/kritik-907/fold-907.mjs` (ny elev, 390): aaben foer svar, lukket efter foerste rigtige svar.
- Haand-tekst paa foerste-skaermen: LUKKET. Paa Min helt: AABENT (se 3).
- Niveau-banner oven i Moellerens kort: LUKKET (intet skaaret af).
- Ganitas 899 (groent glimt, bonus-linjer under Mere) ligger paa main uden rapport; glimtet kan ikke ses i stills.

## 5. Hvad jeg ikke kunne, og Hara
- Ikke maalt: det groenne glimt (899) i bevaegelse; kun stills (`E907-nu-390-6-niveauop-300ms.png`, `-6-niveauop.png`). Ikke testet paa rigtig telefon; 390 er emuleret touch.
- Fold-scriptet ramte foerst et forkert svar (opgaven varierer uden laast Math.random); det lukkede efter en runde klik, der endte rigtigt. "Et forkert svar folder ikke" er kun set i 895s egen beskrivelse og i, at boksen stadig var aaben efter det foerste forkerte i min foerste koersel.
- Levering: `hoest.mjs ... --aflever` blev afvist af tilladelsessystemet, saa rapporten er IKKE afleveret via hoest.mjs; den er committet paa kritik-907.
- Hara: intet i dette arbejde roerer Hara. Ingen Supabase, ingen miljoevariabler, intet skrevet i matematikspillet eller appen.
- Ingen elevdata eller rigtige navne; kun syntetisk "Tulle" og "Ane" (spillets egen figur).
