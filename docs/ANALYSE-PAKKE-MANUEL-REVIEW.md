# Entropi Coach: manuel lokal analyse i review (ordre 1210)

## Tre linjer til Marc

Du ser fart pr. rep og farttab foerst, derefter fund som forslag; atlet og kg skriver du selv.
Fra dette worktree: `node scripts/preview-analyse-pakke-manuel-review.mjs`, aabn den viste lokale adresse, tryk Hent analyse og vaelg `test/fixtures/analyse-pakke/syntetisk.json`.
Skriv fx Test og 82,5 kg, se 15,0 % saettab, og genindlaes: analyse og felter er vaek; stop serveren med Ctrl+C.

## Afproevning uden opsaetning af produktion

Worktree: `C:/Users/Entropi/Desktop/entropi-app-wt-codex-d5`, branch `codex-d5`.
Brug allerede installerede dependencies. Previewet bruger den eksisterende
syntetiske rig med den rigtige VideoReviewModal, uden Dashboard/login/database.
Serveren er kun paa loopback 5211. Vite laeser hverken config eller env-filer;
en load-vagt stopper produktions-transporten. Ingen riktig video eller atletdata.

Hent analyse vaelger en lokal JSON-fil, hoejst 512 KB. Felterne er fritekst og
tal med decimaler. De starter tomme og bliver ikke udfyldt fra atletprofil,
maaling, filnavn eller pakke. En ny fil og Fjern lokal pakke rydder dem.
Luk, skift af review og genindlaesning rydder hele den lokale tilstand.
Ingen callbacks eller storage kobler felterne til gem/godkend/del.
Den eksisterende gemte maaling og feedbackflow er fortsat selvstaendige.

## Reproducer beviset

```powershell
node --test src/dashboard/analysePakke.test.js
node scripts/verify-analyse-pakke-manuel-review.mjs
$reviewTestFiles = Get-ChildItem src,public -Recurse -Filter '*.test.js' -File | ForEach-Object { $_.FullName }
node --test --test-concurrency=1 $reviewTestFiles
node scripts/build-analyse-pakke-manuel-review.mjs
node node_modules/eslint/bin/eslint.js src/dashboard/AnalysePakkeReview.jsx scripts/verify-analyse-pakke-manuel-review.mjs scripts/build-analyse-pakke-manuel-review.mjs scripts/preview-analyse-pakke-manuel-review.mjs
git diff --check
```

Browserproeven bruger rigtig App -> Dashboard -> review med de eksisterende
syntetiske fixtures og mocktransport. Loopback-porte 5210/8996 skal vaere ledige.
Den stopper selv sine servere. Eksternt net afvises foer App aabnes, service
workers blokeres, og produktionsauth/transport erstattes foer indlaesning.
Under lokal genindlaesning af pakke og feltredigering afvises ALLE requests;
testen kraever nul forsoeg. Local/sessionStorage sammenlignes, og mockens
oprindelige maalinger skal forblive identiske. Tre senere syntetiske PATCH fra
feedback/godkend/del maa kun have oprindelige reviewfelter, aldrig lokal atlet,
kg eller pakkedata. Genindlaesning kraever nyt syntetisk login, da test-auth
ikke persisterer sessionen.

Bevis: `outputs/1210/browser.json`, `mock-calls-{390,1280}.json`,
`pakke-{390,1280}.png`, `review-{390,1280}.png`, `suite.txt` og `build.txt`.
De 25 checks pr. bredde inkluderer decimal-kg, feltreset, genindlaesning,
null/maalt nul, alle saet/fund og ingen vandret overflow. Lange inputvaerdier
maa rulle inde i feltet; selve feltets ramme skal passe i modalen.
Eksisterende outputs/1139 og outputs/1146 bevares.

## Graenser

Buildet bruger testtransport og configFile/envDir false. Det er et komplet
frontend-build med syntetisk transport, ikke et produktions-releasebevis.
Ingen Supabase- eller skemaaendring, commit, push, merge eller deploy.
Ingen uafhaengig QA eller fysisk kalibrering af fart. D5 som samlet
atlet-/motorintegration er fortsat aabent; fund er forslag til coachen.
