# Samlet atletprofil i Entropi Coach

Kontakten er fra som standard. Tilvalget gælder kun den aktuelle browser.
Sæt følgende i browserkonsollen og genindlæs for at afprøve visningen:

```js
localStorage.setItem('entropi_coach_samlet_atletprofil', 'true')
location.reload()
```

Slå fra igen:

```js
localStorage.removeItem('entropi_coach_samlet_atletprofil')
location.reload()
```

Med tilvalget åbner profilen i Program. Status bliver stående over Program,
Log og Beskeder. Manglende statusfelter skjules. Profil, kostmål og øvrige
værktøjer findes under Mere.

Ugen følger dansk tid fra mandag til søndag. Et pas tæller som logget efter
mindst ét sæt. Sprungne sæt tæller ikke som træning. Planlagte pas kræver en
dateret uge. Næste pas kræver også en ugedag og øvelser med manglende sæt.
Der gættes ingen datoer for fleksible pas.

Kostmål redigeres i den eksisterende Kostmål-side. Resuméets Se mål åbner den
side uden at starte redigering. Rediger mål indlæser altid atletens aktuelle mål.

Status bruger eksisterende program, log og beskeder. Seneste ventende video
hentes særskilt for atleten, så den globale køs grænse på 50 ikke skjuler den.
Status hverken sender beskeder, læsemarkerer dem eller ændrer atletdata.

Der er ingen ændringer i schema, miljøfiler eller Supabase-indstillinger.
Med kontakten fra bruges det eksisterende profilhoved og faneforløb.

## Kontrol

```sh
npm test
npm run build
node e2e/samletAtletprofil.test.js
```

Browserprøven starter lokal Vite og en Supabase-mock med opdigtede data.
Den læser ingen miljøfiler. `PLAYWRIGHT_MODULE` og `CHROMIUM_PATH` kan angive
lokalt installeret Playwright og Chromium. Billeder og kontrolresultat gemmes
i `work/samlet-atletprofil`, eller i `COACH_PROFILE_SCREENSHOTS` hvis angivet.

Sæt `PROFILE_BASE_REF` til en tidligere git-reference for også at sammenligne
profilens HTML og skærmbillede med kontakten fra. De skal være identiske.
Prøven dækker 390 px, statusgenveje, kostmål, Mere, videogennemgang, profilskift
og en tom atlet. Alle nye prøver hedder `*.test.js`.
