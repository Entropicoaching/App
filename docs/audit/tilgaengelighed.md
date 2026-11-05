# Tilgængelighed i atletens Entropi 2

Auditdato: 5. november 2026. Base: `dda192d6841fde324b42d83c5bd1d82b9cc29ad0`.
Billet: `E2-TILGAENGELIGHED-AUDIT1`.

**Resultat: FAIL for den gennemgåede tilgængelighed.** Syv prioriterede fund følger nedenfor.
Dette er en kildeaudit med faktiske importer af kopierede moduler og syntetiske fixtures,
ikke en certificering af WCAG-overholdelse. Der er ikke kørt browser, layoutmotor,
axe, skærmlæser eller test mod en levende app. De anførte linjer gælder basen ovenfor.
Rettelserne er forslag; denne billet ændrer kun dette dokument.

## Metode og afgrænsning

Alle fastlåste input og det samlede kildearkiv er hashkontrolleret. Atletens koblinger
er fulgt fra `src/AthleteView.jsx:814` (hjem/pas), `src/AthleteView.jsx:891` (program),
`src/AthleteView.jsx:920` (Fremgang), `src/AthleteView.jsx:939` (kost),
`src/AthleteView.jsx:972` (beskeder) og `src/AthleteView.jsx:797` (profil).
Atletvisning med Entropi 2 tændt er udgangspunktet; ældre faner, som stadig monteres,
indgår. Det gælder især Program, der fortsat anvender `src/athlete/ProgramTab.jsx`.

| Kontrol | Vurderingsgrundlag |
| --- | --- |
| Trykmål | Ordrens minimum er 44 × 44 CSS-px for betjening. Det svarer til størrelsesmålet i WCAG 2.5.5 (AAA); WCAG 2.2 AA, 2.5.8, har et andet minimum på 24 × 24 med undtagelser. Manglende 44 px betegnes derfor ikke automatisk som AA-fejl. |
| Kontrast | WCAG 1.4.3: mindst 4,5:1 for normal tekst og 3:1 for stor tekst. WCAG 1.4.11: 3:1 for nødvendige visuelle kontrolmarkeringer. Farvepar nedenfor er beregnet med sRGB-relativ luminans; de er ikke skærmbilledeprøver. |
| Fokus og tastatur | Native betjening, logisk rækkefølge, synlig fokusmarkering og bevaret fokus ved opdatering; især WCAG 2.1.1, 2.4.3 og 2.4.7. |
| Navne og labels | Synlige, vedvarende feltnavne og meningsfulde knapnavne; programmerbar tilstand. WCAG 1.3.1, 3.3.2 og 4.1.2. |
| Skærmlæser | Navne, overskrifter, tabeller, udvidet/valgt tilstand og status-/fejlregioner; herunder WCAG 4.1.3. Faktisk oplæsning er ikke afprøvet. |
| Bevægelse | Brugervalg for reduceret bevægelse og rolige tidsopdateringer. WCAG 2.3.3 er AAA; smooth scroll alene dokumenterer ikke et AA-brud. |

## Dækning af de syv skærme

Tabellen er en registrering af kodeevidens, ikke syv browsergodkendelser. »Intet nyt
fund« betyder alene, at der ikke blev påvist en yderligere konkret fejl i denne audit.

| Skærm | Trykmål og kontrast | Fokusrækkefølge og labels | Skærmlæser og bevægelse |
| --- | --- | --- | --- |
| Hjem | Primærknap har min. 52 px højde, sekundærknapper 44; brødtekst `#b8b4a8` på `#141410` er 8,91:1. `src/entropi2/home/homeStyles.mjs:8`. | Native knapper. Hurtiglog åbner med fokus på overskrift og returnerer til åbneren; vægt/søvn ligger i labels. `src/entropi2/home/QuickLogs.mjs:32`, `src/entropi2/home/QuickLogs.mjs:51`, `src/entropi2/home/QuickLogs.mjs:94`. | Dagsform har fieldset/legend og `aria-pressed`; fejl annonceres. `src/entropi2/home/QuickLogs.mjs:101`, `src/entropi2/home/QuickLogs.mjs:109`. Intet nyt bevægelsesfund i hjemmets egen visning. |
| Pas | Kontroller har min. 44 px højde, knapper også min. 44 px bredde; vægt/reps-steppere 56 px højde. Fokusstil og lys tekst er eksplicitte. `src/entropi2/session/sessionStyle.mjs:3`, `src/entropi2/session/sessionStyle.mjs:18`. | Dialog med Tab-afgrænsning, Escape og fokusretur; ved sætskift fokuseres overskriften, felter bevares ved samme trin. `src/entropi2/session/sessionDom.mjs:32`, `src/entropi2/session/sessionDom.mjs:52`, `src/entropi2/session/sessionView.mjs:263`. | Vægt/reps/RPE har labels; RPE-valg har `aria-pressed`. Fremdrift er polite, fejl alert, timer er live off. `src/entropi2/session/sessionView.mjs:71`, `src/entropi2/session/sessionView.mjs:188`, `src/entropi2/session/sessionView.mjs:227`. Pauseuret har reduced-motion-regel: `src/entropi2/session/restTimer.mjs:22`. |
| Program | **F4 og F6:** lavkontrasttekst og små sekundære kontroller er stadig med, selv om ugeoversigten er forbedret. | **F1, F3 og F5:** klikbare div-overskrifter, skjult feltfokus samt ufuldstændige navne/tilstande i sæt- og feedbackregistrering. | Sætbekræftelse er visuel tekst uden statusrolle: **F5**. Timerens animation indgår i **F7**. |
| Fremgang | Analyse har lys tekst på mørk bund (15,36:1 for grundparret). De fleste folds har min. 44 px højde; to »Sådan tælles det« mangler det: **F6**. `src/entropi2/analysis/Analysis.mjs:55`, `src/entropi2/analysis/Analysis.mjs:84`, `src/entropi2/analysis/Analysis.mjs:98`. | Native details/summary og tekstknapper. `src/entropi2/analysis/Analysis.mjs:59`. Den nye analyse og den tilbageværende Fremgang-fane monteres begge; se `src/AthleteView.jsx:920` og `src/AthleteView.jsx:926`. | Grafer i udviklingsvisningen har navngivne billedroller og efterfølgende tekst/tal; tabeller har caption og scope. `src/entropi2/analysis/DevelopmentView.mjs:49`, `src/entropi2/analysis/DevelopmentView.mjs:59`, `src/entropi2/analysis/DevelopmentView.mjs:88`. Intet nyt bevægelsesfund i denne visning. |
| Kost | CSS kræver min. 44 × 44 på button/summary/input/select. Fokusmarkering er 3 px. Grundparrene lys tekst/mørk bund består tekstkontrastberegningen. `src/entropi2/nutrition/nutrition.css:2`, `src/entropi2/nutrition/nutrition.css:30`, `src/entropi2/nutrition/nutrition.css:34`. | Skiplink, main og indlejrede labels. Formularen gemmer fokusidentitet og genskaber fokus ved redraw. `src/entropi2/nutrition/view.mjs:41`, `src/entropi2/nutrition/view.mjs:54`, `src/entropi2/nutrition/view.mjs:447`. | Status, fejl og busy-tilstand er markeret. `src/entropi2/nutrition/view.mjs:243`. Ingen ny konkret bevægelsesfejl påvist. Fokus på åbne summary-elementer og efter gemning skal stadig afprøves med rigtig tastaturbetjening. |
| Beskeder | Min. 44 px højde på felter/knapper; teksten har eksplicit lys farve og mørk bund. `src/entropi2/conversation/ConversationView.mjs:34`, `src/entropi2/conversation/ConversationView.mjs:134`. Faktisk bredde skal måles. | Beskedfeltet hedder »Din besked«; ulæst-hop flytter fokus, men åbning/genoptegning mister fokus: **F2**. `src/entropi2/conversation/ConversationView.mjs:89`, `src/entropi2/conversation/ConversationView.mjs:138`. | Beskedknapper har `aria-expanded`, tom/fejlet samtale har status/alert. `src/entropi2/conversation/ConversationView.mjs:183`, `src/entropi2/conversation/ConversationView.mjs:241`. Smooth scroll uden reduceret valg: **F7**. |
| Profil | Felter og knapper har min. 52 px højde; »Mig« min. 44 px. **F4:** overskrifter får mørk global farve ved lyst systemtema. `src/entropi2/profile/profileStyles.mjs:12`, `src/entropi2/profile/ProfilePage.mjs:11`. | Profilsektionen fokuseres ved åbning; Tilbage returnerer fokus til »Mig«. Mål har label/htmlFor og feltfejl via aria-describedby. `src/entropi2/profile/ProfilePage.mjs:30`, `src/AthleteView.jsx:799`, `src/entropi2/profile/ProfileGoalsView.mjs:10`. | Definition lists og navngivne sektioner; gemmefejl har alert. `src/entropi2/profile/Profile.mjs:14`, `src/entropi2/profile/ProfileGoalsView.mjs:28`. Intet nyt bevægelsesfund i profilens egen visning. |

Fælles navigation har min. 44 × 56 px knapper, `aria-current="page"`, navngivet
navigation, dekorative ikoner skjult for skærmlæser og en fokusstil:
`src/athlete/BundNav.jsx:16`, `src/athlete/BundNav.jsx:30`, `src/athlete/BundNav.jsx:39`,
`src/athlete/BundNav.jsx:56`, `src/athlete/BundNav.jsx:96`.
Skift fra bundnavigationen til nyt sideindhold, sticky-elementer, zoom og faktisk
oplæsningsrækkefølge er fortsat manuelle verifikationspunkter; der er ikke givet PASS til dem.

## Prioriterede fund

### F1 · P1 · Program: pasfolden kan ikke betjenes med tastatur

**Kilde:** `src/athlete/ProgramTab.jsx:712` og `src/athlete/ProgramTab.jsx:714`.
Den klikbare overskrift er en `div` med onClick, uden knaprolle, tastaturhandler,
Tab-stop eller udvidet tilstand. Den ydre containers `tabIndex=-1` på linje 708
løser ikke dette. En tastaturbruger kan ikke selv åbne/lukke et vilkårligt pas via
overskriften. WCAG 2.1.1 (A) og 4.1.2 (A).

**Konkret rettelse:** Under Entropi 2 ON laves fold-triggeren som en rigtig
`button type="button"` med `aria-expanded={isOpen}`, stabil `aria-controls` og
pasnavn. Behold »Spring resten over« og »Auto-udfyld« som søskendeknapper, så de
ikke bliver indlejret i en anden knap. Pasindholdet får det tilsvarende id.

**Kontrol:** Gå gennem samtlige pas i en uge med Tab. Enter og Space skal åbne og
lukke det valgte pas; fokus bliver på triggeren, og oplæsningen angiver tilstanden.
Den syntetiske import af selve ProgramTab bekræfter den nuværende click-only div.

### F2 · P1 · Beskeder: åbning af ulæst besked fjerner den fokuserede knap

**Kilde:** `src/entropi2/conversation/ConversationView.mjs:217`,
`src/entropi2/conversation/ConversationView.mjs:221`,
`src/entropi2/conversation/ConversationView.mjs:232` og
`src/entropi2/conversation/conversationController.mjs:109`.
Klik/Enter viser indhold og kalder seen. Controlleren udsender derefter ny state;
listen erstattes med nye elementer og partitioneres igen efter ulæst/læst.
Den aktive beskedknap bliver afkoblet uden fokusretur. Det bryder en sammenhængende
fokusrækkefølge ved læsning (WCAG 2.4.3, A).

**Konkret rettelse:** Genbrug list elementer/knapper med stabil `item.key` i stedet
for at erstatte hele listen. Hvis redraw beholdes, gem aktiv nøgle og kontroltype
før redraw og genskab fokus på samme nøgle bagefter, kun når fokus allerede var i
listen. Bevar eksplicit læst-kvittering og ulæst-sortering; vælg ikke blot »første
ulæste« som erstatningsfokus.

**Kontrol:** Med to ulæste beskeder fokuseres og åbnes én, også med kunstigt forsinket
seen-svar. Samme besked skal fortsat have fokus efter kvittering og omplacering.
Den faktiske controller/view med hukommelsesadapter reproducerer afkoblingen; at
fixture-fokus falder til body er en DOM-model, ikke en observeret browserkørsel.

### F3 · P1 · Program: formularfelternes fokusmarkering er slået fra

**Kilde:** `src/athleteShared.js:75`, `src/athlete/ProgramTab.jsx:1024`,
`src/athlete/ProgramTab.jsx:1041` og `src/athlete/ProgramTab.jsx:1138`.
Felterne arver inline `outline: 'none'`. Ingen relevant Program-regel i
`src/entropi2/entropi2.css:1` erstatter den med en synlig fokusmarkering.
Det rammer blandt andet vægt, reps og note. WCAG 2.4.7 (AA).

**Konkret rettelse:** Lav en lokal feltstil for Program ved Entropi 2 ON uden
outline-reset; tilføj et ON-afgrænset Program-rodmærke og en scoped
`:focus-visible { outline: 3px solid #c8923a; outline-offset: 3px; }`.
Fjern reset fra de lokale inline-stile, så CSS-reglen kan virke. Undgå ændringer i
den delte legacy-stil. Giv den samme markering til alle Program-kontroller.

**Kontrol:** Tab og Shift+Tab gennem alle felter, RPE-valg og feedback; fokuseret
kontrol skal altid kunne udpeges visuelt. Kontrollér også at markeringen ikke
klippes eller skjules af bundnavigationen ved zoom.

### F4 · P1 · Profil og Program: tekstkontrast er under AA

**Kilde, profil:** `src/index.css:3`, `src/index.css:69`,
`src/entropi2/profile/Profile.mjs:17`, `src/entropi2/profile/profileStyles.mjs:5`
og `src/entropi2/profile/ProfileGoalsView.mjs:21`.
Profilens h1/h2 har ingen egen tekstfarve. Ved lyst systemtema sætter den globale
h1/h2-regel `#08060d`, selv om atletvisningen stadig har mørk baggrund.
Entropi 2's overskriftsregel på `src/entropi2/entropi2.css:2` omfatter ikke profilen.
Det giver **1,09:1** på `#141410` og **1,18:1** på profilkortets `#1c1c18`, også
under kravet på 3:1 for store overskrifter.

**Kilde, program:** `src/athlete/ProgramTab.jsx:768`,
`src/athlete/ProgramTab.jsx:1019`, `src/athlete/ProgramTab.jsx:1062` og
`src/athlete/ProgramTab.jsx:1138`.
På loggerens `#181816` giver tekst i `#4a4844` **1,95:1** og `#7a7770`
**3,98:1**. »Spring over«, sætnumre og indtastet notetekst er normal/små tekst,
så de kræver 4,5:1. Det er aktive kontroller og information, ikke kun disabled tekst.
Begge områder fejler WCAG 1.4.3 (AA).

**Konkret rettelse:** Sæt `color: '#edeae2'` i profilens lokale title/heading-stile
og lad overskrifter i ProfilGoals arve den samme eksplicitte farve. Sæt den berørte
Program-tekst til fx `#b8b4a8` ved Entropi 2 ON; behold tydeligt skel mellem
normal, valgt og disabled tilstand. Lad legacy/OFF-farverne være uændrede.

**Kontrol:** Beregn igen alle ændrede farvepar, inklusive kort og valgt baggrund.
Åbn profil og Program med både lyst og mørkt systemtema. De beregnede farver og
profilens manglende override er verificeret mod faktisk importeret view/stil og
global CSS; den endelige CSS-cascade skal også kontrolleres i den senere UI-prøve.

### F5 · P2 · Program: gentagne handlinger, feltnavne og valgt/gemt tilstand er uklare

**Kilde:** `src/athlete/ProgramTab.jsx:1057` (Log/✓),
`src/athlete/ProgramTab.jsx:1105` (RPE), `src/athlete/ProgramTab.jsx:1137` (note),
`src/athlete/ProgramTab.jsx:1143` (gemt/fejl) og
`src/athlete/ProgramTab.jsx:1170` (feedback).
Log-knapperne hedder alle »Log« eller kun »✓« uden øvelses-/sætkontekst i navnet.
Note og feedbackkommentar har kun placeholder, som kan give et fallback-navn,
men ingen vedvarende label. RPE bruger `data-selected`, og feedbacktal farver
valget uden programmerbar valgt tilstand. »Gemt«/»Ikke gemt« indsættes uden
status-/fejlrolle. Det berører WCAG 3.3.2 (A), 4.1.2 (A) og 4.1.3 (AA);
ens knaptekst alene er ikke automatisk en særskilt WCAG-fejl.

**Konkret rettelse:** Gruppér hver øvelse/sætrække med navngivet fieldset/legend
eller aria-labelledby. Giv handlinger navne som »Log Squat, sæt 2« og »Ret logget
Squat, sæt 2«, og gør gemt-status til tekst frem for et nøgent flueben. Tilføj
synlige labels til note og kommentar. Brug fx `aria-pressed` til RPE og feedback
og en navngivet gruppe; RPE-triggeren får `aria-expanded` og korrekt fokusretur.
Hold en stabil statusregion til gemmekvittering og alert-region til fejl.

**Kontrol:** Med to øvelser og flere sæt skal hvert felt og hver handling kunne
identificeres ved oplæsning. Valgt rating/RPE skal kunne aflæses uden farve, og
gemmefejl skal annonceres én gang med indtastningen bevaret.

### F6 · P2 · Program og Fremgang: sekundære trykmål opfylder ikke det eksplicitte 44-px-design

**Kilde:** `src/athlete/ProgramTab.jsx:1105` (RPE-valg),
`src/athlete/ProgramTab.jsx:1132` (ℹ),
`src/entropi2/analysis/Analysis.mjs:84` og `src/entropi2/analysis/Analysis.mjs:98`
(»Sådan tælles det«).
Disse kontroller har ingen min. 44-px-flade, selv om nabokontroller har den.
Info-knappens eksplicitte `fontSize: 0.75rem`, `lineHeight: 1` og lodrette
padding `0.3rem` giver ca. **21,6 px højde** ved mobilens 16-px-rem, før eventuelle
UA-minima. RPE-valg og analysefolds mangler den samme sikring.
Dette er et brud på ordrens 44-px-mål; faktisk geometri og eventuelle undtagelser
til WCAG 2.5.8 er ikke målt, så der konkluderes ikke et generelt AA-brud her.

**Konkret rettelse:** Sæt min-height/min-width 44 og border-box på Program-info
og RPE-valg ved Entropi 2 ON. Giv de to analyse-summary samme min. 44 px højde og
fuld tilgængelig bredde som de øvrige folds, med indhold centreret lodret.
Udvid trykfladen uden at gøre alle ikoner visuelt store.

**Kontrol:** Mål den reelle klikflade i CSS-px ved 320 og 375 px viewportbredde og
ved tekstforstørrelse. Kræv mindst 44 × 44 uden overlap og uden vandret scroll.
Kilde/importprøven bekræfter manglende minimum, ikke faktiske browserrektangler.

### F7 · P3 · Beskeder og Program: reduceret bevægelse respekteres ikke overalt

**Kilde:** `src/entropi2/conversation/ConversationView.mjs:140` og
`src/athlete/CountdownRing.jsx:15` (brugt fra `src/athlete/ProgramTab.jsx:219`).
Ulæst-hop vælger altid `behavior: 'smooth'`. Program-timerens ring har en
1-sekunds transition, uden tilsvarende reduced-motion-afgrening.
Pauseuret i den nye pasvisning har allerede en lokal reduced-motion-regel,
men den gælder kun `.e2-session .e2-rest` og dækker ikke disse to steder.
Dette er en forbedring efter WCAG 2.3.3 (AAA), ikke et påvist AA-brud.

**Konkret rettelse:** Ved `prefers-reduced-motion: reduce` vælges øjeblikkelig
scroll ved ulæst-hop. Lad Program sende et lokalt reduced-motion-valg til ringen,
eller afgræns ringens transition med en ON-scoped CSS-regel. Bevar tidsværdien
og rolig statusannoncering; fjern kun animationen. Bevar OFF-adfærden.

**Kontrol:** Med reduceret bevægelse må ulæst-hop og ring ikke animere; uden
præferencen må den eksisterende adfærd bestå. Den aktuelle smooth-anmodning er
reproduceret ved kald af den faktiske samtalevisnings handler.

## Verifikation og næste kontrol

Før og efter dokumentændringen: 11 syntetiske evidenskontroller plus 17 eksisterende
målrettede prøver (5 pas/a11y, 6 samtaleuge og 6 samtale-cleanup), alle PASS.
PASS betyder her, at fund og eksisterende kontroladfærd kunne reproduceres, ikke
at de syv tilgængelighedsfund er rettet. I dokumentets berørte mappe er der ingen
medleverede prøver. Hele medleverede `src/` er gennemsøgt; et `test/`-træ er ikke
med i det fastlåste arkiv. Fuld suite og build er forbeholdt integratoren.

Efter særskilte implementeringsbilletter kontrolleres alle syv skærme med tastatur
og skærmlæser, 200 % tekst/zoom, 320/375-px mobilbredde, begge systemtemaer og
reduceret bevægelse. Medtag tomme data, indlæsningsfejl, gemmefejl, åbne folds og
fokus nær sticky top-/bundnavigation. Den friske eksterne kontrolbillet
`K-E2-TILGAENGELIGHED-AUDIT1` og denne manuelle UI-kontrol er ikke udført af denne worker.
