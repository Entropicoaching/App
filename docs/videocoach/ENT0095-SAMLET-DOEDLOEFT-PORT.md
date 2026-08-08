# ENT0095 — samlet dødløft-port

Kør én lokal kontrol før menneske-test:

```powershell
node docs/videocoach/run-deadlift-gate.mjs
```

Den dækker de tre aktuelle fund og bevarer deres separate rigs:

| Del | Hvad porten beviser |
|---|---|
| Home-anchor C | Den bekræftede, dæmpede korrektion reducerer rigdrift uden snap-afvisninger. |
| Hurtig nedtur | `feature-match`, `identity` og `jump` kan skelnes; C ændrer ikke den zone. |
| Top-exit | Rep tælles stadig ved lockout, mens review beholder dødvægtens nedtur. |
| Diagnosekanal | Probe kræver begge lokale flags og kan navngive den faktiske afvisnings-gate. |

En grøn port betyder kun, at den lokale ændring og dens kontrakter er konsistente.
Den accepteres først, når Marc på samme dødløft-klip bekræfter både: (1) reviewet går
med ned efter toppen, og (2) trackingen fortsætter efter knæene. Hvis tracking stadig
falder ud, downloades benchmark-data fra:

```text
videocoach.html?coach=1&benchmark=1&trackerProbe=1
```

`frameProbe[].rejectGate` er derefter den eneste basis for næste trackingændring.
Ingen deploy, commit eller atletlevering følger af porten.
