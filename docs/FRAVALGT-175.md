# Hvad jeg fravalgte (Ordre 175) — til Dhruvas næste ordre

Skrevet så Marc kan læse det uden kode. Hvert punkt: hvad det ville koste,
hvad det ville give.

## 1. Atletlistens langsomme åbning (~5,8 sekunder)

**Den klart værste måling i hele ordren** — atletlisten (coachens forside)
tager ~5,8 sekunder at blive brugbar, på BÅDE telefon og desktop, med en
perf-score på kun 56-65. De fire andre skærme (check-in, atletens uge,
videoer, indbakke) er alle under 1 sekund og "føles som et værktøj".

- **Hvorfor jeg ikke rettede det:** siden henter reelt mange forskellige
  ting samtidig (atleter, kalender, dagens aktivitet, videokø, beskeder,
  træningssignaler) — det er ikke ét tydeligt duplikat jeg kunne fjerne
  billigt, det er en side der bare skal bruge meget data for at vise et
  fuldt overblik. At gøre den markant hurtigere kræver at ændre HVORDAN og
  HVORNÅR Dashboard.jsx henter sine data (fx udskyde det der ikke skal
  bruges til første tegning, eller hente færre ting parallelt i stedet for
  alt på én gang) — det er en ægte omlægning af Dashboard, som denne ordre
  udtrykkeligt forbød.
- **Hvad det koster:** en ordre for sig, med tid til at gennemgå hvilke af
  de mange kald der reelt skal være klar FØR coachen kan bruge siden, og
  hvilke der kan komme lidt efter uden at det mærkes.
- **Hvad det giver:** formentlig den enkeltrettelse med størst effekt på
  "føles det som et værktøj" — det er den skærm Marc ser oftest.

## 2. Athletliste-fanens vis-alle-25-rettelse — gav ingen målbar gevinst

Jeg rettede den (billig, sikker: viser top 25 + "vis alle"-knap, samme
mønster som den eksisterende "vis skjulte atleter"-knap), fordi ordren
direkte pegede på "lister der tegner alle rækker" som en mistænkt synder.
Men målt før/efter var atletlistens egen TTI/perf UÆNDRET — de 45
attrap-atleters DOM-rækker var aldrig den reelle flaskehals, netværkskaldene
(punkt 1) er det. Rettelsen står, fordi den er billig og korrekt i
princippet (skalerer bedre hvis Marc en dag har 200 atleter), men den løser
IKKE punkt 1.

## 3. En fjerde rettelse jeg forsøgte og rullede tilbage

`refreshCoachInbox()` (dagens aktivitet, videokø, træningssignaler,
beskeder) genkører i sin helhed ved ETHVERT skift mellem "Forside" og
"Indbakke" — målt til 4 gentagne kald pr. endpoint efter blot 4 klik
(Forside→Indbakke→Forside→Indbakke). Jeg tilføjede en 3-sekunders-vagt der
sprang det unødige genhent over.

- **Hvad jeg fandt ved test:** netværkskaldene faldt reelt (11→1 på
  Indbakke-skærmen), MEN Indbakke-skærmens egen visningstid steg fra 68ms
  til 330-930ms på tværs af flere gentagne målinger — en reproducerbar
  regression jeg ikke kunne forklare inden for denne ordres tid, selv efter
  at have flyttet vagten til et andet sted i koden.
- **Hvorfor jeg rullede den tilbage:** en rettelse hvis konsekvens jeg ikke
  forstår er ikke en billig gevinst, uanset hvor godt netværkstallet ser ud.
  Den originale, uændrede kode er stadig i produktion — kun de tre rettelser
  i commit 2 er leveret.
- **Hvad det ville koste at prøve igen:** mere tid til at spore PRÆCIS
  hvorfor Indbakke-visningen bliver langsommere når det redundante
  netværkskald udebliver — muligvis relateret til lazy-indlæsningen af
  Indbakke-fanens egen kodedel (chunk), muligvis noget andet. Skal
  undersøges med værktøjer der viser hvad der reelt sker i browseren
  millisekund for millisekund (en trace), ikke kun før/efter-tal.
- **Hvad det ville give, hvis det lykkes:** samme netværksbesparelse som nu
  (4x færre kald ved gentagne klik) UDEN at gøre Indbakke langsommere.

## 4. Videoer-fanens forudhentning — reel, men svær at måle her

Jeg lagde en forudhentning af Analyse-fanens kodedel ind, som starter så
snart coachen åbner en atlets profil (før coachen når at klikke sig videre
til "Videoer"). Den giver ingen målbar gevinst i DENNE ordres test, fordi
testens klik sker øjeblikkeligt efter hinanden (et script, ikke en
menneskelig coach der læser skærmen først) — forudhentningen får simpelthen
ikke tid til at blive færdig inden det (scriptede) klik. I virkelig brug,
hvor der typisk går længere tid mellem at åbne en profil og klikke ind i
Videoer, forventes den at hjælpe mere. Rettelsen står, fordi den er billig
og harmløs uanset — men den bør IKKE regnes som "bevist" af denne ordres
tal alene.
