# Entropi Coach: lokal Dashboard-proeve (ordre 1146)

Kun syntetiske data og lokale mocks. Ingen credentialfiler, .env-laesning,
persondata, rigtig login, video eller produktionskontakt.
Produktkoden fra ordre 1139 og dens lille modalrig er bevaret uaendret.

## Genstart

Fra `C:/Users/Entropi/Desktop/entropi-app-wt-codex-d5` med de allerede
installerede node_modules og Codex' Playwright-runtime:

```powershell
node --test src/dashboard/analysePakke.test.js
node scripts/verify-analyse-pakke-dashboard.mjs
node node_modules/eslint/bin/eslint.js scripts/verify-analyse-pakke-dashboard.mjs test/analyse-pakke-dashboard/supabase-mock.js
git diff --check
```

Browserproeven starter egen Vite paa 127.0.0.1:5196 og den eksisterende
`e2e/mock-supabase.mjs` paa 127.0.0.1:8996. Begge stoppes efter koersel,
ogsaa ved assertionfejl. Portene skal vaere ledige. Ingen nye dependencies.
`configFile: false`, `envDir: false` og afgraenset dependency-optimering.
Eksternt browsernet blokeres foer App aabnes; service workers er blokeret.
Ingen token eller auth-body skrives i bevisloggene.

App, Dashboard, AnalyseTab, VideoReviewModal og videoReviewHandlinger er
de rigtige produktkomponenter. Mock-login bruger kun fiktiv e2e-konto.
Indgangen er Dashboardets eksisterende "Aabn gemt maaling"-knap.
Den aabner profilen paa Analyse og loader reviewet fra mockens REST-data.
Andre reviews aabnes gennem fanens eksisterende "Gennemgaa maaling"-knapper.

## Testtransportens graense

Vites testplugin erstatter imports af `src/supabase.js`, inden filen laeses.
En load-vagt afviser filen. `test/analyse-pakke-dashboard/supabase-mock.js`
bruger de installerede AuthClient/PostgrestClient/StorageClient mod den
lokale mock. Retry/queue er direkte kald og realtime er inert i proeven.
Der findes ingen rigtig noegle eller produktionsadresse i testtransporten.
Dette beviser Dashboard/review-flowets produktkode og HTTP-payloads, men
ikke produktionsmodulets auth, retry, realtime, RLS eller databasekontrakt.
Der er ingen special-mount af modalen i denne proeve.

## Bevis

`outputs/1146/browser.json`: 17 navngivne checks ved hver af 390/1280 px.
`mock-calls-390.json` og `mock-calls-1280.json`: modtagne lokale kald,
uden auth-kald eller request-headers. Den genererede fixture fra 1139
bruges direkte; ekstra saet med null-tab kontrolleres separat i browseren.

Kontrolleret: 3 pakkereps, 0,600/0,900, null som streger, maalt nul,
saettab 15,0 %, alle fund/graenser og ekstra saet. Ingen vandret overflow
i reviewets elementer, pageerrors eller eksterne requestforsoeg.
Screenshots: `dashboard-{390,1280}.png`, `review-{390,1280}.png` og
`pakke-{390,1280}.png`. Reviewbilledet er den aktuelle synlige viewport;
pakkebilledet viser hele afsnittet. Pakkebilleder er visuelt kontrolleret.

Indlaes/fjern/luk/skift/genaabn giver nul HTTP-skrivekald, ingen
localStorage/sessionStorage-aendringer og identiske mock-maalinger.
Efter skift og genaabning er der ingen pakketable tilbage.
Med pakken stadig synlig bruges rigtig feedback/godkend/del-logik.
Kun tre PATCH-kald: feedback og feedback_version, coach_approved, shared.
Originale reps, metrics, findings, rep_details, bar_path og session_context
bevares. Feedbacken er kun den manuelt indtastede syntetiske tekst.
Den anden maaling er helt uaendret. Intet pakkefund findes i payloads.

`preserved-1139.json` indeholder SHA256 af 11 gamle kilde/fixture/docfiler
foer/efter proeven. Eksisterende outputs/1139 er ikke overskrevet.
Foerste harnesskoersel fejlede ved en foraeldet "Mere"-locator: den
rigtige indgang havde allerede valgt Analyse. Dette var en proevefejl,
rettet uden produktkodeaendring. `failure.json`/`failure-1280.png`
bevarer den foerste fejls evidens; `browser.json` er den endelige dom.

Den gamle `scripts/verify-analyse-pakke-review.mjs` bevares som den mindre
modalregression. 20/20 enhedstests er genkoert foerst; tidligere fuld
suite/lint/build og 42 modalchecks henvises til rapport 1139. Ingen tung
gentagelse: kun testtransport/proeve/dokumentation er tilfoejet her.

## Aerlig afslutning

Teknisk lokal proeve, ingen uafhaengig QA. Ingen commit, staging, push,
merge, migration, deploy, atletvisning eller afsendelse. D5 som samlet
integration og fysisk kalibrering af pakkens tal er ikke godkendt.
Makker/Bhishak reproducerer ovenstaaende, foer Marc vurderer produktet.
