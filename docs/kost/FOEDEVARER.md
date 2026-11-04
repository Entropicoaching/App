# Fødevarer til kostplaner

Base: `b54e820420e6ceec5be7ef1a3586d994f13ea6d3`. Modulerne i
`src/entropi2/kostplan/foedevarer/` er nye, rene beregninger og offentlige data.
De er ikke koblet til skærme, routing, kostlog, aktivering eller lagring.
Coachen og atleten ser derfor præcis den samme Entropi Coach som før denne pakke.
OFF-adfærd er uændret. Der er ingen sideeffekter eller automatisk kostordination.

## Data pr. 100 g

`FOODS` adapterer hele `LOCAL_FOODS` fra `src/athlete/lokaleFoedevarer.js`.
Navne og de eksisterende makrotal genbruges uændret. Kildelisten ændres ikke.
Id er `local:` plus `encodeURIComponent(name)`; rå og kogte produkter forbliver
adskilte. Listen angiver ikke konsekvent rå/kogt tilstand, mærke eller oprindelig
datakilde. Vælg en entydig tilstand og verificér deklarationen før en konkret plan;
fx er `Ris kogt` forskellig fra `Ris tør`, og kyllingens tilstand er uafklaret.
Der foretages ingen omregning mellem tilberedningsformer, ml og gram.

Hvert produkt har `basisGrams: 100`, `preparation`, `source` og
`nutrientsPer100g`. `NUTRIENTS` indeholder felternes danske navn og faste enhed:

| Felter | Enhed |
| --- | --- |
| energyKcal | kcal |
| proteinG, carbohydrateG, fatG, fibreG, leucineG | g |
| ironMg, calciumMg, magnesiumMg, zincMg, potassiumMg, sodiumMg | mg |
| vitaminDUg, vitaminB12Ug, folateUg | µg |

Den eksisterende liste har kun energi, protein, kulhydrat og fedt. De øvrige felter
er `null` (ukendt), aldrig et opdigtet nul. Leucin udledes ikke af protein, calcium
ikke af en fødevaregruppe. Kulhydratdefinition og afrundinger fra legacy-listen
videreføres; energi genberegnes ikke fra makroer. Listen er ikke en valideret
fødevaredatabase og mærkes `kilde skal verificeres`.

`createFood({ id, name, preparation, nutrientsPer100g, source })` kan anvendes til
senere, dokumenterede data. `source` kræver `citation` og `verification` som tekst;
det er dokumentation, ikke automatisk kildeverifikation. Funktionen kopierer og
fryser produktet, udfylder ukendte felter med null og afviser ukendte næringsnøgler,
negative tal, numeriske strenge og ikke-endelige værdier.

## Måltid og dag

```js
import { FOODS, sumMeal, sumDay, compareDayToRecommendations }
  from '../../src/entropi2/kostplan/foedevarer/index.mjs'

const portion = (name, grams) => ({ food: FOODS.find(f => f.name === name), grams })
const lunch = [portion('Ris kogt', 200), portion('Kyllingebryst', 100), portion('Broccoli', 50)]
const meal = sumMeal(lunch)
// 387 kcal, 30.5 g protein, 59.5 g kulhydrat, 2 g fedt fra legacy-listen.
const day = sumDay([lunch])
// Dag er en liste af måltider, måltid er en liste af { food, grams }.
```

`sumMeal` og `sumDay` modtager endelige, ikke-negative tal i gram. En fremtidig UI
skal selv parse fx dansk decimalkomma. Ugyldige data giver TypeError; overløb giver
RangeError. Der afrundes ikke under beregningen. Identiske portioner tælles hver
gang. Kaldende kode skal udvælge måltider fra den ønskede dato; modulerne læser
ikke en kostlog og kan ikke kontrollere, om en hel dags kost er registreret.

Hvert næringsstof returnerer `value`, `complete`, `knownSubtotal`, `knownGrams`,
`missingGrams` og `missingPortions`. En positiv portion uden næringsdata gør
`value: null` for netop det næringsstof; den kendte del kan stadig vises tydeligt
som et deltal. `complete` betyder kun, at de indsendte positive portioner alle har
værdien, ikke at dagen er fuldt logget eller at fødevarekilden er verificeret.
En tom dag eller kun nulgram har `hasData: false` og ukendte totaler. Nul gram
påvirker ikke dækningen. Et registreret næringsindhold på nul er et kendt nul.

## Markering mod anbefalinger

```js
const result = compareDayToRecommendations([lunch], [{
  nutrient: 'proteinG', unit: 'g', min: 40,
  source: 'Syntetisk eksempel på dagsmål; ikke en personlig anbefaling',
}])
// assessment[0]: status 'below', actual 30.5, deficit 9.5.
```

Anbefalinger er eksplicitte dagsintervaller med `nutrient`, korrekt `unit`,
`source` og mindst én af `min`/`max`. Ingen standardmål antages for en atlet.
Coachen/integrationen skal vælge passende referencer ud fra fx alder, kostform,
træning og relevante individuelle hensyn. Uden mål er `assessment` tomt, og
næringsstofferne står i `unassessed`. Forkert enhed, ugyldigt interval eller
gentaget næringsstof afvises.

`below` markerer et beregnet indtag under det valgte minimum; `within` betyder
inden for de angivne grænser (inklusive), og `above` over det valgte maksimum.
Ukendt eller delvist næringsindhold giver altid `unknown`, `actual: null` og
`deficit: null`, også hvis det kendte deltal alene overstiger målet. Der konkluderes
ikke vitaminmangel, klinisk mangel eller behov for tilskud ud fra en kostlog.
En ufuldstændigt logget dag kan se lav ud; den begrænsning skal en senere UI vise.

## Prioritering og evidens

`PRIORITIES` giver en enkel redaktionel rækkefølge med begrundelse, afgrænsning,
forbehold, eksisterende fødevare-id'er og kilde-id'er. Det er ikke en score for
enkelte produkter, et krav om at spise mejeri eller en formel GRADE-vurdering.
`high` angiver stærk generel støtte til det beskrevne formål; `moderate` angiver
mere kontekstafhængig eller indirekte støtte. Der skelnes udtrykkeligt mellem
ernæringsmæssig dækning og dokumenteret ekstra styrkeeffekt.

1. Protein over dagen: høj generel evidens sammen med styrketræning. Leucinrige
   proteinkilder kan være praktiske; evidensen for at favorisere en bestemt
   fødevare ved allerede tilstrækkeligt protein er svagere. Ingen leucingram påstås.
2. Stivelsesrige kulhydrater efter belastning og restitution: moderat støtte i
   denne styrkekontekst. Ris, pasta, kartofler og havre er eksempler. Timing er
   fleksibel; ingen obligatorisk snæver periode omkring træning.
3. Varieret frugt, grønt og bælgfrugter: høj generel ernæringsmæssig støtte;
   indirekte evidens for styrke, ingen løfter om ekstra præstation fra en bestemt sort.
4. Calcium og protein: mejeri er en praktisk mulighed; relevante berigede
   alternativer afhænger af deklarationen. Moderat støtte til denne praktiske
   prioritering, ingen påstået unik styrkeeffekt eller kendt calciumtotal i listen.

Identificerede publikationer (netadgang er forbudt i denne opgave, derfor er
metadata og anvendelighed **kilde skal verificeres** før produktintegration):

- Jäger et al. (2017), *International Society of Sports Nutrition Position Stand:
  protein and exercise*. DOI `10.1186/s12970-017-0177-8`.
- Thomas, Erdman & Burke (2016), *Nutrition and Athletic Performance*.
  DOI `10.1249/MSS.0000000000000852`.
- *Nordic Nutrition Recommendations 2023*. DOI `10.6027/nord2023-003`.

Ingen kilde er udgivet som online-verificeret i denne pakke. Der er ingen numerisk
standardordination eller opfundne mikronæringsværdier. Forskning skal gennemgås
og en egnet, dokumenteret fødevarekilde tilføjes, før mineral-/vitamindækning kan
vises som mere end ukendt for legacy-listen.

## Afgrænset verifikation

Alle `.test.mjs` i den nye mappe kan køres med Node-testløberen fra appens rod.
De importerer de faktiske moduler og den faktiske kopierede `LOCAL_FOODS`.
De indeholder kun syntetiske portioner og mål. Appens eksisterende `npm test`
opdager også filerne rekursivt. Ingen React-komponent eller React-mock tilføjes;
fuld suite og build udføres af Dhurva ved integration ifølge worker-rammen.
