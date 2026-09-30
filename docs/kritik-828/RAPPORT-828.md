MMORPG-foelelse: halvvejs. Rodet: ja (klaret-kortet paa 390 er vaerst, 8 knapper og 115 ord paa 2,67 skaerme; forsiden er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) styrke-pletten er stadig eet lille gult punkt under foedderne, og Hjerte staar paa 1 hele vejen: helten ser ikke staerkere ud pr. "+10" (skaerm: forsiden lige efter et rigtigt svar, `E828-nu-390-5-svar-650ms.png` og `E828-nu-1280-5-svar-650ms.png`; fil: `styrkePletter` og `heltVoksPuls` i `src/spil-app.js`, `.helt-styrke-plet` i `src/spil.css`: goer den 3-4 gange stoerre og lad den nye lyse paa selve figuren, fx som stjerne paa skjoldet; Hjerte-regnemaade er Marcs valg); (2) klaret-kortet er stadig en lang blok: niveau-op, "Forloebet er klaret", "HVOR NU?" og to lukkede "Mere" (andre steder, Moelleren fortaeller) oven over den naeste opgave (skaerm: `E828-nu-390-10-klaret-hel.png`; fil: `klaret-fortsaet` og `.niveau-banner` i `src/spil-app.js` og `src/spil.css`: vis kun "Naeste opgave" som stor knap, skjul "HVOR NU?" og begge "Mere" bag een "Mere"); (3) spilsprog er ikke helt vaek paa Min helt: knappen "Questbogen", "eller questen er klaret" i rygsaekken, og Haand siger "Maal og regn om" (skaerm: `E828-nu-390-8-helt-hel.png`; fil: `src/spil-app.js` og `src/hhh-forklaring.js`: "Opgavebogen", "opgave-raekken", "Maal og regn om" -> "Maal og regn om, fx skridt til moellen" er ok men skriv "Maale" i tekst og tal).

## Hvad jeg goer
Jeg spillede som syntetisk 11-aarig "Tulle" paa 390 (touch) og 1280 (mus) med `docs/kritik-828/elev-828.mjs` (kopi af 823, headless, 0 net-kald, 0 fejl) mod matematikspillets main (d5037f9, ordre 814 merget): ny elev, tre opgaver, niveau op til 3, et klaret forloeb, Min helt, og 60 opgaver aerlig mod gaettende. Skaermbilleder i `outputs/kritik-828/`.

## Svar paa de fire spoergsmaal
1. MMORPG-foelelse: halvvejs. Tal vokser synligt (+10 erfaring i stort tal, niveau-banner, skjold dukker op paa figuren ved niveau 3, badge paa figuren), og det betaler sig at vaere aerlig: 60 aerlige opgaver giver niveau 15, Hoved 9, Haand 7, 14 forloeb mestret; 60 gaettede giver niveau 1, Hoved 1, 0 mestret (erfaring kun 325). Det er MMORPG i logikken. Men helten ser ens ud mellem niveauerne: kun et 7 px punkt og et skjold, og Hjerte staar paa 1 for en elev, der ikke har hjulpet nogen. Tallet er stort; helten er ikke staerkere at se paa.
2. Rod, synlige elementer paa 390 (knapper / ord / tal / skaermhoejder): forside 7 / 66 / 21 / 1,92; Min helt 5 / 116 / 15 / 2,15; klaret-kort 8 / 115 / 14 / 2,67 (foerste skaerm for ny elev: 4 / 116 / 8 / 2,6). Flest ting om blikket: klaret-kortet (banner, klaret-tekst, HVOR NU, to Mere, saa opgaven). Min helt har lige mange ord men er rolig: et kort pr. ting.
3. Hoved, Haand, Hjerte: ja, naesten. Ny elev faar en aaben forklaring ("Hoved er at regne... Haand er at maale og regne om... Hjerte er at hjaelpe en person, fx Ane") med knappen "Forstaaet", og "?" er altid der; under tallene staar regn / maale / hjaelpe. Det er en stor forbedring siden 817. Det, en 11-aarig stadig ikke ved: hvorfor Hjerte er 1, og at Hjerte ikke vokser af almindelige opgaver (Min helt siger det, men forsiden ikke).
4. Mine seneste fund (823): (1) to graa/groenne kort oven paa hinanden: delvist lukket, banner og klaret-kort er eet kort, men blokken er stadig lang; (2) styrke-pletter for smaa: ikke lukket; (3) quest-ord: forsiden er lukket ("1 ny opgave-raekke", "hjaelpe"), Min helt har stadig "Questbogen" og "questen".

## Hvad Ganita boer tjekke
- Er pletten/stjernen paa figuren stor nok til at en 11-aarig siger "han er staerkere"?
- Er klaret-kortet nede paa en skaerm (ca. 1,5 hoejder paa 390)?

## Aerlige graenser
- Kun syntetisk elev i headless Chromium; ingen rigtig 11-aarig har set det. Jeg saa ikke alle skaermbilleder (kun svar-650ms, klaret-hel og helt-hel paa 390 er set; 1280 er kun set via tal).
- Maalingerne er tekst- og knaptal, ikke oejenbevaegelse; "rod" er mit skoen.
- Jeg roerte ikke matematikspillet; udtraek ligger i en midlertidig mappe.

## Hara
Ingen betydning for Hara.

## Gren
Gren: kritik-828
Commits: se `git log kritik-828`.
