MMORPG-foelelse: halvvejs. Rodet: ja (klaret-siden og den nye elevs foerste skaerm; selve opgaven og kortet er rolige). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15 (ottende gang aabent); Haand vokser 2 -> 5 -> 7, men eleven faar ingen besked om hvorfor Hoved staar (skaerm: `E901-nu-390-9-aerlig-efter-60.png` og `elev-nu.json` under `sim.aerlig`; fil: Hoved-reglen i `src/spil-app.js` og niveau-reglerne; vis "Hoved er fuldt, nu vokser Haand" ved loftet; Marcs valg, spoerg ham); (2) klaret-siden har stadig 9 knapper, 19 tal og 117 ord paa 2,03 skaerme, og "Mere" staar oven over den naeste opgave (skaerm: `E901-nu-390-10-klaret-hel.png`; fil: klaret-kortet i `src/spil-app.js` og `src/spil.css`; skjul "Mere" og tal-linjerne til efter "Naeste opgave", saa der er en hovedknap); (3) Min helt-siden bruger stadig den gamle, svaere Haand-tekst "Maal og regn om, fx skridt til moellen, saa vokser den" (Marcs nye ordlyd er kun paa foerste-skaermen), og nyt-elev-boksen er stadig aaben oven paa foerste opgave (skaerm: `E901-nu-390-8-helt-hel.png` og `E901-nu-390-2-ny-foerste.png`; fil: Haand-tekstkortet paa helte-siden og `.hhh`-boksen i `src/spil-app.js`; skriv "Haand: du maaler ting, fx hvor mange skridt der er til moellen" ogsaa paa helte-siden, og fold HHH-boksen bag "?" efter foerste opgave, som ordre 895 sagde).

## 1. Hvad jeg goer
Hentede matematikspillet fra main (commit 3a12e6a, ordre 895) med `git archive` til en midlertidig mappe og koerte mit elev-script (`docs/kritik-901/elev-901.mjs`, kopi af 897) headless: 390 touch og 1280 mus, uden net, syntetisk elev "Tulle" (ingen rigtige data). Tre opgaver, niveau op til 3, et klaret forloeb, Min helt, og en simulering af 60 opgaver (aerlig og gaetter). Laeste Ganitas RAPPORT-884 og -888 (Hvad aendret / Hvad er naeste) og foersteliniet i min egen RAPPORT-897. Skaermbilleder og `elev-nu.json` i `outputs/kritik-901/`. Ingen fejl i konsollen, 0 netkald.

## 2. Hvad jeg fandt
- MMORPG: halvvejs. Det virker: Niveau 3 staar stort i serif og groent i banneret ("Hoved er nu 3" med stort 3), +40 vokser i rygsaekken, helten faar staf og traeskjold, kappen aendres, kortet viser figuren paa Moellen. Det mangler: helten bliver kun staerkere synligt i de foerste ca. 9 niveauer; derefter staar Hoved stille og eleven ser ingen aarsag. Og Haand/Hjerte staar paa 1 laenge for en aerlig elev, saa "tre ting der vokser" foeles som een.
- Rod: klaret-siden foerst (banner + kort + 3 linjer + "Mere" + naeste opgave + kort, 9 knapper, 19 tal). Dernaest ny elevs foerste skaerm (HHH-boks + "Min helt" + opgave: 7 knapper, 19 tal, 104 ord, 2,03 skaerme). Opgaven og kortet er rolige (66 ord, 1,9 skaerme).
- Hoved/Haand/Hjerte: forstaaeligt paa foerste skaerm ("Hoved er at regne...", "Haand er at maale, fx hvor mange skridt der er til moellen", "Hjerte er at hjaelpe en person, fx Ane"): ja, det er i orden for en 11-aarig, og "Haand" er nu lettere. Men "Forstaaet"-knappen og boksen fylder foer opgaven, og paa helte-siden staar den gamle svaere Haand-tekst.

## 3. Tal (390 px)
| Skaerm | ord | tal | knapper | skaerme |
|---|---|---|---|---|
| Ny elevs foerste | 104 | 19 | 7 | 2,03 |
| Kort/opgave | 66 | 21 | 7 | 1,90 |
| Niveau op (banner) | 114 | 14 | 7 | 1,88 |
| Klaret | 117 | 19 | 9 | 2,03 |
| Min helt | 136 | 15 | 5 | 1,45 |
Simulering (aerlig): opg. 40 niveau 10 Hoved 9 Haand 2; opg. 60 niveau 15 Hoved 9 Haand 7. Gaetter: niveau 1 efter 60 opgaver (rigtigt: gaetning belonnes ikke).

## 4. Mine seneste fund (897), lukket eller ej
- Haand-tekst paa foerste-skaermen: LUKKET (ordre 895, Marcs ordlyd). Paa helte-siden: AABEN.
- HHH-boks aaben oven paa foerste opgave: AABEN (895 foldede den kun efter foerste opgave; foerste skaerm er uaendret, 2,03 skaerme).
- Klaret-siden 9 knapper/"Mere": AABEN.
- Hoved staar paa 9 fra opgave 40: AABEN (ottende gang, Marcs valg).
- Stort tal i niveau-banneret (888): LUKKET, ser ud som styrke og fylder ikke for meget.
- Banner + klaret-kort som eet kort (884): LUKKET.

## 5. Hvad Ganita skal goere naeste gang, og Hara
Se de tre punkter i foerste linje. Kraever Marc: Hoved-loftet ("fuldt, nu vokser Haand"), og om HHH-boksen maa foldes ind fra start. Bonus, hvis tid: en synlig "helten er staerkere"-linje ved niveau op ud over Hoved-tallet (fx nyt udstyr som billede i banneret). Jeg har ikke roert spillet. Kunne ikke: maale paa rigtige elever; alt er syntetisk. Betydning for Hara: ingen.

Gren: kritik-901
