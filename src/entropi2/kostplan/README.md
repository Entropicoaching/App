# Kostplan: ren beregning og plankontrakt

Nye, frakoblede moduler til Entropi Coach. Ingen React-komponent, import fra
appens samling, database, browser, lagring, netværk, implicit klokke eller writes.
Atleten og coachen ser derfor ingen ændring fra denne pakke alene. Den eksisterende
kcal-tracker og Entropi 2 OFF er uændrede.

## Beregning

`calculateNutrition(input)` fra `beregning.mjs` returnerer `targets` med `kcal`
(kcal/dag), `protein`, `carb`, `fat` (gram/dag), `reasons`, `warnings`, `limits`,
`evidence`, `maintenanceSource`, `targetWeeklyPct` og `weekly`.
Påkrævede felter: `date` (ISO-dag), `adult: true`, `weightKg` (25–350),
`goal: 'bulk' | 'maintain' | 'cut'`. Kun numeriske, endelige beregningsværdier;
fødevarernes teksttal håndteres særskilt af appens eksisterende parser.

Valgfrie felter:

| Felt | Kontrakt |
| --- | --- |
| `intensity` | `light`, `moderate` (standard), `aggressive` |
| `windowDays` | Heltal 14–28, standard 28; søger op til dette antal dage inkl. datoen |
| `weights` | Daglige `{date, kg}`. Flere valide værdier på samme dag udelukkes alle; caller skal først aggregere flere vejninger til én dagsværdi |
| `dietDays` | Daglige `{date, kcal, complete: true}`. Kun hele loggede dage; måltider skal summeres først. Kvitteringer er ikke kost |
| `maintenanceKcal` | Coachestimat, 20–60 kcal/kg; bruges efter troværdige aktuelle/tidligere responsdata |
| `minKcal` | Coachens individuelle energigulv; kan kun hæve standardgulvet 1600 |
| `experiences` | Tidligere planer `{from, through, weightKg, averageKcal, weeklyChangeKg, adherence}`. Respons i kg/uge, efterlevelse 0–1 |
| `training` | `{volume: 'rest' | 'light' | 'moderate' | 'high', intensity: 'light' | 'moderate' | 'high'}`. Hviledag kræver `light`; udeladt = hvile. Det er dagens belastningskategori, ikke rå tonnage |
| `readiness` | `{energy, hunger}` på skala 1–5; udeladt = ukendt. Energi ≤2 eller sult ≥4 fjerner dagens underskud og stopper ugentlig justering |
| `competition` | `{date, weightClassKg}`. Ingen deadline kan øge underskuddet |
| `currentPlan` | `{kcal, createdOn, lastAdjustedOn?, evaluatedThrough?}`. Kcal er den sammenlignelige daglige basis, ikke dagens resterende energi efter logging |

Vægttrend sammenligner gennemsnittet af den første og sidste syvdagesperiode,
justeret for afstanden mellem målingernes gennemsnitsdatoer. Der kræves mindst
14 kalenderdage, 10 forskellige vejninger og 5 i hver ende. Højst 28 dage bruges.
Den aktuelle kropsvægt leveres særskilt; den erstattes ikke af en enkelt vejning.
Ugyldige, fremtidige og gamle dagsrækker ignoreres og tælles i `rejected`.
Utilstrækkelig historik giver `null` trend og en begrundet fastholdelse.

Ved mindst 70 % komplette kostdage i samme faktiske periode estimeres vedligehold
som gennemsnitsindtag minus observeret kg/uge × 7700 / 7. Dette er en grov model,
ikke en præcis energifysiologisk måling. Estimater uden for 20–60 kcal/kg bruges
ikke. Ellers bruges den seneste entydige tidligere responsperiode: 14–28 dage,
højst 180 dage gammel, ≥80 % efterlevelse, referencevægt inden for ±20 % og
observeret respons højst ±1 %/uge. Derefter coachestimat og til sidst et tydeligt
foreløbigt 30 kcal/kg-estimat. Tidligere respons er den målte faktiske respons,
ikke den tidligere plans ønskede vægtændring.

Bulk bruger +5/+10/+15 % energi og ønsker +0,1/+0,25/+0,4 % vægt/uge.
Cut bruger −5/−10/−15 % og ønsker −0,25/−0,5/−0,75 %/uge.
Vedligehold bruger 0/0 for alle intensiteter. Vægtændringen er et evalueringsmål,
ikke et løfte om den forventede effekt af procenten.

Dagens træning lægger 0/100/200/300 kcal til efter volumen, samt 0/50/100 efter
intensitet. Protein er mindst 2 g/kg (2,2 ved cut), fedt mindst 0,8 g/kg;
kulhydratgulvet er 2 g/kg i hvile, 3 ved øvrig træning og 4 ved høj volumen eller
intensitet. Energibasis hæves til mindst max(1600, 25 × kg, individuelt gulv,
makrogulve i hvile). Træningstillægget lægges til efter dette gulv, så et
individuelt energigulv ikke opsluger træningsbrændstoffet. Dagens energi hæves
desuden til dagens makrogulve. `limits.baseMinKcal` er basisgulvet, og
`limits.minKcal` er dagens gulv inkl. træning. Resterende energi fordeles med sigte på
25 % fedt, og resten som kulhydrat. Makroer returneres uden visningsafrunding,
så 4/4/9-regnskabet stemmer. Energi rundes op til hele kcal.

Disse versionsmærkede tal er produktets foreløbige voksenpolitik og skal
fagligt vurderes af coach før anvendelse. De er ingen klinisk sikkerhedsgaranti
for den enkelte. Modellen vurderer ikke sygdom, graviditet, medicin eller
spiseforstyrrelser og er ikke til børn eller akut vægttab/væskemanipulation.
Stævne inden for 14 dage, vægtkrav over 0,75 % tab/uge eller vægtkrav i strid
med målet stopper ugentlig automatik med coachbegrundelse. Passeret stævne
markeres og bruges ikke til at fremtvinge ændringer.

## Ugentlig regel og aktivering

`weekly` er altid et forslag, aldrig en aktivering. `action` er `hold`, `adjust`
eller `review`; det indeholder begrundelse, konkrete datodækninger, observeret
og ønsket vægttrend samt `requiresCoachActivation: true`.

En justering kræver mindst 7 hele dage siden seneste energiændring (eller
planens oprettelse), tilstrækkelig vægt/kosthistorik, nyt datagrundlag og ingen
stopregel. Ved afvigelse over 0,1 procentpoint/uge foreslås et trin på højst
min(150 kcal, 5 % af aktuel basis). Basisgulvet kan begrænse reduktionen yderligere.
Aktuel basisplan under basisgulvet giver `review` og intet foreslået lavt mål.
Dagens træningstillæg og dagsgulv håndteres ved den daglige beregning og
ændrer ikke ugens basis automatisk.

Adapteren skal efter coachens accepterede ændring gemme ny kcal-basis,
`lastAdjustedOn = evaluatedOn` og `evaluatedThrough = evidence.through`
atomisk sammen. En ren funktion kan ikke forhindre en caller i at genbruge
gammel tilstand; den samme tilstand giver med vilje det samme forslag.
`nextEligibleOn` gives ved cooldown og en foreslået ændring; `null` betyder,
at en datoberegning alene ikke kan ophæve stoppet.
Dagligt genereringsmål og ugentlig ændring er to alternative arbejdstrin;
den ugentlige delta må ikke lægges oven i et nykalibreret dagsmål automatisk.

## Måltider og status

`calculateMeals(meals)` fra `foedevarer.mjs` accepterer måltider med unikt
`id`, `name` og `items: [{food, grams}]`. `food` er et snapshot fra den
eksisterende `LOCAL_FOODS` eller appens egne fødevarer: `name`, `kcal100`,
`protein100`, `carb100`, `fat100`. Ingen ny fødevaredatabase. Rå/kogt vægt
skal passe til det valgte fødevarenavn og dets per-100-g-data.
0 gram og ukendte makroer afvises; kendte nuller er gyldige. Der er plads til
20 måltider, 100 fødevarer pr. måltid og 10000 g pr. fødevare.

Måltids- og dagstotaler summeres fra uafrundede fødevaremængder, og appens
`nutritionValues` afrunder én gang pr. total. Derfor kan en dagstotal afvige
lidt fra summen af de viste, afrundede måltider. Ingen ingredienser går tabt.

Valgfri `food.micronutrients100` har formen
`{iron: {value: 2, unit: 'mg'}}`, med eksplicit `g`, `mg` eller `ug`.
Kun ens navne og enheder summeres. Hvis en fødevare mangler et næringsstof,
er det samlede `value: null` med `knownItems`/`totalItems`, aldrig et opdigtet
nul. Blandede enheder afvises, ikke gættet konverteret. Listen prioriterer
ingen fødevarer ud fra forskning; det kræver et senere fagligt datagrundlag.

`createDraft({id, athleteId, coachId, createdOn, dailyTargets, meals})` fra
`plan.mjs` opretter `schema: 'entropi2-kostplan/v1'`, `status: 'draft'`.
`dailyTargets` er beregningens fire mål. En kladde kan være tom.
`transitionPlan(plan, {to: 'active' | 'archived', actor: {id, role: 'coach'}, on})`
tillader kun `draft → active → archived` med planens coach og gyldig tidsfølge.
Aktivering kræver konkrete måltider. Overgange returnerer løsrevne snapshots og
beregner måltidstotalerne på ny. Arkivering er terminal.

Actor er en betroet adapterkontrakt, ikke autentifikation. Fremtidig integration
skal kontrollere coach/atlet-adgang, uforanderlig planversion, atomisk aktivering
af højst én plan, og gemme begrundelse/datagrundlag fra beregningen sammen med
planversionen. Modulet læser ingen identitet og ændrer ingen tracker eller mål.

## Prøver

Fra projektets rod:

```text
node --test --test-concurrency=1 src/entropi2/kostplan/*.test.mjs
```

Appens eksisterende `npm test` finder `.test.mjs` rekursivt. Prøverne importerer
de faktiske moduler og den faktiske offentlige fødevareliste; ingen omskrevet
beregningskopi, React-erstatning eller loader. I shells uden globudvidelse skal
de tre testfilnavne angives eksplicit. Fuld suite/build udføres af Dhurva.
