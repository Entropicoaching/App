# Mikronæringsdata i Entropi Coach

Modellen understøtter valgfrie mineraler og vitaminer uden nye UI-felter eller
automatisk udfyldning af fødevaredata. Ingen kildebelagte mineral-/vitamintal
findes i den medleverede lokale fødevareliste; dens felter forbliver `null`.

`MICRONUTRIENTS` beskriver ni felter og forbinder de eksisterende dataformater:

| `micronutrients100` | `nutrientsPer100g` | Enhed |
| --- | --- | --- |
| `iron` | `ironMg` | mg |
| `calcium` | `calciumMg` | mg |
| `magnesium` | `magnesiumMg` | mg |
| `zinc` | `zincMg` | mg |
| `potassium` | `potassiumMg` | mg |
| `sodium` | `sodiumMg` | mg |
| `vitaminD` | `vitaminDUg` | µg |
| `vitaminB12` | `vitaminB12Ug` | µg |
| `folate` | `folateUg` | µg |

Alle værdier gælder pr. 100 g i fødevarens angivne tilstand. Det flade format
bruger enhedskoden `ug` for µg; katalogformatet bruger `µg`. Der konverteres
ikke mellem forskellige enheder eller mellem rå og tilberedt vægt.

I `calculateMeals` kan et fødevaresnapshot have
`micronutrients100: { iron: { value, unit: 'mg', source: 'Navngiven kilde og datapost' } }`.
`source` er en ikke-tom tekst på højst 200 tegn. Kilden normaliseres med trim
og kopieres ind i snapshot. Funktionerne kontrollerer tilstedeværelsen af en
kildeangivelse; de verificerer ikke dens faglige rigtighed. Nye virkelige tal
skal kontrolleres mod den navngivne fødevare og dens tilstand inden indlæsning.

Et udeladt felt eller `value: null`/`undefined` betyder ukendt. Ældre flade
værdier uden kilde kan stadig læses, men normaliseres til `value: null` og
`source: null`; de må ikke give en kendt total. Forkerte enheder for de ni
felter, negative/ikke-endelige værdier og ugyldige kildeformater afvises.
Eksisterende øvrige feltnavne med eksplicit `g`, `mg` eller `ug` kan stadig
bruges, nu med samme kildekrav. Der opfindes ingen andre standardfelter.

Måltider og dagen summeres hver for sig fra uafrundede ingrediensmængder.
Alle ni standardfelter findes i resultatets `micronutrients`, også ved en tom
kladde. Et felt indeholder `unit`, `value`, `knownItems`, `totalItems`, `status`
og en liste af forskellige `sources` fra de kendte ingredienser.

En total kræver mindst én ingrediens og en kildebelagt værdi for hver eneste
ingrediens: `status: 'complete'`. Ellers er `value: null` og
`status: 'insufficient-data'`, dvs. **ikke nok data**. En enkelt manglende
ingrediensværdi i ét måltid gør også dagstotalen ukendt. Et dokumenteret nul
er en kendt værdi. `sources` alene siger ikke, at totalen er komplet.

Katalogformatet bevarer sin eksisterende kontrakt: `createFood` kræver
`source: { citation, verification }` for hele fødevarens `nutrientsPer100g`.
Enheder følger `NUTRIENTS`. `sumMeal`/`sumDay` returnerer `value: null` og
`complete: false` ved manglende data; et eventuelt `knownSubtotal` er kun en
delsum. `createPlanSnapshot` bevarer disse data og deres kilde. De to formater
bliver ikke automatisk konverteret eller gemt af denne ændring.

`createDraft`/`transitionPlan` bruger `calculateMeals`, så kildeangivelser og
fuldstændighed genberegnes ved aktivering/arkivering. Ingen mikrodata føjes til
energi-/makromål, anbefalinger, UI, netværkskald eller lagring.
