# ENT0093 — syntetisk dødløft-rig

Riggen kører seks dødløft-reps, som vender tilbage til `p0` på gulvet. Den samme
syntetiske optiske-flow-drift, bund-okklusion og distraktor bruges for alle varianter.
`CX=320` er det kendte facit. `plCapture` og `plSearch` giver kun den hele plade
identitet; de syntetiske forstyrrelser kan derfor ikke blive til et hjemmeanker.

| Variant | Akkumuleret `|nx-CX|` | Afviste jump-frames | Tolkning |
|---|---:|---:|---|
| A — gammelt snap | 3.190,9 | 2 | Retter drift hårdt, men snapper selv over jump-grænsen. |
| B — live, ingen korrektion | 3.530,0 | 0 | Betaler ingen snap-afvisninger, men lader drift akkumulere. |
| C — dæmpet/bekræftet | 3.407,9 | 0 | Mindsker denne rigdrift uden A's afvisninger. |

Kør porten:

```powershell
node docs/videocoach/tracker-deadlift-rig.js && node docs/videocoach/braek-deadlift-rig.mjs
```

Resultatet er en mekanisk sammenligning på syntetiske data — ikke en
produktionsanbefaling. Syntetiske data afgør **ikke**, om en atlets dødløft spores
bedre. Det kræver rigtige klip med menneskemærkede labels, optaget og mærket af et
menneske.
