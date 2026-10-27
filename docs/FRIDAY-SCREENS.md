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
| Hjem (athlete) | [atlet-hjem](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=atlet-hjem) | Startvisningen |
| Program næste uge (athlete) | [atlet-program](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=atlet-program) | Mere > Mit program > næste uge |
| Mobilitet (athlete) | [atlet-mobilitet](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=atlet-mobilitet) | Mere > Mobilitet > vælg fokus |
| Fremgang (athlete) | [atlet-fremgang](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=atlet-fremgang) | Fremgang > Styrke, derefter Rekorder |
| Profil (athlete) | [atlet-profil](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=atlet-profil) | Åbn Konto øverst. Basen har kontomenu, ingen særskilt profilside |
| Dagsliste (coach) | [coach-dagsliste](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=coach-dagsliste) | Startvisningen |
| Atletprofil (coach) | [coach-atletprofil](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=coach-atletprofil) | Åbn Testatlet i dagslisten |
| Analyse (coach) | [coach-analyse](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=coach-analyse) | Åbn Testatlet > Analyse > samlet analyse |
| Videokø (coach) | [coach-videokoe](http://127.0.0.1:4173/scripts/friday-preview.html?appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1&screen=coach-videokoe) | Arbejdsindbakke > Videoer |

Profilmotivet er basens Konto-menu, ikke en ny profilside. Videokøen indeholder
en opdigtet kladde uden videofil. Tag køen og filtre, ikke klipafspilning.
Alle skrivehandlinger er afvist. Dette er en skærmgennemgang, ikke en demonstration
af lagring, upload eller deling. Data og lager forsvinder ved genindlæsning.

## Flag i den isolerede previewindgang

Atletprops: enkelPrototype, forenklinger, programUgeFoerst, fremgangFokus, naesteTraening, personalRecords, staevnedagFokus, fremgangLinjer, mobilitetFoerPas, mobilitetFokus, kostPerAtlet, blokFremgang, vaerdF6, kostValg.
Kostvalg er kun true for den syntetiske atlet.

Coachprops: programCopyEnabled, coachPlanCopyEnabled, blokFremgang, coachFourWeeksEnabled, coachTemplateMessages.

URL: appE2E2=1, appRel3=1, coachRyd=1, coachUge=1, analyseSamlet=1, analyseSammenlign=1, appData2=1.

Hukommelseslager: vc-epik2-playback, entropi:vc-review1, vc_upload_retry_v1.

Tre kodeflag transformeres kun af previewkonfigurationen:
COACH_ACTIONS_ENABLED, VIDEO_QUEUE_FILTER_ENABLED og DEFAULT_VIDEOCOACH_FORENKL4.
COACH_NOTE_SIGNAL_ENABLED følger den eksisterende lokale e2e-gate.
Produktionsindgang, standarder og normal konfiguration er uændrede.

Hermetiske appprøver efter patch: `node --test src/fridayPreview.test.js src/fridayPreviewReview.test.js src/fridayPreviewFunctions.test.js`.
Workerkopier: `node --import ./worker-register.mjs --test fridayPreview.test.js fridayPreviewReview.test.js fridayPreviewFunctions.test.js worker-exact.test.js`.

## Kontrolgraenser

Previewet bruger configFile:false og overtager ikke base, define eller target fra
appens Vite-konfiguration. vite.config.js og index.html er ikke pinnet.
React-montering og visuel kontrol af alle motiver afventer Dhurvas kontrol.
Syntetiske elementtraeer og adapterkald erstatter ikke den kontrol.
Coachens funktionskald, herunder draft-next-week, afvises med PREVIEW_ONLY.
Ingen klipafspilning eller delt video indgaar i denne skaermliste.
