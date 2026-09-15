# ORDRE 215 — reproduktion (commit 1, ingen rettelse endnu)

Bygget `088ec36` (live) i en midlertidig worktree, kørt mod `e2e/mock-supabase.mjs`
som coach, med `entropi_my_athlete_id` sat til en atlet der findes i listen
(`ATHLETE_ID` fra `e2e/fixtures.mjs`) og til en der ikke gør (opdigtet UUID),
ved 390px og 1280px. Samme test gentaget mod `main` (uændret her, se commit 2).

## Præcis hvilken kombination der giver "ingenting"

**Kun ét scenarie fejler, og det fejler på begge bredder:** `entropi_my_athlete_id`
peger på en atlet der FINDES i den allerede indlæste `athletes`-liste. Da tager
`goToMyProfile` (`Dashboard.jsx`) sin direkte vej — `onPreviewAthlete(myAthleteId)`
— uden om nogen picker. Klik/tast M registreres (bekræftet med midlertidig
logning: `goToMyProfile` kaldes, kalder `onPreviewAthlete` med rigtigt id,
`App.jsx` sætter `previewMode: true` og `coachAthleteId` korrekt, App
re-renderer med de rigtige værdier) — men skærmen forbliver den uændrede
coach-forside. `AthleteView` monterer aldrig (bekræftet: dens eget mount-log
fyrer aldrig).

Scenariet hvor `entropi_my_athlete_id` IKKE findes i listen rammer ikke denne
fejl: `goToMyProfile` går i picker-grenen (desktop: `previewPickerOpen` i
sidebaren; mobil: `menuSheetOpen`-arket) — begge er UI der lever INDE i den
samme, allerede monterede `Dashboard`-instans, ingen `LazyBoundary`-skifte
involveret, og viser sig synligt.

## Årsag (fundet ved midlertidig logning, se commit 2 for selve rettelsen)

`App.jsx` skifter mellem to `<LazyBoundary>`-elementer PÅ SAMME POSITION i
træet (`previewMode ? <LazyBoundary factory={athleteViewFactory} .../> :
<LazyBoundary factory={dashboardFactory} .../>`). React ser samme
komponent-TYPE (`LazyBoundary`) på samme position og genbruger instansen i
stedet for at montere en ny — inklusive dens interne `useMemo`. Den memo
(`LazyBoundary.jsx`) havde kun `[retryKey]` som deps, IKKE `factory` — så da
`previewMode` blev sat, beholdt `LazyBoundary` sit gamle, memoiserede
`lazy()`-objekt (Dashboard-chunken), selvom `factory`/`label`-props allerede
var skiftet til Atletvisningen. Resultatet: `<Comp {...componentProps} />`
blev ved med at rendere Dashboard — med Atletvisningens props
(`role`/`coachAthleteId`/`onExitPreview`) i stedet for sine egne
(`onPreviewAthlete`), hvilket Dashboard ikke bemærker (den bruger dem ikke) —
"ingenting" set fra skærmen.

Verificeret: tilføjer `factory` til `useMemo`'s deps-liste (`[retryKey,
factory]`) i den midlertidige worktree, og `AthleteView` monterer korrekt med
det samme klik. Selve rettelsen — se commit 2.
