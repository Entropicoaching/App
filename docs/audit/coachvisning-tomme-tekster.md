# Coachvisning: tomme og faste tekster

Billet: E2-COACH-TOMME-AUDIT1. Offentlig kildebase: `11e250a58fd567e95505ad4471c8b6f761dc5c4d` (kort: `11e250a5`). Dokumentets integrationssti er `docs/audit/coachvisning-tomme-tekster.md`.

Auditten følger den leverede kodes standardvej med Entropi 2 tændt. Ingen produktionsdata, browser, net eller produktionsschema er undersøgt. »Leveres« betyder derfor, at en faktisk læser og en kobling findes i denne kildebase; det beviser ikke en migrerings eller en drifts aktuelle tilstand. Manglende backendkoblinger må ikke erstattes med syntetiske tal eller nye skriveveje.

De syv fundgrupper er ordnet efter skønnet eksponering: forside først, derefter faste fanetekster, sparsomme profiler, åbnede værktøjer, konkrete handlinger, fejl og til sidst særskilte tilvalg. Rangeringen bygger på adgangsveje, ikke brugsstatistik. En lukket fold er ikke synlig brødtekst, men dens overskrift ses stadig. Ærlige tomtilstande og fejl skal bevares dér, hvor coachen har bedt om indhold; unødvendige gentagelser og indhold uden produktionskilde skal væk.

## Skærmkoblinger og dækning

| Skærm | Faktisk indgang i basen | Afgrænsning |
| --- | --- | --- |
| Forside | `src/Dashboard.jsx:697` → `src/entropi2/coach/CoachScreen.mjs:36` | Den gamle ForsideView ligger bag `!e2` ved `src/Dashboard.jsx:753`; dens »Ingen logs« er ikke den nye forside. |
| Atletkort | `src/entropi2/coach/CoachScreen.mjs:89` → `src/entropi2/coach/CoachAthleteWorkspace.mjs:41` | Kompakt kort; den fulde firefeltsvisning bruges ikke her. |
| Oversigt | `src/Dashboard.jsx:833` → `src/dashboard/OversigtTab.jsx:15` | Profilens Hjem/Hub er også medtaget ved `src/dashboard/HubTab.jsx:10`. |
| Kost & mål | `src/Dashboard.jsx:845` → `src/entropi2/kostMaalKobling.mjs:50` | Den gamle KostTab ved `src/Dashboard.jsx:850` er OFF-vejen. |
| Program | `src/Dashboard.jsx:858` → `src/dashboard/ProgramTab.jsx:24` | Inklusive blokforslag, ugesammenligning og skabeloner. |
| Log | `src/Dashboard.jsx:895` → `src/dashboard/LogTab.jsx:14` | Profilens logliste og øvelsesfilter. |
| Analyse | `src/Dashboard.jsx:795` → `src/dashboard/AnalyseTab.jsx:40` | Inklusive ugeevaluering, søvn og lokalt værktøj. |
| Stævne | `src/Dashboard.jsx:904` → `src/dashboard/StaevneTab.jsx:11` | Forsøgsvalg og prognose har hver sin fold. |
| Noter | `src/Dashboard.jsx:912` → `src/dashboard/NoterTab.jsx:9` | Dateret notesøgning kræver særskilt tilvalg. |
| Beskeder | `src/Dashboard.jsx:927` → `src/entropi2/conversation/ConversationEntry.mjs:34` | Gamle BeskederTab er bag `!e2` ved `src/Dashboard.jsx:933`. |
| Kalender | `src/Dashboard.jsx:739` → `src/dashboard/KalenderView.jsx:10` | ProgramOverblik er et alternativt tilvalg; Entropi 2 erstatter ikke automatisk kalenderen. |

## 1. Forsiden gentager mangler ved almindelig daglig brug

Eksponering: forsidens foldoverskrifter ved hver åbning; detaljetekster hver gang coachen åbner en fold med sparsomt eller ufuldstændigt grundlag.

| Fil:linje | Hvad coachen ser og hvornår | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/entropi2/coach/CoachScreen.mjs:77` | »Grundlaget afventer opdatering. Ukendt antal handlinger.« ved ukendt samlet grundlag. | Bevar én status med »Opdaterer overblikket…« under igangværende læsning; ved manglende kvittering tilbydes en opdatering. Antal må først vises ved komplet svar. |
| `src/entropi2/coach/CoachScreen.mjs:78` | Overskriften »Kræver dit blik« står uden indhold, når der ingen rækker er, og modellen endnu ikke er komplet. | Lad den fælles indlæsnings-/fejlstatus høre til sektionen; undgå et ekstra tomt område. Bevar »Ingen atleter kræver dit blik…« kun ved komplet svar. |
| `src/entropi2/coach/WeeklyReport.mjs:13` | »Programuge: ukendt« uden entydig aktuel dateret uge. | Udelad programugerækken uden brugbar uge; ved konkret manglende startdato vises én handling »Sæt dato på programugen« på programstedet. |
| `src/entropi2/coach/WeeklyReport.mjs:14` | »Pas logget: ukendt af ukendt planlagte«; enkelte tal kan også være ukendte. | Vis kun bekræftede tal. Ved ukendt nævner vis fx kun antal loggede pas, hvis det er dokumenteret, uden at antyde gennemførsel. |
| `src/entropi2/coach/WeeklyReport.mjs:15` | »Seneste pas · RPE-snit: ukendt« uden brugbare RPE-svar. | Udelad RPE-rækken. Et manglende svar er hverken nul eller et påkrævet advarselssignal. |
| `src/entropi2/coach/WeeklyReport.mjs:17` | »Kostdage logget: ukendt« og ved næste linje »Proteinmål nået: ukendt« uden kostkvittering. | Udelad begge rækker ved manglende kilde. Bevar én kostfejl med genforsøg på forsiden ved faktisk læsefejl; bevar kendte 0/7 ved komplet tomt svar. |
| `src/entropi2/coach/WeeklyReport.mjs:18` | »Proteinmål: ikke angivet« når kost er læst, men mål mangler. | Flyt behovet til Kost & mål; ugerapporten behøver kun den dokumenterede kostregistrering. |
| `src/entropi2/coach/CoachScreen.mjs:110` | Folden »Noter fra passene« findes også uden valgt atlet; indeni står »Vælg en atlet for at se pasnoter.« fra `src/entropi2/coach/SessionNotesView.mjs:53`. | Bevar vælgeren som et bevidst opslag, men angiv »Vælg atlet« i foldoverskriften eller flyt opslaget til atletens Log. Vis ikke en tom global noteliste som et signal. |
| `src/entropi2/coach/SessionNotesView.mjs:55` | Efter valg: »Ingen noter eller markeringer i de indlæste pas de seneste 7 dage.« | Bevar den ærlige tomtilstand efter et bevidst valg og en komplet læsning; forkort til »Ingen pasnoter de seneste 7 dage«. Ved ukendt pasgrundlag (`:53`) vis en opdateringshandling frem for en teknisk forklaring om logs. |
| `src/entropi2/coach/CoachScreen.mjs:113` | »Programmer der slutter« er altid en fold på forsiden, også uden brugbare kalenderdata eller atleter. `src/entropi2/coach/ProgramEndingView.mjs:28` viser »Programgrundlaget er ukendt. Ukendt slutdato.« | Monter kun folden med en relevant, bekræftet række. Saml fejlet/ufuldstændig kalenderstatus ét sted. Ved manglende dato på en kendt plan: én handlingsrække »Sæt slutdato« via Program, ikke dobbelt »ukendt«. |
| `src/entropi2/coach/ProgramEndingView.mjs:29` | »Ingen programmer slutter inden for 7 dage i de indlæste data.«; rækker uden slutdato viser »Ukendt slutdato« ved `:35`. | Skjul en bekræftet tom fold. Vis kendte udaterede planer som en særskilt dateringsopgave, uden at påstå at de snart slutter. |
| `src/entropi2/coach/CoachScreen.mjs:120` | »Ugens programmer (0)« og »Programgrundlaget er ukendt.« ved manglende kalendergrundlag; ved udateret plan står den længere variant ved `:129`. | Skjul folden uden brugbar roster. Bevar én konkret dateringsopgave for kendte uger uden dato; undgå at gentage den under både programslut og ugens programmer. |

Atletkortene er allerede bedre afgrænset: `src/entropi2/coach/atletkort/AthleteCard.mjs:15` bruger kun kendt seneste pas, positive ulæste beskeder og højst to signaler. Sparsomme kort ender med navn og Åbn, uden faste »Koststatus ukendt«, »Vægttrend ukendt« eller »Opfølgningssignal ukendt«. Bevar dette. `src/entropi2/coach/CoachScreen.mjs:82` viser kun Holdoverblik, når modellen leverer indhold; den skal ikke ændres til en permanent tom fold.

## 2. Kostfanen viser permanent kladdestatus og felter uden leveret grundlag

Eksponering: ved hver åbning af Kost & mål for en sparsom atlet, og ved hver åbning af Kostplan-folden, også når øvrige data er komplette.

| Fil:linje | Hvad coachen ser og hvorfor | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/entropi2/kostMaal/KostMaal.mjs:54` | Energi og Protein viser hver »Ingen mål endnu«. | Bevar én samlet »Sæt kostmål«-indgang når begge mangler; vis eksisterende mål enkeltvis. Ingen nulmål. |
| `src/entropi2/kostMaal/KostMaal.mjs:78` | »Ingen kropsvægt angivet«, »Ingen vejninger endnu«, »Ingen vejninger i perioden« og »Flere vejninger nødvendige« står samtidig i vægtgrundlaget ved `:78`, `:79`, `:80`, `:81`. | Ved komplet tom vægtlog: én tomtilstand. Vis kun seneste vejning, ugesnit og trend, når netop den størrelse kan beregnes; profilvægt og logvægt må ikke udgives for at være samme kilde. |
| `src/entropi2/kostMaal/KostMaal.mjs:90` | »Hjælp til energimål« monteres altid; `src/entropi2/kostMaal/energySuggestion.mjs:10` kræver vejning og `:12` mindst fire kostdage. | Vis hjælpen, når et dokumenteret forslag findes, eller efter et bevidst valg af hjælp. Saml datakrav ét sted; et eksisterende kcal-mål må ikke genbruges som vedligeholdelsesenergi. |
| `src/entropi2/kostMaal/nutritionWeek.mjs:17` | »Kostgrundlaget er ikke tilgængeligt…«, »…endnu ikke indlæst« (`:20`) eller »…ufuldstændigt« (`:30`) kan erstatte energihjælpen. | Skeln kort mellem henter, fejl og manglende data; én status for kostgrundlaget, ikke gentagelse under flere beregnede felter. Skjul beregninger ved manglende kvittering. |
| `src/entropi2/kostplan/coach/view.mjs:25` | Kostplanens faste besked siger, at det kun er en kladde på enheden, at atleten ikke ser den, og at aktivering kræver migration. Kilden `src/entropi2/kostplan/coach/portalModel.mjs:35` vælger altid `localDraftOnly: true`; ingen produktionsadapter til aktivering gives. | Vis kort »Lokal kladde · ikke delt med atleten«. Bevar ærlig status og blokering; skjul enhver forestilling om aktiv plan. Registrer aktivering som en separat opgave, der først må kobles på en verificeret produktionskontrakt. Auditopgaven indfører ingen migration eller skrivevej. |
| `src/entropi2/kostplan/coach/view.mjs:47` | »Grundlag og tidligere erfaringer« har seks felter (Vægttrend, Træning, Kostlog, Dagsform, Stævnedato, Tidligere erfaringer); `:53` viser »Ikke oplyst.« for hvert manglende felt. Portaladapteren giver kun id, dato, protein og måltype, jf. `src/entropi2/kostplan/coach/portalModel.mjs:35`. | Vis kun kontekstfelter med faktiske værdier. Skjul hele folden, når ingen findes. Udled ikke disse felter af ubekræftede snapshots eller frie noter. |
| `src/entropi2/kostplan/coach/view.mjs:59` | »Ingen kladde på skærmen.« før generering og teknisk vejledning om rå/kogt og uverificerede kilder ved `src/entropi2/kostplan/coach/PortalPlan.mjs:56`. | Brug én startinstruks ved fødevarevalget. Bevar relevante kvalitetsforbehold tæt på det valg, de påvirker, men fjern implementeringsstatus fra den faste hovedtekst. |
| `src/entropi2/kostplan/coach/PortalPlan.mjs:74` | Efter gemt lokal kladde monteres ugevurdering med den bogstavelige værdi `plan: null`. `src/entropi2/kostplan/justering/model.mjs:40` giver derfor altid »Der er ingen aktiv kostplan at vurdere.« | Skjul vurderingen, indtil en faktisk aktiv plan og dens komplette grundlag kan leveres. En gemt lokal kladde er ikke en aktiv plan. |

## 3. Sparsomme profiler giver mange tomfelter på de almindelige faner

Eksponering: hver åbning af den pågældende fane for nye atleter eller manglende registreringer. De følgende tekster kan være korrekte; problemet er gentagelser og manglende skelnen mellem tomt og ukendt (fejl behandles i fund 6).

| Fil:linje | Skærm og synlig tomtilstand | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/dashboard/OversigtTab.jsx:40` | Oversigt: »Ingen check-in logget i dag endnu.« | Bevar kun efter komplet læsning af dagens registreringer; ellers henter/fejl. Undgå at gentage manglen i profilens Hjem. |
| `src/dashboard/OversigtTab.jsx:152` | Alder og Vægtklasse viser »Ikke angivet« ved `:152` og `:153`. | Skjul manglende valgfrie profilfelter i læsevisning; behold felterne i redigering. |
| `src/dashboard/ProfilHoved.jsx:103` | På desktop beskriver profilens ID-hjælpetekst interne scripts, og selve ID'et står ved `:106`. | Flyt det tekniske id til en bevidst support-/detaljehandling; behold det ude af atletens normale overblik. Ingen faktiske id'er indgår i denne audit. |
| `src/dashboard/OversigtTab.jsx:157` | Tre konkurrencemaks og tre træningsmaks falder tilbage til 0 ved `:157` og `:164`; totalerne vises ved `:170`. | Vis kun registrerede maks og beregn kun en fuld total, når alle nødvendige løft findes. Manglende personlige tal er ikke 0 kg. |
| `src/dashboard/OversigtTab.jsx:197` | Kostmål viser to »Ikke sat« (`:197`, `:201`), selv om Kost & mål har egne tomtilstande. | Behold én navigation »Sæt kostmål«; undgå en ekstra måloversigt uden data. |
| `src/dashboard/OversigtTab.jsx:246` | »Ingen stævnedato sat endnu.« med kort og knapper. | Vis kun »Tilføj stævnedato« som lille handling ved manglende dato; selve stævnekortet kan være skjult. |
| `src/dashboard/HubTab.jsx:24` | Hjem: træningsantal og »Ulæste beskeder … ingen nye« ved `:25`. | Lad kendt nul være nul, men kræv kildekvittering før en positiv »ingen nye«-status. Undgå et ekstra tomt statistikpanel ved siden af indbakken. |
| `src/dashboard/ProgramTab.jsx:782` | Program: »Ingen uger endnu — tilføj den første«. | Bevar én starttilstand med Tilføj uge efter komplet tomt svar; skjul ekstra blok-/skabelonpaneler indtil de kan bruges. |
| `src/dashboard/LogTab.jsx:238` | Log: »Ingen loggede træninger endnu«; med filter »Ingen loggede sæt for … endnu« ved `:258`. | Bevar én ærlig tomtilstand efter komplet svar. Filtertomhed skal tilbyde »Vis alle øvelser«, så den ikke ligner manglende historik. |
| `src/dashboard/LogTab.jsx:186` | »Plan:« står også, når den sammensatte plantekst er tom. | Monter kun planrækken med mindst én faktisk planoplysning; samme mønster bruges allerede for progressionens `planText` ved `:284`. |
| `src/dashboard/AnalyseTab.jsx:98` | Seneste session kan hedde »Ukendt«, når den sammenkædede sessionstitel mangler. | Brug en neutral »Pas« med kendt dato; vis ingen opdigtet titel eller manglende databasereference. |
| `src/dashboard/AnalyseTab.jsx:453` | Træningsoverblik viser »—« for manglende programantal og aktivitet; Seneste sessioner viser »Ingen loggede sessioner endnu« ved `:695`. | Skjul de enkelte ukendte nøgletal, og brug én tomtilstand ved helt tom historik. Undgå både 0-statistik, streger og en tom liste for samme fravær. |
| `src/dashboard/AnalyseTab.jsx:301` | »Første bevægelsesprofil er ikke oprettet endnu« eller »Ingen analyser for dette løft endnu.« | Bevar kort, sand forklaring på valgt løft og en relevant videoindgang; ingen baselinekort før målinger findes. |
| `src/dashboard/AnalyseTab.jsx:353` | Videoer uden belastning viser »kg ikke angivet«; manglende repetitionstal falder tilbage til 0 reps. | Udelad ukendte tal; behold en relevant videorække med dato og status. Manglende repetitionsmåling er ikke nul gentagelser. |
| `src/dashboard/StaevneTab.jsx:110` | Stævne: »Ingen stævner registreret endnu« og »Ingen PR'er registreret endnu« ved `:149`; manglende resultatceller viser »–« ved `:130`. | Bevar Registrér resultat som start. Vis ikke både et tomt historikkort og et tomt PR-kort; tomme enkeltceller kan skjules eller markeres »Ikke registreret« efter bevidst åbning. |
| `src/dashboard/NoterTab.jsx:41` | Noter: »Ingen noter endnu.« | Bevar én starttilstand med Tilføj/rediger note. Der er ikke en dokumenteret skjult notesamling, der skal udfylde feltet. |
| `src/entropi2/conversation/ConversationView.mjs:181` | Beskeder: »Ingen beskeder endnu.« efter læst tom samtale. | Bevar denne tomtilstand og skrivefeltet; den eksisterende status skelner allerede mellem henter, fejl og tom samtale. |
| `src/dashboard/KalenderView.jsx:253` | Kalender: »Ingen atleter med datoer endnu…«; »Ingen atleter« ved `:456`. Manglende dato ved stævne vises ved `:437`. | Ved komplet tom roster: én starttilstand. Ved atleter uden dato: én dateringsliste med handling; undgå samtidig tom tidslinje og gentagne manglende datoer. |
| `src/dashboard/KalenderView.jsx:64` | »Intet program oprettet«, »Uger oprettet, men ingen øvelser« (`:65`), »Ingen logs« (`:74`), »Ingen uger oprettet« (`:466`) og »Ikke startet« (`:468`). | Bevar konkrete planlægningsopgaver, men vis ét problem og én handling pr. atlet frem for at gentage det i Planoverblik, handlingslisten og programstatus. Ingen aktivitetskonklusion før komplet loglæsning. |
| `src/dashboard/VolumenKort.jsx:106` | Oversigt: »Ingen sæt gennemført eller planlagt denne uge endnu«; historikfeltet viser »Ingen loggede sæt de seneste … uger endnu« ved `:189`. | Saml tomtilstanden. Ved ukendt kalenderuge skal kortet være skjult frem for at vise tom plan; den eksisterende null-vagt ved `:98` skal bevares. |

## 4. Åbnede folde giver gentagne datakrav og tekniske forklaringer

Eksponering: ved eksplicit åbning af analyse-, program- eller stævneværktøj med utilstrækkelige data; lavere end de faste faner ovenfor.

| Fil:linje | Hvad coachen ser | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/dashboard/AnalyseTab.jsx:205` | Et lokalt analyseværktøj, som bruger syntetiske data. `src/dashboard/AnalyseLokaltVaerktoej.jsx:14` siger det direkte; `:23` viser implementeringstekst om inputformater og acceptværdien false. | Skjul værktøjet fra den almindelige atletanalyse, indtil et produktionsflow er verificeret. Et eventuelt udviklertilvalg skal være særskilt. Syntetiske tal må aldrig fremstå som atletens. |
| `src/dashboard/AnalyseTab.jsx:261` | Baselinekort viser »…/5 · foreløbig · mangler …« eller »…/5 · mangler …«. Ved `:281` omtales tracking-confidence og ny kvalitetssikret baseline. | Én kort status pr. løft med antal brugbare målinger og næste konkrete handling; metode og historisk overgang foldes væk. Ingen baseline uden dokumenterede målinger. |
| `src/dashboardCharts.jsx:10` | »Ingen data endnu«; LineChart viser »Ikke nok data endnu« ved `:90`. Analyse har også sin egen tekst ved `src/dashboard/AnalyseTab.jsx:864`. | Kontroller datagrundlag før grafmontage; én forklaring for hele den efterspurgte graf, ikke et tomt diagramkort plus flere identiske tekster. |
| `src/dashboard/AnalyseTab.jsx:871` | Parathedens nøgletal viser streger for søvn og seneste score (`:872`). | Vis kun kendte størrelser; med én dags data vis dagens svar frem for et tomt trendkort. |
| `src/entropi2/tracking/coachuge/CoachWeek.mjs:35` | »Ingen registreringer i perioden«, »For lidt data til et samlet overblik« og »Ingen flag i de registrerede data«; under øvrigt grundlag står regler, formler, »Antal: ukendt« (`:10`) og »Ingen validerede registreringer at vise« (`:13`). | Bevar sondringen mellem tomt, utilstrækkeligt og kendt ingen flag. Saml datamangler i én lukket fold med konkrete registreringskrav; udelad enkeltfelter uden kilde. |
| `src/entropi2/tracking/soevn/SleepOverview.mjs:11` | Uger uden målinger: »Ukendt · 0/7 dage«; andre sparsomme uger: »For lidt data · …/7 dage«. Daglisten viser »Ukendt« via `:6`. `src/entropi2/tracking/soevn/CoachSleep.mjs:12` skjuler allerede hele folden ved tomt otteugersgrundlag; en kortere valgt periode kan dog vise tomteksten ved SleepOverview `:46`. | Bevar tomfold-vagten. Vis kun uger/dage med registreringer; ved bevidst valgt kortere tom periode er én tomtilstand korrekt. Den tilkoblede coachvisning er `hoursOnly`; skjul fortsat søvnkvalitet og pasrelationer, som den ikke leverer. |
| `src/entropi2/coach/blokplan/CoachProgramTools.mjs:139` | »Sammenlign to uger« kan åbnes med færre end to daterede uger; beskeden siger, at de mangler. | Tilbyd først sammenligning, når mindst to gyldige uger findes. Datering hører hjemme i programmet, ikke i en tom sammenligningsfold. |
| `src/entropi2/coach/sammenlign/CompareWeeksView.mjs:5` | Ukendte enkeltmål vises som »Ukendt«. `:30` kan vise »Ingen kvalificerede tunge sæt…«, fulgt af en lang forklaring ved `:31`. | Vis kun sammenlignelige kendte mål. Saml metode i en lukket grundlagsfold; behold en kort forklaring, hvis coachen aktivt efterspørger et mål uden grundlag. |
| `src/entropi2/program/skabeloner/ProgramTemplatesView.mjs:7` | »Ingen uger at oprette en skabelon fra« og »Ingen gemte skabeloner« ved `:12`. | Med ingen kildesessioner: skjul opret-skabelon. Et bevidst åbnet bibliotek må gerne have én tomtilstand med forklaring på, hvordan en skabelon oprettes. |
| `src/entropi2/staevne/CoachStaevnePlan.mjs:14` | Forsøgsvalg starter med tomt manuelt e1RM-grundlag. `src/entropi2/staevne/meetModel.mjs:34` svarer »Ingen e1RM eller tunge singler fra de seneste 42 dage.« | Bevar manuelt input og vis én »Angiv et aktuelt e1RM«-instruks, indtil en værdi findes. Undlad tre gentagne mangler for tre løft; PR må fortsat ikke bruges automatisk som aktuelt estimat. |
| `src/entropi2/staevne/StaevneView.mjs:33` | »Åbnertid mangler; tider vises relativt…« og ved `:34` »Ingen lettere opvarmningsvægt i 2,5 kg-trin…«. | Vis relative tider uden at kalde valgfri klokketid en mangel. Bevar en kort konkret forklaring, hvis et faktisk estimat ikke giver lettere opvarmningssæt. |
| `src/entropi2/analysis/prognose/prognoseModel.mjs:43` | Prognose kræver mindst otte uger; øvrige afvisninger ved `:46`, `:47`, `:49`, `:67` kræver tidsmæssigt spænd, friske sæt, passende afstand og stabilt grundlag. | Bevar kravene. Vis én kort grund til at prognosen mangler og fold præcise grænser/metode væk; ingen opdigtet fremskrivning. Tom stævnedato ved `:85` skal give en konkret datovælger. |
| `src/dashboard/VolumenKort.jsx:213` | »Ukendt øvelse« som række med antal ikke-kortlagte sæt. Forklaringen om udateret uge står ved `:126`. | Omdøb til »Ikke kortlagt« med én kortlægningshandling. Skjul ukendt planmængde; behold registrerede sæt, som faktisk kan opgøres. |

## 5. Handlinger afslører faste begrænsninger eller rå tekniske tekster

Eksponering: efter generér, gem, lav udkast eller anden bevidst handling; ikke ved alle sidebesøg.

| Fil:linje | Hvad coachen ser | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/dashboard/ProgramTab.jsx:105` | AI-ugeudkast bruger backendens `data.error`, `error.message` eller »Ukendt fejl« direkte; tilsvarende ved afsendelse `:298`, gengivelse ved `:168`. | Oversæt til kendte fejl med handling: »Udkastet kunne ikke dannes. Prøv igen.« / »Ugen blev ikke gemt«. Gem tekniske detaljer uden for produktteksten; bevar coachens indtastninger og godkendelseskravet. |
| `src/dashboard/ProgramTab.jsx:196` | »Mangler kontekst« i progression; godkendelsesfejl vises råt ved `:213`; »Ingen automatiske justeringer — ren kopi…« ved `:280`. | Vis kun beregnet progression, når motorens dokumenterede minimum findes. En ren kopi skal kaldes kopi, og ukendte felter skal skjules; vis godkendelseskravet én gang. |
| `src/dashboard/programHandlinger.js:139` | Godkend progression, gem anbefalet vægt (`:561`) og kopier blok (`:666`) kan føre rå backendfejl frem til fejltekst/flash. | Brug stabile tekster for hver handling, og bevar det lokale udkast ved fejl. Coachen skal kunne se, hvad der ikke blev gemt, uden at læse en teknisk backendbesked. |
| `src/entropi2/kostplan/coach/view.mjs:87` | »Gem som klar til aktivering« er en lokal kladdehandling; den ændrer ikke atletens aktive plan. | Kald den fx »Markér lokal kladde som klar« og gentag delingsstatus efter handling. Ingen »Aktiv«-kvittering uden en faktisk produktionskvittering. |
| `src/entropi2/conversation/ConversationView.mjs:67` | Søvnudkast siger »Øvrige data er ukendte« hver gang, selv om udkastet bevidst kun bruger søvn; uden søvn står en lang tomforklaring ved `:70`. | Bevar navnet »Lav udkast om søvn« og den korte datoperiode. Undlad den globale ukendt-påstand om øvrige domæner; uden kendte søvntimer: ingen udkast og én kort forklaring. |
| `src/entropi2/conversation/ConversationView.mjs:118` | »Ingen gemte hurtige svar« efter Hent hurtige svar; lokallager-/valideringsfejl kan vises via `e.message` ved `:112` og `:116`. | Bevar bevidst tomt bibliotek, men vis én Opret svar-handling. Oversæt lagerfejl til en stabil dansk besked; ingen intern nøgle eller fejlobjekt i UI. |
| `src/entropi2/staevne/CoachStaevnePlan.mjs:52` | Faktiske forsøg er kun midlertidige og gemmes ikke; de nulstilles ved navigation. | Bevar den afgørende gemmebegrænsning ved indtastning og en tydelig Registrér resultat-handling. Fjern ikke advarslen før en reel gemmevej findes. |

## 6. Læsefejl kan ligne nye atleter eller manglende historik

Eksponering: forbindelses-/læsefejl og indlæsning; sjældnere end de almindelige tomtilstande, men høj konsekvens. Ingen fejl må omskrives til »ingen data«.

| Fil:linje | Sammenhæng til synlig skærm | Konkret rettelsesforslag |
| --- | --- | --- |
| `src/dashboard/laesninger.js:501` | `fetchWeeks` giver `data || []` videre ved `:512` og ingen fane-fejlstatus til Program. »Ingen uger endnu« kan derfor komme ved fejl. | Giv den valgte atlets læsning en eksplicit loading/error/ready-kvittering. Tomtekst kun efter ready med tom liste; tilbyd genforsøg. |
| `src/dashboard/laesninger.js:569` | Loglæsning falder tilbage til `[]` ved `:584`. `src/Dashboard.jsx:895` giver LogTab selve listen uden separat læsefejl. | Samme kvittering på Log og de læsende dele af Analyse. `readEvidence.complete=false` er ikke nok, når selve tomlisten stadig vises. |
| `src/dashboard/laesninger.js:624` | Dagsform læser kun `data`, kasserer fejl og sætter `[]` ved `:631`; Oversigt kan dermed sige ingen check-in. | Vis dagsformfejl særskilt og behold seneste bekræftede data mærket som gamle, hvis de bevares; ingen positiv mangelkonklusion fra fejl. |
| `src/dashboard/laesninger.js:634` | PR-historik og derefter stævneresultater ved `:649` læser kun `data`; tomme lister kan give de to Stævne-tomkort. | Vis én historikfejl med genforsøg; skjul beregnede PR-konklusioner, indtil kildeperioden er bekræftet. |
| `src/dashboard/laesninger.js:658` | Stævneplan bruger `data || null` og tom formular uden synlig læsefejl. | Skeln »Ingen plan endnu« fra »Planen kunne ikke hentes« og undgå at invitere til overskrivning, før status er kendt. |
| `src/Dashboard.jsx:741` | KalenderView får ikke `loading`/`loadError`; dens `calendarWeeks[a.id] || []` ved `src/dashboard/KalenderView.jsx:39` kan derfor ligne »Intet program oprettet«. | Tilfør kalenderens faktiske kvittering og skjul opgavekonklusioner under læsning/fejl. ProgramOverblik-alternativet modtager allerede loading/loadError, men er et særskilt tilvalg. |
| `src/dashboard/KalenderView.jsx:85` | »Alle planer har luft« kan stå ved tom `planningNeeds`, også uden synlige atleter. | Kræv komplet, ikke-tom roster og kalender før den positive formulering; ellers ingen konklusion. |
| `src/dashboard/laesninger.js:603` | Videohistorikkens fejltekst kan komme fra databasens rå `error.message`; `src/dashboard/AnalyseTab.jsx:290` viser den. | Bevar fejl og Prøv igen, men brug fast forståelig tekst i UI og teknisk detalje uden for visningen. |
| `src/entropi2/kostMaalKobling.mjs:55` | Fejl i vægtlæsning erstatter hele kostfanen med »Vægtgrundlaget kunne ikke hentes…«; KostMaal og PortalPlan monteres først ved ready (`:57`). | Lad fejl blokere vægtafhængige forslag. Uafhængige, allerede læste kostmål og lokal kladde kan vises separat med egne statusser; tilbyd genforsøg direkte. Ingen fejlagtig »Ingen vejninger«. |
| `src/ErrorBoundary.jsx:44` | Hele appens fejlfallback siger »Fejlen er registreret og bliver kigget på«, selv om registreringen kun er best effort. Fanens lokale fallback ved `src/LazyBoundary.jsx:66` nøjes med »Noget gik galt« og genforsøg. | Bevar genindlæsning/genforsøg. Lov kun fejlregistrering, når der faktisk foreligger en kvittering; den lokale neutrale tekst kan bevares. |

Forsidens kostfejl ved `src/entropi2/coach/CoachScreen.mjs:97` har allerede egen åben fejlstatus og Hent kost igen. Samtalens læsefejl ved `src/entropi2/conversation/conversationController.mjs:40` bliver en forståelig fejl, ikke en tom historik. Pasnoternes fejl ved `src/entropi2/coach/SessionNotesView.mjs:50` og prognosens genforsøg ved `src/entropi2/analysis/prognose/CoachMeetPrognose.mjs:16` bør ligeledes bevares.

## 7. Tilvalg og manglende produktionskoblinger skal ikke tælles som daglige fejl

Eksponering: kun særskilt tilvalg eller en ny datakilde, som værten endnu ikke leverer. Disse afgrænsninger forhindrer, at man »retter« ved at opfinde data eller tænde frakoblede funktioner.

| Fil:linje | Faktisk tilstand | Konkret rettelsesforslag/afgrænsning |
| --- | --- | --- |
| `src/entropi2/coach/coachWorkspaceModel.mjs:12` | Ugeevaluering, planlægningsgrundlag og rigt tracking-snapshot kræver `props.coachAnalysis`. Dashboard giver ikke denne prop til CoachScreen. Ved `:43` til `:45` er felterne derfor fraværende. | Bevar de skjulte folde uden kvittering. De er ikke tomme folde i produktionens nuværende kobling. Udvid kun med data fra faktiske produktionslæsere, samme ejer/atlet/dag og komplet svar. |
| `src/entropi2/coach/atletkort/AthleteCard.mjs:30` | Den fulde kortvariant kan vise faste ukendt-tekster fra `src/entropi2/coach/atletkort/athleteCardModel.mjs:24`; forsiden bruger compact. | Tæl ikke de fulde rækker som synlige forsidefejl. Hvis varianten senere kobles ind, filtreres ukendte rækker før montage. Bevar OFF uden læsning af facts. |
| `src/dashboard/CoachNotesPage.mjs:37` | »Dato ukendt« for gamle fritekstnoter; »Ingen noter matcher din søgning« ved `:39`. Komponenten vælges kun med `coachNotes`-tilvalget, jf. `src/Dashboard.jsx:104` og `src/dashboard/NoterTab.jsx:14`. | Vis gammel note uden opdigtet dato; søgetomhed skal have Nulstil søgning. Dette er ikke standardnotefanens daglige tekst. |
| `src/dashboard/ProgramOverblikView.mjs:23` | Tilvalget kan vise »Programuge ukendt«, »Program uden dato«, »Intet program« (`:24`) og »Ingen atleter at vise« (`:27`). | Skjul ukendt ugenummer, behold kendt slutdato, og tilbyd konkret datering. Tom roster må kun beskrives efter komplet læsning. |
| `src/dashboard/CoachCalendarEvents.jsx:9` | »Ingen stævnedatoer angivet« vises kun med `coachCalendarEvents`; montagevagten er `src/dashboard/KalenderView.jsx:189`. | Skjul den ekstra datofold/-sektion uden datoer. Den er ikke standardkalenderens tomtekst og må ikke tælles med som endnu en daglig gentagelse. |
| `src/dashboard/AnalyseTab.jsx:154` | AnalyseSamletPrototype og AnalyseSammenlign kræver særskilte URL-tilvalg ved `:154` og `:158`; de er ikke almindelig produktionstekst. | Hold prototyper adskilt fra coachens atletdata. Auditfundet om det lokale analyseværktøj i fund 4 gælder derimod, fordi det monteres uden disse tilvalg. |
| `src/analyseMissingFlag.mjs:1` | Detaljerede logkrav er OFF som standard; AnalyseTab bruger dem kun ved `analyseMissingData`. Den fælles datagate er også særskilt. | Beskriv ikke hver D-regel som en permanent skærmtekst. Når tilvalget bruges, samles kravene pr. datakilde, og Send logkrav må kun være en bevidst coachhandling. |
| `src/entropi2/tracking/soevn/CoachSleep.mjs:19` | Coachens søvnvisning bruger selvregistrerede timer. Kvalitet, smartwatchdata og automatisk årsagsanalyse følger ikke med denne kobling. | Vis intet felt for disse kilder. Samtykkekrævende/private oplysninger må heller ikke udfyldes fra antagelser. |

## Verifikation og forslag til accept ved senere rettelser

Der er kun foreslået rettelser; ingen appkode, flag, data eller lagringskontrakter er ændret. De kopierede moduler er kørt med syntetiske fixtures. Afgrænsede prøver og kildehenvisningskontrol fremgår af TESTOUTPUT.md; ingen fuld suite, build eller visuel produktionstest er kørt.

En senere implementering bør kontrollere: komplet tomt svar, manglende kvittering, loading, fejl, afkortet svar, forkert ejer/atlet/dag, kendt nul og kendte positive værdier. Ukendte enkeltfelter forsvinder; en eksplicit efterspurgt tom liste må have én ærlig tomtilstand; fejl beholder genforsøg. Forsidekort forbliver kompakte, ekstra stof foldes væk, OFF forbliver uden sideeffekter, og lokale kladder beholder deres namespace og ærlige delingsstatus.
