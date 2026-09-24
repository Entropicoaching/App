# Rapport: ORDRE 343 (Bhishak, kritiker paa skak-udseende og matematik)

## Gren
Gren `kritik-skole-2` (fra `main` `abe41bd`).
- Commit 1 `79b15f1`: blok 1, skak (script `scripts/kritik-skole-2.mjs`, `verify:kritik-skole-2`, skak-skaermbilleder)
- Commit 2: blok 2, matematik + `docs/skole/KRITIK-335-329.md` + denne rapport (hash i `git log`; et commit kan ikke nævne sit eget)

## Hvad ændret
Intet, kritik. Kun nye filer: testscript, skaermbilleder/maalinger/fund i `outputs/kritik-skole-2/`, `docs/skole/KRITIK-335-329.md`, denne rapport og een linje i `package.json`. Skak- og matematik-repoet er urørt (kun laest og koert headless).

Kort resultat (fuld liste med alvor i `docs/skole/KRITIK-335-329.md`):
- **Skak: klar til Marc paa tavle/pc, ikke paa telefon.** Alle 312-fund er lukket (drag afvises nu med besked). Nyt udseende er et tydeligt spring, men koordinaterne kan ikke laeses (10,5 px, kontrast 2,4:1), groen pil forsvinder paa groent braet, tegnevaerktoejet staar over braettet i alle faner, og knapraekken under braettet er uden for skaermen paa 1280x800. `skak.html` mangler stadig viewport-meta (telefon: tekst ca. 4 px).
- **Matematik: klar til Marc.** Kort roligt og uden overlap; journalens overskrift "5 af 5 steder aabne" kan laeses som "faerdig"; Moellen-knappen sidder i kortkanten. Den uforkortede broek kan ikke ses live (0 af 24 broekopgaver; generatoren filtrerer den fra).

## Testresultat
`npm run verify:kritik-skole-2` (een kommando): koerer til ende, exit 0; tre koersler af skak (tavle 1280x800, telefon 390x844, telefon med testet viewport-meta) og to af matematik (390 og 1280). Konsollen tom i alle fem. `fund.json` indeholder scriptets automatiske fund (viewport-meta og trykflader paa telefon); resten af fundene er fra skaermbillederne og `maalinger.json`. `npm run lint` koert (se afsnittet om graenser).

## Hvad er næste
Bhishak/Vaidya kan rette skak-punkterne 1-6 i en ordre (mindste gevinst foerst: viewport-meta, koordinater 14 px+, roed standardfarve paa pil, skjul tegnevaerktoej uden for Opstil). Matematik: overskriften i journalen og Moellens plads paa kortet.

For Hara (Coaching-planeten er ikke berørt; Skole-planeten, spor "Skakbraettet frit braet og opgaver til undervisningen"): begge spil er klar til at blive vist for Marc, med de to forbehold ovenfor. Duta bedes lade det staa i afleveringen.

## Ærlige grænser
- Kun Chromium headless; ingen Edge, tavle, skaermlaeser eller rigtig telefon. Telefonfundet (viewport-meta) er udledt af emulering, men skak.html har ingen viewport-tag (`grep` = 0).
- Kontrastmaalingen ser kun paa tekstnodens egen baggrundsfarve.
- Ikke set: Lygten/gamle gang, Sporvognen, skak-gaadebankens loesning, brikkernes saet-ned-animation.
- Mit script blev under udviklingen rettet til at bruge Playwrights `tap()` i stedet for hand-skaleret CDP-touch (det ramte ved siden af paa 0,4-skaleret side); drag bruger stadig CDP-touch og virkede.
- Eldre skaermbilleder i `outputs/kritik-skole/` (kritik 322) blev overskrevet af en tidligere koersel i vinduet; jeg gendannede dem foer commit.
