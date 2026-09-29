MMORPG-følelse: halvvejs. Rodet: ja (Min helt; klaret-skærmen er blevet ét kort, men ligger under kortet). De tre vigtigste ting Ganita retter næste gang: (1) Min helt (`M698-390-8-helt.png`, `src/spil-app.js` og `src/helten.js`): "+1", "+40", to grønne mærker, "Øv her"-kortet og "Siden sidst" står stadig på første skærm (16 tal); "Øv her" skal ned under Hoved/Hånd/Hjerte, og "+1/+40" skal væk, når de er set; (2) klaret-skærmen (`M698-390-10-klaret-hel.png`, `renderKlaretReplik` og `renderKlaretValg` i `src/spil-app.js`): klaret-kortet ligger under et helt skærmhøjt kort, så valget "Hvor nu?" ligger nede under folden (3,04 skærme); flyt klaret-kortet over kortet eller skjul kortet, mens det står; (3) Hånd (`M698-390-2-ny-foerste.png`, forklaringen i `src/spil-app.js`): "Hånd er at bruge matematikken: måle og handle med penge" siger ikke, hvad en 11-årig gør; skriv stedet ("Grusgraven: mål og regn om") og lad prikken under Hånd vise, hvornår den vokser.

Ordre 698, matematikspillet efter Ganitas 686 og 691, set som en 11-årig på 390 (touch) og 1280 (mus). Bhishak, 29. sep. 2026. Kun syntetisk elev "Tulle". **Hvilken version:** ordren siger `main`, men 691 er endnu ikke merget (matematik `main` = `ddc86ac`, kun 686). Jeg spillede grenen `ordre-691` @ `524e01a`, ellers kunne 691 ikke vurderes. Spillet er hentet med `git archive` og ikke rørt.

## 1. Føles det som et MMORPG?

**Halvvejs, lidt tættere på end i 688.** Det virker:
- Helten er det største på Min helt (148 x 185) og ser forskellig ud pr. niveau: grøn kittel uden noget i hånden på niveau 1, rød kittel, hue, stav og målestok på niveau 3 (`M698-390-2-ny-foerste.png` mod `M698-390-8-helt.png`).
- Ved et rigtigt svar er der ét "+5" fra helten (`M698-390-5-svar-150ms.png`); "Brøker 62" tæller stille med. Ét tal vokser, og det er heltens.
- "Niveau op!" (`M698-390-6-niveauop.png`): "Niveau 3 · Lærling ... Hoved er nu 3", stille efter ca. 1 s.
- Klaret-kortet har helten med niveau-mærket ved siden af "Forløbet er klaret" og "+40 Brøker" i fed skrift (`M698-390-10-klaret.png`): et lille løft, hvor erfaringen er det, der vises.
- Ærligheden holder: 60 opgaver med rigtigt svar giver niveau 15, Hoved 9, Hånd 7 og 14 mestrede forløb; 60 opgaver med gætten giver niveau 1, 310 erfaring og ingenting mestret (`mat-698.json`, `sim`). Hånd vokser altså, når man regner rigtigt. Hjerte har jeg ikke testet ud over 1 (jeg hjælper ingen).

Hvorfor ikke ja: mellem niveau 3 og 15 er der stadig ikke noget nyt at se uden at åbne Min helt (kappens kanter ved 1., 4., 8. og 12. forløb; ikke rørt siden 688). Prikkerne under Hoved/Hånd/Hjerte viser vækst, men "+1"/"+40"-mærkerne og "Siden sidst" gentager den som tekst i stedet for at lade helten være det, der vokser.

## 2. Rod: hvilken skærm konkurrerer mest?

Første skærm, tal fra `mat-698.json` (ord, tal, knapper; sider i skærmhøjder for hele siden, fuld bevægelse):

| Skærm | 390 | 1280 |
|---|---|---|
| Ny elev, første skærm (forklaringen åben) | 77 ord, 9 tal, 9 knapper, 2,90 | 77, 9, 9, 2,82 |
| Kortet / opgaven | 49 ord, 12 tal, 9 knapper, 2,23 | 49, 12, 9, 2,31 |
| Niveau op! | 52 ord, 7 tal, 4 knapper, 3,46 | 52, 7, 4, 3,31 |
| Klaret forløb | 63 ord, 8 tal, 6 knapper, 3,04 | 66, 8, 7, 2,94 |
| Min helt | 116 ord, 16 tal, 3 knapper, 3,30 | 148, 19, 4, 2,76 |

De tre vigtigste skærme på 390 er kortet/opgaven (12 tal, 9 knapper), klaret-skærmen (8 tal, 6 knapper) og Min helt (16 tal, 3 knapper). **Flest ting, der konkurrerer, er Min helt**: "Tulle", "Niveau 3", "+1", "+40", to grønne mærker, "64 erfaring", to kappe-linjer, "Øv her"-kort med knap, Hoved/Hånd/Hjerte med hver et "+1" og prikker, og "Siden sidst" ligger på første skærm. 691 flyttede "Siden sidst" ned; det står nu lige under kortene, stadig på første skærm.

Klaret-skærmen er blevet et kort (fra 3,74 til 3,04 skærme; 691 måler 2,48, men på en anden måde, se afsnit 5). Rodet er, at kortet ligger *under* kortet med byen (et helt skærmhøjt billede), så en 11-årig på 390 ser et kort og et billede af Møllen og skal rulle for at nå "Hvor nu?". Kortet selv (49 ord, 9 knapper) er uændret siden 688 og roligere end de to andre, men er stadig den skærm, eleven ser mest.

## 3. Forstår en 11-årig Hoved, Hånd og Hjerte første gang?

**Ja for Hoved og Hjerte, halvt for Hånd.** Forklaringen er nu tre korte sætninger (77 ord på hele første skærm, mod 113 i 688; `M698-390-2-ny-foerste.png`): "Hoved er at regne: dele, brøker og klokken." "Hånd er at bruge matematikken: måle og handle med penge." "Hjerte er at hjælpe andre. Det vokser for hver, du hjælper."
- Hoved og Hjerte har en handling, en 11-årig kan gøre. Hånd har en handling ("måle og handle med penge"), men ikke et sted: Grusgraven er låst, og eleven kan ikke se, hvornår Hånd vokser. Min helt siger "Brug det, så vokser den", hvilket næsten er det samme som forklaringen.
- Prikkerne (en fyldt pr. point, en stiplet til den næste) læser jeg som noget, der kan fyldes, og ikke som endnu en boks. **Det er lukket siden 688**: Hånd og Hjerte er ikke længere tomme bokse.
- Rest: efter "Forstået" står kun en rund "?" tilbage, og forklaringen står stadig over "Din opgave nu".

## 4. Er 688's tre fund lukket?

| Fund fra 688 | Nu |
|---|---|
| (1) Klaret-skærmen | **Næsten lukket**: ét klaret-kort med helten og ét valg ("Hvor nu?"), 3,74 til 3,04 skærme. Åben: kortet ligger under kortet, tre knapper står under hinanden (`M698-390-10-klaret-hel.png`). |
| (2) "+10" ved svaret | **Lukket**: ét flyvende tal ved helten (`+5` her), færdigheden tæller stille (`M698-390-5-svar-150ms.png`). |
| (3) Min helt | **Halvt**: helten er stor, Hånd og Hjerte er ikke tomme, men "+1", "+40", to grønne mærker, "Øv her" og "Siden sidst" står stadig på første skærm, og tallene er 16, som i 688. |

## 5. Ærlige grænser

- Ingen rigtig 11-årig eller lærer har set noget af det. Tallene er målt (ord, tal, knapper, sider, gemt spil); "føles som MMORPG", "rodet" og "forstår" er mit skøn ud fra skærmbillederne og teksterne.
- Mine sidehøjder er større end Ganitas (klaret 3,04 mod 2,48 på 390; Min helt 3,30 mod 3,01). Jeg har bevægelse slået til og en klaret-skærm efter et Del ligeligt-forløb med to nye steder; de måler måske med reduceret bevægelse. Tallene er ikke sammenlignelige på tværs af rapporterne, kun inden for mit script.
- Ét gemt spil (niveau 2, Møllen), ét klaret forløb, ét niveau op. Niveau 4 og op er kun målt i modellen (60 opgaver). Hjerte og "Hjælp en person" er ikke spillet.
- Touch er emuleret i headless Chromium på Windows, ikke en rigtig telefon. Uret og `Math.random` er låst.
- Scriptet `outputs/kritik-698/mat-698.mjs` er mit 688-script med nyt navn. Ingen ændring af matematikspillet, ingen push, ingen merges, ingen sub-agenter.

**Til Hara:** School-planeten, spor matematik-minispil. Efter 686 og 691 er spillet halvvejs et MMORPG (stor helt, ét "+N" ved svaret, ét klaret-kort, Hånd og Hjerte med prikker), og Hoved/Hjerte forstås første gang; Hånd er det uklareste. Rodet er koncentreret i Min helt og klaret-skærmen, og det er der Ganita bør rette næste gang.
