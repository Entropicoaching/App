Matematikken mindre rodet: ja

Hoved/Hånd/Hjerte forståelig for en 11-årig: ja

Bhishak, ordre 656 blok 1, 28. sep. 2026. Matematikspillet før og efter Ganitas 651, set som en 11-årig på 390 px touch og som Marc foran klassen på 1280.

**Kort sagt.** 651 har rettet det, der var mest rodet sidst: den første skærm siger nu, hvad man skal gøre. Under figuren står én stor brun knap, "Din opgave nu · »Del ligeligt« hos Mølleren ↓", og ét tryk bringer svarknapperne frem. En helt ny elev ser nu forklaringen af Hoved, Hånd og Hjerte, og ordene siger hvad hver ting er, med de steder barnet kan se på kortet. Det er roligere og tydeligere. Men Min helt er uændret og stadig fuld af tal, opgaven har stadig to linjer spilsprog, og Hoved og Hånd gør stadig ikke noget.

## Hvad jeg målte

- **Før** = matematik `main` @ `de17445` (643 merget). **Efter** = `main` @ `6e83254` (651 merget: `e5017e4` blok 1, `c8fc550` blok 2, `8096d66` rapport). Ganitas `outputs/RAPPORT-651.md` er læst.
- Begge hentet med `git archive` til en midlertidig mappe. Matematik-træet er ikke rørt.
- `outputs/kritik-656/mat-656.mjs`: headless Chromium (matematiks playwright), 390 × 844 touch (×2) og 1280 × 900 mus, alt net blokeret (0 kald), uret og `Math.random` låst, reduceret bevægelse, 0 JS-fejl. Tal i `mat-656.json`, billeder `M656-*.png`.
- Samme syntetiske elev som i 648 (fantasinavnet Tulle, niveau 2, Møllens forløb 1 mestret), og en helt ny elev fra en tom browser (Lav din figur, Start eventyret, Forstået).
- "Første skærm" er det, der står uden at rulle. Ord, tal og knapper er alt, der kan ses.

## De tre skærme, før og efter

| Skærm | Bredde | Før (643) | Efter (651) |
|---|---|---|---|
| Kortet, første skærm | 390 | 53 ord, 12 tal, 9 knapper | 49 ord, 12 tal, 9 knapper |
| Kortet, første skærm | 1280 | 50 ord, 12 tal, 8 knapper | 49 ord, 12 tal, 9 knapper |
| Næste handling på første skærm | 390 / 1280 | ingen (en linje i bjælken) | "Din opgave nu" ved y 347 / 323, 65 px høj |
| Fra første skærm til svarknapperne | 390 / 1280 | rul 1642 / 1801 px | ét tryk; alle tre svar på skærmen, fokus på første |
| Opgaven, én skærm | 390 | 65 ord, 14 tal, 4 knapper | 65 ord, 14 tal, 4 knapper (uændret) |
| Min helt, første skærm | 390 | 88 ord, 12 tal, 3 knapper | 88 ord, 12 tal, 3 knapper (uændret) |
| Min helt, hele siden | 390 | 3,02 skærme, 331 ord | 3,02 skærme, 331 ord (uændret) |
| Vandret rulning | begge | nej | nej |

**Hvad en 11-årig mærker:**
- **Hun ved, hvad hun skal.** Den første skærm har nu én ting, der skiller sig ud: den brune knap med opgavens navn og hvem der venter. Før stod det samme i en lille linje i bjælken over kortet, som man let læste forbi. Linjen er væk, så der står ikke mere end før (49 ord mod 53) (`M656-efter-390-1-kortet.png` mod `M656-foer-390-1-kortet.png`).
- **Ét tryk til opgaven.** Knappen ruller ned til Mølleren, og alle tre svar står på skærmen (`M656-efter-390-2-efter-tryk.png`). Før skulle hun selv rulle 1,9 skærme forbi kortet.
- **Samme knap på 1280.** Marc kan trykke én gang foran klassen, og opgaven står der.
- Den brune knap er den eneste mørke flade på skærmen. Det er roligt: øjet ved, hvor det skal hen.

Derfor **ja, mindre rodet**. Det er første gang siden 643, at forbedringen er i midten af skærmen og ikke i kanten.

## Hoved, Hånd og Hjerte

Ordene efter 651 (de samme i spillet og på `laerer.html`, målt):
- **Hoved** (22 ord): "Hoved er at regne: dele, brøker og klokken ved Møllen, Kirken og Sporvognen. Når det vokser, stiger din helt også et niveau."
- **Hånd** (23 ord): "Hånd er at bruge matematikken: måle i Grusgraven og handle med penge på Landsbygaden. Når den vokser, stiger din helt også et niveau."
- **Hjerte** (25 ord): uændret, "Hjerte er at hjælpe andre. Det vokser for hver person, du hjælper. Så går de med dig på kortet og kommer senere og hjælper dig."

Passer med koden: Møllen, Kirken og Sporvognen løfter `hoved`, Grusgraven og Landsbygaden `haand` (`spil-quest.js` 917-970); et niveau op løfter stedets egenskab med 1 i samme skridt (`givNiveauPoint`, `spil-figur.js:81`). Så "stiger din helt også et niveau" er sandt.

**Som en 11-årig:**
- **Hvad er Hoved? Det kan hun nu svare på:** "at regne, dele og brøker ved Møllen". Eksemplerne er ting, hun lige har gjort, og stederne står på kortet under forklaringen (alle fem navne er synlige på kortet, også de låste).
- **Hånd** er det svageste: "at bruge matematikken" er et voksenord, og at måle er også at regne. Men "måle i Grusgraven og handle med penge" er konkret nok til, at hun kan sige, hvor Hånd kommer fra.
- **Hjerte** er stadig den bedste: hvad det er, hvordan det vokser, og hvad hun får.
- **"Hvad skal jeg bruge Hoved 2 til?"** Svaret er ærligt men tyndt: det følger niveauet. Det er ikke længere uforklaret; det er bare ikke til noget. Det er ikke en fejl i forklaringen, men i spillet (Marcs valg, G2).
- "Forløb" og "et nyt niveau" er væk fra forklaringen. Den er kortere at læse.

Derfor **ja, forståelig**: en 11-årig kan læse den én gang og sige, hvad de tre ting er, og hvor de kommer fra.

**Visningen:**
- **Helt ny elev (rettet, var G1).** Efter "Start eventyret" står siden øverst (`scrollY` 0), og hele forklaringen er på skærmen (390: y 266, under tallene), med "Din opgave nu" lige under (y 625). "Forstået" ruller hende til Mølleren (`M656-efter-390-6-ny-foerste-skaerm.png`, `M656-efter-390-7-ny-efter-forstaaet.png`). Flaget sættes først ved Forstået; genindlæser hun før, står forklaringen der igen. Før rullede siden forbi den (`scrollY` 1607).
- **Elev med gemt spil, første gang:** som før, hele boksen på første skærm; "Din opgave nu" står stadig på første skærm (y 642 på 390).
- **"?"** har nu en trykflade på 44 px (målt via `::after`), men ser stadig ud som 30 px og sidder stadig på Hjertes hjørne, så det ligner Hjertes egen knap.

## Marc foran klassen (1280)

- Første skærm: figuren, tre tal, tre knapper og den brune opgaveknap, alt i én 520 px søjle midt på skærmen (`M656-efter-1280-1-kortet.png`). Et tryk, så står Mølleren og de tre svar. Det kan vises uden at rode.
- Den lille skrift ("Næste niveau: mestr et forløb eller hjælp en person.", 13 px) er stadig svær at læse bagerst i klassen; opgaveknappens titel (17 px fed) er ikke.
- **Ville Marc skamme sig? Nej.** Det ser pænt, roligt og venligt ud, og det er tydeligt, hvor man trykker. Det, der kan få ham til at stoppe op, er Min helt (for mange tal) og linjen "mestret ved 3 rigtige i første forsøg" ved opgaven.

## De tre vigtigste ting, der stadig er rodede

1. **Min helt er uændret og fuld af tal (G4, G5).** Første skærm på 390: Niveau 2, 30 erfaring to gange (i hovedet og i boksen Erfaring), "Brøker ... (60 point)", Udstyr 1 af 9, Titler 0, Hoved 2, Hånd 1, Hjerte 1, og så to Hjerte-forklaringer ("Hjerte er de folk, du har hjulpet" under tallene). Otte slags tal; 651 rørte den ikke (`M656-efter-390-3-helten.png`).
2. **Opgavens spilsprog.** Over spørgsmålet står "0 af 4 opgaver løst · mestret ved 3 rigtige i første forsøg" og ved siden af "Brøker 60" med en lille bjælke. En 11-årig ved ikke, hvad "mestret" og "første forsøg" betyder her, eller hvad 60 er. Det er det første, hun læser, når knappen har rullet hende ned.
3. **Hoved og Hånd gør stadig intet (G2).** To af tre store tal øverst er nu forklaret ærligt, men de følger bare niveauet. Et barn, der spørger "hvad får jeg for Hoved 3?", får intet svar. Det kræver Marcs valg.

## Fund

| Fund | Alvor | Hvad | Forslag (Marcs valg, hvor det rører spillet) |
|---|---|---|---|
| G2 | middel | Hoved og Hånd er forklaret, men gør intet ud over at følge niveauet. | Marcs valg: giv dem en virkning, eller slå dem sammen til ét tal ved siden af Hjerte. |
| G4 | middel | Min helt: otte slags tal på første skærm, erfaring to gange. Uændret siden 648. | Fjern boksen Erfaring, fold Udstyr og Titler ned under udstyret. |
| G7 | middel | Opgavens første linje er spilsprog: "0 af 4 opgaver løst · mestret ved 3 rigtige i første forsøg" og "Brøker 60" uden forklaring. | Én linje for barnet, fx "3 rigtige i træk, så er du færdig"; "Brøker 60" bag et tryk eller væk her. |
| G5 | lav | To Hjerte-forklaringer på Min helt. Uændret. | Behold én. |
| G6 | lav | "?" har 44 px trykflade nu, men ser ud som 30 px og sidder på Hjertes hjørne. | Stil det ved siden af de tre tal eller ved overskriften, ikke på Hjerte. |
| G8 | lav | "Hånd er at bruge matematikken" er et voksenord; at måle er også at regne. | "Hånd er at måle og handle: i Grusgraven og på Landsbygaden." |

G1 og G3 fra 648 er rettet og målt (se ovenfor).

## Ærlige grænser

- **Ingen rigtig 11-årig har læst det.** "Forstår" er mit skøn ud fra ordene, koden og skærmbillederne. Tallene (ord, knapper, y, fokus, flaget) er målt.
- Ét gemt spil (niveau 2, Møllen) og én ny elev. Senere i spillet, når flere steder er åbne, er Min helt længere, og knappen kan pege på andre steder; det har jeg ikke målt.
- Skriftstørrelsen 13 px er læst fra billedet, ikke målt på en projektor. Headless Chromium på Windows, ikke en skole-pc eller telefon.
- Touch er emuleret; at knappen ruller rigtigt på en rigtig iPad eller Chromebook er ikke prøvet.
