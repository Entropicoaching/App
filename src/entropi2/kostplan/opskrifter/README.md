# Opskrifter

24 enkle forslag: fire til hver af morgenmad, frokost, aftensmad,
mellemmåltid, før træning og efter træning. Kategorierne er til sortering,
ikke individuelle anbefalinger om timing eller mængder.

Modulet er ikke koblet ind i appen. Coachen og atleten ser derfor ingen ny
visning, handling eller automatisk kostændring. Ingen lagring eller netkald.
Eksisterende adfærd med Entropi 2 slået fra eller til er uændret.

Alle ingredienser er katalog-id'er fra `../foedevarer/`, og alle mængder er
gram af den spiselige del (æg uden skal, tun afdryppet). Ris, pasta, quinoa,
linser og kartofler, som hedder kogt/kogte i kataloget, vejes efter kogning.
Drikkevarer vejes også i gram; der antages ingen omregning fra ml.
De øvrige fødevarers tilstand og næringskilde er ikke konsekvent specificeret
eller verificeret i kataloget. Opskrifterne viderefører denne begrænsning og
tilføjer ingen næringstal eller påstand om verificeret rå/tilberedt grundlag.
Tilberedningsvejledningen ændrer ikke katalogets næringsdata.
Eventuelt ekstra tilbehør indgår ikke i de beregnede mængder.

```js
import { RECIPES, sumRecipe, scaleRecipe } from './index.mjs'

const meal = RECIPES.find(recipe => recipe.id === 'skyr-havre-baer')
const totals = sumRecipe(meal)
// totals.nutrients.energyKcal.value: kcal; proteinG.value: gram.
// Ukendte mikronæringsstoffer forbliver null med kendt delsum/dækning.
const scaled = scaleRecipe(meal, { nutrient: 'proteinG', value: 40 })
const scaledTotals = sumRecipe(scaled)
```

`recipePortions(recipe)` giver `{ food, grams }[]` med de originale frosne
katalogfødevarer, så eksisterende `sumMeal`/`sumDay` kan bruges direkte.
`sumRecipe` bruger udelukkende `sumMeal`; der er ingen separat makroberegner.

`scaleRecipe` returnerer en ny opskrift med nye ingrediensobjekter. Alle
ingredienser skaleres proportionalt til ét positivt, endeligt mål i enten
`energyKcal` eller `proteinG`. Ingen afrunding af gram eller delsummer:
afrunding til visning hører til en senere brugerflade. Det er en matematisk
skalering uden vurdering af, om den resulterende portion er praktisk.
Originalopskriften og kataloget ændres aldrig. De leverede forslag er frosne.

Manglende/tom opskrift, ukendt fødevare, ikke-positive/ikke-numeriske gram
og ugyldige mål giver `TypeError`. Et mål med nul/ukendt beregningsgrundlag
eller talmæssig over-/underløb giver `RangeError`. Der returneres ikke et
tilsyneladende gyldigt resultat ved disse fejl.

Prøverne er almindelige `node:test`-filer, der findes af appens
`npm test` (`scripts/test.mjs`). De importerer de rigtige moduler og det
kopierede katalog uden React-erstatning eller andre test-adaptere.
