# Hvad jeg fravalgte (Ordre 225) — til Dhruvas næste ordre

## Commit 3 — billigere genfinding: IKKE forsøgt, fordi tallene ikke bærer premissen

Ordren beder om at afprøve ÉN afgrænsning af `plSearch`s gitter (færre
kandidater pr. kald, eller kald hvert andet billede) BAG ET FLAG, "hvis
commit 1 viser at gitteret er dyrt fordi det søger for bredt eller for
ofte". Commit 1's egne tal (se `docs/RAPPORT-225.md`) viser det MODSATTE:

- `marc-doedloeft-270.mov`: 8 `plSearch`-kald i alt (2 kalibrering, 6
  hjemme-genfinding), 460ms samlet, 57ms/kald i snit.
- `vis-mig-nu-4-reps-realistisk.mp4` (4 reps, langt flere tabsepisoder): 115
  kald, 6125ms samlet, 53ms/kald i snit — MEST af dette (113 kald) er én
  enkelt, ægte lang tabsepisode (`t=8.2-11.3s`) hvor genfindingen forsøger
  igen og igen uden held, indtil commit 2's loft stopper den.

57ms/kald og en gennemsnitlig gitterstørrelse på ~618 punkter er ikke "dyrt"
i nogen målestok der forklarer et hæng på flere minutter — selv 113 kald i
træk (den værste observerede serie) koster kun ~6,1s samlet. At gøre
gitteret 2-4x billigere ville spare et par hundrede millisekunder på det
værste klip i denne ordre — ikke den slags forskel der afgør om en coach
oplever et hæng eller ej.

**Den faktiske rodårsag (se commit 2 i `docs/RAPPORT-225.md`) var slet ikke
en dyr søgning: det var en fejlmåling.** `e2e/coach-sporing.spec.mjs`s egen
`confirmAndWaitForTracking` genkendte kun to bestemte banner-tekster som
"færdig" og ventede derfor for evigt på et rigtigt klip, der i virkeligheden
allerede var færdigt (efter ~21-46s, ikke minutter) og havde åbnet
analyse-arket stille via en tredje, ikke-genkendt vej. Rettet i commit 2.

**Konklusion: ingen ændring af `plSearch`s gitterstørrelse eller
kaldsfrekvens.** At indsnævre et allerede billigt, velfungerende gitter bag
et flag ingen nogensinde ville slå til (fordi der intet problem er at løse)
er ren spildt kompleksitet — præcis den slags "ændring uden måling der bærer
den" ordren selv advarer imod. Hvis en FREMTIDIG ordre finder et klip hvor
`plSearch` rent faktisk dominerer den samlede tid (fx et klip med
langt flere, langt hyppigere tabsepisoder end de to her), er
instrumenteringen fra commit 1 (`plSearchProbe`, pr.-tag/pr.-sekund) allerede
på plads til at bevise det først.

## Beskeden ved et reelt tab er sjældent synlig i praksis (ærlig grænse, ikke fravalgt)

Commit 2's "Stangen blev tabt ved rep X · klip fra Ys eller klik stangen
igen" vises KUN når `runFullAnalysis` finder `!tracked || !usableRep` — dvs.
kun hvis INTET brugbart rep kunne udledes af de data der blev sporet før
tabet. På begge rigtige testklip i denne ordre var der ALTID mindst ét
brugbart, delvist rep tilbage, så coachen så det normale analyse-ark, ikke
denne besked. Det er den rigtige prioritering (et brugbart resultat slår en
fejlbesked), men betyder at beskeden reelt kun rammer den smallere sag: tabt
stang FØR noget som helst brugbart rep er nået (fx allerede i rep 1, tidligt
i et sæt). Ikke verificeret med et klip der rammer denne sag i denne ordre —
ville kræve et klip konstrueret til at tabe stangen tidligt.
