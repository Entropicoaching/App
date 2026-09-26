Ordre 432

Squat-opslagsværket før Marc trykker deploy: hele udgivelsesgrenen læst som læser, coach og Google (Bhishak)

## Gren

- **Gren:** `kritik-432` i `C:\Users\Entropi\Desktop\entropi-app-kritik`, lavet fra app-`main` 59afda2 (med kritik-427 merget). Ikke pushet.
- **Commit 1** `7d7c29c`: `outputs/kritik-432/` (script, målinger, skærmbilleder) og `verify:kritik-432` i `package.json`.
- **Commit 2:** `docs/kritik-432/KRITIK-udgivelse.md` og denne rapport.
- **Sitet** (`entropi-coaching-site-wt2`, `udgivelse-squat` be28ed5) er kun læst. Deploy-mappen `entropi-coaching-site` er kun læst med `git status`, `hash-object` og `merge-tree`.

## Hvad ændret

- **`outputs/kritik-432/kritik-432.mjs`:** `scripts/kritik-394.mjs` kopieret med ny gren (`udgivelse-squat`), løftmodel (7e3ef64, som Setu i 430) og udgang (`outputs/kritik-432/`). Blok 1 (figurer) og blok 2 (artiklen, Q1-Q22, A1-A7, K6, stil) er uændret. Blok 3 "udgivelse" er ny og måler:
  - head og delingskort (titel- og beskrivelseslængde, `og:*`, ld+json, billedets mål)
  - HTML-kommentarerne i kilden
  - sitemap og noindex-siderne, og om de linkes
  - forsiden, `artikler.html` og `viden.html` på 390 og 1280, og om kortet åbner artiklen
  - de fire skjulte MARC-bokse, og om afsnittene hænger sammen uden dem
  - kapitelmenuen: åbner, lukker og lander rigtigt efter blød rulning
  - N2-N6 fra 394
  - hvad pushet gør offentligt, med tjek for atletnavne (navnene skrives ikke ud)
  - om Setus deploy-kommandoer kan køre
- **`docs/kritik-432/KRITIK-udgivelse.md`:** fund øverst og dommen.
- **Dom:** klar til deploy: nej, fordi pushet gør Marcs private arbejdsspor offentligt og ikke kan trækkes tilbage. Seks HTML-kommentarer i artiklens kilde fortæller, hvad Marc ikke svarede på, og peger på `outputs/SVAR-squat.md`, som kommer med sammen med 1.485 andre arbejdsfiler. Deploy-kommandoerne stopper desuden ved merge. Selve artiklen er klar.

## Testresultat

- **`npm run verify:kritik-432`:** exit 0 (`outputs/kritik-432/resultat.txt`).
- **Blok 1:** 27 figurer og indlejringer i to bredder, plus panel og vælger i brug.
- **Blok 2:** Q1-Q16, Q18-Q21 og A1-A7/K6 er lukket, og Q17 og Q22 venter på Marc. Kapitel 6's tabel har 0 forskelle mod 7e3ef64. Stilen: 0 tankestreger, 0 interne navne, 0 udråbstegn, forbeholdet sidst, 0 konsolfejl og ingen vandret rulning.
- **Blok 3:** 6 FUND-linjer og 22 OK-linjer. FUND er D1-D5 i kritikken: titel, beskrivelse, datePublished, kommentarer, offentlige filer og deploy-kollision.
  - MARC-boksene er skjult uden huller.
  - Kapitelmenuen virker.
  - Sitemap, noindex og delingskort er i orden.
  - Atletnavne: 0.
- **`npm run lint`** kunne ikke køre, fordi worktreen ikke har `node_modules` ("eslint is not recognized"). Ordren rører ingen appkode, kun `outputs/`, `docs/` og én linje i `package.json`.

## Hvad er næste

Svaret er nej, så de få fund går til Setu (detaljer under "Til Setu" i kritikken):
1. Slet de seks HTML-kommentarer i `artikel-squat.html` (D1).
2. Byg `udgivelse-squat-ren` fra lokal `main` med én squash-commit, der kun rummer sidens filer: artikel, `artikler.html`, `sitemap.xml` og `assets/`. `outputs/` og `scripts/` fra 289-430 bliver lokalt (D2).
3. Sæt `datePublished` til deploydagen (D4).
4. Skriv deploy-kommandoerne om til den nye gren. Kollisionen med de to usporede PNG'er (D3) forsvinder så.

Marcs egne valg:
- Titlen er 88 tegn og beskrivelsen 209 tegn, og Google klipper begge (D5).
- Om lokal `main`'s syv commits fra 257/271 (med `RAPPORT-257/271` og `MAAL-LIVE`) også skal være offentlige.
- Vil Marc hellere have hele arbejdssporet offentligt, skal han sige det udtrykkeligt. Så er kun D1, D3 og D4 tilbage.

Efter Setus rettelser: en kort genlæsning af `git diff --stat origin/main udgivelse-squat-ren` og kilden. Derefter ja.

**For Hara (Coaching-planeten, sporet artikler på entropicoaching.dk):** artiklen er klar som indhold. Udgivelsen venter på én oprydning, før den kan gå live i ét trin.

## Ærlige grænser

- **Rollen:** CLAUDE.local.md i denne worktree kalder mig Vaidya og siger, at ordrer til andre navne ignoreres. Marc bad direkte om at udføre ORDRE-Bhishak.md, og worktreen er Bhishaks hjem (kritik-4xx). Jeg fulgte Marcs direkte besked.
- **`package.json`:** ordren siger "filer KUN under docs/kritik-432/ og outputs/kritik-432/". `verify:kritik-432` kræver én linje i `package.json`, som i 394-427.
- **Figurfundene:** F5, F8, F9, F10 og N1 er ikke genmålt enkeltvis, kun set på billederne. Delingsbilledet er kun set som fil, ikke i en rigtig delingstjeneste.
- **Offentlige filer:** at `/outputs/` bliver serveret, er set på to filer, der er live i dag (200). Om GitHub Pages bygger med Jekyll, er ikke undersøgt, men der er ingen `_config.yml`, der udelukker noget.
- **Atletnavne:** tjekket mod 3 fornavne fra app-repoets `.gitignore`. Det er ikke en fuld liste over atleter.
- **Hvad jeg ikke kan vide:** om Marc selv er ligeglad med, at arbejdssporet er offentligt. D1 og D2 er min dom over, hvad en kritiker kan finde, og det er hans valg.
- **Rettelser:** intet er rettet i sitet, og intet er merget, pushet eller deployet.
