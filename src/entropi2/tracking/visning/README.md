# Belastning og trend — visningskontrakt v1

Ren, coachrettet React-sektion til én atlet. Ingen datahentning, lagring,
identiteter, hooks eller skærmkobling. Alle filer ligger ved anvendelse af diffen
i `src/entropi2/tracking/visning/`.

```js
import BelastningOgTrend from './tracking/visning/BelastningOgTrend.mjs'
// En senere integrationsopgave leverer allerede afgrænsede TRACK-resultater:
// createElement(BelastningOgTrend, { enabled: entropi2Enabled, data })
```

`enabled` skal være den booleske værdi `true`. Standard er OFF; OFF læser ikke
`data`. Komponenten håndhæver ikke adgangsrettigheder: den fremtidige kalder
skal først kontrollere coachens adgang og vælge præcis én atlet. Ingen private
specialkategorier eller rå registreringer indgår i kontrakten.

## Fælles envelope

`{ version: 1, asOf: 'YYYY-MM-DD', load, strength, nutrition, weight }`.
Datoer er gyldige kalenderdatoer uden klokkeslæt. `asOf` leveres eksplicit af
kalderen; komponenten bruger hverken systemur eller implicit tidszone.

Hvert domæne er enten `{ state: 'missing' }`, udeladt eller et objekt med
`state: 'ready'` og felterne nedenfor. Ready må have tomme lister. Ready med
ugyldig struktur afvises kun for det domæne. Ukendt version/dato giver ingen
visning af tal. Der sker ingen delvis filtrering af ugyldige rækker.

Alle tal er endelige, ikke-negative JavaScript-tal eller eksplicit `null`.
`null` betyder manglende grundlag, aldrig nul; udeladte talfelter afvises.
Lister er tætte og kronologisk stigende med unikke datoer. Daglister har
præcis én kalenderdag mellem rækker; indsæt null-rækker for huller. Ugelister
har præcis syv dage mellem rækker. Ingen række må ligge efter `asOf` eller
mere end 27 dage før `asOf`. Visningen fylder ikke selv data ud. Seneste
række og hele datoperioden fremgår af visningen, også når data er ældre.

Ready-domæner kan have `signal: { level: 'info' | 'attention', label, reason }`.
Begge tekster skal være ikke-tomme. Manglende signal angives som manglende
vurdering, ikke som grønt lys. Produceren ejer tærskler, datakvalitet og
begrundelse. Komponenten udleder ingen helbreds-, plateau- eller kostsignaler.

## TRACK-BELASTNING1 → load

`{ state: 'ready', unit, days: [{ day, acute, chronic }], signal? }`.
`unit` er ikke-tom tekst. Højst 28 dagrækker. `acute` er 7 kalenderdages
samlede belastning; `chronic` er 28 kalenderdages samlede belastning divideret
med fire, så begge linjer har samme enhed og 7-dages skala. Produceren skal
anvende samme metode/enhed og levere null ved utilstrækkeligt grundlag.
Ingen ratio beregnes i visningen; nul i kronisk belastning giver ingen division.

## TRACK-STYRKETREND1 → strength

`{ state: 'ready', exercises: [{ id, label, trend, plateau, reason, days }], signal? }`.
Højst 20 øvelser med unikke, ikke-tomme `id` og ikke-tomme `label` og `reason`.
`trend` er `rising`, `falling`, `stable` eller `unknown`. `plateau` er boolesk
eller `null` (ukendt). `days` har højst 28 rækker `{ day, e1rmKg }`.
Produceren leverer sammenlignelig e1RM i kg for samme øvelse og metode;
dage uden måling er null, ikke en videreført seneste måling. Uden numerisk
e1RM i perioden kræves `trend: 'unknown'` og `plateau: null`. Begrundelsen
skal forklare producentens trend/plateau eller utilstrækkelige grundlag.

## TRACK-KOSTTREND1 → nutrition

`{ state: 'ready', weeks: [{ day, proteinG, proteinGoalG, kcal, kcalGoal, loggedDays }], signal? }`.
Højst fire uger; `day` er ugens sidste kalenderdag. `proteinG` og `kcal` er
daglige gennemsnit for registrerede dage i ugen, ikke totaler. Mål er
gennemsnitlige daglige mål for de samme dage, så ændrede mål håndteres hos
produceren. `loggedDays` er et heltal 0–7; nul kræver null i alle fire tal.
Manglende mål er null og bliver ikke erstattet med et standardmål. Delvis
dækning vises eksplicit. Fire uger med datamangler kan leveres som null-rækker.

## TRACK-VAEGT1 → weight

`{ state: 'ready', days: [{ day, kg, mean7Kg, samples7 }], signal? }`.
Højst 28 dage. `kg` er dagens registrerede vægt; `mean7Kg` er gennemsnittet
af registrerede dagværdier i intervallet `[day - 6, day]`, ikke syv seneste
målinger. Produceren afklarer flere målinger samme dag før aggregering.
`samples7` er antal måledage i intervallet, heltal 0–7. Nul kræver både
`kg` og `mean7Kg` null. Dagens vægt kan mangle, selv om gennemsnittet findes.
Visningen viser dækning og kræver ikke syv målinger for at vise et gennemsnit.

## Grafer og prøver

SVG-linjer har fælles skala inden for hver graf, datoafstand på x-aksen,
fuld/stiplet linje, punkter for enkeltmålinger og brud ved null. Skala og
periode vises; alle tal findes i en udfoldelig tabel. Grid og tabeller tilpasser
sig smalle bredder. Tekst indsættes som React-tekst, aldrig HTML.

Fra repoets rod, uden installation:

```text
node --test --test-concurrency=1 src/entropi2/tracking/visning/BelastningOgTrend.test.mjs src/entropi2/tracking/visning/tracking.review.test.mjs
```

Prøverne importerer de faktiske moduler. Kun Reacts `createElement` erstattes
med en syntetisk elementfixture, afgrænset til visningsmodulets import.
Det efterprøver træstruktur, kontrakt og grafkoordinater; det er ikke en
ReactDOM-, browser-, layout- eller skærmlæsertest. Ingen fixture i runtime.
