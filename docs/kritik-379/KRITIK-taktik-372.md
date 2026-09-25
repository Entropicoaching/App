# Kritik: taktikstien (skak main e3d13ec, ordre 372) spillet som elev på telefonen

Ordre 379, blok 1. Bhishak har kun kritiseret og intet rettet. Skak-repoet er læst via `git archive` af `main`
(e3d13ec, "merge: taktikstien (ORDRE 372, Chaturanga)"). Alt kørte headless i Chromium på 390×844,
som mobil med berøring (`isMobile`, `hasTouch`, tap i stedet for klik). Fremgangen lå i en flygtig
browserprofil, og der er ingen elevdata.

Script: `node scripts/kritik-379.mjs --kun taktik` (elevturen) og `--kun gaader` (gåderne som data).
Skærmbillederne ligger i `outputs/kritik-379/taktik-*.png`, og målingerne i
`outputs/kritik-379/maalinger.json` (`taktik`, `taktikTekster`, `gaader`).

## Sådan blev stien spillet

Eleven starter på et tomt lager, går ind i fanen Taktik og tager stien fra mønster 1 til 11:

- **Eksemplerne:** alle tre spilles efter pilen. I allerførste eksempel spiller eleven først et forkert træk (f3).
- **Gåde 1:** eleven laver mønstrets *typiske fejl* (se kolonnen "Fejl" herunder) og løser den så. Har gåden to elevtræk, spiller eleven desuden et forkert andet træk efter modstanderens svar.
- **Gåde 2:** to forkerte forsøg, så pilen kommer frem. Eleven følger den.
- **Gåde 3 og frem:** løses i første forsøg, indtil "Du har lært".
- **Mønster 9 (afdækket angreb, det sværeste):** eleven trykker "Spring dette mønster over".
- **Til sidst:** siden genindlæses, "Start forfra" trykkes, og eleven prøver at flytte en bunden brik (mat i 1, gåde 0Psb8).

Alt i alt blev 93 stillinger spillet. Konsollen havde 0 fejl.

| Typisk fejl i ordren | Sådan blev den spillet |
|---|---|
| Ser ikke gaflen | Gaffel 5/6: slår med det samme (Bxh6, Nxg7) eller flytter gaffelbrikken et andet sted hen (Nb6, Ne5) |
| Flytter den bundne brik | Mat i 1, gåde 0Psb8: sorts dronning på d7 er bundet til kongen, og eleven prøver d7-e7 |
| Overser mat i 1 | Mat i 1, baglinjemat og kvælningsmat: et træk der ikke giver mat. Desuden er hver stilling tjekket for et overset mat i 1 (se T2) |

## Det der virker

- **Tekst og bræt samtidig.** Forklaring, opgave og hele brættet står inden for 844 px i 92 af 93 stillinger. Brættet fylder y 294-668 (374 px bredt), og teksten står ved y 165-294. Den ene undtagelse skyldes "Spring over" (T4). Forklaringen er 14,4 px, opgaven 16 px og titlen 17,6 px.
- **Mestring virker.** Med to fejl i starten er hvert mønster lært efter 6 gåder (4 af de sidste 5 i første forsøg). Beskeden "Du har lært: …" kommer, og fluebenet står i listen. Derefter går stien videre til næste mønster.
- **Pilen efter to fejl virker** i alle 10 mønstre der blev prøvet. Beskeden siger "… Pilen viser vejen.", og pilen står på brættet (fx `taktik-06-gaffel-andre-gaade-2-pil-efter-to-fejl.png`).
- **"Spring over" markerer ikke mønstret som lært** (`sprunget: true`, intet flueben). Da de ti andre mønstre var lært, førte stien eleven tilbage til det oversprungne (mønster 9). Efter en genindlæsning står eleven samme sted.
- **Trykflader:** 0 under 44 px i Taktik.
- **Sproget er let.** LIX ligger på 5-31 for forklaringer og hint (let til meget let). Opgaveteksterne topper på 50 ("Find springergaflen - og vind brikken bagefter"), fordi de er korte og har ét langt ord.

## Fund

Alvor: **høj** = eleven bliver vildledt eller mister arbejde, **middel** = det forvirrer eller forsinker, **lav** = en skønhedsfejl.

| # | Mønster | Skærm | Hvad eleven oplever | Alvor |
|---|---|---|---|---|
| T1 | 5, 6, 7, 8, 11 (og 9, samme kode) | `taktik-05-gaffel-springer-gaade-1-fejl-i-traek-2.png`, `-06-`, `-07-`, `-08-`, `-11-…-fejl-i-traek-2.png` | Eleven har fundet gaflen, og modstanderen har svaret. Nu skal eleven slå brikken, men slår forkert. Så står der: **"Det træk angreb ikke to ting. Find et felt hvor springeren rammer to brikker … Pilen viser vejen."** Eleven HAR lige gaflet. I mat i 2 står der "Start med et skak", selvom eleven lige har givet skak. Hintet hører til første træk, men vises også ved andet træk (`src/taktik.js`: `m.hint` uden hensyn til `t.linjeIndeks`). Pilen kommer allerede efter første fejl i andet træk, fordi fejlene tælles pr. gåde og ikke pr. træk. Eleven får at vide, at det rigtige træk var forkert. | **høj** |
| T2 | 2 Red din brik | `taktik-02-forsvar-eksempel-1.png` og eksempel 2-3 | Eksempel 2 (f02) siger "Dronningen på e2 er angrebet. d3 redder den." og pilen peger på d3, men **De8 er mat i 1**. Eksempel 3 (f03) siger "Ta4 redder den", men **Td8 er mat**. Det sker i mønstret lige før "Mat i 1 … Tjek alle dine skak". Gåderne f09 (Td8#), f10 (Dc8#) og f13 (Dd1#/Da1#) har samme mat. Dér godtages mattet (det står i `godeFoerste`), men forsvarstrækket gør også. En skarp elev eller Marc ved tavlen ser, at eksemplet lærer det næstbedste træk. | **høj** (fagligt) |
| T3 | alle | `taktik-93-efter-start-forfra.png` | "Start forfra" står lige ved siden af "Spring dette mønster over" og **sletter al fremgang uden at spørge**. Efter 10 lærte mønstre var lageret `{"fremgang":{}}` efter ét tryk, og der kom ingen dialog. Siden bliver stående nede ved knapperne (scrollY 854), så eleven ser ikke engang, at stien er startet forfra. Et fejltryk i klassen koster en hel lektions arbejde. | **høj** |
| T4 | alle | `taktik-10-kvaelningsmat-eksempel-1.png` | Eleven trykker "Spring dette mønster over" (knappen står under brættet, y 973). Næste mønster starter, men **siden bliver stående nede** (scrollY 574). Brættet står ved y -280 til 94, og forklaringen er rullet ud af syne. Eleven ser listen og knapperne, ikke det nye mønster. Et tryk i listen ruller op (`window.scrollTo(0, 0)`), men "Spring over" gør ikke. | middel |
| T5 | 2, 3, 4, 5, 7, 8, 10, 11 | `taktik-*-gaade-*-fejl-*.png` | **Brættet hopper 21 px (ved "Pilen viser vejen" 42 px) ved 22 af 30 forkerte træk.** Hintet erstatter én linje opgavetekst ("Sort i træk. Sæt mat i ét træk.") med to eller tre linjer. Det sker lige når eleven skal prøve igen, så næste tryk kan ramme et felt ved siden af. S2 fra 372 holder kun, når beskeden er kortere end instruktionen (det står også i 372's ærlige grænser). | middel |
| T6 | alle | `taktik-00-foerste-skaerm.png`, `taktik-03-mat-i-1-eksempel-1.png` | Forklaringerne bruger notation, som eleven aldrig har lært: "Slå med **Txd5**", "**Dxg2#** er mat", "**Sd6+**: springeren …", "Slå med **exd5**". Lær skak nævner Sf3 og Lc4 i teksten, men forklarer ikke x, + og #, og hvad bogstaverne står for, står intet sted. For en elev i 5. klasse er "Dxg2#" en kode. Det tunge ord står forrest i linjen, der skal forklare trækket. | middel |
| T7 | 7 Binding | `taktik-07-binding-eksempel-1.png` → `-din-tur-igen.png` | Eksempel 1 (0NLTN) siger "Tc8: dronningen på d8 **kan ikke flytte** uden at kongen bagved står åben". Et sekund efter flytter dronningen: den slår tårnet (Dxc8), og eleven slår igen. Forklaringen modsiges af brættet. Mønstrets egen forklaring ("En bundet brik kan ikke flytte") er for skarp: en bunden brik kan godt flytte langs linjen og slå den der binder. | middel |
| T8 | 1, 3 (og generelt) | `taktik-01-ubeskyttet-gaade-1-fejl-1.png`, `taktik-03-mat-i-1-gaade-1-fejl-1.png` | Hintet går ud fra, at eleven lavede *den* typiske fejl. Efter Sd4 (et træk der ikke slog) står der "Kunne modstanderen slå tilbage?". Efter Kd8 (ikke skak) står der "Det var ikke mat - kongen kunne komme væk. Prøv et **andet** skak." Beskeden svarer ikke på det eleven gjorde. | lav |
| T9 | 3 (gælder alle) | `taktik-94-bunden-brik-valgt.png`, `taktik-95-bunden-brik-forsoegt-flyttet.png` | Eleven vælger den bundne dronning på d7: brikken markeres, og fire lovlige felter vises (langs bindingen). Eleven trykker på e7, uden for linjen, og **intet sker, heller ingen besked**. Det er netop begrebet "binding", og brættet siger intet om hvorfor. | lav |
| T10 | liste | `taktik-92-liste-og-knapper.png` | Forudsætningerne ("Godt at kunne først: …") står kun i `title`, og det vises aldrig på en telefon. TAKTIKSTIEN.md siger, at "listen siger bare hvilke". På telefonen siger den intet. | lav |
| T11 | 5-9, 11 | `taktik-0X-…-eksempel-1-din-tur-igen.png` | I eksemplerne erstattes "Se: …"-forklaringen af "Din tur igen: følg pilen.". Elevens andet træk (fx Dxc8+ efter bindingen, Sxc4 efter gaflen) forklares ikke. Det er dér gevinsten sker. | lav |
| T12 | 6, 10, 11 | eksemplerne | To af tre eksempler er samme idé med samme sætning. Gaffel med andre: eks. 1 og 3 er begge "Dc1+: dronningen angriber tårnet på d2 og kongen på g1". Kvælningsmat: eks. 2 og 3 er begge "Sf2#: …". Mat i 2: eks. 1 og 2 er begge "Td8+ tvinger modstanderen …". Stillingerne er forskellige, men eleven læser det samme to gange. | lav |
| T13 | 9 Afdækket | `taktik-09-afdaekket-eksempel-1.png` | Eksempel 1 siger "dronningen på h4 angriber nu dronningen på e7" (3 linjer, brættet rykker til y 315). Det der vindes, er tårnet på d8 (Dxf7, Dxd8+), og det nævnes ikke. Mønstret har også de sværeste gåder (rating 897-1623), hvilket 372 selv har noteret. | lav |

### Gåderne som data (`--kun gaader`)

`test/taktiksti.test.js` (372) tjekker, at hver stilling er lovlig og har én løsning. Her er de samme 143 stillinger
tjekket for tre ting mere:

- **Mat i 1, der ikke er facit, i mønstre der ikke handler om mat:** 5 stillinger, alle i "Red din brik" (f02, f03, f09, f10, f13). Det er T2.
- **Modstanderen har mat i 1 efter elevens løsning:** 0 stillinger. Heller ingen gåde har et overset mat i 1 i elevens andet træk.
- **372's egen materiale-søgning, ét halvtræk dybere** (4 i stedet for 3), for "én løsning" og for elevens andet træk (`gaader.soegning4`), fandt to:
  - `u01` (første eksempel i hele stien): f3 vinder også springeren (samme score, 3 mod 3), fordi Td8 er mat, når springeren forlader d-linjen. Det er ikke forkert, men eleven ser en stilling med en skjult baglinjemat.
  - `0CwF4` (gaffel med andre, gåde 5): Txf2+ Dxf2 Lxf2 Kxf2 vinder kun +2 (tårn og løber for dronning og bonde). Søgningen ser et stille træk (h6) inden for 1 af det. Gaden er lovlig og løsningen den bedste, men gevinsten er lille for en "vind brikken"-gåde.

  Ingen andre stillinger faldt igennem på 4 halvtræk. Jeg har ikke fundet en gåde, der er direkte forkert (facit taber) eller har to lige gode løsninger ud over T2.

## Klar til klassen: **nej, ikke som hel sti. Mønster 1, 3, 4 og 10 kan bruges nu.**

Fordi:

- **T1** rammer alle mønstre med to elevtræk, også gaflen, som 372 anbefalede at starte med. Den elev, der finder gaflen og så slår forkert, får at vide, at gaflen var forkert. Det er den vigtigste læring i mønstret, og den bliver vendt om.
- **T2** lader "Red din brik" vise et forsvarstræk som *det rigtige*, mens mat i 1 står på brættet. Marc vil få spørgsmålet ved tavlen.
- **T3** kan slette en hel klasses fremgang med ét fejltryk på den knap, der står ved siden af "Spring over".

De tre er små rettelser: hint pr. træk, fjern eller skift fem stillinger, og en bekræftelse eller flyt knappen. Mønster 1 (ubeskyttet), 3 (mat i 1), 4 (baglinjemat) og 10 (kvælningsmat) har kun ét elevtræk og rammes ikke af T1-T2. De kan bruges i klassen i dag, med T3 og T5 in mente ("tryk ikke på Start forfra").
