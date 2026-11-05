# Atletens næste visuelle forbedringer — Entropi Coach

Billet: E2-UI-GENNEMGANG2. Grundlag: offentlig kildekopi af revision
`4bc2a3406e705bd66cb3b6c74c62213e1850e975` (4bc2a340).
Dokumentationsaudit, 5. november 2026. Ingen produktkode er ændret.

## Metode og afgrænsning

Gennemgangen følger atletens aktive Entropi 2-indgange fra `src/AthleteView.jsx`.
Programmet er stadig `src/athlete/ProgramTab.jsx`; den separate
`src/entropi2/program/Program.mjs` er ikke den monterede programfane her.
390 px er målbredden for anbefalingerne. Browser, server og net er forbudt i
denne kørsel: beskrivelserne nedenfor er kildebaserede og suppleret med
syntetiske tekst-, fokus- og hændelsesprøver mod de faktiske kopierede moduler.
De er ikke skærmbilledobservationer eller bevis for pixelmål, foldhøjde,
skærmtastatur, fontindlæsning eller browserlayout. De skal bekræftes visuelt
ved 390 px i Dhurvas senere integrationskontrol.

De medleverede beslutninger fra 3. november bruges som ophav. Beslutningerne
fra 4. november kl. 20:44 og 21:01, som ordren henviser til, er ikke medleveret;
deres indhold er derfor ikke rekonstrueret eller antaget.

De allerede flettede forbedringer bevares: Start før øvelser og noter på Hjem
(`src/entropi2/home/AthleteHome.mjs:108`), kompakt plan før registrering
(`src/entropi2/session/sessionView.mjs:163`), forslaget »Som planlagt«
(`src/entropi2/session/sessionModel.mjs:43`), programmets fokusmarkering og
44 px-kontroller (`src/athlete/ProgramTab.jsx:31` og
`src/athlete/ProgramTab.jsx:344`), foldet dagbog samt fejl uden for kostfolden
(`src/entropi2/nutrition/view.mjs:243`).

Alle forslag bruger eksisterende indlæste felter eller lokal UI-tilstand.
Kildekoden viser disse kontrakter; produktionsdata er ikke tilgået eller
bekræftet. Manglende, fejlramte eller ufuldstændige data må aldrig erstattes med
opfundne koblinger, nulværdier eller rekorder. Ingen nye datakilder,
samtykkeudvidelser, automatiske anbefalinger eller baggrundsskrivninger foreslås.
Senere kodearbejde skal bevare eksplicit OFF, forhåndsvisning uden skrivninger,
ejerskabsafgrænsning og styles under skærmens eksisterende namespace.

## De 12 forbedringer i anbefalet rækkefølge

### 1. Vis den eksisterende rekordkvittering i Entropi 2-passet

- **Sted:** `src/AthleteView.jsx:837`, `src/AthleteView.jsx:905`,
  `src/entropi2/session/sessionView.mjs:79`.
- **Nu:** Værten har `rekordFejring`, men sender den kun til den gamle
  hjemvisning. `HomeSession` og den nye pasrenderer viser ingen rekordlinje.
  Den eksisterende visning findes i `src/athlete/DagensPasCard.jsx:213`.
  Atleten kan dermed mangle den rolige fejring efter et bekræftet rekordsæt.
- **Rettelse:** Før den eksisterende, kortlivede rekordkvittering til det aktive
  pas og vis én kompakt statuslinje ved det netop gemte sæt. Match kvitteringens
  nøgle med atletens aktuelle øvelse/sæt, og bevar eksisterende rydning ved
  fortrydelse eller udløb. Vis intet uden en gyldig kvittering; beregn ikke nye
  rekorder fra den lokale pasoversigt, og fejr aldrig et afventende/offline sæt.
- **Prioritet og omfang:** P1 · 60–90 minutter.
- **Kontrol ved 390 px:** Ét bekræftet rekordsæt giver én linje; almindeligt,
  fortrudt, kølagt og parkeret sæt giver ingen. Linjen må ikke flytte Start
  eller skjule gemmestatus.

### 2. Bevar Start først og fold de lange pasdetaljer på Hjem

- **Sted:** `src/entropi2/home/AthleteHome.mjs:112`.
- **Nu:** Start er korrekt øverst, men derefter vises alle øvelsesnavne og
  samtlige øvelsesnoter udfoldet. Et pas med mange lange noter gør hjemkortet
  langt, før atleten når Dagsform, Vægt og coachens besked.
- **Rettelse:** Bevar titel, dato, Start og sætfremgang synlige. Saml listen og
  de eksisterende noter under én lukket »Se øvelser og coachnoter« med mindst
  44 px trykhøjde. Bevar hele teksten i folden og coachens fokus synligt under
  selve passet; ingen afkortning af instruktioner dér.
- **Prioritet og omfang:** P1 · 45–60 minutter.
- **Kontrol ved 390 px:** Prøv ét og ti øvelsesnavne med lange noter. Start står
  før folden, noter findes én gang, og de daglige loggenveje følger kortet.

### 3. Giv hjemkortet mere af telefonens bredde

- **Sted:** `src/AthleteView.jsx:834`, `src/athleteShared.js:71`,
  `src/entropi2/home/homeStyles.mjs:3`.
- **Nu:** Hjem ligger i værtens sidepadding på 1 rem i hver side og tilføjer
  selv 20 px samt kortets yderligere 20 px og kant. Med en rodskrift på 16 px
  giver disse deklarationer ca. 276 px til kortets tekst på en 390 px skærm.
  Det er en beregning af styles, ikke et målt browserresultat.
- **Rettelse:** Lad værten eje den ydre vandrette padding på E2 Hjem, og fjern
  kun det dobbelte lag inde i hjemkomponenten. Bevar kortets luft, maxbredde,
  tekstombrydning og den gamle OFF-visning. Brug E2 Hjems eksisterende scope.
- **Prioritet og omfang:** P1 · 30–45 minutter.
- **Kontrol ved 390 px:** Lang pastitel, coachtekst og Start uden vandret rul;
  sammenlign også 200 % tekst og 320 px. Bekræft de faktiske bredder i browser.

### 4. Gør valgfri RPE til et roligt tilvalg i sættet

- **Sted:** `src/entropi2/session/sessionView.mjs:190`,
  `src/entropi2/session/sessionView.mjs:225`.
- **Nu:** Et valgfrit RPE-felt og ni RPE-knapper er altid udfoldet under vægt
  og gentagelser. Den kompakte plan er på plads, men registreringsdelen har
  stadig mange valg før »Som planlagt«/godkendelsesknappen.
- **Rettelse:** Vis en 44 px »Tilføj oplevet anstrengelse (RPE)«-fold efter
  vægt og gentagelser. Har atleten selv indtastet RPE i det aktuelle sæt, skal
  værdien være synlig og folden blive åben ved opdatering. Bevar fritekstfelt,
  hele den eksisterende tilladte skala og en tom værdi som manglende RPE.
  Planlagt RPE må fortsat ikke udfylde oplevet RPE.
- **Prioritet og omfang:** P2 · 60–90 minutter.
- **Kontrol ved 390 px:** Tom RPE kan gemmes med samme payload som nu;
  selvvalgt RPE kan rettes og fjernes. Travl/fejl/offline-tilstand bevarer låse,
  indtastning og adgang til forklaringen.

### 5. Hold fokus på plus/minus og RPE ved opdatering af samme sæt

- **Sted:** `src/entropi2/session/sessionView.mjs:85`,
  `src/entropi2/session/sessionView.mjs:265`.
- **Nu:** Rendereren husker inputfelt, foldoverskrift og godkendelsesknap,
  men ikke `data-step`-knappen. En syntetisk prøve mod den faktiske renderer
  viser: fokusér »+2,5«, tryk og opdatér samme sæt; vægten ændres korrekt, men
  fokus ender på pasoverskriften. Tastaturbrugeren må finde kontrollen igen.
- **Rettelse:** Husk den fokuserede knaps `data-step` og gendan den på den nye
  knap ved opdatering af samme sætnøgle, hvis den stadig er tilgængelig.
  Bevar flytning til overskriften ved et reelt sætskift og den eksisterende
  håndtering af inputmarkering, gemning og deaktivéring.
- **Prioritet og omfang:** P1 · 45–60 minutter.
- **Kontrol ved 390 px:** Gentag plus/minus og RPE med tastatur uden tabt fokus.
  Bekræft sætskift, lukning og gemmefejl særskilt. Prøven er en fokuskontrakt,
  ikke en påstand om mobilbrowserens tastatur eller scroll.

### 6. Gør programmets resterende små etiketter læsbare

- **Sted:** `src/athlete/ProgramTab.jsx:620`,
  `src/athlete/ProgramTab.jsx:633`, `src/athlete/ProgramTab.jsx:764`.
- **Nu:** Ugeoverskrifter og trykmål er forbedret, men parathedstekster bruger
  stadig 0,56 rem og ugedagsmærket 0,52 rem med ekstra bogstavafstand.
  44 px-knapper gør ikke selve teksten større.
- **Rettelse:** Brug E2-betingede tekststyles på mindst 14 px, normal
  bogstavafstand og almindelig sætningsform for disse etiketter. Bevar
  statusord, datoer, farvebetydning, ombrydning og 44 px-kontroller; ændr ikke
  parathedens beregning eller træningsanbefalinger.
- **Prioritet og omfang:** P1 · 30–45 minutter.
- **Kontrol ved 390 px:** Lang ugedag og parathedens to eksisterende tilstande
  skal kunne læses uden zoom og uden at skubbe pasåbneren ud af kortet.

### 7. Fold programmets sjældne massehandlinger væk

- **Sted:** `src/athlete/ProgramTab.jsx:777`.
- **Nu:** »Spring resten over« og »Auto-udfyld« ligger udfoldet i hvert
  ufærdigt paskorts header. De konkurrerer med at åbne passet og giver flere
  rækker på smal skærm, selv om begge allerede kræver bekræftelse.
- **Rettelse:** Flyt de to eksisterende knapper til en lukket »Flere
  handlinger for passet«-fold med mindst 44 px åbner. Hold pasåbner,
  gennemførtstatus og sætfremgang synlige. Bevar præcis de nuværende
  bekræftelser, callbacks, busy-låse samt read-only- og fremtidsbegrænsninger.
  Åbning af folden må ikke registrere noget.
- **Prioritet og omfang:** P2 · 45–60 minutter.
- **Kontrol ved 390 px:** Et tryk på titlen åbner fortsat passet; de to
  massehandlinger kræver deres eksisterende bekræftelse og har 44 px trykmål.

### 8. Gør første overblik over Mine tal kortere

- **Sted:** `src/entropi2/analysis/DevelopmentView.mjs:39`,
  `src/entropi2/analysis/DevelopmentView.mjs:41`.
- **Nu:** Alle løft med observationer får seneste e1RM, forklaring, ændring og
  en 26-ugers graf udfoldet. Tal og datagrundlag er allerede foldet, men flere
  løft kan stadig gøre det første overblik langt før atletens trivselstal.
- **Rettelse:** Bevar seneste observerede tal, dato, ændring når beregnelig,
  e1RM som skøn og eventuel advarsel om gamle data synlige for hvert løft.
  Fold hver graf under »Se udviklingen over 26 uger«; behold alle 26 positioner
  og manglende målinger som huller. Ingen ny udvælgelse af »bedste« løft eller
  automatisk vurdering af atletens form.
- **Prioritet og omfang:** P2 · 60–90 minutter.
- **Kontrol ved 390 px:** Ingen, ét og tre løft med både spredte og gamle data.
  Kompaktkortet viser kun observerede tal og eksisterende beregnelige ændringer.

### 9. Fjern et foldniveau i de ekstra analyser

- **Sted:** `src/entropi2/analysis/Analysis.mjs:71`,
  `src/entropi2/analysis/Analysis.mjs:80`,
  `src/entropi2/analysis/Analysis.mjs:84`.
- **Nu:** »Ugerapport og flere analyser« indeholder »Flere analyser«, som
  igen indeholder »Del ugen«. Den relevante handling kræver tre åbninger;
  beslægtede foldnavne gør placeringen vanskelig at huske.
- **Rettelse:** Bevar én samlet sekundær fold, men læg rapport, Mine data,
  intensitet, rekorder og deling som direkte, klart navngivne underpunkter.
  Fjern kun den mellemliggende samlefold »Flere analyser«. Bevar alle
  eksisterende datagates, manglende-data-regler og read-only-grænsen for kopiering.
  Tomme sektioner skal fortsat udelades.
- **Prioritet og omfang:** P2 · 45–60 minutter.
- **Kontrol ved 390 px:** Deling kan nås efter højst to foldåbninger; en tom
  analyse får fortsat kun sin eksisterende forklaring og programgenvej.

### 10. Hold kostmål synlige før den valgfrie logmenu

- **Sted:** `src/entropi2/nutrition/view.mjs:67`,
  `src/entropi2/nutrition/view.mjs:90`,
  `src/entropi2/nutrition/view.mjs:449`.
- **Nu:** Den afsluttende DOM-omordning viser intro, vægt, »Log hurtigt« og
  dernæst dagens mål. Gentag i går er ubegrænset; favoritter og seneste måltider
  kan tilføje op til fem valg hver. Atleten skal forbi logvalg for at se målene,
  selv om introen siger, at dagbogen er valgfri. Introen står allerede først.
- **Rettelse:** Bevar intro og vægt øverst som i den eksisterende kostprioritet,
  men flyt dagens mål foran hurtigloggen. Vis højst tre deduplikerede hurtigvalg
  og læg resten under »Flere måltider«. Brug de eksisterende måltidsidentiteter
  og mål; vis ingen tom måltidsfold, hvis der ikke findes valg.
- **Prioritet og omfang:** P1 · 45–60 minutter.
- **Kontrol ved 390 px:** Prøv nul og mange måltider samt manglende mål. Bevar
  vægtfejl, logfejl og kvitteringer uden for lukkede folde og ingen logning ved
  blot at åbne dem. En syntetisk DOM-prøve bekræfter den nuværende rækkefølge.

### 11. Giv beskeder en kort vej til at skrive

- **Sted:** `src/entropi2/conversation/ConversationView.mjs:144`,
  `src/entropi2/conversation/ConversationView.mjs:158`.
- **Nu:** Hele samtalelisten står før skrivefeltet. Der er en god genvej til
  første ulæste, men ingen tilsvarende genvej til at skrive efter en lang
  historik. Det gælder også, når atleten blot vil stille et nyt spørgsmål.
- **Rettelse:** Tilføj en enkel 44 px »Skriv til din coach«-knap ved toppen,
  der fokuserer det eksisterende skrivefelt og bringer det i syne. Bevar
  feltets placering, kladde, sendelås, ulæst-rækkefølge, eksplicit læsekvittering
  og rolig rulning ved reduceret bevægelse. Knappen må hverken sende eller
  markere en besked læst.
- **Prioritet og omfang:** P1 · 30–45 minutter.
- **Kontrol ved 390 px:** Nul og 50 beskeder; atleten når samme kladde med ét
  tryk. Efterfølgende browserkontrol skal også afprøve det åbne skærmtastatur.

### 12. Åbn profilen direkte fra »Mig«

- **Sted:** `src/entropi2/profile/ProfilePage.mjs:8`,
  `src/AthleteView.jsx:815`.
- **Nu:** »Mig« åbner en menu med kun ét valg, »Profil og dataeksport«.
  Profilen kræver derfor to tryk, selv om der ikke er et reelt menuvalg.
- **Rettelse:** Brug én almindelig »Mig«-knap på mindst 44 px, der kalder den
  eksisterende `onOpen`. Lad samme ref modtage fokus ved Tilbage, og bevar
  værtens ejerskabskontrol, lukning af kontomenu samt profilens fokus ved åbning.
  Målredigering skal fortsat være tydeligt lokal på enheden, og eksport skal
  fortsat først læse data efter atletens udtrykkelige handling.
- **Prioritet og omfang:** P2 · 30–45 minutter.
- **Kontrol ved 390 px:** Ét tryk til profil og tilbage til samme knap med
  tastatur. Forkert ejer, OFF og coachens atletforhåndsvisning giver ingen ny
  adgang eller læsning.

## Videre kontrol

P1 kommer først; P2 er efterfølgende polering. Hvert omfang gælder én afgrænset
rettelse med fokuserede prøver, ikke hele listen samlet. Punkterne er forslag
til senere kodebilletter, ikke implementerede eller visuelt godkendte ændringer.
Ved integration kontrolleres 390 px med korte og lange syntetiske tekster,
tomme data, fejl, afventende gemning, OFF og forhåndsvisning uden skrivninger.
Dhurva ejer fuld suite, build og den senere visuelle bekræftelse.
