Matematikken mindre rodet: ja

Hoved/Hånd/Hjerte forståelig for en 11-årig: ja

MMORPG-følelse: nej

Bhishak, ordre 664 blok 1, 28. sep. 2026. Matematikspillet efter Ganitas 658 og 660, set som en 11-årig på 390 px touch og som Marc foran klassen på 1280. Sammenlignet med 643, som ordren spørger om.

**Kort sagt.** Tallet vokser nu, så man kan se det. Det er ærligt: en gætter får mindre og langsommere end en elev, der regner. Og det er roligt ved et almindeligt svar: efter 1 s står intet tilbage. Men helten bliver ikke synligt stærkere. Den ser ens ud på niveau 2 og 3, for 660's blok 2 er ikke committet. Og i selve øjeblikket står væksten tre steder på én gang. Det føles derfor endnu ikke som et MMORPG, men det er heller ikke Cookie Clicker. Skærmene er lidt mindre rodede end efter 643.

## Hvad jeg målte

- **643** = matematik `main` @ `de17445`. **658** = `main` @ `04d25b3` (658 merget). **660** = `ordre-660` @ `f78f354`: kun blok 1 er committet, og intet er merget. Blok 2 og 3 ligger ucommittet i Ganitas træ. De er ikke målt, og der findes ingen `RAPPORT-660.md`.
- Ganitas `outputs/RAPPORT-658.md` er læst fra `main`, og commit-beskeden til 660 blok 1 er læst.
- Alle tre er hentet med `git archive` til en midlertidig mappe. Matematik-træet er ikke rørt.
- `outputs/kritik-664/mat-664.mjs` kører i headless Chromium (matematiks playwright) på 390 × 844 touch (×2) og 1280 × 900 mus. Alt net er blokeret (0 kald), og uret og `Math.random` er låst. Der var 0 JS-fejl. Tallene står i `mat-664.json`, billederne i `M664-*.png`.
- Eleven er den samme syntetiske elev som i 648 og 656 (fantasinavnet Tulle, niveau 2, Møllens forløb 1 mestret). Derudover en helt ny elev fra en tom browser.
- **Skærmene** er målt med reduceret bevægelse, som i 648 og 656.
- **Følelsen** er målt i 658 og 660 med bevægelse. Fire forløb er spillet: et rigtigt svar i første forsøg, et gæt (forkert, så rigtigt), et helt forløb til nyt niveau og Min helt bagefter.
- I hvert øjeblik er målt, hvor mange ting der bevæger sig (`document.getAnimations()` i gang og "+N"-flydere), og hvad der står tilbage efter 2,2 s.
- **Gætteren mod den ærlige** er målt med spillets egen model (`scripts/elev-model-420.mjs` i 658 og 660, spillets rene regler). Hver elev tog 150 opgaver over 200 frø.

## MMORPG eller Cookie Clicker

| Øjeblik (390 og 1280 ens) | 658 | 660 |
|---|---|---|
| "Din opgave nu", helten på skærmen, når man svarer | 390: nej (helten 28 px over kanten); 1280: ja | ja, helten 50 px under toppen, alle svar på skærmen |
| Rigtigt i første forsøg: "+N" på skærmen på én gang | 2 ("+10 Brøker" ved opgaven, "+10" ved baren) | 3 (også "+1 ... +10", der stiger op fra helten) |
| Rigtigt: ting i bevægelse lige efter trykket | 23 | 14 til 24 |
| Rigtigt: næsten stille (2 tilbage) | efter 1,0 s | efter 0,7 s |
| Rigtigt: helt stille | efter 2,2 s | efter 1,0 s |
| Gæt, forkert tryk | 1 til 2 bevægelser ("prøv igen"-skub), intet tal | samme |
| Gæt, så rigtigt | "+5" | "+5" fra helten og ved opgaven |
| Nyt niveau ("Videre" på sidste opgave): ting i bevægelse | 48 | 36 til 55 |
| Nyt niveau: "Niveau op!", ring om helten, prikkerne fyldes | banner | banner, ring og prikker |
| Nyt niveau: bevægelse tilbage efter 2,2 s | 6 til 7 | 6 til 7 |
| Min helt bagefter | "Siden sidst: Niveau 3 +1 · Hoved 3 +1 · 70 erfaring +40" og tallene tæller op | samme |

**Gætteren kan ikke nå de flotteste trin før den ærlige.** Efter 150 opgaver gælder spillets egen model:

- **Gætteren** (trykker oppefra): median niveau 1. Kun 111 af 200 får nogensinde en belønning, og i median først ved opgave 79.
- **En elev, der regner rigtigt 3 ud af 4 gange i første forsøg:** median niveau 19, første belønning ved opgave 9.
- **En elev med 9 ud af 10 rigtige:** median niveau 27.

Tallene er de samme i 658 og 660, for 660 har ikke rørt reglerne. I spillet ses det ærlige arbejde også som "+10" mod "+5". "De flotteste trin" som udseende (660 blok 2) er ikke committet, så de kan ikke måles endnu.

**Hvad en 11-årig ser og føler:**

- **Et almindeligt svar er roligt og ærligt.** "Rigtigt!" vises, og tre "+10" flyder op. Brøker tæller 60 til 70, og efter 0,7 s står næsten alt stille, efter 1 s alt (`M664-v660-390-B1-rigtigt-120ms.png` og `-1000ms.png`). Et forkert tryk giver kun et lille skub og intet tal. Intet blinker for at lokke hende til at trykke igen. Det er det modsatte af Cookie Clicker.
- **Men helten er ikke den, der vokser.** Heltens "+N" er det mindste af de tre og sidder øverst ved en figur på ca. 30 px, lige over møllens hjul. Hun kigger på "Rigtigt!" og baren ca. 600 px længere nede. I et MMORPG kommer tallet fra helten. Her kommer det tre steder fra, og helten er det sted, man mindst ser.
- **Nyt niveau er et øjeblik, og det er for fuldt.** "Niveau op! Niveau 3 · Lærling. Din figur er blevet klogere: Hoved er nu 3." er klart og godt (`M664-v660-390-B3b-efter-videre-120ms.png`). Men samtidig sker alt dette på 390:
  - Flyderen øverst tæller "Niveau 2 +1 · Hoved 2 +1 · 62 erfaring +10", mens banneret lige under siger "Niveau 3".
  - "Spring over" dukker op på kortet.
  - Ringen breder sig fra helten, og prikkerne fyldes.
  - Under banneret står "Bonus i rygsækken: +40 Brøker" og "NYE STEDER".

  I alt er op til 55 ting i bevægelse på én gang (658: 48). På 1280 flyder "+40 Brøker" et øjeblik hen over "(nu 100)" (`M664-v660-1280-B3b-efter-videre-700ms.png`).
- **Helten bliver ikke synligt stærkere.** Figuren på kortet og på Min helt er den samme før og efter niveau 3. Kun tallet og ordet "Lærling" er nye. Det var præcis det, Marc bad om i 660 blok 2, og det er ikke committet.

Derfor **MMORPG-følelse: nej**, men halvvejs. Tallet vokser synligt, animeret og ærligt, og et almindeligt svar er roligt. Helten vokser ikke, og væksten har ikke ét sted. 660 blok 1 er et godt fundament. Blok 2 (helten ændrer sig) er det, der kan gøre det til et ja.

## De tre skærme, efter 643

Med reduceret bevægelse, som i 648 og 656. "Første skærm" er det, der står uden at rulle.

| Skærm | Bredde | 643 | 658 | 660 blok 1 |
|---|---|---|---|---|
| Kortet, første skærm | 390 | 53 ord, 12 tal, 9 knapper | 49 ord, 12 tal, 9 knapper | 49 ord, 12 tal, 9 knapper |
| Kortet, første skærm | 1280 | 50 ord, 12 tal, 8 knapper | 49 ord, 12 tal, 9 knapper | 49 ord, 12 tal, 9 knapper |
| Til svarknapperne | 390 | rul selv 1,9 skærme | ét tryk ("Din opgave nu") | ét tryk, og helten står med på skærmen |
| Opgaven, én skærm | 390 | 65 ord, 14 tal, 4 knapper | 65 ord, 14 tal, 4 knapper | 66 ord, 15 tal, 4 knapper |
| Min helt, første skærm | 390 | 88 ord, 12 tal, 3 knapper | 90 ord, 11 tal, 4 knapper | 90 ord, 11 tal, 4 knapper |
| Min helt, første skærm | 1280 | 115 ord, 15 tal, 4 knapper | 124 ord, 15 tal, 4 knapper | 124 ord, 15 tal, 4 knapper |
| Min helt, hele siden | 390 | 3,02 skærme, 331 ord, 37 tal | 2,89 skærme, 319 ord, 35 tal | 2,89 skærme, 319 ord, 35 tal |
| Vandret rulning | begge | nej | nej | nej |

**Hvad en 11-årig mærker efter 643:**

- **Kortet** (`M664-v660-390-1-kortet.png`) er roligt. Øverst står figur, navn, niveau og Hoved/Hånd/Hjerte. Så kommer tre knapper og én brun knap, "Din opgave nu · »Del ligeligt« hos Mølleren". Hun ved, hvad hun skal. Det er den store forbedring siden 643 (651), og den holder.
- **Opgaven** er uændret siden 643. Det første, hun læser efter trykket, er stadig "0 af 4 opgaver løst · mestret ved 3 rigtige i første forsøg" og "Brøker 60".
- **Min helt** (`M664-v660-390-3-helten.png`) er ryddet lidt i 658:
  - Boksene Udstyr, Titler og Erfaring er væk.
  - Erfaringen står én gang.
  - Hjerte forklares kun bag "?".

  Siden er en tiendedel skærm kortere. Men på første skærm står stadig seks slags tal: niveau 2, 30 erfaring, 60 point, Hoved/Hånd/Hjerte, "1 af 9" og "0 af 5". "Øv her"-boksen siger "Brøker er den færdighed, du har mindst af (60 point). Alle syv står i rygsækken længere nede." Det er en voksensætning.

Derfor **ja, mindre rodet**, men kun lidt siden 656. Den store forbedring (opgaven på første skærm) kom i 651. 658 ryddede Min helt en smule. 660 blok 1 har ikke gjort nogen skærm mere rodet, kun øjeblikket ved nyt niveau.

## Hoved, Hånd og Hjerte

Ordene er uændrede siden 651, og det samme gælder i spillet, bag "?" på kortet og på Min helt:

> Hoved er at regne: dele, brøker og klokken ved Møllen, Kirken og Sporvognen. Når det vokser, stiger din helt også et niveau.
> Hånd er at bruge matematikken: måle i Grusgraven og handle med penge på Landsbygaden. Når den vokser, stiger din helt også et niveau.
> Hjerte er at hjælpe andre. Det vokser for hver person, du hjælper. Så går de med dig på kortet og kommer senere og hjælper dig.

- En helt ny elev ser forklaringen hel på første skærm (scrollY 0, på 390 og 1280). Alle fem stednavne står synligt på siden.
- **Nyt siden 656:** "Niveau op!" siger "Din figur er blevet klogere: Hoved er nu 3." Det binder Hoved til noget, barnet lige har gjort. Det er den bedste forklaring af Hoved i spillet, og den kommer på det rigtige tidspunkt.
- På Min helt står under tallene kun "Du har ikke hjulpet nogen endnu." (658). Den dobbelte Hjerte-forklaring er væk.

Derfor **ja**. En 11-årig kan sige, hvad hver af de tre er, og hvor den vokser. Hun kan ikke sige, hvad Hoved og Hånd gør for hende (G2, Marcs valg).

## Marc foran klassen

- **1280, kortet:** én brun knap, heltens tal, kortet. Det er roligt, og Marc ved, hvad han skal trykke på.
- **1280, et rigtigt svar på projektoren:** "+10" stiger op fra helten øverst, og samtidig står "+10 Brøker" og "+10" ved svaret. Det er pænt og kort. Klassen ser tallet ved svaret, ikke ved helten.
- **1280, nyt niveau:** banneret "Niveau op! Niveau 3 · Lærling" er fint at vise frem. Flyderen øverst og "+40 Brøker" over "(nu 100)" er et sekunds uro.

**Ville Marc skamme sig over at vise det frem?** Nej. Det er pænt, roligt ved det almindelige svar og ærligt. Men hvis han lover klassen, at "helten bliver stærkere", vil en elev spørge, hvor det ses. Det ses ikke endnu.

## De tre vigtigste ting, der stadig er rodede

1. **Væksten har ikke ét sted (G9, G10).** Et rigtigt svar giver tre "+10" tre steder, og heltens er det mindste. Nyt niveau sætter op til 55 ting i bevægelse, og flyderen øverst siger "Niveau 2" et øjeblik, mens banneret siger "Niveau 3".
2. **Helten bliver ikke synligt stærkere (G12).** Figuren er den samme på niveau 2 og 3. Det er 660 blok 2, som ikke er committet.
3. **Opgavens spilsprog og Min helts tal (G7, G4-rest).** "mestret ved 3 rigtige i første forsøg", "Brøker 60" og seks slags tal på Min helts første skærm.

## Fund

| Nr. | Alvor | Hvad | Hvor |
|---|---|---|---|
| G2 | middel (Marcs valg) | Hoved og Hånd gør intet ud over at følge niveauet. "Niveau op!" forklarer nu Hoved godt. | Min helt, "?" |
| G4 | lav (rest) | Seks slags tal på Min helts første skærm; "Øv her" med "(60 point)" og "Alle syv står i rygsækken" | Min helt |
| G5 | lukket (658) | Én Hjerte-forklaring, kun bag "?" | Min helt |
| G6 | lav | "?" ser ud som 30 px (trykflade 44) og sidder på Hjertes hjørne | kortet, Min helt |
| G7 | middel | "0 af 4 opgaver løst · mestret ved 3 rigtige i første forsøg" og "Brøker 60" er det første, barnet læser ved opgaven | opgaven |
| G9 | middel (ny) | Rigtigt svar: tre "+10" på én gang (helten øverst, "+10 Brøker", "+10" ved baren), og Brøker tæller op. Heltens er mindst og længst fra øjet. | kortet og opgaven |
| G10 | middel (ny) | Nyt niveau: 36 til 55 ting i bevægelse (658: 48), og flyderen øverst tæller "Niveau 2 +1" over banneret "Niveau 3". På 1280 står "+40 Brøker" hen over "(nu 100)". | opgaven, niveau op |
| G12 | middel (ny) | Helten ser ens ud før og efter nyt niveau. Kun tallet og titlen ændres (660 blok 2 ikke committet). | kortet, Min helt |

## Ærlige grænser

- **Ingen rigtig 11-årig eller klasse har set det.** "Føles som et MMORPG", "roligt" og "skamme sig" er mit skøn ud fra skærmbilleder og målte tal.
- **"Ting i bevægelse"** svinger med, hvornår målingen rammer (nyt niveau i 660: 55 på 390, 36 på 1280 i samme kørsel). Det er `document.getAnimations()` i gang plus flydere. Det tæller også de små scener på kortet (møllehjul, røg, åndedræt), som altid kører. Tallet siger, hvor meget der sker, ikke hvor meget man ser.
- **660 er kun blok 1.** Blok 2 (helten ændrer sig) og blok 3 er ikke committet og ikke målt. Dommen om MMORPG kan skifte, når de er.
- Ét gemt spil (niveau 2, Møllen) og ét forløb er målt. Senere niveauer og titler er ikke set.
- Gætteren og den ærlige er målt i spillets model, ikke i browseren. I browseren er kun "+10" mod "+5" set.
- Touch er emuleret i headless Chromium på Windows. Det er ikke en rigtig telefon eller skole-pc, og tempoet på en langsom pc er ikke målt.
