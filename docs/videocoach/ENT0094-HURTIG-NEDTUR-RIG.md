# ENT0094 — hurtig dødløft-nedtur efter knæet

`tracker-deadlift-descent-rig.mjs` er en separat syntetisk rig: seks hurtige
nedadgående frames efter knæpassagen, langt fra gulvets `nearHome`-zone. Den
porterer accept-portens rækkefølge fra `public/videocoach.html` og lader B og C
få identisk input. Det er bevidst: C's dødløftskorrektion kan kun køre ved
`nearHome`, så den kan ikke forklare en afvisning efter knæene.

| Indført, isoleret fejl | Første målte eksisterende gate | B/C-resultat |
|---|---|---|
| Under fem matcher | `feature-match` (`moves`/`kept` < 5) | Begge afviser |
| Tynd konsensus med svag pladeidentitet | `identity` | Begge afviser |
| Spring over hastighedsgrænsen | `jump` | Begge afviser |

Riggen beviser kun følsomhed og gate-rækkefølge: alle tre mulige fejlkilder kan
skelnes mekanisk, og `feature-match` afviser før identity/jump. Den afgør **ikke**
hvilken fejl der rammer Marcs video; der mangler frame-for-frame telemetri fra det
konkrete klip. En mekanisme ville derfor være et gæt.

Kør:

```powershell
node docs/videocoach/tracker-deadlift-descent-rig.mjs
node docs/videocoach/braek-deadlift-descent-rig.mjs
```

Bræk-testen ændrer bevidst feature-match-tærsklen, kræver rød rig og gendanner
derefter filen i `finally`. Ingen produktionsfil ændres.
