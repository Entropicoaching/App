# Næste version af Entropi Coach

Kilde: `release/entropi-samlet-neste`, revision `23450ad0`.

**Udkast: forskellen mod main er endnu ikke verificeret.** Den udleverede kildepakke indeholder denne revision, men hverken git-loggen eller `main` ved `bf183203`. Nedenfor står det, som kan dokumenteres i release-koden; det er ikke en bekræftet liste over nyheder siden main. Noten dokumenterer heller ikke en udgivelse til brugerne.

Den samlede Entropi 2-visning er tændt som standard i kildeversionen. Atleten får dagens træning og et enkelt overblik; coachen får det, der kræver handling, først. Flere detaljer ligger bag fold-ud-felter.

## For atleten

- **Pas — Hjem → Start dagens pas.** Ét sæt ad gangen med vægt, gentagelser, RPE og knappen **Godkendt**. Der er vægt- og gentagelsesknapper, seneste sæt, pausevisning og fold-ud-værktøjer til opvarmning og skiver. Planens tempo og supersæt vises, når de findes. En sætnote kan følge med sættet. **Afslut pas** viser en opsummering; det er også muligt at fortsætte et uafsluttet pas. En vurdering af hele passet i opsummeringen er kun en midlertidig kladde og bliver ikke gemt.

- **Hjem — Hjem.** Dagens eller næste relevante pas står først, sammen med ugens passtatus. **Se ugens plan** folder planen ud. Der er adgang til **Film et sæt**, seneste besked og dagens kost, når det er tilgængeligt. Ferie, manglende program og færdig træning får hver sin besked. Den nye hjem- og pasvisning gælder atletens egen visning; coachens atletforhåndsvisning går ikke gennem samme indgang.

- **Kost — Kost, når kost er slået til for atleten.** Vægt med ugegennemsnit, **Log hurtigt**, dagens mål og dagbog er samlet. Man kan gentage måltider, logge en portion, rette eller fjerne en logning og se **Din uge** samt op til 30 dages historik. Favoritter, egne sammensatte måltider og måltidsskabeloner opbevares lokalt i browseren for den enkelte atlet; brug af dem logger et måltid via den almindelige gemmehandling. **Indkøb fra dine favoritter** vises kun, når egne måltider har ingredienser; listen kan ikke udlede ingredienser fra gamle logninger uden dem.

- **Analyse — Fremgang → Din analyse.** Ugerapport, **Mine data** og udviklingen over de seneste fire uger samles her. **Intensitet pr. uge** og **Flere analyser** kan foldes ud. Her findes blandt andet RPE-historik, rekorder, muskelvolumen og **Del ugen**, som kopierer en tekst til udklipsholderen. Det sender ikke en besked til coachen. Manglende uger og målinger vises som mangler.

- **Program — Program.** Den aktuelle blok viser **Uge … af …**, næste test eller deload, hvis det fremgår af planen, og **Blokkens uger og planlagte sæt**. Tryk på en uge for at åbne den. Planlagte sæt og logstatus er forskellige oplysninger; en uafklaret logstatus bliver ikke til gennemført træning. Denne blokvisning er koblet ind i den eksisterende Program-fane.

- **Profil — Mig øverst → Profil og dataeksport.** Se eget mål og eksisterende kostmål. **Eksportér mine data** kan forberede trænings-, kost- og vægtdata til JSON og CSV. Eksporten kræver komplette opslag for den aktuelle atlet; den er ikke en eksport af samtaler eller alle appens data. **Log ud** ligger fortsat i kontomenuen **⋯**.

- **Volumen — Volumen.** **Din volumen** sammenligner denne uge med sidste uge pr. muskelgruppe. Kun gennemførte sæt tælles, med standardkortets vægtning for primære og medvirkende muskler. Ukendte øvelser oplyses særskilt. Det er træningsmængde i sæt, ikke løftet vægt; beregningen kan læses under **Sådan tælles det**.

- **Stævne — Stævne, når stævnedato eller plan giver adgang til fanen.** Den eksisterende stævnefane bruges fortsat til forsøgsplan, opvarmning og stævnehistorik. Coachens nye værktøj til forsøgsforslag er beskrevet nedenfor; det er ikke en ny selvstændig stævneskærm for atleten.

- **Tracking — Fremgang → Mine data samt Kost.** Det enkle overblik bruger egne logninger af træning, kost og vægt. Pasoptællingen i **Mine data** er begrænset til den viste programuge; den er ikke en samlet optælling for alle fire uger. Den separate skærm **Mine tal** er ikke koblet ind i appen i denne kildeversion.

## For coachen

- **Hjem — Overblik.** **Det vigtigste først** prioriterer atleter, der kræver handling. **Dine atleter**, **Ugerapport**, **Kost**, **Noter fra passene**, **Programmer der slutter** og **Ugens programmer** kan foldes ud. **Indbakke** samler det, der venter, med **Alle samtaler** nedenunder. Ufuldstændige opslag betyder ukendt grundlag, også når der ikke vises nogen opgaver.

- **Pas — Overblik → Noter fra passene og Ugerapport.** Sætnoter kan læses med deres træningskontekst. Ugerapporten viser loggede mod planlagte pas i den aktuelle programuge og RPE-snittet fra seneste pas, når der er grundlag. Her tæller et pas som logget, når mindst ét sæt er logget uden at være sprunget over; tallet betyder ikke, at alle sættene er gennemført.

- **Kost — Overblik → Kost; atletens profil → Mere → Kost & mål.** Overblikket viser koststatus fra de seneste syv dage. På atletens kostfane er kostmål og vægt koblet til coachens målvisning. Fejl har en synlig status og mulighed for genhentning. Manglende mål eller logninger bliver ikke til opnåede mål.

- **Analyse — Overblik → Ugerapport og Dine atleter.** Atletoverblikket kan vise signaler om registreret belastningsændring og lavt protein, med begrundelse og datagrundlag. Kun det tilgængelige grundlag bruges. De mere omfattende felter **Ugeevaluering**, **Planlægningsgrundlag** og trendgraferne kræver et særskilt analysesnapshot, som Dashboard ikke leverer i denne version; de er derfor ikke almindeligt tilgængelige her.

- **Program — Åbn en atlet → Program.** **Forslag til næste blok**, **Sammenlign to uger** og **Programskabeloner** er fold-ud-værktøjer i den eksisterende programfane. Sammenligningen henter trænings-, kost- og vægtgrundlag for to valgte uger. Blokforslag, skabelonbibliotek og programudkast kan gemmes lokalt i denne browser. De opretter ikke uger eller pas hos atleten og bliver ikke automatisk til atletens program.

- **Profil — Åbn en atlet fra Overblik.** Atletkortet giver adgang til den eksisterende atletprofil. Atletens egen **Mig → Profil og dataeksport** kræver ejerskab og er ikke tilgængelig som den samme skærm i coachens forhåndsvisning. Der er ikke belæg i denne pakke for at kalde selve coachprofilen ny i forhold til main.

- **Volumen — Atletens profil → Mere → Oversigt → volumenkortet.** Coachens eksisterende volumenvisning med planlagt og gennemført træning bevares. Atletens sammenligning af to uger erstatter ikke coachens værktøj. Om coachvisningen er ændret siden main kan ikke afgøres uden sammenligningsgrundlaget.

- **Stævne — Atletens profil → Mere → Stævne → Forsøgsvalg og opvarmning.** Indtast et aktuelt e1RM-estimat og eventuelt tidspunkt for åbneren; vælg strategi og gennemgå forsøg og opvarmning. Rekorder bruges ikke automatisk som estimat. **Brug …-forslag i planen** udfylder kun planfelterne; **Gem plan** er en særskilt handling. Faktiske forsøg inde i forslagsværktøjet er midlertidige noter. Brug **Stævnehistorik → Registrér resultat** til at gemme et resultat.

- **Tracking — Overblik → Dine atleter → Belastning og trend → Signaler og datagrundlag.** Signalerne er støtte til evaluering og planlægning, uden automatiske programændringer. Under **Beskedudkast fra ugerapport** kan der laves og rettes et tekstudkast, når rapporten har brugbare oplysninger. Udkastet lever kun i skærmens hukommelse: intet er sendt eller gemt, og afsendelse er ikke tilsluttet dette værktøj.

## Hvad er slået fra, frakoblet eller kun en kladde?

- **Midlertidigt på skærmen:** vurdering af hele passet, coachens beskedudkast, indkøbslisten og faktiske forsøg i stævneforslagsværktøjet. De er ikke gemte registreringer.
- **Lokalt i browseren:** kostfavoritter, egne måltider, måltidsskabeloner samt coachens blok- og programudkast/skabeloner. De følger ikke automatisk med til en anden enhed. Almindelige måltids- og sætlogninger skal stadig gemmes særskilt.
- **Findes som moduler, men uden appindgang:** den separate ugentlige check-in, **Mine tal**, månedsrapporten, den særskilte smertehistorik, blokslutrapport, prognosevisning, kostugeplan og ude-spisning. Check-in-modulet gemmer kun en lokal kladde; det er ikke en indsendt check-in. Tilsvarende findes en separat ny Program-visning og VideoCoach-visning uden appindgang; eksisterende program- og videoflows bruges fortsat.
- **Koblet ind, men uden det nødvendige datagrundlag:** coachens omfattende ugeevaluering, planlægningsgrundlag og komplette belastnings-/trendvisning. Dashboard sender ikke det krævede `coachAnalysis`-snapshot. Man skal derfor ikke forvente disse fold-ud-felter eller komplette grafer i den almindelige coachvisning.
- **Særskilt udrulningstrin er stadig 0:** den ældre `appData2`-aktivering er ikke slået til gennem `UDGIVELSE_TRIN`; den har fortsat et eksplicit tilvalg. Det er et andet flag end den samlede Entropi 2-visning, som er tændt i denne kildeversion.
- **Senere spor:** mobil- og smartwatchdata er ikke dokumenteret som en tilsluttet datakilde. Cyklusdeling må ikke beskrives som frigivet eller databasesikret her: kilden indeholder privatlivslogik, men pakken indeholder ingen databasefiler, der kan dokumentere håndhævelsen.

<details>
<summary>Kildegrundlag og kontrol før endelige udgivelsesnoter</summary>

Alle nedenstående henvisninger gælder den udleverede revision `23450ad06c4e2fd84e6b05cf6a3f5586edfe9648`. Kommentarer om tidligere ordrer er ikke brugt som bevis for, hvad der er nyt siden main.

- **Indgange og standard:** [AthleteView](../src/AthleteView.jsx), [Dashboard](../src/Dashboard.jsx), [Entropi 2-flag](../src/entropi2/flag.mjs), [navigation](../src/athlete/NavItems.jsx).
- **Pas og hjem:** [hjem](../src/entropi2/home/AthleteHome.mjs), [pasbro](../src/entropi2/home/homeSessionBridge.mjs), [pasvisning](../src/entropi2/session/sessionView.mjs), [pasmodel](../src/entropi2/session/sessionModel.mjs), [pasvurdering](../src/entropi2/session/afslut/sessionFeelingDom.mjs).
- **Kost og lokal lagring:** [kostvisning](../src/entropi2/nutrition/view.mjs), [kostcontroller](../src/entropi2/nutrition/controller.mjs), [måltidsskabeloner](../src/entropi2/nutrition/skabeloner/model.mjs), [indkøb](../src/entropi2/nutrition/indkoeb/shoppingList.mjs), [coachens kostmål](../src/entropi2/kostMaalKobling.mjs).
- **Analyse, program og profil:** [analyse](../src/entropi2/analysis/Analysis.mjs), [Mine data-adapter](../src/entropi2/analysis/analysisMineData.mjs), [programfane](../src/athlete/ProgramTab.jsx), [blokoverblik](../src/athlete/programBlockOverview.mjs), [profil](../src/entropi2/profile/ProfilePage.mjs), [eksport](../src/entropi2/eksport/athleteExport.mjs), [volumen](../src/entropi2/volume/Volume.mjs).
- **Coach:** [overblik](../src/entropi2/coach/CoachScreen.mjs), [ugerapport](../src/entropi2/coach/WeeklyReport.mjs), [arbejdsområde](../src/entropi2/coach/CoachAthleteWorkspace.mjs), [snapshotkrav](../src/entropi2/coach/coachWorkspaceModel.mjs), [signaler](../src/entropi2/coach/coachTrackingModel.mjs), [programværktøjer](../src/entropi2/coach/blokplan/CoachProgramTools.mjs), [programkladder](../src/entropi2/coach/blokplan/programData.mjs), [profilnavigation](../src/dashboard/ProfilHoved.jsx), [sektioner](../src/dashboard/hubSektioner.jsx), [oversigt med volumenkort](../src/dashboard/OversigtTab.jsx).
- **Stævne og særskilt flag:** [atletens stævnefane](../src/athlete/StaevnedagTab.jsx), [coachens stævnefane](../src/dashboard/StaevneTab.jsx), [forslagsværktøj](../src/entropi2/staevne/CoachStaevnePlan.mjs), [udrulningstrin](../src/udgivelseTrin.mjs).

Før noten kan kaldes en verificeret oversigt over nyheder siden main, skal git-log og ændringer for `bf183203..23450ad0` tilføjes som fastlåst offentligt input og holdes op mod punkterne ovenfor. Eksisterende funktioner skal derefter mærkes som bevarede eller fjernes fra nyhedslisten. Fuld suite, build og udgivelseskontrol ligger hos integrationen.

</details>
