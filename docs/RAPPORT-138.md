# RAPPORT 138 — nul advarsler, og træet rent

## Gren

`nul-advarsler`, forgrenet fra `main` (`e1da192`). Tre commits:

- `fb95ff3` — docs(nul-advarsler): dom over de 13 exhaustive-deps-advarsler (commit 1)
- `56ee2ac` — fix(nul-advarsler): ret alle 13 exhaustive-deps-advarsler (commit 2)
- `c2cc3df` — chore(nul-advarsler): ryd de fire faste utrackede poster (commit 3)

## Hvad ændret

**Commit 1** (`docs/HOOKS-ADVARSLER.md`): undersøgte alle 13 `react-hooks/exhaustive-
deps`-advarsler enkeltvis — hvad effekten synkroniserer, hvad der reelt mangler i
dependency-listen, og om der findes et konkret scenarie (bl.a. "skift atlet hurtigt
to gange") hvor den nuværende kode viser forældede data. Ingen rettelser i det
commit.

Ærligt resultat: **alle 13 lander på dom (b) — bevidst udeladt og harmløst.** Ingen
er en reel (a)-risiko, ingen er en (c)-effekt der egentlig er en event-handler. Ni
af de 13 skyldtes samme mønster: koden tjekkede et bart objekt (`if (athlete)` /
`&& selectedAthlete`) mens dependency-listen kun havde `athlete?.id` /
`selectedAthlete?.id` — ESLint ser korrekt disse som to forskellige afhængigheder,
selvom kun `.id` reelt bruges. De resterende fire er enten "kør kun ved mount"
(afhænger af props/session der er faste for komponent-instansens levetid) eller
funktioner der udelukkende læser deres egne parametre (eller reaktivt state
synkront i samme kørsel, aldrig en ældre closure). Begrundelsen for hver af de 13
står linje for linje i `docs/HOOKS-ADVARSLER.md`.

To ting bekræftede at ingen "hurtigt atlet-skift"-race findes: AthleteView
genmonteres altid ved atlet-skift (bekræftet i `src/App.jsx` — coach-preview og
egen-visning skifter aldrig atlet på en levende instans), og Dashboards
beskeder-effekt (`fetchMessages`) har allerede en ref-baseret stale-guard
(`messageThreadAthleteRef`) der beskytter mod netop det scenarie.

**Commit 2** (`src/AthleteView.jsx`, `src/Dashboard.jsx`): rettede alle 13 uden at
ændre nogen funktionalitet.
- 9 steder: `athlete` / `selectedAthlete` → `athlete?.id` / `selectedAthlete?.id` i
  guard-betingelsen. Ingen `eslint-disable` nødvendig her — koden blev bare gjort
  konsekvent med det den allerede afhænger af. De eksisterende `athlete.id`-kald
  inde i effekterne er urørte (flere verify-scripts matcher dem ordret).
- 4 steder: `eslint-disable-next-line react-hooks/exhaustive-deps` med en
  begrundelse på linjen (mount-once fetches, og to steder hvor de kaldte
  funktioner er rene ift. deres parametre eller læser state synkront).

**Commit 3** (`.gitignore`, `docs/videocoach/ENT0092-AUDIT-EE6D8A8.md`): de fire
faste utrackede poster afgjort hver for sig:
- `docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` → **committet**. Den hører til samme
  nummererede audit-serie som `ENT0093/094/095`, der allerede er committet i
  `a4d3a16`; den manglende fil var en oversprunget commit fra en tidligere
  session, ikke en forældet rapport. Dommens kerne (ingen menneskemærkede
  dødløft-labels findes til at afgøre `ee6d8a8`) er stadig sand i dag.
- `drafts-2026-08-10/`, `drafts-2026-08-17/`, `drafts-2026-08-31/` → **ignoreret**.
  Indeholder atlet-json/-sql pr. dato (Marcs egne kladder) — persondata, må ikke i
  det offentlige repo. Lagt ind som `drafts-*/` i `.gitignore`, samme sted og
  begrundelse som de eksisterende `supabase/marc-*`-mønstre. Intet slettet, intet
  læst ud over filnavne (som heller ikke er gengivet her).

Rørt ingenting i `videocoach.html` eller `scripts/verify-videocoach-clip.mjs`
(Bhishaks område).

## Testresultat

- `npm run lint`: **0 advarsler, 0 fejl** (var 13 advarsler).
- Alle **32** `verify:*`-scripts: grønne (kørt enkeltvis, listen matchet mod
  `package.json` for at bekræfte antallet).
- `git status --short`: tomt, rent træ, på `nul-advarsler`.

## Hvad er næste

- Marc merger `nul-advarsler` til `main` når han er klar; ingen push herfra.
- Ingen åbne tråde fra denne ordre — alle tre commits er afsluttede og grønne.
- Hvis en fremtidig ordre tilføjer nye effekter: mønstret fra commit 2 (brug
  `?.id` konsekvent fremfor et bart objekt-tjek) er nu etableret to steder i
  kodebasen og kan genbruges uden ny diskussion.

## Ærlige grænser

- Jeg har ikke selv kørt appen i browseren (headless eller på anden vis) — dette
  var en hooks-/dependency-gennemgang og lint/verify-verifikation, ikke en UI-
  ændring. Ingen af de 9 restruktureringer ændrer betinget logik (kun hvornår en
  effekt kører ift. et allerede-tracked id), så risikoen for visuel regression
  vurderes meget lav, men er ikke visuelt verificeret af mig.
- Dommen "alle 13 er (b)" er baseret på statisk kodelæsning og de eksisterende
  ref-baserede guards (fx `messageThreadAthleteRef`) — ikke på en kørende
  reproduktion af "skift atlet hurtigt to gange" i en rigtig browser. Hvis Marc
  vil have det bekræftet med egne øjne, er Dashboards beskeder-fane
  (`activeTab === 'beskeder'`) med hurtige klik mellem to atleter det oplagte
  sted at prøve.
- Jeg har ikke læst indholdet af `drafts-*/`-filerne ud over filnavne — det var
  nok til at afgøre at de indeholder persondata og skal ignoreres, og
  hård-reglen om ingen atletdata i rapporter/filer betyder jeg bevidst ikke er
  gået dybere.
- Delmål-relevans for Hara: dette er ren hygiejne (nul lint-advarsler + rent
  træ) uden ny synlig funktionalitet for atleter eller coach — indirekte
  relevant for "Appen mærkbart bedre" (fjerner en klasse af stale-closure-risiko
  og gør fremtidige ordrer nemmere at levere rent), men ikke i sig selv en
  mærkbar forbedring en bruger vil opleve.
