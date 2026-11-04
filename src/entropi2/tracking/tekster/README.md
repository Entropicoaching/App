# Signalforklaringer

Statisk dansk tekst, endnu ikke koblet til skærme, signalberegning eller flag.
`getSignalExplanation(key)` giver en frossen post eller `null` ved ukendt nøgle.
`SIGNAL_EXPLANATIONS` indeholder de fem poster i fast rækkefølge.

Hver post har `key`, `title`, `explanation`, `dataBasis`, `conversation` og `caveat`.
`dataBasis` forklarer beregningsreglen, ikke en bestemt atlets observationer.
Teksten er samtalestøtte; den stiller ingen diagnose og ændrer ingen plan.

## Senere kobling

Kalderen skal selv håndhæve OFF, atletafgrænsning, adgang og datatilstrækkelighed.
Et tekstopslag udleder aldrig, at der er et signal. Vis kun en forklaring ved et
faktisk signal med dets autoriserede periode, antal og målinger ved siden af.
Teksten skal rendres som almindelig tekst.

| Eksisterende modelresultat | Opslagsnøgle |
| --- | --- |
| `load(...).signal === 'belastningsspring'` | `belastningsspring` |
| `buildStrengthTrend(...).lifts[i].plateau === true` | `plateau` |
| `buildStrengthTrend(...).lifts[i].drop === true` | `fald i e1RM` |
| `nutritionTrend(...).signal === 'lavt protein'` | `lavt protein` |
| `weightTrend(...).fastChange === true` | `hurtig vægtændring` |

`normal`, `false`, `null` og manglende data er ikke signaler. Plateau og fald kan
optræde samtidig. Aggregatoren `buildAthleteSignalList` har frie `key`-værdier;
en senere adapter skal aftale nøgler eksplicit og må ikke gætte via `reason`.
Ingen sådan adapter eller integration leveres her.

Prøver: `node --test src/entropi2/tracking/tekster/*.test.mjs` fra projektroden.
Kun syntetiske fixtures; prøverne importerer de faktiske kopierede modeller.
