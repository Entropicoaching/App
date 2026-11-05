# Audit: tomme og tekniske tekster i coachens visninger

Billet: E2-TOMME-AUDIT3. Base: `b38ac71755988f9254b1defcfbc9693b3eb7bd14`.

Resultat: **FAIL — seks fund til opfølgning** (én P1, tre P2, to P3).
Det er en dokumentationsaudit; ingen af rettelserne nedenfor er implementeret.
Hvert nummer er afgrænset til én billet på 30–90 minutter inklusive fokuserede prøver.

Grundlag: ORDER, tre medleverede offentlige beslutningskopier og den hashkontrollerede
kildepakke. Henvisninger er til basens uændrede filer, med linjenumre fra 1.
De to beslutninger fra 4. november er kun omtalt i ORDER; deres fulde indhold er
ikke medleveret. Ingen privat tilstand eller faktisk atletvisning er tilgået.

Der er fulgt aktive indgange fra `src/Dashboard.jsx:700`,
`src/dashboard/OversigtTab.jsx:121` og `src/dashboard/ProgramTab.jsx:1142`.
Overblik, indbakke, pasnoter, ugerapport og programværktøjer er undersøgt gennem
faktiske modulimporter med syntetiske data. Analyse-, stævne-, søvn-, restitutions-
og eksportvisninger er også læst i kilden; der hævdes ingen visuel browserprøve.
Ingen konkret læk af interne id-værdier blev bekræftet i de efterprøvede aktive
visninger. Den selvstændige `CoachTeam` viser id'er i kilden, men den aktive
forside bruger `CoachTeamRegistrations`; dette er derfor ikke optalt som et fund.

## 1. Ugyldigt smertegrundlag ligner fravær af smerter

**P1 · 90 minutter · Oversigt → smertehistorik.**

- **Fil:linje:** `src/dashboard/OversigtTab.jsx:121` vælger kun panelet, når
  `hasReadinessPain` er sand; `src/entropi2/tracking/smerte/painRead.mjs:35` og
  `src/entropi2/tracking/smerte/painRead.mjs:41` reducerer ugyldigt grundlag til
  fejl/false; `src/entropi2/tracking/smerte/CoachPainHistory.mjs:20` og
  `src/entropi2/tracking/smerte/CoachPainHistory.mjs:23` fjerner fejlvisningen.
- **Brugeren ser nu:** Intet smertepanel og ingen forklaring, når en registrering
  for den valgte atlet har `pain: 8`, men mangler område. En tom, korrekt læst
  liste giver samme fravær. Det er ikke dokumentation for, at smerter er fraværende.
- **Konkret rettelse:** Skeln mellem et gyldigt tomt grundlag og et ugyldigt
  grundlag inden lazy-gaten. Vis ved ugyldige data i en bekræftet atletkontekst:
  »Smertehistorikken kunne ikke vises. Nogle registreringer mangler oplysninger.«
  Tilbyd den eksisterende genindlæsning af atletens data. Gyldig tomhed må fortsat
  skjule den valgfrie fold. Forkert atlet/ejer/dato og OFF må fortsat skjule data.
- **Accept og prøve:** F1 i den vedlagte `audit-evidence.mjs` bekræfter fejl →
  false → intet indhold samt en gyldig positiv kontrol. Tilføj en prøve for en
  synlig fejl efter rettelsen. Opdatér de relevante forventninger i
  `src/entropi2/tracking/smerte/painCoach.test.mjs:40` og
  `src/entropi2/tracking/smerte/painCoach.test.mjs:61`, som nu kræver skjulte fejl;
  bevar deres værn for OFF og fremmed kontekst. Ingen nye læsninger eller lagring.

## 2. Programværktøjer viser rå fejl og tekniske id-krav

**P2 · 60 minutter · Program → næste blok / sammenlign uger.**

- **Fil:linje:** `src/entropi2/coach/blokplan/CoachProgramTools.mjs:80` og
  `src/entropi2/coach/blokplan/CoachProgramTools.mjs:116` kopierer `failure.message`;
  `src/entropi2/coach/blokplan/CoachProgramTools.mjs:25` og
  `src/entropi2/coach/blokplan/CoachProgramTools.mjs:36` viser den direkte.
  `src/entropi2/coach/blokplan/programData.mjs:45` kræver »gyldige id’er« i en fejltekst.
- **Brugeren ser nu:** En afvist læsning kan vise »Failed to fetch« direkte i
  coachens panel. En strukturelt ugyldig uge giver teksten »Alle uger skal have
  gyldige id’er, datoer, ugenumre og bloknavne før blokforslaget.« Coachen kan ikke
  rette et internt id via dette værktøj. F2 bruger kun en syntetisk netfejltekst;
  ingen netværksforbindelse bliver oprettet.
- **Konkret rettelse:** Brug kontrollerede danske fejltekster for de kendte
  valideringsfejl og en fast fallback for ukendte afvisninger: »Programgrundlaget
  kunne ikke hentes. Prøv igen.« Erstat id-kravet med »Programgrundlaget er
  ufuldstændigt og kan ikke bruges. Hent grundlaget igen.« Bevar den eksisterende
  genhent-knap og muligheden for at gentage sammenligningen. Vis aldrig en ukendt
  fejlbesked direkte i de to paneler.
- **Accept og prøve:** F2 reproducerer den rå tekst gennem den faktiske afviste
  læser og komponentens hookforløb. Udvid
  `src/entropi2/coach/blokplan/CoachProgramTools.synthetic.test.mjs:70` med krav om
  dansk fallback, og prøv også afvisning under sammenligning. Bevar fejlet kontra
  tom læsning og de nuværende valideringsgrænser. Ingen nye dataskrivninger.

## 3. Fejlet skabelonlæsning beskrives samtidig som et tomt lager

**P2 · 60 minutter · Program → programskabeloner.**

- **Fil:linje:** `src/entropi2/coach/blokplan/CoachProgramTools.mjs:50` starter med
  en tom liste; `src/entropi2/coach/blokplan/CoachProgramTools.mjs:95` sætter
  fejltilstand, men `src/entropi2/coach/blokplan/CoachProgramTools.mjs:145` sender
  fortsat tomme kildeuger til visningen.
  `src/entropi2/program/skabeloner/ProgramTemplatesView.mjs:7` og
  `src/entropi2/program/skabeloner/ProgramTemplatesView.mjs:12` drager tomhedskonklusioner.
- **Brugeren ser nu:** Når lokal læsning afvises, vises både »Skabeloner kunne
  ikke læses«, »Ingen uger at oprette en skabelon fra« og »Ingen gemte skabeloner«.
  F3 har faktisk en gyldig kildeuge. Der er ikke grundlag for at sige noget om,
  hvor mange skabeloner lageret indeholder.
- **Konkret rettelse:** Giv visningen en eksplicit indlæsningstilstand for
  skabelonbiblioteket. Vis kun tom bibliotekstekst efter en vellykket læsning
  med nul skabeloner. Under fejl vises én forklaring og »Hent skabeloner igen«;
  undlad at fremstille kendte kildeuger som en tom liste. Hold oprettelse og gem
  spærret, indtil nødvendigt lagergrundlag er bekræftet. Et fejlet programudkast
  må heller ikke udgive et ukendt bibliotek som tomt.
- **Accept og prøve:** F3 reproducerer de tre modstridende tekster i det faktiske
  panel med et lager, der kaster. Tilføj fejl → vellykket genhentning og vellykket
  tomt bibliotek som adskilte prøver. Den nuværende glade vej i
  `src/entropi2/coach/blokplan/CoachProgramTools.synthetic.test.mjs:81` skal bestå.
  Bevar eksisterende namespace og værnet mod at overskrive et ulæst lager.

## 4. Tomt atletnavn giver en tom samtaleknap

**P2 · 45 minutter · Indbakke → alle samtaler.**

- **Fil:linje:** `src/entropi2/coach/coachModel.mjs:37` accepterer alle strenge
  som navn, inklusive tomme strenge og mellemrum.
  `src/entropi2/coach/CoachScreen.mjs:122` bruger navnet direkte som knaptekst.
  Samme rå navne bruges på handlingsrækker ved `src/entropi2/coach/CoachScreen.mjs:53`.
- **Brugeren ser nu:** Ved `name: ''` eller kun mellemrum findes en klikbar
  samtaleknap uden synligt navn og uden et særskilt tilgængeligt navn.
- **Konkret rettelse:** Trim det præsenterede navn ved rosterens adaptergrænse,
  og brug »Atlet uden navn«, hvis resultatet er tomt. Bevar id og navigation;
  vis aldrig id'et som fallback og skriv ikke fallbacken tilbage til profilen.
- **Accept og prøve:** F4 importerer både adapteren og `CoachView` og finder én
  navnløs samtaleknap for begge inputs. Tilføj tom streng, mellemrum og manglende
  navn til coachprøverne; efter rettelsen skal knappen kunne identificeres ved
  sit navn og stadig åbne den samme atlet. Ingen ændring af OFF eller rosterfiltrering.

## 5. Ugerapport og pasnoter viser tekniske datostrings

**P3 · 60 minutter · Overblik → ugerapport / noter fra passene.**

- **Fil:linje:** `src/entropi2/coach/WeeklyReport.mjs:15` indsætter `t.start`
  direkte. `src/entropi2/coach/SessionNotesView.mjs:60` bruger `entry.day` som
  både maskindato og synlig tekst.
- **Brugeren ser nu:** »Programuge fra 2026-11-02« og en pasoverskrift med
  »2026-11-03«. Programmer på samme forside viser allerede datoer som `08.11.2026`
  ved `src/entropi2/coach/CoachProgramsView.mjs:29`.
- **Konkret rettelse:** Vis de to civile datoer som henholdsvis `02.11.2026` og
  `03.11.2026` med samme danske visningsformat som programlisten. Bevar ISO i
  `<time dateTime>`, modeldata og sortering. Formater kalenderdatoen direkte,
  uden at lade en tidszone flytte den til dagen før eller efter.
- **Accept og prøve:** F5 bekræfter begge nuværende synlige ISO-datoer gennem
  faktiske komponenter. Tilføj forventninger for dansk synlig tekst og uændret
  `dateTime` i `src/entropi2/coach/coachSessionNotes.test.mjs:26` samt ugerapportens
  renderprøver. Bevar prøverne for dansk døgn og sommertid; ingen datakonvertering
  eller ændrede dataperioder.

## 6. Skabelonforhåndsvisningen bruger et ugedagsnummer og engelsk sætnotation

**P3 · 45 minutter · Program → programskabeloner → brug som udkast.**

- **Fil:linje:** `src/entropi2/program/skabeloner/ProgramTemplatesView.mjs:18`
  viser `session.dayOfWeek` direkte; ved
  `src/entropi2/program/skabeloner/ProgramTemplatesView.mjs:20` vises »reps @ RPE«.
  Dagskontrakten er eksplicit mandag=1 til søndag=7 ved
  `src/entropi2/program/skabeloner/programTemplates.mjs:53`.
- **Brugeren ser nu:** Et gyldigt udkast viser »Syntetisk pas · ugedag 1« og
  »5 reps @ RPE 7«. Coachen skal omsætte et internt dagsnummer til en ugedag.
- **Konkret rettelse:** Oversæt kun visningen af 1–7 til »Mandag«–»Søndag« og
  skriv »5 gentagelser · mål-RPE 7«. Brug dansk decimalkomma ved halve RPE-trin,
  og udelad RPE-delen, når målet er null. Bevar tal og formatversion i skabelonen.
- **Accept og prøve:** F6 bygger først en gyldig skabelon med den faktiske
  `templateFromWeek` og efterprøver dernæst den faktiske visning. Dæk alle syv
  dage, én/flere gentagelser, halv RPE og null i en fokuseret visningsprøve.
  Der skal ikke ændres på øvelsesnavne, prescriptions, gemmenøgler eller afsendelse.

## Verifikation og afgrænsning

63 eksisterende fokuserede prøver og 7 lokale evidensprøver bestod både før og
efter dokumentændringen. Evidensprøverne er karakteriseringer af de nuværende
problemer; grønne prøver betyder ikke, at problemerne er rettet. React er erstattet
af kildens syntetiske element-/hookrig; dette er ikke rigtig React-rendering eller
en DOM-, mobil- eller browserprøve.

Hele det medleverede `src/` er søgt for prøver og låste tekstforventninger:
2.046 filer, heraf 929 prøvefiler. `test/`, `tests/` og `docs/` er ikke medleveret
i den fastlåste pakke. Der er derfor ingen medleverede prøver i den eneste ændrede
mappe `docs/audit/`; fraværet beviser ikke, at det fulde repo mangler sådanne prøver.
Fuld suite, build og en separat frisk kontrol tilhører integrationen hos Dhurva.
Denne audit ændrer kun denne dokumentationsfil og bevarer al OFF-adfærd og alle
skrivegrænser. Detaljerede kommandoer og begrænsninger følger i `TESTOUTPUT.md`.
