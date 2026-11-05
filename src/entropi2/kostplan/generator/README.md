# Gramplan v1

`generateGramPlan` er en synkron, deterministisk funktion uden I/O, UI eller lagring.
Den ændrer ingen eksisterende moduler eller feature flags. Intet køres ved import
ud over opbygning af katalogets id-opslag. Kaldet producerer kun et udkast.

```js
import { generateGramPlan } from './generator/index.mjs'
import { calculateNutrition } from './beregning.mjs'

const targets = calculateNutrition({ date: '2026-11-05', adult: true,
  weightKg: 80, goal: 'maintain', maintenanceKcal: 2640 }).targets
const plan = generateGramPlan({
  targets,
  mealCount: 1,
  meals: [{ id: 'frokost', name: 'Frokost', items: [
    { foodId: 'local:Ris%20kogt', minGrams: 100, maxGrams: 400 },
    { foodId: 'local:Kyllingebryst', minGrams: 75, maxGrams: 250 },
    { foodId: 'local:Broccoli', minGrams: 50, maxGrams: 200 },
  ] }],
  prioritizedFoodIds: ['local:Kyllingebryst'],
})
// Dette enkeltmåltid kan ikke dække hele dagsmålet: læs status og deviation.
```

Brug eksisterende `FOODS` fra `../foedevarer/catalog.mjs` til valg; opfind aldrig
id'er eller næringsværdier. Beregningsmodulets `targets` har nøglerne `kcal`,
`protein`, `carb`, `fat` (energi i kcal, øvrige i gram). Alle fire kræves som
endelige, ikke-negative tal; kcal skal være positiv. Kcal højst 100000, øvrige
højst 10000. Grænserne er tekniske inputværn, ikke kostanbefalinger.

Hver valgt portion skal have eksplicitte `minGrams`/`maxGrams` i trin på 5 g,
5–1000 g, min <= max. De er coachens praktiske valg pr. fødevare OG måltid;
generatoren gætter ikke portionsstørrelser for fx olie, tør ris eller kogt ris.
Alle valgte fødevarer indgår med mindst minimum. At fravælge en fødevare betyder
at fjerne den fra `items`. Ingen valgte fødevarer erstattes eller tilføjes.
Minimum og maksimum kan være ens for en fast portion. Grænser gælder pr. portion,
ikke hele dagen; daglige fødevarelofter er ikke implementeret.

1–8 måltider, højst 12 forskellige fødevarer pr. måltid og 64 portioner pr. dag.
Et katalog-id må gentages på tværs af måltider. Tomt `items` giver `no-plan`, ingen
måltider og `null` for totals/afvigelser/grænser. Ugyldige input giver `TypeError`.
`prioritizedFoodIds` er valgfri, ordnet og uden dubletter; kun allerede valgte
id'er tillades. Prioritet bestemmer søgeorden og afgør lige gode kandidater,
fx to fødevarer med identiske makroer. Det er ikke et garanteret gramminimum
eller en ernæringsfaglig rangordning. Brug portionsminimum til et hårdt ønske.

Algoritmen minimerer summen af kvadrerede dagsafvigelser divideret med tolerance.
Tre faste startpunkter, højst 300 kontinuerte koordinatrunder og derefter højst
100 diskrete runder med koordinatspring og parvise 5 g skridt. Ingen tilfældighed,
ekstern optimeringspakke eller løfte om et globalt optimum. Der optimeres på
dagens sum; lige store måltider, allergier, variation og mikronæringsdækning er
ikke udledt. De praktiske portionsgrænser skal afspejle de ønskede måltider.

Tolerance pr. mål er max(5 % af målet, absolut grænse): 50 kcal, 5 g protein,
10 g kulhydrat, 3 g fedt. Det er en synlig produktregel, ikke klinisk vurdering.
`matched` betyder at alle fire ligger inden for tolerancen, ikke eksakt lighed.
`infeasible` betyder at mindst ét mål ligger uden for den uafhængigt beregnede
min/max-sum selv med tolerance; målet kan da beviseligt ikke nås med disse valg.
`unmet` betyder at søgningen ikke fandt et match; koblede begrænsninger eller
søgebudget kan være årsagen. Det er ikke et bevis på umulighed. Begge statusser
returnerer et begrænset udkast og en ærlig besked om afvigelser.

`totals` er uafrundede summer fra de endelige 5 g portioner. `displayTotals` og
måltidernes `totals` kommer fra appens eksisterende `calculateMeals`; der afrundes
kun ved præsentationen. `deviation[key].delta` er faktisk minus mål i samme enhed;
`percent` er procent af mål, eller null ved nulmål. Status bruger de uafrundede
summer. `bounds` viser hver uafhængig dags min/max samt `excludesTarget`.

Portionerne indeholder `foodId`, `food` (samme snapshotformat som
`calculateMeals`), `grams`, min/max, tilstand og katalogets kilde/verifikationsstatus.
De kan beregnes igen med `calculateMeals(plan.meals)`. Kildens legacy-værdier er
uændrede; kildeverifikation og uklar rå/kogt tilstand forbliver synlige. Ingen
kcal udledes af 4/4/9, og ukendte mikronæringsværdier udfyldes ikke.

Alle tests her er almindelige `.test.mjs`-filer og opdages af appens eksisterende
`npm test`-runner. Modulet kræver ikke React, og ingen React-stub eller loader
bruges. Fuld suite og build køres af Dhurva ved integration.
