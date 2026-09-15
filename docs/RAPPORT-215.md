# Rapport — ordre 215: "Min træning" gjorde ingenting (hastefejl på live)

## Gren

Gren `min-traening-hotfix`, forgrenet fra `main` (`5fe52f5`).

- `0671e92` — commit 1: reproduktion på live (`088ec36`), ingen rettelse
- `2bd1e1b` — commit 2: rettelsen + e2e-prøve
- (denne rapport er commit 3, se hash i `git log` efter commit)

## Hvad ændret

**Fejlen.** Marc klikkede "Min træning" (eller tastede M) som coach, der
også selv er atlet (`entropi_my_athlete_id` i `localStorage` pegede på en
atlet der findes i hans egen atletliste) — intet skete. Reproduceret på
live `088ec36` med midlertidig logning (se `docs/ordre-215-repro.md`, ikke
rettet i den commit): `goToMyProfile` (`Dashboard.jsx`) kaldte
`onPreviewAthlete` korrekt, `App.jsx` satte `previewMode`/`coachAthleteId`
korrekt og re-renderede — men `AthleteView` monterede aldrig.

**Årsag.** `App.jsx` skifter mellem to `<LazyBoundary>`-elementer
(Dashboard/Atletvisning) på SAMME position i træet. React genbruger derfor
selve `LazyBoundary`-instansen ved skiftet, inklusive dens `useMemo` — som
kun havde `retryKey` i sine deps, ikke `factory`/`label`. Da `previewMode`
blev sat, beholdt komponenten det gamle, memoiserede `lazy()`-objekt
(Dashboard-chunken) og blev ved med at rendere Dashboard, nu bare med
Atletvisningens (ubrugte) props — "ingenting" set fra skærmen. Scenariet
hvor atleten IKKE findes i listen (picker-vejen, inde i samme
Dashboard-instans, intet `LazyBoundary`-skifte) var upåvirket.

**Rettelsen** (`src/LazyBoundary.jsx`): `factory`/`label` tilføjet til
`useMemo`'s deps — et skift af lazy-mål giver nu altid et frisk objekt,
uafhængigt af `retryKey`. Én linje reel ændring, resten kommentar.

**E2e-prøve** (`e2e/coach.spec.mjs`, ny `runMinTraeningPreview`, kaldt fra
både filens egen `main()` og `e2e/run-all.mjs`, så `npm run e2e` reelt gater
på fixet): logger ind som coach, sætter `entropi_my_athlete_id` til en
atlet der findes, klikker "Min træning", forventer "← Coach view"
(Atletvisningens egen markør for at preview-visningen rent faktisk er
monteret, ikke bare at state blev sat).

**Til Marc:** knappen "Min træning" virkede ikke fordi appen internt
genbrugte den forkerte, allerede-indlæste skærm i stedet for at skifte til
din egen profil — ingen data gik tabt, ingen atletdata var involveret. Det
er rettet på `main` her og venter på din push.

## Testresultat

- `npm run lint`: grøn, hele repoet.
- Alle 34 `verify:*`-scripts: grønne.
- `npm run e2e`: grøn (inkl. den nye "Min træning"-prøve), ~28s.
- Fixet verificeret direkte mod `088ec36` i en midlertidig worktree (fjernet
  igen): med samme ret ét-linjes ændring monterede `AthleteView` korrekt,
  hvor den før slet ikke monterede — se `docs/ordre-215-repro.md`.

## Hvad er næste

Ingen kendte opfølgninger — fejlen er strukturel (React-reconciliation),
ikke en dybere symptom-liste. Samme mønster (to `<LazyBoundary>`'er, samme
position, forskellig `factory`) findes ikke andre steder i `App.jsx` i dag
(kun dette ene betingede skift), så ingen søsterfejl at rette samtidig.

## Ærlige grænser

- Live-verifikationen (`088ec36`) er gjort i en midlertidig, ikke-committet
  worktree med midlertidig `console.log`-instrumentering — reproducerbar
  (samme trin er nu dækket permanent af e2e-prøven), men selve
  logningskoden er ikke en del af nogen commit.
- E2e-prøven dækker "atlet findes i listen"-vejen (den der fejlede). Den
  gør ikke, og skulle ikke, teste picker-vejen ("atlet findes ikke") — den
  var aldrig i stykker.
- Ikke set af en rigtig, indlogget Marc på ægte produktions-data — kun mod
  mocken, per ordrens egen grænse (ingen produktions-Supabase).

Til Dhruva: 215 klar til merge og push
