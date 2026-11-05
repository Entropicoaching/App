# Coachportalen: visuel gennemgang 2

Billet: E2-COACH-VISUEL-AUDIT2. Base: `9218bbc8a6cb1af0bd894dafb4886fa4127e0f71`
(`release/entropi-samlet-neste`, Entropi 2 tændt). Dato: 5. november 2026.

Dette er en kildebaseret gennemgang af de fastlåste offentlige kopier. Der er
ikke åbnet browser, kørt server eller brugt private data. Beskrivelserne af det,
brugeren ser, følger komponenternes elementtræer og betingelser; de er ikke
skærmbilledobservationer. Faktisk layout, zoom og skærmlæseradfærd skal efterprøves
ved implementering. Syntetiske element- og hændelsesværter er ikke ægte React.

Målet følger Marcs beslutninger: det vigtigste først, resten foldet, mobil først,
ingen dobbelt information og et ærligt skel mellem tomme, ukendte og fejlede data.
De 10 punkter nedenfor er afgrænsede forbedringsbilletter, ikke ændringer i denne
leverance. Estimaterne omfatter rettelse og lokale regressionsprøver, men ikke
Dhurvas fulde suite og build. P1 = adgang til en central handling; P2 = tydelig
friktion i et dagligt flow. Hver rettelse gælder kun Entropi 2 ON og bevarer OFF.

## Gennemgåede indgange

| Flow | Aktiv kilde i denne base |
| --- | --- |
| Forside og indbakke | `src/Dashboard.jsx:699` → `src/entropi2/coach/CoachScreen.mjs:37` |
| MIN TRÆNING | `src/dashboard/navigation.js:20` → `src/AthleteView.jsx:845` → `src/entropi2/home/AthleteHome.mjs:178` |
| Kalender | `src/Dashboard.jsx:744` → `src/dashboard/KalenderView.jsx:19` i kalendergrenen uden programOverblik |
| Atletliste | `src/entropi2/coach/CoachScreen.mjs:97` → `src/entropi2/coach/CoachAthleteWorkspace.mjs:39` |
| Kost & mål og kostplan | `src/Dashboard.jsx:854` → `src/entropi2/kostMaalKobling.mjs:66` → `src/entropi2/kostplan/coach/PortalPlan.mjs:61` |
| Samtale med video-feedback | `src/Dashboard.jsx:941` → `src/entropi2/conversation/ConversationView.mjs:30` |

Forsidens første tre opgaver, navnesøgning, kostplanens lukkede indgang,
vægtgenforsøg, kalenderens fremhævede aktuelle uge og samtalens bevarede fokus
ved læsekvittering findes allerede. De foreslås derfor ikke igen.

## F01 — Bevar atletlistens arbejdssted ved retur fra en profil

- **Prioritet og omfang:** P2 · 90 minutter.
- **Fil:linje:** `src/entropi2/coach/CoachScreen.mjs:29` og `:97`;
  monteringsgrænse `src/Dashboard.jsx:699`; eksisterende rullegendan i
  `src/dashboard/navigation.js:45`.
- **Nu:** Coachen åbner »Dine atleter«, søger og åbner en profil. Listen afmonteres
  i profilvisningen. Ved retur er søgningen tom, og den ukontrollerede
  atletfold starter lukket. Den eksisterende gendannelse af rulleposition kan
  derfor ikke alene føre tilbage til samme synlige søgeresultat.
- **Konkret rettelse:** Bevar kun søgetekst og denne folds åbning i den eksisterende
  Dashboard-vært under coachens identitet. Gendan dem ved retur til listen;
  nulstil ved coachskift og OFF. Bevar den nuværende rullelogik. Gem ikke
  atletdata eller beskedudkast sammen med visningstilstanden.
- **Færdig når:** Søg → profil → retur viser samme søgning og åbne atletfold;
  nulstilling og coachskift virker fortsat. Udvid `coachFront.test.mjs` med
  afmontering/genmontering af værtsgrænsen. Syntetisk genmontering reproducerer
  allerede tabet af søgetekst; selve rullegengivelsen er ikke browserprøvet.

## F02 — Gør en stor indbakke overskuelig i mindre portioner

- **Prioritet og omfang:** P2 · 60 minutter.
- **Fil:linje:** `src/entropi2/coach/CoachScreen.mjs:55`, `:88` og `:137`.
- **Nu:** Forsiden viser tre opgaver og folder resten. Indbakken viser derimod
  samtlige opgaveknapper før »Alle samtaler«. Med 20 opgaver er der 20 åbne
  opgaverækker før denne indgang; der er ingen lokal afgrænsning. Det gør vejen
  til en anden samtale lang på mobil. Dette er en bevidst nuværende kontrakt,
  ikke et tab af opgaver.
- **Konkret rettelse:** Vis de første 10 i eksisterende rækkefølge med
  »Vis 10 flere« og synlig tæller »10 af 20«. Lad coachen se alle ved gentagne
  tryk. Bevar samlet antal, opgavenøgler og eksisterende profil-/returcallbacks.
- **Færdig når:** 0, 1, 10 og 20 opgaver har korrekte tællere; alle opgaver kan
  nås uden datagenlæsning, og ingen afsendelse eller læsekvittering udløses af
  »Vis flere«. Opdatér den eksplicitte forventning om alle åbne indbakkeopgaver
  i `src/entropi2/coach/coachFront.test.mjs:37`.

## F03 — Vis bekræftet fravær af træningsregistreringer på atletkortet

- **Prioritet og omfang:** P2 · 45 minutter.
- **Fil:linje:** `src/entropi2/coach/coachWorkspaceModel.mjs:21` og `:38`;
  `src/entropi2/coach/atletkort/AthleteCard.mjs:16`.
- **Nu:** En komplet aktivitetslæsning uden registreringer bliver til
  `session: undefined`. Det kompakte atletkort udelader derefter træningslinjen.
  Coachen kan ikke på kortet skelne en bekræftet tom læsning fra et ukendt
  træningsgrundlag. Modellen understøtter allerede »Ingen registrerede pas«.
- **Konkret rettelse:** Tilpas den komplette, validerede tomme aktivitetskilde til
  en sessionkvittering med `lastDay: null`, og vis modellens tomtekst i den
  kompakte variant. Brug formuleringen »Ingen pas i det indlæste grundlag«, hvis
  læseren kun dækker en afgrænset periode; påstå ikke at atleten aldrig har trænet.
  Manglende, delvise og fejlede kilder skal fortsat være ukendte.
- **Færdig når:** Komplet tom, komplet med pas, delvis, fejl og forkert
  atlet/dag giver forskellige, korrekte resultater uden et falsk inaktivitetssignal.
  Udvid `coachFront.test.mjs` og `atletkort/athleteCard.test.mjs`.

## F04 — Giv MIN TRÆNING en genindlæsningsknap ved ugeskift

- **Prioritet og omfang:** P2 · 45 minutter.
- **Fil:linje:** `src/entropi2/home/AthleteHome.mjs:134`, `:184` og `:199`.
- **Nu:** Når næste pas tilhører en anden uge end den indlæste, er startknappen
  deaktiveret. Teksten siger »En ny uge er startet. Genindlæs siden …«.
  Skærmens eksisterende »Hent igen« vises kun ved programfejl eller offlinekopi,
  så denne konkrete blokering giver ingen tilsvarende knap.
- **Konkret rettelse:** Tilbyd den eksisterende `onRetryProgram`-handling også i
  `staleWeek`-tilstanden. Vis »Henter…« under forsøget og en lokal fejl med nyt
  forsøg ved afvisning. Bevar startblokeringen, indtil værten faktisk leverer
  samme uge som det valgte pas. Afgræns ændringen til coachens egen træning.
- **Færdig når:** En syntetisk coach på egen profil kan hente den nye uge med ét
  tryk; gentagne tryk under hentning giver ét forsøg; en mislykket hentning
  aktiverer aldrig start. Bevar read-only-preview og OFF. Udvid
  `src/entropi2/home/coachSelfHome.synthetic.test.mjs` med ugeskiftgrenen.

## F05 — Gør kalenderens profilgenveje til rigtige knapper

- **Prioritet og omfang:** P1 · 60 minutter.
- **Fil:linje:** `src/dashboard/KalenderView.jsx:295`, `:413` og `:502`.
- **Nu:** Kalenderens navnekolonne og rækker i »Alle atleter« åbner programmer
  med `div onClick`; navnet i bakken uden startdato er et `span onClick`.
  De ligner klikbare genveje, men mangler native tastaturfokus og aktivering med
  Enter/mellemrum. Tidslinjens blok- og tomcelleknapper er allerede forbedret.
- **Konkret rettelse:** Brug native `button type="button"` til disse tre
  profilgenveje, kun i ON-grenen. Bevar `openProfile(..., 'program')`, placering
  og navneafkortning. Giv mindst 44 px trykhøjde og synlig fokusring uden at
  lægge knapper inde i andre interaktive elementer.
- **Færdig når:** Alle tre genvejstyper kan nås med Tab og aktiveres én gang
  med tastatur. Lange navne og mobilbredde bevarer layoutet. Udvid
  `src/dashboard/calendarClarity.test.mjs`; kontrollér fokus og Enter/mellemrum
  i rigtig browser ved implementeringen. OFF beholder eksisterende elementer.

## F06 — Lad kalenderens tomtilstand matche en tom atletliste

- **Prioritet og omfang:** P2 · 30 minutter.
- **Fil:linje:** `src/dashboard/KalenderView.jsx:49`, `:280` og `:487`.
- **Nu:** Med vellykket læsning og nul synlige atleter viser den åbne tidslinje
  »Ingen atleter med datoer endnu — sæt en startdato nedenfor …«. Men der er
  ingen atlet eller »Sæt startdato«-knap nedenfor. Den korrekte »Ingen atleter«
  ligger inde i den lukkede boardfold. Det samme kan ske, når alle er skjulte.
- **Konkret rettelse:** Vis en kort, åben tomtilstand, når læsningen er færdig og
  `visibleAthletes.length === 0`. Fjern datoinstruktionen og de tomme
  kalendersektioner i denne gren. Brug »Ingen synlige atleter« uden at udlede,
  at coachen skal oprette en ny atlet. Bevar de andre indlæsnings-/fejlgrene.
- **Færdig når:** Tom læsning og kun skjulte atleter giver den præcise tomtekst;
  en synlig atlet uden datoer får fortsat den relevante datohjælp. Justér de
  eksisterende tomkalenderforventninger i `calendarToday.test.mjs:68` og
  `calendarClarity.test.mjs:19`.

## F07 — Forklar en manglende vægttrend uden at åbne hjælpen

- **Prioritet og omfang:** P2 · 45 minutter.
- **Fil:linje:** `src/entropi2/kostMaal/KostMaal.mjs:86` og `:97`;
  `src/entropi2/kostMaal/model.mjs:67` og `:71`.
- **Nu:** Med én gyldig vejning viser Kost & mål »Seneste vejning«, men
  trendlinjen forsvinder helt. Kravet om mindst to vejedage i hver periode
  findes kun i den lukkede »Vægtgrundlag«-fold; modellens handlingsforklaring
  vises ikke. Den sparsomme, men gyldige tilstand har ingen kort forklaring.
- **Konkret rettelse:** Vis én neutral linje, fx »Trend: for få vejninger endnu«,
  når vægtlæsningen er klar, en vejning findes, og `trend === null`. Behold
  periodekravet i folden. Brug modellens eksisterende datagrundlag; ændr ikke
  beregning eller tærskler, og vis aldrig 0 kg som erstatning for ukendt trend.
- **Færdig når:** Én vejning, tilstrækkeligt grundlag, ingen vejninger,
  indlæsning og fejl har korrekte synlige tekster. Udvid
  `src/entropi2/kostMaal/coachCalm.synthetic.test.mjs`; bevar dens eksisterende
  kontrakt om foldet forklaring.

## F08 — Gør dagsplanens måltider overskuelige før redigering

- **Prioritet og omfang:** P2 · 90 minutter.
- **Fil:linje:** `src/entropi2/kostplan/coach/view.mjs:91`, `:108` og `:138`.
- **Nu:** Den ydre »Kostplan« er allerede lukket som standard. Når coachen
  genererer en plan, står alle tre måltiders fødevarevælgere og gramfelter
  åbne i gennemgangen. »Gem som kladde« og aktivering ligger efter samtlige
  måltidsfelter. Det prioriterer redigeringsfelter frem for et kort overblik.
- **Konkret rettelse:** Behold dagens plan/mål-tabel og status åbne. Giv hvert
  måltid et kompakt resumé af fødevarer, gram og eksisterende makrosum med
  »Rediger måltid« som fold. Åbn et berørt måltid ved ugyldige gram eller anden
  lokal feltfejl. Bevar gennemgangstekst, tolerancer, kladdestatus og de
  eksplicitte gem-/aktiveringshandlinger.
- **Færdig når:** Genereret og genåbnet kladde er læsbare med måltidsredigering
  foldet; redigering og genberegning virker, og en feltfejl skjules ikke.
  Ingen foldhandling gemmer eller aktiverer. Udvid `calmPlan.synthetic.test.mjs`
  og kør kostplanmappens prøver ved implementeringen.

## F09 — Lad en åbnet besked kunne foldes sammen igen

- **Prioritet og omfang:** P2 · 45 minutter.
- **Fil:linje:** `src/entropi2/conversation/ConversationView.mjs:253` og `:266`.
- **Nu:** Et tryk på beskedens metadatalinje åbner hele indholdet. Næste tryk
  åbner det igen: handleren kalder altid `expanded.add`, aldrig `delete`.
  Flere lange åbne beskeder bliver derfor stående, indtil samtalen afmonteres.
  `aria-expanded` viser tilstanden, men knappen kan ikke lukke den.
- **Konkret rettelse:** Skift åben/lukket for samme nøgle ved hvert tryk og
  opdatér preview, indhold og `aria-expanded` samlet. Kvittér fortsat først
  efter en udtrykkelig åbning; sammenfoldning må ikke markere andre læst eller
  ændre beskedernes eksisterende rækkefølge.
- **Færdig når:** Åbn → luk → åbn fungerer for både tekst og video, bevarer
  tilknyttet fokus og gør videoreview tilgængeligt, når rækken er åben. Bevar
  fejl ved læsekvittering og sendekladde. Udvid
  `conversationAccessibility.synthetic.test.mjs` og præsentationsprøverne.

## F10 — Forklar og validér tidsfeedback før coachen trykker Send

- **Prioritet og omfang:** P2 · 60 minutter.
- **Fil:linje:** `src/entropi2/conversation/ConversationView.mjs:127`, `:138`
  og `:214`; eksisterende validering i `conversationController.mjs:65`.
- **Nu:** Under beskedfeltet står videovælger, et tomt talfelt og »Send
  tidsfeedback«. Talfeltet har kun et tilgængeligt navn, ingen synlig etiket.
  Når beskedteksten er udfyldt, er tidsfeedbackknappen aktiv selv uden valgt
  video og tidspunkt. Først controlleren afviser forsøget; kladden bevares.
- **Konkret rettelse:** Tilføj synlige etiketter »Video« og »Tidspunkt i sekunder«
  samt et kort eksempel. Aktivér tidsfeedback kun med valgt eksisterende video,
  endeligt gyldigt tidspunkt og tekst. Opdatér knappens tilstand også ved
  ændringer i video og tidspunkt. Bevar controllerens autoritative validering,
  normal Send og kladden; hent ikke video eller opret ny skrivevej.
- **Færdig når:** Ingen video, tom/negativ/ugyldig tid og en fjernet video kan
  ikke sendes som tidsfeedback; 0 sekunder og øvrige gyldige tider virker.
  Et forældet input afvises stadig af controlleren. Udvid samtalens
  præsentationsprøver med de synlige etiketter og knaptilstandene.

## Foreslået rækkefølge og kontrolgrundlag

Start med F05 (tastaturadgang), derefter F01, F10, F06, F03, F04, F07, F08,
F02 og F09. F02 og F08 ændrer en bevidst præsentation og bør verificeres som
hele flows, så roligere visning ikke skjuler opgaver eller ugyldige felter.
Ingen af punkterne kræver ny datakilde, migration eller automatisk afsendelse.

Der er søgt efter dokumentkontrakter i hele det leverede `src/` (962
test-/specfiler); ingen låser `docs/audit/coach-visuel2.md`. `test/` og `docs/`
indgår ikke i kildepakken, så eksisterende dokumentation og prøver uden for
pakken kan ikke vurderes her. Der er ingen prøver i den nyoprettede
`docs/audit/`-mappe. Otte udvalgte eksisterende prøvefiler blev kørt før og efter
dokumentændringen: 66/66 PASS med syntetisk adapter. Ti supplerende
evidenskontroller reproducerer ovenstående forhold; F04 er en kildegrenkontrol,
og F01 kombinerer syntetisk genmontering med værtens kildebetingelse.

Dette dokument ændrer ingen af de påviste forhold. Dhurva kører fuld suite og
build ved fletning; den separate kontrolbillet K-E2-COACH-VISUEL-AUDIT2 skal
foretage frisk kontrol af den endelige leverance.
