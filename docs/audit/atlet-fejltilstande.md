# Atletens indlæsning, læsefejl, offline og tomme data

Entropi Coach · E2-FEJLTEKST-AUDIT1 · 5. november 2026
Base: `3082dfb3545e60942834c0e094c730e320b68d5b` (`3082dfb3`).

## Konklusion og afgrænsning

FAIL for ensartede fejltilstande i den undersøgte kilde: seks afgrænsede fund nedenfor. Dette er en dokumentationsaudit og et forslag; ingen produktkode er ændret. P1 betyder misvisende eller skjult datatilstand, P2 betyder manglende tydelig tilstand eller vej tilbage, P3 betyder sproglig/visuel ensretning. Prioriteterne angiver rækkefølge, ikke målte hændelser i produktion.

Grundlaget er de hashkontrollerede offentlige kildekopier fra basen. Fil:linje refererer til basens kildefiler uden lokal `copied-source/`-præfiks. Vurderingen følger de faktiske forbindelser fra `src/AthleteView.jsx:819`, `:925`, `:945`, `:997` og profil-/samtaleindgangene. Historiske `*Baseline*`, `*Before*` og fixturefiler tælles ikke som aktuelle skærme. Ingen browser, netværk eller produktionsdata er brugt; synligt resultat er udledt af kode og, hvor anført, af eksisterende syntetiske modulprøver. Der er ikke udført visuel mobil- eller skærmlæsertest.

Ordren nævner beslutninger fra 4. november; de beslutningsfiler er ikke vedlagt. Audit anvender derfor den aktuelle ORDER og de tre vedlagte beslutninger fra 3. november. Der indføres ingen antagelser om nye produktionsdata, integrationer eller automatiske anbefalinger.

## Forslag til én fælles standard

Brug en lille præsentationskomponent, foreløbigt kaldet `DataTilstand`, med samme tekstkatalog til React og eksisterende DOM-skærme. Den modtager tilstand, kort ressourcenavn, bekræftet tomtekst, eventuelt tidspunkt for sidst bekræftede data samt en lokal genhentningsfunktion og dens ventestatus. Komponenten henter og gemmer ikke selv noget og opdager ikke featureflag, brugeridentitet eller forbindelsestilstand. Værten ejer læsning, afbrydelse og identitetskontrol. Dette er en foreslået kontrakt, ikke en ny fil i leverancen.

| Tilstand | Atletens tekst | Handling og adfærd |
| --- | --- | --- |
| Første læsning / genhentning | »Henter {ressource}…« | `role="status"`, området `aria-busy=true`; vis ikke tomtekst eller beregnede tal fra ubekræftet grundlag. En eksisterende knap siger »Henter…« og er deaktiveret under samme læsning. |
| Læsefejl uden brugbare data | »{Ressource} kunne ikke hentes.« | `role="alert"` og »Hent igen«, som genkører netop læsningen. Fejlen bliver stående til nyt forsøg eller bekræftet succes. Ingen rå tekniske fejl. |
| Fejl med tidligere bekræftede data | »{Ressource} kunne ikke opdateres.« | Vis »Hent igen«. Bevar kun data for samme atlet/periode, markér dem som tidligere hentet, og vis kun tidspunkt hvis det faktisk kendes. De må ikke give nye beregninger eller fremstå som friske. |
| Bekræftet tomt svar | »Ingen {registreringer} endnu.« eller »Ingen {registreringer} i den valgte periode.« | `role="status"`; én rolig tomtekst dér, hvor indhold forventes. Eksempel for kost: »Ingen måltider registreret i dag.« Ingen fejlknap og ingen opdigtede mål, nulværdier eller coachbeskeder. Valgfrie datakoblinger vises slet ikke uden grundlag. |
| Bekræftet offline | »Ingen forbindelse. Data kan ikke opdateres lige nu.« | Ét fælles banner med `role="status"`. Vis kun konkrete løfter om lokale funktioner, når deres faktiske forudsætninger er opfyldt. Tillad fortsat navigation og bevar udkast. |
| Gemte data / øjebliksbillede | »Viser tidligere hentede data.« | Tilføj kendt tidspunkt. Ved programmets aktuelle begrænsning: »Hent programmet igen, når du har forbindelse, før du starter et pas.« Et øjebliksbillede beviser ikke, at browseren er offline eller at forbindelsen er svag. |
| Lokal læsefejl | »{Ressource} kunne ikke læses på denne enhed.« | `role="alert"` og »Prøv igen«, der genlæser samme lokale kilde uden at rydde eller overskrive data. Dette må ikke kaldes en netværksfejl. |
| Ugyldigt/ufuldstændigt grundlag | »{Ressource} kan ikke vises ud fra de hentede data.« | Ingen tal eller anbefalinger fra det afviste grundlag. »Hent igen« kun hvis en læsning faktisk kan genkøres; ellers en konkret vej til programmet eller coachen. |

Ressourcenavne er eksempelvis »Programmet«, »Din udvikling«, »Kostloggen« og »Vejningerne«; kataloget skal håndtere korrekt dansk bøjning. »Hent igen« gælder læsninger. Bevar særskilte handlinger som »Prøv afsendelse igen« og »Gem igen« for skrivninger, så en genhentning aldrig kan sende eller gemme noget.

Mobilstandard: én kort status og én relevant primær handling pr. berørt område; mindst 44 × 44 px trykflade og synligt tastaturfokus. Placér blokkerende fejl uden for lukkede detaljer. Genhent kun den fejlede ressource og bevar fokus, valgt dato, lokale udkast og resten af siden. Forbindelsesbanner og lokal fejl må supplere hinanden uden at gentage samme forklaring i flere kort. Vis ventestatus straks; forveksl aldrig en langsom læsning med bekræftet tomt svar. Afvis sene svar efter atlet-/datoperiodeskift. Ved OFF må komponentens vært fortsat undlade læsninger, timere og skrivninger. Lokale skriveveje og eksisterende navnerum ændres ikke af standarden.

## Fund som selvstændige billetter

### F1 · P1 · Analyse mister læsefejl og kan ligne manglende eller friske data · 60–90 min

**Kilde:** `src/athlete/laesninger.js:280` (især `:288`–`:290`), `src/AthleteView.jsx:272`, `:411`–`:417` og `:926`–`:929`; modtageren `src/entropi2/analysis/developmentModel.mjs:61`–`:65` og `src/entropi2/analysis/DevelopmentView.mjs:26`–`:34`.

**Nu:** `fetchFremgangLogs` slukker loading og returnerer ved fejl uden at gemme en fejlstatus. Værten sender ingen `fremgangError` til Analyse. Ved første fejlede læsning er historikken fortsat `null`: atleten ser »Din udvikling er ikke klar endnu. Prøv at åbne analyse igen.« Ved fejl efter en tidligere succes bevares historikken uden en fejlmarkering. Online vises desuden en midlertidig fejltoast; offline springes den over. Den vedvarende udviklingsvisning kan derfor ikke skelne fejl fra manglende grundlag eller tidligere data. Den har ingen lokal genhentningsknap.

**Rettelse:** Før en eksplicit loading/error/ready-status fra den eksisterende historiklæsning til Analyse og giv udviklingskortet en lokal »Hent igen«. Vis »Din udvikling kunne ikke hentes.« ved første fejl; brug opdateringsvarianten ved kendte gamle data. Bevar historik uden at bruge den til friske prognoser, indtil genhentning lykkes. At åbne fanen igen må gerne fortsat hente, men er ikke den eneste vej ud af fejl.

**Accept:** Syntetisk fejl før første succes giver vedvarende fejl og én genhentning; fejl efter succes giver ingen frisk prognose. Succes med `[]` viser den ægte tomtekst. Test værtskoblingen, ikke kun et manuelt sat fejlflag i bladkomponenten. Eksisterende `development.test.mjs` og `developmentReview.test.mjs` bekræfter bladets forskel på fejl, loading og manglende data; de beviser ikke, at værten leverer flaget.

### F2 · P2 · Hjem mangler programmets læsestatus og direkte genhentning · 60–90 min

**Kilde:** `src/athlete/laesninger.js:158`, `:174` og `:500`–`:515`; `src/AthleteView.jsx:819`–`:833`; `src/entropi2/home/homeModel.mjs:29`–`:37`; `src/entropi2/home/AthleteHome.mjs:19`, `:90`–`:105`.

**Nu:** Profilens loading afsluttes efter start af den uafventede programlæsning. Hjem får `programError`, men ingen selvstændig status for programmets første læsning. Med tomme uger og kendte tomme sæt kan kortet vise »Intet program endnu«, mens programsvaret stadig ventes; med ukendte sæt bruges »Programmet er ikke tilgængeligt«. En kendt programfejl viser »Programmet kunne ikke hentes. Prøv at genindlæse siden.« Handlingen er »Se mit program«; der er ingen lokal genhentning på Hjem. Programfanen har allerede en læseknap (`src/athlete/ProgramTab.jsx:546`–`:550`).

**Rettelse:** Tilføj eksplicit status for programmets eksisterende læsning og før den til Hjem. Vis »Henter programmet…« frem til bekræftet svar, fejlstandarden ved fejl og »Hent igen« koblet til samme programlæser. Tomt program må kun vises efter en vellykket tom læsning. Bevar navigation til programfanen.

**Accept:** Udskudt programløfte efter succesfuld profillæsning viser ikke tomt program. Afvist læsning giver lokal genhentning uden helsidegenindlæsning; bekræftet tomt svar giver præcis én tomtekst. Eksisterende `home/emptyStates.synthetic.test.mjs` låser den nuværende fejltekst om genindlæsning; opdatér forventningen ved implementering.

### F3 · P1 · Offlinebanner lover passtart, som Entropi 2 afviser ved øjebliksbillede · 30–60 min

**Kilde:** `src/athlete/IngenForbindelse.jsx:27`–`:44`; montering `src/AthleteView.jsx:807`; `src/entropi2/home/homeModel.mjs:33`; `src/entropi2/home/AthleteHome.mjs:103`; `src/entropi2/session/sessionModel.mjs:14`.

**Nu:** Banneret siger »Dagens pas og dine sæt virker; resten opdateres, når du har net.« Det vises også ved et gemt program, hvor browseren melder online, med præfikset »Forbindelsen er svag.« Samtidig fjerner Hjem startmålet ved `offlineSnapshotAt`, og sessionmodellen afviser samme grundlag. Atleten får både et løfte om et fungerende pas og besked om at hente programmet før registrering. Øjebliksbilledets tilstedeværelse dokumenterer heller ikke i sig selv en svag forbindelse.

**Rettelse:** Lad bannerets tekst afhænge af kendt forbindelsestilstand og den aktuelle skærms faktiske muligheder. I Entropi 2 med øjebliksbillede bruges offline-/øjebliksbilledeteksterne i standarden uden løfte om passtart. Bevar den nuværende startbegrænsning og den eksisterende kø for allerede registrerede sæt. Beskriv kun lokalt ventende sæt, hvis de faktisk findes. Bevar legacy/OFF-adfærd.

**Accept:** Syntetisk øjebliksbillede, både browser-online og -offline, må ikke love passtart, når start afvises. Kendt tidspunkt vises; ukendt tidspunkt opfindes ikke. OFF og allerede ventende sæt ændrer ikke adfærd. `home/emptyStates.synthetic.test.mjs` bekræfter allerede, at øjebliksbilledet fjerner startknappen.

### F4 · P2 · Mobilitets lokale læsefejl har ingen vej til genlæsning · 30–60 min

**Kilde:** `src/entropi2/mobility/mobility-screen.mjs:65`–`:87` og `:98`–`:110`; `src/entropi2/mobility/mobility-model.mjs:88`–`:99`.

**Nu:** Fejl i enhedens historik vises som »Ugeoversigten kunne ikke læses på denne enhed.« Hjemmeøvelsernes læsefejl bliver også vist. Begge bruger `role="status"`, og der er ingen »Prøv igen« ved fejlene. Modellen for hjemmeøvelser beregnes ved montering, så en almindelig ny tegning er ikke tilstrækkelig til at læse den igen. Det er synlige lokale læsefejl, ikke skjulte netværksfejl.

**Rettelse:** Vis lokal-fejlstandarden med »Prøv igen« og genlæs kun den ramte lokale kilde; hjemmeøvelsesmodellen skal også genberegnes. Brug `role="alert"` for den indtrufne fejl, og bevar bibliotek, programnavigation og eventuel fungerende rutine. Ryd eller overskriv ikke det lager, der ikke kunne læses.

**Accept:** Lageret kaster først og virker derefter; ét tryk genlæser og fjerner fejlen ved succes. Ingen skrivekald under genhentning; ingen falsk »0 rutiner« ved fejl. `mobility-empty.test.mjs` bekræfter allerede fejltekst og fravær af falsk nul, men prøver ikke en genhentningsknap.

### F5 · P2 · Øvelseshistorik beder om nyt forsøg uden en læsehandling · 45–90 min

**Kilde:** `src/entropi2/session/historik/exerciseHistory.mjs:28`–`:32`; `src/entropi2/session/historik/exerciseHistoryContent.mjs:27`–`:38`; tilkoblingen `src/entropi2/session/sessionView.mjs:95`–`:103`.

**Nu:** Historikmodellens fejlgren giver »Historikken kunne ikke vises. Prøv igen, når data er hentet.« Visningen viser kun en alert, ingen genhentningsknap. Modellen bruger samme fejlgren for et eksplicit læseproblem og ugyldigt/manglende input. At lukke og åbne detaljen er ikke en eksplicit genhentning af logs. Den bekræftede tomme historik skjules allerede korrekt.

**Rettelse:** Skeln læsefejl fra ugyldigt grundlag. Ved læsefejl vis »Historikken kunne ikke hentes.« og før en lokal »Hent igen« fra den eksisterende loglæser gennem sessionadapteren til både React- og DOM-visning. Bevar sessionens felter, åbne historik og fokus. For ugyldigt input bruges grundlagsteksten uden falsk løfte om, at en genhentning altid hjælper. Bevar skjult tom historik.

**Accept:** Eksakt import af indhold og adapter med syntetisk læsefejl viser én læsehandling; succes opdaterer historikken uden at gemme et sæt. Ugyldigt grundlag viser ingen gamle tal. OFF og tomt bekræftet svar er stadig uden historikkort. De 12 eksisterende `exerciseHistory.test.mjs`-prøver dækker modelgrænser, ikke en manglende genhentningsvej i værten.

### F6 · P3 · Samme læsehandling har flere navne og forskellige ventetekster · 30–60 min

**Kilde:** `src/entropi2/nutrition/view.mjs:175`, `:182`–`:185`, `:247`–`:248`; `src/entropi2/conversation/ConversationView.mjs:97`, `:181`; `src/entropi2/tracking/atlet/MineTal.mjs:53`–`:58`; `src/athlete/Indlaeser.jsx:10`–`:13`.

**Nu:** Atleten møder »Hent igen« ved vejninger, »Hent kostloggen igen« ved kost, »Opdatér samtalen« ved samtalen og »Prøv igen« ved Mine tal og opstart. Loading hedder både »Indlæser…« og »Henter…«. Kilderne kan allerede genhentes flere af disse steder; fundet handler om ensretning, ikke om manglende knapper overalt.

**Rettelse:** Først en lille genbrugelig præsentation med tekstkatalog og en pilot i kostvisningens dagbog og vejninger: »Henter {ressource}…«, »{Ressource} kunne ikke hentes.« og »Hent igen«. Knappernes tilgængelige navn kan uddybe ressourcen. Planlæg øvrige skærmes brug i deres eksisterende små billetter; forsøg ikke at migrere alle skærme på én gang. Bevar »Opdatér samtalen« som almindelig opdatering, hvis ønsket, men brug »Hent igen« ved dens læsefejl. Skrivningsretry skal fortsat være særskilt.

**Accept:** Pilotens læsefejl er vedvarende, genhenter kun den rette ressource og har ens ventestatus og 44 px trykflade. Kostens tomtekst må fortsat kun vises ved bekræftet tomt svar. Ingen ændring af datakilder, gemmeflow eller featureflag. `nutrition/emptyStates.test.mjs` har allerede en faktisk fejl→genhentning→tom-data-prøve og skal få den nye knaptekst ved implementering.

## Kontrolleret adfærd, som skal bevares

| Område | Observation ved basen | Evidens og begrænsning |
| --- | --- | --- |
| Første profillæsning | Ved reel læsefejl bliver atletvisningen på en fejlskærm frem for »ikke koblet«. Egen visning har »Prøv igen«. | `src/athlete/laesninger.js:132`–`:138`, `src/athlete/Indlaeser.jsx:8`–`:13`. Statiske kildechecks; ikke browserprøvet. |
| Programfane | Læsefejl har allerede »Prøv igen«. | `src/athlete/ProgramTab.jsx:546`–`:550`; referencemønster for F2, ikke bevis for Hjem-koblingen. |
| Kost og vejninger | Skelner loading, læsefejl og bekræftet tomt svar; kost kan genhentes, og tomtekst dubleres ikke. | `src/entropi2/nutrition/view.mjs:175`–`:185`, `:243`–`:264`; otte faktiske modulprøver bestod. |
| Samtale | Læsefejl har sikker tekst og en opdateringshandling; afsendelsesretry er særskilt. Tom tråd opfordrer roligt til at skrive. | `src/entropi2/conversation/conversationController.mjs:30`–`:41`, `ConversationView.mjs:95`–`:97`, `:181`–`:187`; seks cleanup-prøver bestod. |
| Dagsform og Mine tal | Loading og fejl adskilles; fejl har en retry når værten leverer den. | `src/entropi2/home/QuickLogs.mjs:161`–`:165`, `src/entropi2/tracking/atlet/MineTal.mjs:53`–`:58`. Kun kildecheck af disse grene. |
| Profil og eksport | Lokale måls læsefejl har retry; eksport har ventestatus, fejl og en klargøringshandling, der kan køres igen. Tom eksport beskrives ærligt. | `src/entropi2/profile/ProfileGoalsView.mjs:27`–`:29`, `src/entropi2/eksport/ExportPanel.mjs:39`–`:44`. Kun kildecheck; ingen eksportfiler hentet. |
| Øvelseshistorik / mobilitet | Valgfrie tomme kort udelades. Lokale mobilitetsfejl skjules ikke som nul gennemførte rutiner. | `exerciseHistoryContent.mjs:30`, `mobility-screen.mjs:87`–`:89`; model-/syntetiske prøver, ingen layoutmotor. |

## Verifikation og næste gate

Hele den leverede `src/`-kopi blev søgt efter prøver og relevante fejl-/loading-/offline-/tomtilstande. Der findes 826 testfiler under de 1.906 kildefiler; `test/` og `docs/audit/` er ikke med i det fastlåste arkiv. Ingen prøve refererer til `atlet-fejltilstande`. Den eneste repositoryændring er denne nye Markdown-fil, så der er nul kørbare prøver i den berørte dokumentationsmappe før/efter.

Som evidens er otte eksisterende testfiler kørt før og efter dokumentet: 82/82 bestået pr. kørsel. De importerer faktiske kopierede moduler med syntetiske data; React erstattes kun af arkivets egne syntetiske værter, hvor nødvendigt. De grønne prøver dokumenterer eksisterende adfærd og er ikke bevis for, at fundene er rettet. Se `TESTOUTPUT.md` og `ADAPTER.md` i afleveringspakken. Fuld suite og build er ikke kørt; de tilhører Dhurva ved fletning.

Foreslået rækkefølge: F1 og F3, derefter F2, F4 og F5; F6 kan begynde med kostpiloten uden at blokere de øvrige. Hver billet skal kun bruge eksisterende data, bevare OFF, forhåndsvisningens skriveværn og lokale navnerum. Ingen af forslagene giver tilladelse til produktionsskrivninger eller release. En frisk separat kontrol af det endelige dokument skal ske i den bestilte kontrolkørsel; producentens egne checks erstatter den ikke.
