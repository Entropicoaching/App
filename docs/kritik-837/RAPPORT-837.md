MMORPG-foelelse: halvvejs. Rodet: ja (Min helt og klaret-kortet paa 390; forsiden er rolig). De tre vigtigste ting Ganita retter naeste gang: (1) Hjerte staar paa 1 hele vejen (ogsaa efter 60 aerlige opgaver er Hoved 9, Haand 7, og Hjerte er stadig den der aldrig bevaeger sig i simuleringen): "det betaler sig at vaere et godt menneske" ses ikke paa tallene (skaerm: forsiden efter et rigtigt svar, `E837-nu-390-5-svar-650ms.png`, og `E837-nu-390-9-aerlig-efter-60.png`; fil: Hjerte-regningen i `src/spil-app.js` og `src/spil.css`; giv Hjerte et lille synligt hop foerste gang eleven hjaelper/deler, fx +1 og en gylden puls paa Hjerte-kortet; regnevalget er Marcs); (2) klaret-kortet er stadig ca. 2,4 skaermhoejder paa 390 (2,45 paa 1280) med 16 tal og 9 knapper, og "Mere: andre steder . Moelleren fortaeller" er en tekst der ikke ligner en knap (skaerm: `E837-nu-390-10-klaret-hel.png`; fil: `klaret-fortsaet` i `src/spil-app.js`, `.niveau-banner` i `src/spil.css`: skjul Moellerens replik og "Byen vaagner" bag "Mere" og lad kortet kun have Niveau op + een stor "Naeste opgave"); (3) Min helt paa 390 er ca. 2,1 skaerme med ca. 15 tal og 5 knapper, og "Rygsaekken: det har jeg laert" og "Dine titler" konkurrerer med Hoved/Haand/Hjerte (skaerm: `E837-nu-390-8-helt-hel.png`; fil: Min helt-visningen i `src/spil-app.js` og `src/spil.css`: luk begge sektioner som "Dit udstyr" allerede er lukket).

## 1. Hvad jeg goer
Ordre 837: matematikspillet (Ganitas main, hentet med `git archive`, kun laest) spillet som 11-aarig "Tulle" (syntetisk) paa 390 touch og 1280 mus med `docs/kritik-837/elev-837.mjs` (kopi af elev-833): ny elev, tre opgaver, niveau op (2 til 3), klaret forloeb, Min helt, og 60-opgavers simulering (aerlig og gaettende). Headless, uden net. 0 net-kald, 0 fejl, ingen vandret rulning. Laest: RAPPORT-827 og RAPPORT-820 ("Hvad aendret", "Hvad er naeste") og foerste linje af min kritik 833. Skaermbilleder: `outputs/kritik-837/E837-nu-*.png`, maal: `elev-nu.json`.

## 2. Hvad jeg fandt
- MMORPG: halvvejs. Bedre end 833: tallet vokser synligt ("+10 erfaring" stort i groent, XP-streg, niveau-banner), helten faar ting (vandrestav, traeskjold, kappe) og to-tre stjerner allerede ved niveau 2-3 (833: kun 1); 8 stjerner ved niveau 15. Men Hjerte ("det betaler sig at vaere godt") flytter sig ikke, og Haand er 1 til ca. opgave 30. Gaetter faar niveau 1 efter 60 opgaver (godt: det betaler sig ikke at gaette).
- Rod, talt paa 390: forside efter svar ca. 8 tal / 4 knapper (rolig, 2,6 skaerme foerste gang pga. forklaringen); kort/opgave 21 tal / 7 knapper (1,9 skaerme); klaret-kortet 16 tal / 9 knapper (2,4 skaerme); Min helt 15 tal / 5 knapper (2,15 skaerme, 116 ord). Klaret-kortet og Min helt er de to rodede skaerme; forsiden er ikke.
- Hoved/Haand/Hjerte: NY forklaring lukker det meste af 28. sep-klagen. Foerste gang ses en ramme "Hoved, Haand og Hjerte" med tre korte linjer og "Forstaet", og "?" ved siden af; paa Min helt staar en linje under hver ("Regn, saa vokser den"). En 11-aarig forstaar Hoved (regne) og Haand (maale); Hjerte ("hjaelpe en person, fx Ane, med alle hendes opgaver") forstaas, men eleven ser ikke hvor Ane er eller hvornaar det tikker.
- Rammen "Forstaet" er tekst i tre linjer paa telefon og skubber Moelleren ned; acceptabelt een gang.

## 3. Er mine seneste fund (833) lukket?
1. Hjerte/Haand hopper tidligt + tit aendret figur: delvist. Stjerner ved niveau 2-3 nu 2 (foer 1); Hjerte uaendret 1, Haand stadig 1 til opgave 30. AABENT.
2. Klaret-kortet 2,4 skaerme, "Mere" med to ting: uaendret (2,40 paa 390). AABENT.
3. Min helt ca. 2,1 skaerme, forklaring kun dér: forklaringen er LUKKET (ramme + "?" paa forsiden); laengden er AABEN (2,15 skaerme, Rygsaekken/titler staar aabne).

## 4. Hvad mangler (jeg kunne ikke)
Ingen rigtig 11-aarig og ingen ekte touch-enhed; alt er emuleret i headless Chromium med laast ur. Ikke set: lyd. Ikke maalt: de senere byer efter Moellen. Dommen om "foelelse" er min laesning af skaermbillederne.

## 5. Hara
Ingen betydning for Hara. Ingen elevdata (kun syntetisk "Tulle"), intet roert i matematikspillet eller appen.

## Gren
Gren: kritik-837
Commits: se `git log kritik-837`.

## Hvad ændret
Kun filer under `docs/kritik-837/` og `outputs/kritik-837/`: rapport, `elev-837.mjs`, skaermbilleder og `elev-nu.json`. Intet i matematikspillet eller appen er aendret.

## Testresultat
Elev-scriptet koert paa Ganitas main: 0 net-kald, 0 fejl, ingen vandret rulning paa 390 og 1280. Klaret-skaerm 390: 2,40 skaermhoejder; Min helt 390: 2,15. 60 aerlige opgaver: niveau 15, Hoved 9, Haand 7, 14 mestret; gaettende: niveau 1.

## Hvad er næste
Ganita retter de tre ting i foerste linje (Hjerte der bevaeger sig, klaret-kortet kortere, Min helt kortere). Bhishak tjekker bagefter: bevaeger Hjerte sig nu, og er klaret-kortet under ca. 1,5 skaerm paa 390?
