# Fredagens skærmliste

Syntetisk forhåndsvisning til Marc. Alle motiver: 375 x 900 px, da-DK,
Europe/Copenhagen. Vent på data, luk skærmlisten og tag derefter billedet.
Ingen billeder er taget af workeren.

Efter separat kontrol kan Dhurva fra appens rod køre:

`node scripts/friday-preview.mjs --build-preview`

Dette bygger kun til preview-friday-dist og starter ingen server. Uden argument
er scriptet OFF. Brug eksisterende installerede afhængigheder. Ingen installation.
Åbn det byggede scripts/friday-preview.html på en frisk lokal HTTP-oprindelse.
Linkene nedenfor antager port 4173. Er en service worker aktiv, stopper previewet.
Brug en anden frisk lokal oprindelse. Brug ikke produktionsoprindelsen.

Linket vælger rolle og viser en klikvej. Skærmnavnet automatiserer ikke appens
interne faner eller klik. Følg klikvejen efter åbning. Hvert link starter forfra.

| Motiv | Link | Klikvej |
| --- | --- | --- |
| Hjem (athlete) | [atlet-hjem](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-hjem) | Startvisningen |
| Program næste uge (athlete) | [atlet-program](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-program) | Mere > Mit program > næste uge |
| Mobilitet (athlete) | [atlet-mobilitet](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-mobilitet) | Mere > Mobilitet > vælg fokus |
| Fremgang (athlete) | [atlet-fremgang](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-fremgang) | Fremgang > Styrke > Rekorder > Se alle detaljer |
| Profil (athlete) | [atlet-profil](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-profil) | Åbn Konto øverst. Basen har kontomenu, ingen særskilt profilside |
| Videocoachens tidsmarkeringer (athlete) | [videocoach-tidsmarkeringer](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=videocoach-tidsmarkeringer) | Kontakt > Teknik & løft > Se feedback > Åbn syntetiske tidsmarkeringer > 4.0 s | 
| Mobilitetsbibliotek (athlete) | [atlet-mobilitetsbibliotek](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-mobilitetsbibliotek) | Mere > Mobilitet > Mobilitet > Se øvelsesbibliotek |
| Hjemmerutine (athlete) | [atlet-hjemmerutine](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-hjemmerutine) | Mere > Mobilitet > Mobilitet > Squat > Mere dybde > Start min rutine |
| Blok mod blok (athlete) | [atlet-blok-mod-blok](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-blok-mod-blok) | Fremgang > Styrke > Se alle detaljer |
| Rekorder pr. gentagelser (athlete) | [atlet-gentagelsesrekorder](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=atlet-gentagelsesrekorder) | Fremgang > Styrke > Rekorder > Se alle detaljer |
| Coachens opryddede menu (coach) | [coach-oprydning](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-oprydning) | Menu > Mere |
| Kalender med stævner (coach) | [coach-staevnekalender](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-staevnekalender) | Menu > Kalender |
| Dagsliste (coach) | [coach-dagsliste](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-dagsliste) | Startvisningen |
| Atletprofil (coach) | [coach-atletprofil](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-atletprofil) | Åbn Testatlet i dagslisten |
| Analyse (coach) | [coach-analyse](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-analyse) | Åbn Testatlet > Mere ▾ > Analyse |
| Videokø (coach) | [coach-videokoe](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&rel1030=1&analyseConclusion=1&screen=coach-videokoe) | Arbejdsindbakke |

Profilmotivet er basens Konto-menu, ikke en ny profilside. Videokøen indeholder
en opdigtet kladde uden videofil. Åbn Arbejdsindbakke > Testatlet >
Gennemgå måling > Åbn syntetiske tidsmarkeringer > 4.0 s. Samme analyse-id
vises som delt feedback hos atleten og kladde hos coachen i to særskilte
læseperspektiver. Der udføres ingen deling eller lagring.
Alle skrivehandlinger er afvist. Dette er en skærmgennemgang, ikke en demonstration
af lagring, upload eller deling. Data og lager forsvinder ved genindlæsning.

## Flag i den isolerede previewindgang

Atletprops: enkelPrototype, forenklinger, programUgeFoerst, fremgangFokus, naesteTraening, personalRecords, repRecords, staevnedagFokus, fremgangLinjer, mobilitetFoerPas, mobilitetFokus, kostPerAtlet, blokFremgang, vaerdF6, kostValg.
Kostvalg er kun true for den syntetiske atlet.

Coachprops: programCopyEnabled, coachPlanCopyEnabled, blokFremgang, coachFourWeeksEnabled, coachTemplateMessages, coachCalendarEvents.

URL: appE2E2=1, appRel3=1, coachRyd=1, coachUge=1, analyseSamlet=1, analyseSammenlign=1, appData2=1.

Hukommelseslager: vc-epik2-playback, entropi:vc-review1, vc_upload_retry_v1.

Tre kodeflag transformeres kun af previewkonfigurationen:
COACH_ACTIONS_ENABLED, VIDEO_QUEUE_FILTER_ENABLED og DEFAULT_VIDEOCOACH_FORENKL4.
COACH_NOTE_SIGNAL_ENABLED følger den eksisterende lokale e2e-gate.
Produktionsindgang, standarder og normal konfiguration er uændrede.

Hermetiske appprøver efter patch: `node --test src/fridayPreview.test.js src/fridayPreviewReview.test.js src/fridayPreviewFunctions.test.js src/fridayPreviewMarkers.test.js`.
Workerkopier: `node --import ./worker-register.mjs --test fridayPreview.test.js fridayPreviewReview.test.js fridayPreviewFunctions.test.js fridayPreviewMarkers.test.js worker-dom.test.js worker-exact.test.js`.

## Kontrolgraenser

Previewet bruger configFile:false og overtager ikke base, define eller target fra
appens Vite-konfiguration. vite.config.js og index.html er ikke pinnet.
React-montering og visuel kontrol af alle motiver afventer Dhurvas kontrol.
Syntetiske elementtraeer og adapterkald erstatter ikke den kontrol.
Coachens funktionskald, herunder draft-next-week, afvises med PREVIEW_ONLY.
Tidsmarkeringsmotivet bruger en syntetisk stillbilledplads, aldrig en videofil.
VC-EPIK2-dokumentet indeholder kun deklareret klipmetadata, to kommentarer og
normaliserede tegninger. Hash, størrelse og varighed er pladsholdermetadata,
ikke målte værdier. Der kan ikke afspilles eller eksporteres et videoklip.
Åbn detaljen og brug tidsknapperne eller skyderen. Første markering ved 1 s
og næste ved 4 s viser hver sin kommentar og tegning. Visningen er kun
indsat af den isolerede previewkonfiguration og kræver vc-epik2-playback=1.
Normal app og VC-EPIK2-importafspiller er uændrede.
Previewtransformationen kører før React og afviser ændrede ankerpunkter.


## REB-APP-SAMLET5: samlet fredagspreview paa a10e1041

De 16 eksisterende motiv-ID'er bevares. rel1030=1 aktiverer nu ogsaa
analyseConclusion, mobilitetCoach og mobilitetHjemme. Uden tilvalg er alle tre
fortsat OFF. De to mobilitetsprops kraever boolsk true; analyseConclusion=1
kan bruges alene. Previewprops aktiverer begge mobilitetssider eksplicit.

coach-dagsliste viser nu Arbejdsindbakke som start. coach-oprydning finder
Coach. som styled div eller Arbejdsindbakke. som heading. coach-atletprofil
finder Testatlet i ProfileActions, og viser mobilitetsvalg og hjemmeoevelser.
coach-staevnekalender finder Staevnedatoer. coach-analyse kontrollerer
Konklusion og den lukkede Se grundlaget-fold; eksisterende analyser ligger
under folden. coach-videokoe viser videoer i den faelles Arbejdsindbakke og
kontrollerer Vigtigst nu. Det separate VIDEO_QUEUE_FILTER_ENABLED forbliver
OFF; motivet paastaar derfor ikke at vise filterets Videokoe-heading.

videocoach-tidsmarkeringer finder den faktiske status 4.0 s / 8 s efter
markeringsklikket og kontrollerer derefter kommentaren. Ingen video maales.
atlet-hjem indeholder nu hjemmeoevelseskortet; uden lokal tildeling vises den
aerlige tomtilstand. Bibliotek og fokusrutine beholder deres eksisterende vej.
APP-MOB6 gemmer kun lokalt i denne browser, og previewets hukommelseslager
nulstilles ved ny side. Coachvalgets backend-skrivning er stadig afvist i
det skrivebeskyttede syntetiske preview. Ingen produktstandard aendres.

Kun syntetiske selector- og modulproever er koert af worker. Fuld operatorsuite,
build, browserlayout og faktiske billeder skal verificeres separat.
