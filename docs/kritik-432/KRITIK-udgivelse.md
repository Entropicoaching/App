# Kritik af udgivelsesgrenen `udgivelse-squat` (be28ed5), før Marc trykker deploy

**Klar til deploy: nej, fordi pushet gør Marcs private arbejdsspor offentligt og ikke kan trækkes tilbage: seks HTML-kommentarer i artiklens kilde fortæller, hvad Marc ikke svarede på, og peger på `outputs/SVAR-squat.md`, som følger med sammen med 1.485 andre arbejdsfiler. Deploy-kommandoerne i RAPPORT-430 stopper desuden ved merge. Selve artiklen er klar. Rettelserne tager Setu ca. 20 minutter, og derefter er svaret ja.**

## Fundlisten

Alvor: **blokerer** (skal rettes før deploy), **vigtigt** (en kritiker eller Google finder det), **irriterer**, **kosmetisk**. D er nye fund i 432. N, F og Q er fund fra 394.

| Nr. | Fund | Sted | Alvor | Hvem retter |
|---|---|---|---|---|
| D1 | Seks HTML-kommentarer står i artiklens kilde, alle interne. Et par eksempler: "Marc svarede ikke på tone (samtale eller briefing) eller på et eget øjeblik hvor han indså det. Derfor er introen holdt neutral", "Marc svarede ikke på om han selv har skiftet stangplacering. Ikke digtet ind" og "brødteksten er skrevet ud fra Marcs stikord (outputs/SVAR-squat.md ...)". Alle kan se dem med "Vis kilde". | `artikel-squat.html` linje 6, 49, 389, 430, 703 og 710 | **blokerer** | Setu: slet de seks kommentarer. `faser:start/slut` og `stang:start/slut` er scriptmærker og kan blive |
| D2 | Pushet lægger 1.540 nye filer ud, og 1.486 af dem ligger i `outputs/`. Sitet serverer hele repoet (`/outputs/RAPPORT-174.md` svarer 200 i dag), og repoet er offentligt på GitHub. De offentlige filer i `outputs/` går fra 15 til 1.501. Heriblandt er `SVAR-squat.md` ("Skrevet ned af Dhruva efter Marcs egne ord ... der må IKKE digtes"), `SVAR-squat-2.md` og `RAPPORT-289.md`, som beskriver, hvordan brødteksten er sat sammen. 24 filer har interne navne. Når det først er pushet, ligger det i historikken. En `git rm` bagefter fjerner det ikke. Setu skriver "som ved tidligere deploys", men dengang var det 15 filer. | hele grenen | **blokerer** | Setu: en udgivelsesgren fra `main` med én squash-commit, der kun rummer sidens filer (se "Til Setu"). Alternativt skal Marc sige ja til, at arbejdssporet er offentligt |
| D3 | Deploy-kommandoerne kan ikke køre. `C:\Users\Entropi\Desktop\entropi-coaching-site` har to usporede filer, `outputs/artikel-squat/desktop.png` og `mobil-390px.png`, med andet indhold end grenens. Derfor stopper `git merge` med "untracked working tree files would be overwritten". Mappen står på `artikel-skabelon`. `git merge-tree` er rent, så indholdet konflikter ikke. | deploy-mappen | **vigtigt** (forsvinder med D2's rettelse) | Setu i den nye vejledning. Ellers flytter Marc de to PNG'er væk først |
| D4 | `datePublished` er 2026-09-21. Artiklen går live på deploydagen. | ld+json | irriterer | Setu: sæt den til deploydagen |
| D5 | Metabeskrivelsen er 209 tegn (RAPPORT-430 siger 219). Google klipper ved ca. 155 midt i "ændrer". Titlen er 88 tegn, og Google viser ca. 60, så " \| Entropi Coaching" og "fra opstilling til lockout" falder væk. | `<head>` | irriterer | Marc (hans formulering). Forslag: stop beskrivelsen efter "ankel ændrer positionen" |
| D6 | Knappen "Kapitler 06/08" står fast nederst til højre og dækker kolonnen "Afvigelse" i kapitel 6's tabel på 390. Man kan rulle forbi den. | kap. 6 på 390 | kosmetisk | Setu (evt. `padding-bottom` på tabellen) |
| D7 | "< Artikler" og "Tilbage til artikler" peger på `viden.html#artikler`, og dér står squat-artiklen ikke. Det gælder alle artikler og er ikke nyt. | nav og bund | kosmetisk | Setu, senere |
| D8 | Delingsbilledet har fire mørkegrå figurer på næsten sort baggrund og ingen tekst. Som thumbnail i Messenger bliver det dunkelt. | `assets/squat-deling.png` | kosmetisk | Yantra/Setu, hvis Marc vil |
| D9 | Deload-kortet lige over squat-kortet på `artikler.html` har en tankestreg. Det er ikke nyt. | `artikler.html` | kosmetisk | Setu |
| Q17 | Marc er næsten fraværende i kapitel 1-3 og 6-7 | hele | venter på Marc | Marc |
| Q22 | Fire `[MARC: ...]` er skjult med `skjul-marc` | kap. 1 og 7 | venter (med vilje) | Marc |

**Lukket siden 394:**
- N2: kapitel 5's mærker er 12 px på 390 og 11,4 px på 1280.
- N3, N4, N5 og N6: den gamle tekst er væk.
- Q21: ingen trykflader under 44 px.
- F1-F4, F6 og F7 er stadig lukket.
- Alle 20 Q-tjek og A1-A7/K6 er lukket mod `udgivelse-squat` og løftmodellen 7e3ef64. Kapitel 6's tabel har 0 forskelle.

**Ikke genmålt, set på billederne:** F5, F8, F9, F10 og N1 er Yantras 408-rettelser. Figurbillederne i `outputs/kritik-432/fig-*` er ikke dårligere end i 394. Jeg har ikke vurderet dem enkeltvis igen.

## Det der holder

- **Den skjulte MARC-tekst efterlader ingen huller.** Alle fire bokse er `display:none` på 390 og 1280. Tre står sidst i deres afsnit, og alle fire afsnit slutter med punktum. Boksen midt i afsnittet i kapitel 1 efterlader hverken dobbelt mellemrum eller et løst tegn. `[MARC` står 0 gange i den viste tekst.
- **Artiklen:**
  - 0 konsolfejl og ingen vandret rulning på 390 og 1280.
  - 19 folde åbner.
  - 0 tankestreger, 0 "man skal", 0 udråbstegn og 0 interne navne i den viste tekst.
  - Forbeholdet står sidst.
  - 9.017 ord med foldene åbne. "44 min. læsning" passer.
- **Kapitelmenuen:**
  - På 390 åbner knappen (48 px) menuen, og menuen lukker ved valg.
  - Kapitel 6 lander 76 px under toppen efter den bløde rulning, og knappen skifter til 06/08.
  - På 1280 står menuen fast ved siden af teksten uden at overlappe den.
- **Delingskortet:**
  - Alle 8 `og:*` er udfyldt, og `twitter:card` er `summary_large_image`.
  - Billedet er 1200x630 og 28 kB.
  - Canonical er rigtig, og der er ingen `robots`-meta.
- **Sitemap og links:**
  - Sitemappet har 15 URL'er, alle med fil, og artiklen er med.
  - De tre noindex-sider (skabelonen og de to dødløft-sider) står ikke i sitemappet og linkes ingen steder fra.
  - Kortet står som nr. 6 af 6 på `artikler.html` og åbner artiklen.
  - Forsiden er uændret.
- **Atletnavne:** 0 i artiklen og 0 i de 167 nye tekstfiler. Kontrollen brugte 3 fornavne, der hentes ved kørslen og ikke skrives ud.

## Til Setu (hvis Marc siger ja til rettelserne)

1. Slet de seks HTML-kommentarer i `artikel-squat.html` (D1). Gør det samme med de to, der peger på `outputs/RAPPORT-271.md` i dødløft-siderne.
2. Lav `udgivelse-squat-ren` fra lokal `main` med én squash-commit (D2). Den skal kun rumme det, siden bruger:
   - `artikel-squat.html`, `artikler.html` og `sitemap.xml`
   - de nye filer i `assets/`
   - evt. `docs/UDGIV-ARTIKEL.md`

   `outputs/` og `scripts/` fra 289-430 bliver på `udgivelse-squat` lokalt. Kontrollér med `git diff --stat origin/main udgivelse-squat-ren`, og kør linktjekket igen.
3. Sæt `datePublished` til deploydagen (D4).
4. Skriv deploy-kommandoerne om, så de peger på den nye gren (D3 forsvinder, fordi PNG'erne ikke er med).
5. Lokal `main`'s syv commits fra 257/271 har selv `outputs/RAPPORT-257.md`, `RAPPORT-271.md` og `MAAL-LIVE.*` med. Marc bør vide, at de også bliver offentlige.

## Grundlag

- **Kørslen:** `npm run verify:kritik-432` (`outputs/kritik-432/kritik-432.mjs`) er `scripts/kritik-394.mjs` uændret for blok 1 og 2 mod `udgivelse-squat` be28ed5 og løftmodellen 7e3ef64. Blok 3 er ny.
- **Browseren:** headless Chromium på 390x844 (touch, 2x) og 1280x900.
- **Sitet:** trækkes ud med `git archive` og serveres lokalt. Deploy-mappen læses kun med `git status`, `git hash-object` og `git merge-tree`.
- **Hvad scriptet skriver:** kun i `outputs/kritik-432/`.
- **Hvad der er min læsning:** fundene D1-D9 og deres alvor, ikke scriptets. Intet er rettet i sitet.
