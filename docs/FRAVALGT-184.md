# Hvad jeg fravalgte (Ordre 184) — til Dhruvas næste ordre

Skrevet så Marc kan læse det uden kode. Hvert punkt: hvad det ville koste,
hvad det ville give. Erstatter FRAVALGT-175.md som Dhruvas grundlag — de to
punkter derfra der stod åbne (atletlistens 5,8s TTI, refreshCoachInbox's
gentagne kald) er begge videreført/opdateret her.

## 1. Atletlistens ~5,8s TTI — stadig uløst, stadig forbudt af denne ordres grænser

Uændret fra FRAVALGT-175.md #1: klart den værste måling (perf 55-70, TTI
~5,8-6,0s), på coachens hyppigst brugte skærm. Kræver en ægte omlægning af
HVORNÅR Dashboard.jsx henter sine mange datakilder — udtrykkeligt forbudt af
både ordre 175's og denne ordres grænser ("ingen omskrivning af Dashboard").
**Egen ordre, med tid til at gennemgå data-hentningsstrategien.**

## 2. refreshCoachInbox()s gentagne kald ved faneskift — forsøgt igen, rullet tilbage igen

Den faste dublet (samme funktion kaldt to gange ved HVER sideindlæsning) er
rettet i denne ordres commit 2. Den ANDEN mekanisme — et rent Forside↔Coach
Briefing-faneskift genkører alle fire kald — blev forsøgt igen her, med en
anden teknik end ordre 175's tidsbaserede vagt (denne gang: tjek FØR nogen
`setState` kaldes, i stedet for at sætte `inboxRefreshing` og bagefter
opdage at kaldet var overflødigt).

- **Hvad jeg fandt ved test:** netværkskaldene faldt reelt (11→1 på
  Indbakke), MEN en reproducerbar regression viste sig igen — denne gang
  konsistent på DESKTOP-profilen (ingen CPU-kastration der, så ikke en
  throttling-artefakt): renderMs 59-66ms → 359-361ms, målt to gange i træk
  med identisk resultat. Telefon-profilens tal var støjende (514-948ms mod
  en baseline på 496-507ms) og derfor ikke i sig selv beviskraftigt, men
  desktop-tallet var det.
- **Hvorfor jeg rullede den tilbage:** samme princip som ordre 175 —  en
  rettelse hvis konsekvens jeg ikke forstår er ikke en billig gevinst. At
  SKIPPE et netværkskald burde aldrig gøre en skærm langsommere at tegne;
  at det gør det, to gange nu, med to forskellige teknikker, er et tegn på
  at der er en reel mekanisme jeg ikke har fundet endnu — ikke tilfældighed.
- **Hvad det ville koste at prøve en tredje gang:** et ægte
  performance-trace (Chrome DevTools "Performance"-panel eller
  `Network.requestWillBeSent`+`Tracing.start` via CDP), ikke kun
  før/efter-tal, for at se PRÆCIS hvad der sker på hovedtråden i de ~300ms
  ekstra. Mistanke værd at afprøve: at `videoCoachAthletesRef.current` (som
  `refreshCoachInbox` læser synkront) på en eller anden måde tvinger en
  ekstra re-render af hele Dashboard-træet når kaldet SPRINGES over, fordi
  ingen af de fire fetches' `setState`-kald (som normalt sker spredt over
  flere microtasks) kommer til at "brydde" en synkron renderings-kæde op.
  Ren hypotese, ikke efterprøvet.
- **Hvad det ville give, hvis det lykkes:** samme netværksbesparelse (11→1
  ved gentagne klik) uden at gøre Indbakke langsommere at tegne — se
  `outputs/maal-coach/2026-09-14--efter-commit3.json` og
  `outputs/maal-coach/2026-09-14--efter-commit3-retry.json` for de rå tal
  fra begge forsøg (koden selv er IKKE i noget commit — kun disse to
  målefiler dokumenterer forsøget).

## 3. Ny: weeks/calendar-data genhentes ved rent Forside↔Kalender-faneskift

Fundet under denne ordres arbejde, IKKE afprøvet eller rettet (ordren bad om
at vælge fra den EKSISTERENDE fravalgt-liste, ikke åbne nye områder — noteres
her til Dhruvas næste ordre i stedet).

`fetchCalendarWeeks`/`fetchCalendarProgress` (Dashboard.jsx linje ~626-632)
henter 180 dages `exercise_logs` med indlejrede joins for ALLE atleter, og
genkører for HVERT skift mellem 'list' og 'calendar' — nøjagtig samme mønster
som ordre 175's rettelse 1 (weeks/logs), bare for en anden datakilde og et
andet fanepar. `fetchCalendarWeeks` bliver allerede eksplicit genkaldt efter
ægte skrivninger tre andre steder i koden (linje 943, 1251, 1284) — samme
forudsætning der gjorde rettelse 1 sikker.

- **Hvad det koster:** en ref-baseret dedup identisk i form med
  `weeksLogsLoadedForRef` (ordre 175), nulstillet når coachen forlader
  'list'/'calendar' til fx en atletprofil (samme sikkerhedsmargin som
  rettelse 1's `!selectedAthlete`-nulstilling).
- **Hvad det giver:** færre unødige 180-dages-forespørgsler ved almindelig
  Forside↔Kalender-navigation. Ikke målt her — ukendt størrelse, men
  billig og lavrisiko givet det etablerede mønster.

## 4. Ny: oversigt/analyse-fanernes fire kald genhentes ved faneskift mellem dem

Samme fund, andet sted: `fetchAthleteWeightLogs`/`fetchAthleteReadiness`/
`fetchAthletePRs`/`fetchMeetResults` (linje ~662-668) genkører ved ETHVERT
skift mellem 'oversigt' og 'analyse' på samme atlet — ingen af de to fanetal
er atlet-skrivestyret fra coachens side (vægt/parathed logges af atleten
selv), så en ref-dedup ville være lige så sikker som rettelse 1's.

- **Hvad det koster:** samme mønster som punkt 3 ovenfor, en ny, separat ref
  (må IKKE genbruge `weeksLogsLoadedForRef` — den dækker en anden
  datakombination og ville lade `fetchWeeks` springes forkert over).
- **Hvad det giver:** ikke målt her — samme klasse gevinst som ordre 175's
  rettelse 1 (færre unødige rundture, ikke nødvendigvis en følt
  hastighedsforskel).

## 5-7. Uændrede fra RAPPORT-167 — stadig infrastruktur-blokerede

- **Videocoach-forsidens resterende ~3,5s FCP:** kræver at splitte
  sporingskoden fra skallen — forbudt af denne ordres grænser
  ("videocoachens sporingskode").
- **Logins resterende ~3s FCP (preconnect):** kræver et ægte, sikkert
  Supabase-testmiljø for ærlig måling — findes ikke her, og må ikke bygges
  uden ordre.
- **De tre harness-skærmes ægte tal:** samme infrastrukturkrav som ovenfor.

## Prioriteret rækkefølge til Dhruva

1. Punkt 1 (atletlistens TTI) — størst kendt gevinst, egen ordre, kræver at
   Dashboard-grænsen løftes for netop den ordre.
2. Punkt 3 og 4 (calendar/oversigt-dedup) — billigst, lavest risiko, samme
   velafprøvede mønster som ordre 175's rettelse 1. God kandidat til en
   hurtig, lille ordre.
3. Punkt 2 (refreshCoachInbox tredje forsøg) — kun med et ægte trace-værktøj
   til rådighed, ellers samme uforklarede regression igen.
4. Punkt 5-7 — kræver et sikkert Supabase-testmiljø, ikke kodearbejde.
