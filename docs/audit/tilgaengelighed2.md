# Tilgængelighed efter nattens fletninger — runde 2

Billet: R1-E2-TILG-AUDIT2. Entropi Coach, base
`9c48b5690a6be9ed29a18736b96b1d1c620cbc82` (kort: `9c48b569`).
Dato: 5. november 2026. Kun dokumentation; ingen produktkode ændres.

**Resultat: FAIL for de undersøgte tilgængelighedskrav. Seks fund.**
P1 bør rettes før næste atletgennemgang; P2 er afgrænsede forbedringer.
Hvert estimat nedenfor omfatter rettelse og en målrettet prøve, ikke fuld release.

## Grundlag og afgrænsning

Gennemgangen bruger kun den hashkontrollerede offentlige kildekopi. Linjenumre
henviser til denne base. Der er kørt faktiske kopierede moduler med syntetiske
atleter, DOM-/hook-adaptere, hukommelseslagring og servicegrænser. Browser,
skærmlæser, layoutmotor og rigtig backend er ikke brugt. Dette er derfor ikke en
AA-certificering. Beregnede kontraster er kildeværdier i sRGB; de små trykmål er
fund om manglende størrelseskrav, ikke målte browserrektangler.

Atletens aktive koblinger er fulgt i `src/AthleteView.jsx`: Hjem via HomeSession,
pas via sessionView, Program via `src/athlete/ProgramTab.jsx` (ikke den isolerede
Entropi 2 Program-komponent), Fremgang via Analysis, kost via mountNutrition,
beskeder via ConversationEntry og profil via ProfilePage.

Der var ingen tidligere auditdokumenter i det leverede arkiv, som kun omfatter
src/, scripts/ og pakkefiler. De seks fund er observationer på den aktuelle base;
historisk nyhed eller overlap med ikke-leverede audits er ikke verificeret.
De allerede prøvede rettelser for bl.a. beskedfokus og programnavne tælles ikke
igen som fund.

## F1 — Fokus mangler, når hurtig dagsform udvides til alle svar

- **Sted:** `src/entropi2/home/QuickLogs.mjs:55`, `:192` og `:203`.
- **Prioritet / omfang:** P1, 45–60 minutter.
- **Situation:** Med et gyldigt forslag fra i går vælges en energiknap. Tryk
  derefter på »Ret øvrige svar«. Handleren ændrer kun `quick`; `open` forbliver
  `readiness`. Hurtigformularen og dens fokuserede knap fjernes, og den nye h2
  monteres, men fokuseffekten afhænger kun af `[open]`. Den kører derfor ikke.
- **Evidens / betydning:** Faktisk QuickLogs i syntetisk hook-host viser en ny
  overskrift og nul fokuskald ved skiftet. Tastatur- og skærmlæserbrugeren mister
  sin placering. Relevant for meningsfuld fokusorden (2.4.3); browserens konkrete
  tab-fortsættelse er ikke målt.
- **Konkret rettelse:** Håndtér overgangen fra hurtig til fuld formular eksplicit
  efter montering, fx med en engangsintention og ref til overskriften. Bevar fokus
  på den valgte energiknap under almindelige scoreændringer. Prøv både »Ret øvrige
  svar« før og efter første energivalg samt luk/retur til åbningsknappen. Brug en
  adapter, der også modellerer afmonterede refs.

## F2 — Valgt dagsformsscore vises kun med en svag baggrundsændring

- **Sted:** `src/entropi2/home/QuickLogs.mjs:185` og `:227`.
- **Prioritet / omfang:** P2, 30–45 minutter.
- **Situation:** En valgt score får `#414139`; øvrige knapper er transparente på
  kortets `#1c1c18`. Tekst og kant ændrer sig ikke, og der vises intet flueben.
- **Evidens / betydning:** Faktisk gengivet valgt energiknap har `aria-pressed=true`,
  men den visuelle markering har kun **1,66:1** mod kortet. Det giver svag synlig
  tilstand og afhængighed af farve (1.4.1/1.4.11). Skærmlæsertilstanden er allerede
  korrekt og skal bevares.
- **Konkret rettelse:** Tilføj en synlig formmarkør, fx et `aria-hidden` flueben,
  og en tydelig valgt kant eller baggrund med mindst 3:1 mod den tilstødende flade.
  Bevar tekstkontrast på mindst 4,5:1, `aria-pressed` og knappernes størrelse.
  Prøv både éntryksrækken og alle fire scorer i den fulde formular.

## F3 — Kostfelters afgrænsning er under 3:1

- **Sted:** `src/entropi2/nutrition/nutrition.css:2` og `:43`.
- **Prioritet / omfang:** P2, 30–45 minutter.
- **Situation:** Input/select bruger `--bg:#141410` og en 1 px kant i
  `--line:#414139`. Formularerne ligger på `--surface:#1c1c18`.
- **Evidens / betydning:** Kant mod feltet er **1,79:1**, kant mod kortet
  **1,66:1**. Felt og kort ligger også tæt. Den nødvendige visuelle afgrænsning
  af indtastningsområdet opfylder ikke 3:1 (1.4.11). Tekstfarven er ikke problemet.
- **Konkret rettelse:** Giv kun kostens input/select en særskilt kantfarve med
  mindst 3:1 mod begge flader, fx en kontrolleret lysere neutral farve. Ændr ikke
  `--line` globalt, da den også styrer dekorative kort og skillelinjer. Kontrollér
  måltid, portion, enhed og vægt samt normal- og fokustilstand i E2-scope.

## F4 — Kostens genoptegning mister fokus på foldens summary

- **Sted:** `src/entropi2/nutrition/view.mjs:62`, `:123`, `:466` og `:480`.
- **Prioritet / omfang:** P1, 60–90 minutter.
- **Situation:** Fokus står på »Notér et måltid«, mens nye vægtprops kommer ind.
  `updateWeight()` tegner hele værten igen. `data-focus` er sat på details,
  men ikke på dens summary. Genopretningen kender derfor ikke fokusmålet.
- **Evidens / betydning:** En prøve med faktisk mountNutrition, syntetisk DOM og
  `cleanup.updateWeight({weightLogs:[]})` viser, at summary udskiftes, uden at den
  nye summary får fokus. Fixture-referencen peger på den fjernede node. Browserens
  efterfølgende fokus er ikke observeret. Samme mekanisme rammer kontroller uden
  nøgle, fx »Log portion« på linje 167. Relevant for fokusorden (2.4.3).
- **Konkret rettelse:** Giv alle interaktive kontroller stabile, entydige nøgler,
  især summary og portionsknappen. Gendan kun det fokus, som tilhørte værten,
  til en tilsluttet, synlig og aktiveret kontrol efter opdatering; brug et relevant
  fallback ved fjernede handlinger. Bevar foldens åben/lukket-tilstand. Prøv en
  sen vægtopdatering med fokus på summary, portionsknap og et skrivefelt.

## F5 — To forklaringsfolde i Fremgang mangler 44 px minimum

- **Sted:** `src/entropi2/analysis/Analysis.mjs:93` og `:107`.
- **Prioritet / omfang:** P2, 30–45 minutter.
- **Situation:** »Sådan tælles det« under rekorder og muskelvolumen får alene
  `cursor` og `opacity`. De øvrige centrale summary-kontroller angiver 44 px.
- **Evidens / betydning:** Faktisk Analysis med syntetiske logninger gengiver
  begge summaries uden minimumshøjde; ingen dækkende E2-summaryregel findes i
  den leverede CSS. En enkelt tekstlinje garanterer ikke 44 px. Dette er ordrekravet
  til mobiltryk, ikke i sig selv bevis for brud på AA's mindre minimumsmål.
- **Konkret rettelse:** Del en E2-afgrænset summary-stil med `minHeight:44`,
  passende lodret padding og `boxSizing:'border-box'` mellem de to folde. Bevar
  native details/summary, navn og foldet start. Prøv begge datatilstande, og mål
  selve klikkefladen ved 320 px bredde i Dhurvas senere browserkontrol.

## F6 — Programnoter mangler samme 44 px krav som nabofelterne

- **Sted:** `src/athlete/ProgramTab.jsx:1212`; fælles stil i
  `src/athleteShared.js:75`.
- **Prioritet / omfang:** P2, 30–45 minutter.
- **Situation:** Notefeltet bruger 0,75 rem tekst og 0,3 rem lodret padding uden
  minimumshøjde. Vægt/reps lige ovenfor angiver eksplicit 44 px. Her anvendes
  `programTapTarget` ikke på inputtet.
- **Evidens / betydning:** Faktisk ProgramTab gengiver fire navngivne notefelter
  uden minimumshøjde i den syntetiske prøve. CSS-kopien giver ingen generel
  kompensation. Højden afhænger af font/normal line-height; ingen fysisk
  browserhøjde er målt. 44 px er et produktkrav og ikke automatisk et AA-brud.
- **Konkret rettelse:** Sæt minimumshøjde og border-box på notefeltet, betinget af
  `programAppearanceOn`, ligesom de andre E2-felter. Bevar navn, eksisterende
  updater og OFF-stil. Prøv flere ens øvelser/sæt og smal mobilbredde; kontrollér
  at inputfeltet selv, ikke kun rækken omkring det, måler mindst 44 px.

## Dækning og eksisterende værn

| Skærm / flow | Kilde- og prøvegrundlag | Udfald i denne gennemgang |
| --- | --- | --- |
| Hjem med rekord | AthleteHome/HomeRecordCard: tekstlig rekord, løft, kg, reps og time-element; foldene er native | Intet yderligere fund om rekordkortet; dagsform F1–F2 |
| Dagsform med ét tryk | QuickLogs, readinessOneTap og faktiske skrivehandlers mod syntetisk servicegrænse | F1–F2; presset tilstand har skærmlæsernavn |
| Ugentligt check-in | HomeCheckIn/WeeklyCheckIn med label, hint, native felter og lokal status | Ingen ny observeret fejl; 48 px kontroller og namespace-isoleret kladde prøvet |
| Pas: Som planlagt og RPE-fold | sessionView/sessionStyle og a11y-prøver: indgang/næste/afslutning, Tab-omløb, status, retur og 44 px | Ingen ny observeret fejl i disse prøver; ingen bevægelsesdeklaration i sessionStyle |
| Program | Den koblede ProgramTab; navne, expansion, fokusregel, kontrast og sekundære handlinger | F6; eksisterende reduced-motion-scope bevares |
| Fremgang | Analysis, rekorder og relaterede modelprøver | F5; grafernes tekstalternativer læst i DevelopmentView |
| Kost | Faktisk controller/view, inputnavne, fokuskoder og scoped CSS | F3–F4; øvrige kontraster er ikke fuldt layoutvalideret |
| Beskeder | Faktisk mountConversation: stabilt fokus efter læsekvittering, navngivet tekstfelt, native knapper | Ingen ny observeret fejl; spring følger aktuel reduced-motion-præference |
| Profil | Profile/ProfilePage samt direkte åbning og returref i faktisk host | Ingen ny observeret fejl; ejerskab/OFF, knapnavne og returhandling prøvet |

146 eksisterende målrettede prøver bestod både før og efter dokumentændringen.
Supplerende evidensprober reproducerer F1–F6 som den nuværende adfærd, ikke som
rettelser. Alle 933 prøvefiler i den leverede src/-kopi blev søgt; 333 indeholder
tilgængelighedsrelaterede kontrakter, ingen låser denne dokumentsti. test/ og
docs/ findes ikke i inputarkivets scope, så docs/audit har ingen leverede prøver.

Senere kontrol hos Dhurva: mål faktiske trykflader og fokusvisning ved mobilbredde,
kontrollér Tab/Shift+Tab, Enter, Space og Escape samt skærmlæserens annonceringer
ved ændringer. Kontrollér reduced-motion i værtsappen og den samlede CSS-kaskade.
Fuld suite og build tilhører Dhurva ved fletning. Denne billet ændrer ingen
flag, runtime-skrivninger, namespaces eller OFF-adfærd.
