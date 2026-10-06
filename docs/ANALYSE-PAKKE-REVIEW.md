# Lokal analyse-pakke i Entropi Coach (ordre 1139)

Branch: `codex-d5`, base `ordre-1092` / `0b8cf855`.
Lokale, ikke committede filer. Ingen push, merge, migration eller deploy.

Coachen vaelger en JSON-fil under **Fart og tab** i det eksisterende review.
Indlaesningen bruger kun `File.text()` og komponentens hukommelse. Den
gemte analyse, feedback, baseline og delehandling faar aldrig pakken.
Pakken nulstilles ved fjernelse, lukning og skift af maaling. Ingen
automatisk kobling til atlet, vaegt eller saet; coachen kontrollerer selv
loeft, dato og reps. Fejlet ny indlaesning fjerner den tidligere visning.

`analysePakke.js` er ren bortset fra den eksplicitte lokale fillaeser.
Validatoren spejler `video/pakke.mjs::valider` og tilfoejer sikre fejl for
null-elementer, ukendt skala/seed, ikke-tekstlige graenser og store lister.
512 KB filgraense, hoejst 1000 elementer pr. liste, 4000 tegn pr. tekst.
Ukendte felter ignoreres. Ingen nye afhaengigheder.

Fartabellen i `public/videocoach.html` er trackerens DOM-kode og genbruges
ikke ved at koble reviewet til trackeren. Reviewet bruger pakkens tal
direkte; ingen genberegning. `null` vises som `-`, maalt nul som `0,0`.
Alle saet vises. Fund er forslag med sikkerhed; lav sikkerhed er nedtonet.
Raa skala, seed, `ikkeRegnet` og `forbehold` vises.

## Reproducer beviset

Fra dette worktree, med de eksisterende lokale afhaengigheder:

```powershell
node scripts/byg-analyse-pakke-fixture.mjs C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva/video/pakke.mjs
node --test src/dashboard/analysePakke.test.js
$tests = Get-ChildItem src,public -File -Recurse -Filter '*.test.js' | ForEach-Object { $_.FullName }
node --test @tests
npm run lint
npm run build
node scripts/verify-analyse-pakke-review.mjs
git diff --check
```

Fixturegeneratoren laeser kun loeftmodellens pakke-builder. Den skriver
syntetiske kilder i `outputs/1139/pakke-kilde` og en genereret, transportabel
JSON i `test/fixtures/analyse-pakke/syntetisk.json`. Ingen personer/billeder.
Browserproeven kraever den allerede installerede Playwright-runtime i
`~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`.
Den starter en lokal Vite paa port 5197 med `envDir: false` og stopper den
igen. Den virkelige VideoReviewModal monteres med syntetiske props og
stub-handlinger; ingen login, database eller .env-filer.

Bevis: `outputs/1139/browser.json`, `pakke-390.png`, `pakke-1280.png`,
`unit-tests.txt`, `lint.txt`, `build.txt`. Skaermbillederne er selve pakkens
afsnit i den rigtige modal. De viser ikke hele dashboard/login-flowet.

## TEST-TJEKLISTE til Marc: 3 trin

1. I lokal Entropi Coach: aabn en maaling i review og vaelg
   `test/fixtures/analyse-pakke/syntetisk.json` under Fart og tab.
   Se tre reps, 0,600/0,900 m/s paa rep 1, streger paa rep 2 og saettab 15,0 %.
2. Kontroller raa-skala-maerkat, forslag med lav/middel sikkerhed og Ikke
   regnet. Den gemte maalings reps og feedback skal stadig vaere uaendrede.
3. Vaelg en ugyldig JSON: fejl og ingen gamle pakketal. Indlaes derefter den
   gyldige igen, luk reviewet og aabn det igen: pakken skal vaere vaek.

## Graenser

Pakken maaler stangen, ikke kroppen. Ingen teknikdom eller validering af
hastighed mod ekstern maaler. Ingen lagring, atletvisning, programmotor
eller automatisk matching. Makker/Bhishak og Marcs produktgodkendelse
mangler; tekniske tests er ikke en uafhaengig QA-godkendelse.
