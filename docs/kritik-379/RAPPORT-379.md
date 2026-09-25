Ordre 379

# Rapport: taktikstien (372) spillet som elev på telefonen, og atletens app efter 373 (Bhishak)

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): **ja, som kontrol.** Blok 2 viser uafhængigt af Vaidya, at 373's opdeling af AthleteView ikke ændrer noget for atleten, så Marc kan pushe den. Selve appen er ikke blevet bedre af denne ordre. Blok 1 hører til school-planeten (spor "skakbrættet").

## Gren

Gren `kritik-379` fra `main` (`c8aa336`) i `entropi-app-wt2`. Ingen merges, ingen push.
- Commit 1 `0405fe4`: blok 1. Scriptet `scripts/kritik-379.mjs`, `docs/kritik-379/KRITIK-taktik-372.md` og taktik-skærmbillederne.
- Commit 2 `395f720`: blok 2. `docs/kritik-379/KRITIK-athleteview-373.md` og skærmbillederne live/efter.
- Commit 3: blok 3. `verify:kritik-379` i `package.json`, den fulde kørsel (`outputs/kritik-379/`) og denne rapport. Hashen står i `git log`.

Kilder, kun læst via `git archive`: skak `main` (`e3d13ec`), og appens `e524d5e` (live) og `main` (`c8aa336`). Intet er rettet eller committet i skak-repoet.

## Hvad ændret

Intet i appen eller i skak er ændret. Der er kun kommet kritik, et script og målinger.

**Blok 1, taktikstien som elev** (`KRITIK-taktik-372.md`). Headless på 390×844 med berøring: alle 11 mønstre fra første mønster, 93 stillinger i alt. Eleven lavede de typiske fejl (så ikke gaflen, flyttede en bunden brik, gav skak i stedet for mat), fik pilen efter to fejl, sprang mønster 9 over, genindlæste siden og trykkede "Start forfra". Desuden er alle 143 stillinger tjekket som data: mat i 1, der ikke er facit, mat til modstanderen efter løsningen, og 372's egen søgning ét halvtræk dybere. De vigtigste fund:
- **T1 (høj):** er elevens *andet* træk forkert (efter en rigtig gaffel, binding, spid eller første træk i mat i 2), viser appen hintet til første træk: "Det træk angreb ikke to ting …" eller "Start med et skak …". Eleven har lige gjort netop det.
- **T2 (høj, fagligt):** "Red din brik" eksempel 2 og 3 viser et forsvarstræk med pilen, mens De8#/Td8# er mat i 1. Det samme gælder gåderne f09, f10 og f13.
- **T3 (høj):** "Start forfra" står ved siden af "Spring over" og sletter al fremgang uden at spørge. Siden bliver stående nede, så eleven ser det ikke.
- **T4-T5 (middel):** "Spring over" efterlader eleven nede ved knappen, så det nye mønster er ude af syne. Brættet hopper 21-42 px ved 22 af 30 forkerte træk.
- **T6-T7 (middel):** notationen (x, +, #, D/T/L/S) forklares ingen steder. Binding-eksempel 1 siger "dronningen kan ikke flytte", og et sekund efter slår dronningen tårnet.
- **T8-T13 (lav):** hint der ikke passer til fejlen, ingen besked når en bunden brik ikke kan flytte, forudsætninger der kun står i en tooltip, gentagne eksempel-sætninger, og en afdækket-tekst der ikke nævner det der vindes.
- **Virker:** tekst og bræt står samtidig på skærmen i 92 af 93 stillinger. Mestring (4 af 5), pilen efter to fejl, flueben, "Spring over" uden flueben, genindlæsning, 0 trykflader under 44 px og 0 konsolfejl virker alle. LIX er 5-50.
- **Klar til klassen: nej som hel sti.** Mønster 1, 3, 4 og 10 (ét elevtræk) kan bruges nu.

**Blok 2, atletens app efter 373** (`KRITIK-athleteview-373.md`). Samme mock og seed som 373, kørt mod `e524d5e` og `main`:
- Forside, Godkendt på dagens sæt, "Film et sæt" (åbn og luk via broen), "Mere", Program, Kost og alle 8 faner i bundnavet.
- **8 skærme, 0 % pixel-afvigelse** i første kørsel. I den fulde kørsel var 7 af 8 på 0 %, og VideoCoach-skærmen afveg på grund af skrift-timing i iframen (A5). Samme tekst og adfærd, 0 sidefejl, 0 `console.error` og 0 HTTP-fejl i begge versioner.
- **Klar til push: ja.** Forbehold: `main` indeholder også ordre 370's coach-ændringer (`coachBriefingRules.js`, `coachPriority.js`) og ordre 355's trackerændring i `videocoach.html`, og dem har denne ordre ikke set.

## Testresultat

- `npm run verify:kritik-379`: **exit 0**. Den kører alle tre dele (taktik, gåder, atlet) og skriver `outputs/kritik-379/maalinger.json` og alle skærmbilleder. Resultat: taktik 11 mønstre og 0 konsolfejl. Gåder 143 stillinger (5 med mat i 1 fra start, 2 fund i søgningen). Atlet 7 af 8 skærme på 0 %. `03-video-1` afveg 3,99 %, fordi iframens webfont ikke var indlæst i live-billedet (reserveskrift, samme layout, se A5). Ved første kørsel var den 0 %.
- `npm run lint`: grøn (0 fejl, 0 advarsler).
- Enkeltkørslerne undervejs, uafhængigt af den fulde kørsel:
  - `--kun taktik`: 11 mønstre og 93 stillinger, 0 konsolfejl. Kørt tre gange; fundene var ens i de to sidste kørsler, og den første havde en fejl i mit eget script (det ventede forkert på næste stilling).
  - `--kun gaader`: 143 stillinger. 5 har mat i 1 fra start i et mønster der ikke handler om mat, 0 giver modstanderen mat efter løsningen, og søgningen på 4 halvtræk gav 2 fund (u01, 0CwF4).
  - `--kun atlet`: 8/8 skærme på 0 %.

## Hvad er næste

**Chaturanga skal rette, i denne rækkefølge** (alle i skak-repoet, små):
1. **T1:** hint pr. træk. Når `t.linjeIndeks > 0`, skal hintet sige noget om *andet* træk, fx "Gaflen virkede! Hvilken brik står nu uden beskyttelse? Slå den." eller "Nu er det mat i ét: tjek dine skak.". Tæl også fejl pr. træk, så pilen ikke kommer efter én fejl i andet træk.
2. **T2:** skift f02, f03, f09, f10 og f13 ud med stillinger uden mat i 1 (eller giv sort en luft-bonde), og lad `lav-taktiksti.mjs` afvise en forsvarsstilling, der har mat i 1.
3. **T3:** "Start forfra" skal spørge først ("Slet al fremgang i Taktik?") eller flyttes væk fra "Spring over". Rul op til brættet bagefter.
4. **T4:** `taktikSpringOver` skal rulle op (`window.scrollTo(0, 0)`), ligesom listen gør.
5. **T5:** giv beskedpladsen en fast højde på tre linjer, så brættet står stille.
6. **T6-T7:** én linje om notationen første gang den dukker op ("x = slår, + = skak, # = mat"), og en ny tekst til binding eksempel 1 (eller et andet eksempel, hvor den bundne brik bliver stående).

**Marc:**
- **Appen kan pushes.** Blok 2 fandt ingen forskel for atleten. Husk, at pushet også sender ordre 370's coach-briefingregler og ordre 355's tracker (hurtig dødløft-nedtur) ud.
- **Taktikstien:** vent med gaflen (nr. 5) i klassen, til T1 er rettet. Mønster 1, 3, 4 og 10 kan bruges i dag. Tryk ikke på "Start forfra".

## Ærlige grænser

- Kun headless Chromium med mobil-emulering, ingen rigtig telefon og ingen rigtig elev. "Forstår en elev i 5.-7. klasse forklaringen" er vurderet ud fra teksten, LIX og det eleven ser. Ingen barn har læst den.
- Den "typiske fejl" er regnet ud af stillingen efter en fast opskrift pr. mønster. Hvor opskriften ikke fandt et passende træk, blev der spillet et andet forkert træk. T8 skyldes delvis det, men hintet ville passe lige så dårligt til en elevs tilfældige fejltræk.
- Pr. mønster er kun gåde 1 og 2 spillet med fejl, og de næste 4 blev løst i første forsøg. Gåde 7-10 i hvert mønster er ikke set i appen (kun som data). Mønster 9 (afdækket) er kun set i sine eksempler, fordi det blev sprunget over med vilje.
- Tjekket "én løsning" er 372's egen materiale-søgning, kørt 4 halvtræk dybt og ikke med en rigtig motor. En kørsel på 5 halvtræk blev startet i scratch og stoppet efter ca. 40 minutter. Indtil da havde den fundet de samme to (u01, 0CwF4) og ingen andre, men den nåede ikke alle stillinger.
- Blok 2 har kun set de skærme ordren nævner. Mobilitet, Volumen, Fremgang, Beskeder og Stævne er kun åbnet (overskrift læst), ikke fotograferet. Dem dækker 373's egne 11 skærme. Offline, fejlskærmen, bekræft-modalen og coach-preview er ikke set.
- VideoCoach-billedet tages 1,5 s efter tryk. Det er ikke altid nok til iframens webfont (A5), så pixeltallet for den skærm svinger mellem kørsler.
- Billederne er taget med `deviceScaleFactor: 1`, samme dag og med samme seed for begge versioner. Datoen står på skærmen, så en sammenligning på to forskellige dage ville afvige.
- Indlæsningstiden (bundtet er +2,8 kB gzip) er ikke målt, hverken her eller i 373.
- Worktreet havde ved start 179 ændrede, ikke-committede filer under `outputs/kritik-skole*` fra ældre kørsler. De er ikke mine, jeg har ikke rørt dem, og de er ikke med i mine commits. Træet er derfor ikke rent i den forstand. Mine egne filer er alle committet.
