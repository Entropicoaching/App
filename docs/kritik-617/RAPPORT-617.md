Ordre 617

# To kritikker: matematikspillet efter Ganitas 605 og 612, værktøjssidens kopi af Mål dit billede (Bhishak)

**Dommene:**
- **Matematikken stadig klar til Marcs klasse: ja.** Det gælder `main` `42e0ae2` (605 og 612 merget).
- **Marcs M2/N1 opfyldt: ja.** Den ærlige hjælper ligger aldrig under den travle. Konsekvensen tager intet, og "Fortsæt" og "Hjælp" står der begge ved 134 af 134 valg. Men gætteren, der hjælper, bliver den bedste (M17, middel), og den svage ærlige får intet for at hjælpe (M15, middel).
- **Værktøjssiden klar til Marcs deploy: ja.** Det gælder `vaerktoejer` `1169b5f` (Setus 620, som kom, mens jeg målte). Resultatet er 16/16 grønne i sitets egen kopi, og M5 og M6 fra 610 er lukket. Ét nyt fund er lavt (M18).

Identitet: ordren siger, at jeg er Bhishak i dette træ (`entropi-app-kritik`), selv om `CLAUDE.local.md` nævner Vaidya. Jeg har fulgt ordren.

## Gren

`kritik-617` fra `main` (`076805f`). Ingen push, ingen merge, ingen sub-agenter. Filer kun under `docs/kritik-617/` og `outputs/kritik-617/`.

- `a8c32d0` kritik 617 blok 1: matematikken (`docs/kritik-617/MATEMATIK.md`).
- Blok 2 (commit 2): værktøjssiden, verificering og denne rapport (`VAERKTOEJER.md`, `RAPPORT-617.md`). Hashen står i git-loggen.

**Målt på** (alt hentet med `git archive`, og ingen af træerne er rørt):

| | Hash | Bemærkning |
|---|---|---|
| Matematik før 605 | `c096c38` | |
| Matematik 605 | `4630a20` | |
| Matematik `ordre-612` | `26c3a37` | 612 blev merget undervejs som `42e0ae2`, med samme `src/` og `spil.html` |
| Matematik `main` | `42e0ae2` | 20-minutters-kørslerne med sidens eget "Rigtigt!" |
| Sitet `vaerktoejer` | `1bd6672`, så `1169b5f` | 620 kom undervejs; dommen gælder `1169b5f` |
| Løftmodellen | `4ca0c63` | Det, Setu kopierede. `main` er nu `287210d` (621) og indgår ikke |

## Hvad ændret

Jeg har ikke ændret noget i appen, matematikken, sitet eller løftmodellen. Jeg har lavet to kritikker med mine egne scripts.

**Blok 1, matematikken** (`MATEMATIK.md`). Min elev fra 603 er blevet til `elev-617.mjs`. Hun læser 605's nye linjer, logger valget og den sjove linje, tager et øjebliksbillede ved 20 minutter og tæller sidens eget "Rigtigt!". Det gav 17 kørsler med 40 elevforløb, 390 og 1280, 40 minutter, uden net.
- **M2/N1 holder for den ærlige elev.** Hjælperen er aldrig under den travle, i 10 sammenligninger med tre terninger. Efter 40 minutter er hun 1-4 niveauer foran på 390 og lige på 1280 (525). Hjerte 3-7 og en følger.
- **Konsekvensen er sjov og harmløs.** "Helt fint, Ane klarer sig nok" giver lov, geden og bierne er et glimt i øjet, og intet tages. Linjen og første svarknap står på samme skærm, og "Hjælp ..." og "!" er der stadig.
- **M16 (lav):** linjen er 41-49 ord og koster en læsende elev 16-20 s. Ved terning 525 flytter det den travles niveau 4 fra 20:11 til 20:30. Gedebiddet er næsten usynligt.
- **M15 (middel):** den svage ærlige (40 %) prøver 4-5 quests på 40 minutter. Alle hviler, og hun ender med Hjerte 1, ingen følger og 0 hjulpne.
- **M17 (middel):** gætteren, der hjælper, når niveau 7½ efter 20 minutter (den ærlige hjælper 4½, den travle 3), og Mester kl. 24:25. Med 612 har han Brøker 630/610 mod 390/260 for den ærlige 70 %-elev.
  - Sidens eget "Rigtigt!" viser, at han rammer 28-41 % i første forsøg, og den svage ærlige 42-43 %. En tredjedel er gættets forventning (3 knapper), så grænsen skiller dem ikke.
  - Genåbner M7.
- **612 lukker M14 for den svage ærlige** (Brøker 190/295 → 300/355, ingen "Halv værdi") og M13 (den ærlige 70 %-elev ser ikke længere "står stille").

**Blok 2, værktøjssiden** (`VAERKTOEJER.md`, `maal-617.mjs`, 16 tjek) i sitets egen kopi, Chrome 154 headless, 390 og 1280, uden net:
- De 13 filer siden 607 er `4ca0c63`'s blob for blob.
- 10 sider og 106 lokale links: 0 fejl 404 og 0 JS-fejl. Noindex og `robots.txt` er i orden, og disclaimeren står nederst.
- Alle 8 miniaturer er uden felter og indlæses fra sitets sti. "Ligner" viser en af dem.
- Gem og åbn igen (tre runder), før og efter med Byt og video virker.
- M5 og M6 er lukket.
- **M18 (lav):** efter Byt står noten "Gemt måling åbnet ... Før er gemt senere end efter; tryk Byt" stadig over billedet. Setus læseside siger "Efter Byt er advarslen væk"; det gælder kun advarslen over tabellen.

## Testresultat

| Kørsel | Resultat |
|---|---|
| `bash outputs/kritik-617/koer-elever-617.sh a`, `b`, `c` og `d` | 17 kørsler, 40 elevforløb, alle exit 0, 0 JS-fejl, 0 netkald |
| `node outputs/kritik-617/opsummer-elev-617.mjs` | `elev-617-tabel.json` (40 rækker) |
| `node outputs/kritik-617/maal-617.mjs` | **16/16 grønne** på `1169b5f` (14/14 på `1bd6672` før 620), 0 netkald ud over skrifttypen, 0 fejl 404 |
| `node outputs/kritik-617/verify-kritik-617.mjs --blok 1` | grøn (før commit 1) |
| `node outputs/kritik-617/verify-kritik-617.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

Elevernes `.log` og `maal-617.log` er gitignored. JSON'en og skærmbillederne er committet.

**Rødt undervejs, alt i mine egne scripts:**
- Min elev læste siden, efter den var lukket (rettet før første rigtige kørsel).
- Mit opsummeringsscript læste sin egen tabel.
- Mit kørselsscript kørte gruppe c, når jeg bad om d. Det blev opdaget før kørslen.
- To regex mistede deres backslash.
- Mit M6-tjek ledte efter den forkerte tekst. Det førte til M18.

## Hvad er næste

**Ganita:**
1. **M17:** en quest, der har hvilet, bør kræve mestring (3 af 3), før den giver et halvt niveau. Alternativt gælder 2 af 3 kun i første forsøg. Grænsen i rygsækken skal over en tredjedel for at ramme gætteren (fx 40 %); det er tæt på den svage ærlige (42-43 %), så Marc vælger. Kør min elev med `GAET=1` og terning 525 bagefter.
2. **M15:** find en måde, så den svage ærlige får noget for at hjælpe uden niveau og Hjerte (som gætteren ville farme). Fx at personen takker og går med på kortet efter et forsøg, hvor alle blev løst.
3. **M16:** gør den sjove linje kortere (cirka 20 ord), og giv gedebiddet en kant, der kan ses.

**Setu:**
- Intet før deploy. Marc kan udgive `vaerktoejer` `1169b5f` med 594's kommando fra læsesidens afsnit 5.
- Ret sætningen "Efter Byt er advarslen væk" på `LAES-VAERKTOEJER.html`, så den siger "advarslen over tabellen" (M18).
- Når Yantra har rettet M18, kopierer Setu igen i én kopi. Løftmodellens 621 ("Uger") er ikke kritiseret endnu; den skal ikke med, før jeg har set den.

**Yantra:** M18. Skriv noten om ved Byt, eller tag sætningen ud af noten.

**Marc:** grænsen i M17 (`HEL_VAERDI_ANDEL`) og om quests efter hvile skal kræve mestring. M4, M5, M11, N8 og N1 A+ er stadig dine valg.

**Hara (School):** matematikspillet er målt efter Marcs "det betaler sig altid at være et godt menneske". For den ærlige elev holder det. For gætteren betaler det sig for meget (M17), og for den svage ærlige betaler det sig ikke (M15).

## Ærlige grænser

- **Kun min model-elev, ikke et barn.** Gætteren trykker hvert sekund i 40 minutter. Min læser læser alt, også den sjove linje.
- **Terninger:** 525, 731 og 311 (70 %), 525 (svag), 525 og 731 (gætter). Tallene svinger meget med terningen. Sidens "Rigtigt!" er kun talt i 4 kørsler på 20 minutter.
- **612 og 620 kom, mens jeg målte.** 612's kode er den samme, som jeg målte. 620 er målt fuldt igen.
- **Ingen telefon.** Headless Chrome/Chromium på Windows, min egen lokale server, et webm-klip lavet i browseren.
- **"Ligner"** er fremkaldt for én af otte fejl. Min krop, De tre løft og bænkens figurside er kun åbnet og sammenlignet blob for blob.
- **Kun syntetiske data:** eleven "Tulle" og ensfarvede billeder. Ingen elever, atleter, atletdata eller klip. Ingen push, ingen merge, ingen deploy.
