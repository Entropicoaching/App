MMORPG-følelse: halvvejs. Rodet: ja (mindre end i 664, men klaret-skærmen og Min helt er stadig fulde). De tre vigtigste ting Ganita retter næste gang: (1) klaret-skærmen på kortet (`M688-390-10-klaret-hel.png`, 3,7 skærme, `renderKlaret` i `src/spil-app.js` ~linje 1744-1790): ét klaret-kort med helten og det, der blev større, og "Nye steder" og "Byen vågner" som ét valg; (2) "+10 Brøker" ved svaret (`M688-390-5-svar-150ms.png`, `.quest-besked` og fremdriftsmærket i `src/spil-app.js`): mærket lægger sig oven i "Brøker 60" i 0,15 s og er stadig et tal ved siden af heltens "+10"; (3) Min helt (`M688-390-8-helt.png`, `src/spil-app.js` og `src/helten.js`): "+1", "+40", "Siden sidst", to grønne mærker og "Øv her" konkurrerer på første skærm, og Hånd og Hjerte er tomme bokse, indtil de vokser.

Ordre 688, matematikspillet (matematik `main` @ `88333f6`, efter Ganitas 677 og 681), set som en 11-årig på 390 (touch) og 1280 (mus). Bhishak, 29. sep. 2026. Kun syntetisk elev "Tulle".

## 1. Føles det som et MMORPG?

**Halvvejs, tættere på ja end i 664 (dengang: nej/halvvejs).** Det, der nu virker:
- Helten ser forskellig ud pr. niveau: niveau 1 er en grøn kittel uden noget i hånden, niveau 2 har rød kittel, hue, stav og målestok, niveau 3 har hue og kant (`M688-390-2-ny-foerste.png` mod `M688-390-4-opgave.png` og `M688-390-8-helt.png`). **G12 fra 664 er lukket.**
- "Niveau op!" (`M688-390-6-niveauop.png`) har helten selv øverst, mærket skifter 2 til 3, og sætningen siger "Hoved er nu **3**", hvor 3 tæller op. Efter 1 s står alt stille. Det er MMORPG-agtigt og ikke Cookie Clicker.
- Et almindeligt rigtigt svar: ét "+10" fra helten, og "35 erfaring" tæller. Et niveau tager 2 til 3 opgaver i modellen (10 ærlige opgaver: niveau 3; 60: niveau 15).
- Ærligheden holder: 60 opgaver med gætten giver niveau 1 og 310 erfaring, 60 opgaver med rigtigt svar giver niveau 15 og 14 mestrede forløb (`mat-688.json`, `sim`). At det betaler sig at være et godt menneske, ses dog kun i Hjerte (hjælp en person), og Hjerte står på 1 i alle mine forløb, fordi jeg ikke hjælper nogen.

Hvorfor ikke et fuldt ja: helten bliver stærkere i tre spring (niveau 1, 2, 3), men mellem 3 og 15 ser en 11-årig ikke noget nyt uden at åbne Min helt (kappen får kant først ved 1., 4., 8. og 12. forløb). Tallet vokser synligt, men det er tal og ikke en helt, der fylder mere.

## 2. Rod: hvilken skærm konkurrerer mest?

Synlige ting på første skærm (`mat-688.json`, ord, tal, knapper, sider i skærmhøjder):

| Skærm | 390 | 1280 |
|---|---|---|
| Ny elev, første skærm (forklaringen åben) | 113 ord, 7 tal, 8 knapper, 3,05 sider | 118 ord, 9 tal, 9 knapper, 2,94 |
| Kortet (gemt spil) | 49 ord, 12 tal, 9 knapper, 2,29 | 49, 12, 9, 2,37 |
| Opgaven (Min opgave, kortet ovenover) | samme som kortet | samme |
| Niveau op! (banneret) | 57 ord, 6 tal, 3 knapper, 4,17 | 57, 6, 3, 3,94 |
| Klaret forløb | 89 ord, 4 tal, 3 knapper, 3,74 | 122 ord, 5 tal, 4 knapper, 3,58 |
| Min helt | 115 ord, 16 tal, 3 knapper, 3,22 | 140 ord, 21 tal, 4 knapper, 2,72 |

**Flest ting, der konkurrerer om blikket, på 390: Min helt (16 tal på første skærm), derefter klaret-skærmen.** Klaret-skærmen er hele 3,7 skærme lang: klaret-tekst, bonus, to "Nye steder" med hver et citat og en knap, "Byen vågner" med billede og et nyt citat, "Ny opgave", "Se det på kortet", "Mere" og til sidst næste forløb. En 11-årig, der har klaret et forløb, skal rulle forbi seks kort for at nå næste opgave. Kortet og opgaven er til gengæld roligere og uændrede siden 681 (49 ord, 9 knapper). Mine mål siger, at intet er blevet mere rodet siden 664; det, der er tilbage, er ikke fjernet, men ikke kommet til.

Marcs "stadig lidt rodet" (28. sep) rammer efter mit skøn klaret-skærmen og Min helt, ikke kortet.

## 3. Forstår en 11-årig Hoved, Hånd og Hjerte første gang?

**Ja, hvis forklaringen læses; halvt, hvis den trykkes væk.** Første gang står der et kort med tre korte afsnit (`M688-390-2-ny-foerste.png`): "Hoved er at regne ... Hånd er at bruge matematikken: måle i Grusgraven og handle med penge ... Hjerte er at hjælpe andre. Det vokser for hver person, du hjælper." Hver har et sted og en handling, og "Når det vokser, stiger din helt også et niveau" forklarer, hvorfor det betyder noget. Det er en klar forbedring siden 664. Rest:
- "Hånd er at bruge matematikken" er det uklareste, en 11-årig kan ikke gætte, hvad "bruge" betyder, før stedet er åbent (Grusgraven er låst med "Mestr Møllens forløb 1-2").
- Efter "Forstået" står kun en rund "?" tilbage; Hånd og Hjerte er bare 1 og 1 i tre kasser, og det siges ikke, hvad man gør for at få dem op, andet end i Min helt ("Øv her").
- Forklaringen står over "Din opgave nu", så første skærm har 113 ord, før eleven kan gøre noget. Den skubber opgaven ca. 285 px ned på 390.

## 4. Er 664's åbne fund lukket?

| Fund | Nu |
|---|---|
| G12 helten ens på niveau 2 og 3 | **Lukket** for niveau 1 mod 2 mod 3 (stav, farve, kant). Ikke set for 4 og op. |
| G10 banner og flyder bevæger sig samtidig | **Lukket**: efter 1 s står alt stille, ét mærke skifter i banneret (681). |
| G9 vækst tre steder | **Halvt**: heltens "+10" er ét sted, men "+10 Brøker" og "35 erfaring" tæller stadig ved siden af (`M688-390-5-svar-150ms.png`, mærket lægger sig over "Brøker 60"). |
| G7 opgavens spilsprog | **Uændret** (mit skøn: "Din opgave nu / Forløb 2 af 8 / Opgave 1 af 4 / Få 3 stjerner" er fire slags tal over spørgsmålet). |
| G4-rest ("Øv her") | **Åben**: står stadig midt i Min helt (`M688-390-8-helt.png`). |
| G2 (skal Hoved og Hånd gøre noget?) | **Marcs valg**, ikke rørt. |

## 5. Ærlige grænser

- Ingen rigtig 11-årig eller lærer har set noget af det. Tallene er målt (ord, tal, knapper, sider, gemt spil); "føles som MMORPG", "rodet" og "forstår" er mit skøn ud fra skærmbillederne og teksterne.
- Ét gemt spil (niveau 2, Møllen, Hoved 2) og ét klaret forløb (Del ligeligt). Niveau 4 og op er kun målt i modellen (60 opgaver), ikke set som skærmbillede.
- Touch er emuleret i headless Chromium på Windows, ikke en rigtig telefon. Uret og `Math.random` er låst, og bevægelse er til.
- Første version af mit script tabte bogstavet s i de gemte tekster (en regex uden skråstreg); det er rettet, og alle tal her er fra sidste kørsel.
- Ingen ændring af matematikspillet, ingen push, ingen merges, ingen sub-agenter. Spillet er hentet med `git archive` fra `main` @ `88333f6` og er ikke rørt.

**Til Hara:** School-planeten, spor matematik-minispil. Matematikspillet er nu halvvejs et MMORPG (helten ser forskellig ud pr. niveau, tallet tæller, banneret er roligt efter 1 s), men klaret-skærmen og Min helt er stadig for fulde til Marcs klasse. Hoved, Hånd og Hjerte er forståelige første gang.
