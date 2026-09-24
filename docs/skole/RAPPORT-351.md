# Rapport: ORDRE 351 (Bhishak, kritiker paa skak paa telefonen og matematikkens rettede punkter)

## Gren
Gren `kritik-skole-3` (fra `main`).
- Commit 1 `789b4d7`: blok 1, skak (script `scripts/kritik-skole-3.mjs`, `verify:kritik-skole-3`, skak-skaermbilleder paa 390 og 360 px)
- Commit 2: blok 2, matematik-skaermbilleder, `maalinger.json`, `docs/skole/KRITIK-344-345.md` og denne rapport (hash i `git log`; et commit kan ikke nævne sit eget)

## Hvad ændret
Intet, kritik. Kun nye filer: testscript, skaermbilleder og `maalinger.json` i `outputs/kritik-skole-3/`, `docs/skole/KRITIK-344-345.md`, denne rapport og een linje i `package.json`. Skak (`main` `270cd4d`) og matematik (`main` `4faabe0`) er urørt: hver `main` traekkes ud med `git archive` til en midlertidig mappe og koeres derfra.

Kort resultat (fuld fund-liste med alvor i `docs/skole/KRITIK-344-345.md`):
- **Skak: klar til telefonen: ja, med forbehold.** Viewport-fundet fra 335 er lukket: layout 390/360 px, ingen vandret scroll paa nogen skaerm, intet uden for kanten, touch-traek og computer-svar virker (ca. 0,66 s), konsollen er tom. Men i "Laer skak" ser eleven kun et braet; niveauvalget og opgaveteksten ligger under folden (blokerer for en der ikke scroller). Desuden: tegneveaerktoej over braettet i alle faner, tre raekker navigation, "Udseende"/"Brikker"/"Braet" og summary-raekker under 44 px, koordinater paa 9,9 px.
- **Matematik: klar til telefonen: ja.** Journalen siger "0 af 5 steder klaret"; Moellen-knappen er fri af kanten (62 px paa 390, 59 px paa 360) og landsbyen ligger stadig mellem kirken og moellen; af 20 broekopgaver i traek kan 7 (35 %) forkortes og 3 (15 %) viser det uforkortede svar, som faar ros og hint ("Rigtigt! 3/6 kan ogsaa skrives 1/2."). Kun kosmetik tilbage.

## Testresultat
- `npm run verify:kritik-skole-3` (een kommando): koerer til ende, exit 0. Skak paa 390x844 og 360x800 (forside, Laer skak med tre niveauer og spring over, fem traek mod computeren, Opstil, Gaader, laerer-siden), matematik paa 390 og 360 (start, kort med og uden udfoldet klynge, 20 broekopgaver, journal). 52 skaermbilleder; konsol tom i alle otte sessioner.
- `npm run lint`: groen.
- Skak og matematik har egne testsaet; de er ikke koert, fordi intet er rettet dér.

## Hvad er næste
Bhishak/Vaidya kan rette skak-punkterne i en ordre, mindste gevinst foerst: gem tegneveaerktoejet uden for Opstil (fund 2), saet opgaveteksten og niveauvalget oeverst i "Laer skak" (fund 1), 44 px paa "Udseende"-raekkerne, koordinater 14 px+ (fund 5). Matematik: intet kraevende; kosmetik i `KRITIK-344-345.md` (M3).

For Hara: Coaching-planeten er ikke beroert (ingen ændring i appen). Skole-planeten, spor "Skakbraettet frit braet og opgaver til undervisningen": matematik er klar til telefonen, skak er klar med forbehold (Laer skak). Duta bedes lade det staa i afleveringen.

## Ærlige grænser
- Kun Chromium-emulering (isMobile + touch, 2x), ikke en rigtig telefon, Safari eller Firefox; skaermbilleder ikke set paa en fysisk skaerm.
- Kontrasten paa skak-koordinaterne er set paa skaermbillede, ikke maalt denne gang.
- Broekopgaverne: alle 20 kom fra Moellen og er samme raekkefoelge paa 390 og 360 (samme figurnavn, ny profil); spillet er flervalg, saa "4/6 i stedet for 2/3" kan kun testes naar 4/6 er et tilbudt valg. Det skete i 3 af 20 (med 6/8 og 4/8 som de to andre); jeg trykkede altid uforkortet svar foerst, hvor et fandtes.
- "Forkortelig" er min egen taelling: broek i spoergsmaal eller svar der kan forkortes. Jeg har ikke laest generatorens kode.
- Jeg spillede fem traek mod computeren paa "Begynder"; mit fjerde traek paa 390 var ulovligt (computeren havde taget bonden paa d2) - fejl i mit script, ikke appen. Niveauerne Øvet/Stærk og Gaader-loesning er ikke afproevet.
- Ikke set: Kirken, Landsbygaden, Grusgraven, Sporvognen (kun kortet), Lygten, resten af skak-gaadebanken.
- Ingen elevdata; ingen push.
