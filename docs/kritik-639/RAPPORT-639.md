Ordre 639: Mål dit billede efter Yantras 634, og skakken efter Chaturangas 623 og 629. Bhishak, 28. sep. 2026.

**Maal dit billede stadig klar til sitet: ja.** Setu skal kopiere 634 nu: løftmodellens `main` `2c8f284`, `dist/maal-billede/` hel. Kopien fra `2ccb0bb` (630) er overhalet og skal ikke laves.

**skakken stadig klar til Marcs klasse: ja.** 623 og 629 er begge merget (`main` `c358eeb`). Alt, Chaturanga bad mig prøve, gør det, han siger. Mine to nye fund er lave ord-fund (S11, S12), og ingen af dem rammer klassen.

## Gren

`kritik-639`, lavet med `git checkout -b kritik-639 main` fra `main` @ `251a39f` (merge af kritik-632). Ingen push og ingen merges.

- `9bb4e60` kritik 639 blok 1: Mål dit billede efter Yantras 634
- commit 2: skakken, verificering og denne rapport. Hashen står i `git log`.

Filer kun under `docs/kritik-639/` og `outputs/kritik-639/`. Løftmodellen (`entropi-loeftmodel-dhruva` `main` @ `2c8f284`), sitet (`entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`) og skakken (`skak` `main` @ `c358eeb`) er hentet med `git archive`. Ingen af de tre træer er rørt.

## Hvad ændret

Kun dokumenter og mine egne scripts, ingen appkode, løftmodel, site eller skak. Nedenfor står, hvad jeg fandt i hver blok.

### Blok 1: Mål dit billede (`MAAL.md`)

Hele kritikken står i `docs/kritik-639/MAAL.md`. Kort:
- **M21 lukket.**
  - Med 165 på siden og filer gemt med 180 siger status det, på 390 og 1280 og i PNG'et. Sætningen er 5 linjer på 390.
  - 180 i feltet fjerner sætningen og giver de samme tal som en tom side (cm-rækkerne 1,091 gange større).
  - Med Min krop siger den "178 cm fra Min krop ... ret Min krop".
  - Det er rigtigt, at siden ikke selv tager filernes højde.
- **M23 lukket på siden.** "1 uge" er 11,7 px i samme grå som en ≈-forskel. Forskellen over den er 14,1 px og lys, så den skilles tydeligt fra ≈.
  - Uden nogen ændring står "1 uge" et sted i 40-58 % af tabellerne, i snit under én celle.
  - Guld er uændret 5,6-11,6 %.
- **M24 lukket.** Rækkerne i sætningen er præcis dem med "1 uge" i den nyeste kolonne, også når andre rækker står i guld.
- **Nye lave fund:**
  - M27: PNG'et bryder "over grænsen, 1 uge" som "over grænsen, 1" / "uge" i alle celler. Guldlinjen brydes også.
  - M28: blandede filer (4 med 180, 4 med 165) giver "Filerne er gemt med højden 165 cm" uden at sige hvilke.
  - M29: en måling gemt med Min krop har tom højde i filen, så M21 kan ikke sige noget om den.
- **M22, M25 og M26 står.** Otte uger giver nu 1200 × 2828 px mod 2648 i 632.

### Blok 2: skakken som elev og som lærer

`outputs/kritik-639/skak-639.mjs` gav **23/23** (`skak-639.json`, `.log`, `S-*.png`).

Opsætning:
- Headless Chromium: 360 og 390 med touch, 1280 med mus.
- Playwrights falske ur og intet net.
- Alt elevens er spillet i appen med tryk. Gåderne og stormene er løst ved at slå stillingen op i banken.
- Lagt ind i lageret: 623's tal for en elev fra før 629, temastatistikken og ét gemt parti.

**S (som 628): ugesætningen og Find feltet står som før.** Ugesætningen nævner alle fire slags, og S7 er stadig lukket ("hurtigere til "Find feltet": 20 felter på 30 s mod 10 sidste uge"). 0 netkald og 0 JS-fejl.

**T: stormen over to uger (623 og 629), på 360, 390 og 1280.** Eleven havde før 629 rekorden 9 over alle temaer, og i Gafler bedst 4 en dag og 7 i sidste uge (623). Der var ingen temarekord.

| storm | hvad eleven ser | rigtigt? |
|---|---|---|
| startkortet, Gafler | "Gafler: rekord 7." med det samme | ja: den største af 623's dag og uge |
| startkortet, Blandet | ingen linje (ingen storm denne uge) | ja |
| Gafler 3 | ingen ros; "Gafler: bedst 3 i dag · bedst 3 denne uge · rekord 7." | ja |
| Gafler 8 | "Din bedste Gafler-storm nogensinde!"; "· rekord 8." | ja, 8 slår 7; ingen "Ny rekord", for rekorden over alle er 9 |
| Gafler 9, stoppet | ingen ros, lageret uændret | ja |
| Gafler 10 (tirsdag) | "Ny rekord på denne enhed!" alene; "· rekord 10." | ja, aldrig begge ros oven i hinanden |
| ny uge, startkortet | "Gafler: rekord 10." | ja |
| Gafler 2 | ingen ros; "... · rekord 10." | ja |
| dagens storm med Gafler valgt, 11 | "Ny rekord"; "Gafler: bedst 11 ... · rekord 11." | tæller med i Gafler og i rekorden over alle |
| Blandet 3 | "I alt: bedst 11 i dag · bedst 11 denne uge." og ingen temalinje | ja |

- **Kun når en tidligere Gafler-storm er slået?** Ja. Den første storm i ugen giver ingen ros. Ros kommer kun, når rekorden er slået, også når rekorden kommer fra 623.
- **Kommer den oven i "Ny rekord"?** Aldrig.
- **Tæller dagens storm med tema med?** Ja, i temaets linje og rekord.
- **En elev fra før 629** får den rigtige rekord med det samme, så langt 623's lager rækker.
- **Et fund i mit eget script undervejs:** i første kørsel slog scriptet stillingen op, før appen havde vist den, og talte 10, hvor appen talte 9. Appen gjorde det rigtige med 9: 9 slår Gaflers 8, men er lig med rekorden over alle, så rosen var "nogensinde" og ikke "Ny rekord". Scriptet følger nu appens egen tæller og venter også ægte tid. Appen er uændret.

**S10: startkortet med én linje (360, 390, 1280).**

| bredde | Blandet (ingen storm endnu) | Gafler med rekord |
|---|---|---|
| 360 | 485 px | 505 px |
| 390 | 465 px | 485 px |
| 1280 | 398 px | 419 px |

- **Er én linje nok? Ja.** Der er ingen linje over temavalget. Linjen står 0 px under temaknapperne, og både knapperne og linjen er på skærmen, når man trykker. Man ser den skifte fra ingenting til "Gafler: rekord 7." (`S-360-639-startkort-*.png`).
- **Forstår en 11-årig "I alt: bedst 10 i dag"? Nok ikke helt (S11, lav).** "I alt" betyder på dansk en sum. "I alt: bedst 11 i dag" kan læses som 11 gåder i alt i dag, altså summen af dagens stormer, og ikke den bedste storm. Chaturanga valgte "I alt" for at holde linjen på én linje på 390. Et kort ord, der ikke er en sum, fx "Alle: bedst 11 i dag", ville holde begge dele.
- **S12 (lav):** "Din bedste Gafler-storm nogensinde!" står lige over "Din rekord på denne enhed: 9 gåder" og "Gafler: ... · rekord 8.". Linjen under siger "rekord", og rosen siger "nogensinde".
  - For en elev fra før 629 er "nogensinde" kun sandt så langt tilbage, som 623 husker. Chaturanga skriver det selv under grænserne.
  - "Ny Gafler-rekord!" ville bruge samme ord som linjen og ikke love mere, end lageret ved.

**H: hårdt mellemrum før % med mange data (360 og 390).** Alle står samlet, og ingen er brudt:
- "Øv et tema" med alle 17 temaer: 17 af 17 procenttal har hårdt mellemrum.
- Mit bibliotek med alle temaer og Find feltet: 56 af 56.
- Analysen efter et langt parti mod computeren ("Det evige parti", 47 halvtræk, mat): 5 af 5. Ingen vandret rulning.

**L: lærersiden med 25 koder (360, 390, 1280).**
- 25 koder læst. "Svagest først" og folden står som i 610 ("Øvet af under halvdelen (14 kompetencer)").
- Siden er 2572 px høj på 360 (3,3 skærme).
- Med alle folder åbne har alle 97 procenttal hårdt mellemrum, og intet er brudt.
- 0 netkald, 0 JS-fejl og ingen vandret rulning.

| Fund | Styrke | Status |
|---|---|---|
| S10 | lav | lukket (én linje under temavalget) |
| S11 | lav, ny | "I alt: bedst 11 i dag" kan læses som en sum |
| S12 | lav, ny | "nogensinde" ved siden af "rekord"; for en elev fra før 629 kun sandt så langt, 623 husker |
| S9 | lav | står fra 610, venter på Marc |
| S5, S6 | lav | står fra 598 |

## Testresultat

| Kommando | Resultat |
|---|---|
| `node outputs/kritik-639/maal-639.mjs` (blok 1) | 22/22 grønne, Chrome 154, 2.000 forsøg pr. linje |
| `node outputs/kritik-639/skak-639.mjs` (blok 2) | 23/23 grønne (skak `main` `c358eeb`) |
| `node outputs/kritik-639/verify-kritik-639.mjs --blok 1` | grøn |
| `node outputs/kritik-639/verify-kritik-639.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

Rødt undervejs, alt mine egne fejl:
- `maal-639` med 40 forsøg (tørkørsel) havde én rød: 12,5 % guld med 40 forsøg. Med 2.000 forsøg er det 11,6 %, som i 632.
- `skak-639` kørte fire gange:
  - 19/23 første gang: scriptet talte forsøg, ikke appens løste.
  - 19/23 anden gang: scriptet gav op på en stilling, der ikke var kommet endnu.
  - 16/23 tredje gang: samme årsag, nu også i Gåder-fanen, fordi appen venter på mere end timere.
  - 23/23 fjerde gang: opslaget venter også ægte tid.
  - I alle fire kørsler gjorde appen det rigtige med det tal, den selv havde talt.
- Blok 1's commit-besked fik et "≈" med. Jeg rettede den med `--amend`, før noget andet skete, så beskeden kun er ASCII.

## Hvad er næste

**Setu:** kopiér løftmodellens `main` `2c8f284` til `vaerktoejer` i én kopi: `dist/maal-billede/` hel, med `miniaturer/`.
- Sitet er stadig blob for blob `4ca0c63`. Mod `main` er kun `maal-billede/index.html` og `maal-billede.js` anderledes.
- Tag den ikke fra `2ccb0bb`. 634 er set og grøn her.
- LAES-VAERKTOEJER.html kan nævne Uger, "1 uge" og at siden siger en anden højde.

**Yantra**, ingen af punkterne stopper kopien:
- M27: hårdt mellemrum i "1 uge" og "2 uger" i PNG'et, eller kortere linjer. Kan tages med M26 og M22, fordi de alle handler om cellernes højde.
- M28: "4 af 8 filer (uge 5-8) er gemt med højden 165 cm".
- M29: gem den brugte højde i filen, også med Min krop, og lad `ugeSkala` bruge den, når `hoejde` er tom.
- M25 står (sig at 3 runder får guldet frem).

**Chaturanga**, intet stopper klassen:
- S11: et kort ord i stedet for "I alt", som ikke læses som en sum, fx "Alle: bedst 11 i dag". Mål, at linjen stadig står på én linje på 360 og 390.
- S12: "Ny Gafler-rekord!" i stedet for "Din bedste Gafler-storm nogensinde!".
- Hans egen rangliste efter 629: stormens historik pr. tema og S5/S6.
- Hans ældre browserscripts (619, 623) og mit `skak-628.mjs` kender ikke 629's tekster. Mit `skak-639.mjs` erstatter `skak-628.mjs`.

**Marc:** intet nyt valg. S1, S4 og #29/S9 venter stadig på ham. iPhone-prøven (610) står, nu også med Uger og det gemte PNG.

**Hara** (Coaching-planeten, "Appen mærkbart bedre"): Uger siger nu, hvilken højde ugerne er regnet med, og en enkelt uge over grænsen står med et svagt "1 uge". En træner kan altså bruge værktøjet hver uge til flere atleter uden at få forkerte cm-tal eller overse et spring. Det er klar til sitet, så snart Setu kopierer `2c8f284`.

## Ærlige grænser

- **Kun headless browsere på Windows.** Chrome 154 til Mål dit billede og Playwrights Chromium til skakken. Ingen Safari og ingen telefon.
- **Kun syntetiske data.** Grå flader og modellens egne stillinger. Syntetiske elever, stormer og 25 syntetiske koder. Ingen rigtige atleter, elever eller klip.
- **Skakkens gåder er løst ved opslag i banken** og ikke tænkt ud. Det falske ur styrer tiden. Scriptet måtte også vente ægte tid (se Testresultat).
- **En 11-12-årig og en træner er ikke spurgt.** "Tydeligt nok", "forstår" og "klar nok" (M21, M23, M24, S10, S11, S12) er min vurdering.
- **M28 og M29 er målt med filer, jeg har skrevet om.** De er ikke set hos en træner.
- **Det lange parti er ét parti** (47 halvtræk) og ikke det længste, en elev kan spille.
- **Intet er pushet eller merget.** Løftmodellen, sitet og skakken er ikke rørt.
