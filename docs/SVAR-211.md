# Svar — ordre 211: kravet eller klippet?

Ordre 211s eget spørgsmål (fra ordre 200): stopper coach-sporingen ved 97-98%
fordi kravet til en "brugbar rep" er for strengt for den syntetiske bevægelse,
eller fordi trackeren mister sporet? Instrumenteringen fra commit 1
(`e2e/coach-sporing-trace.mjs`, kørt mod `test-clips/_e2e/coach-sporing-full.mp4`
— ordre 200's uændrede, fulde klip) giver et entydigt svar.

## Svaret: sporet, ikke kravet

**Trackeren mister stangen PRÆCIS ved t≈3,2s og genfinder den ALDRIG.**
`t=3,2s = LEAD_IN (2,0s) + REP_DUR/2 (1,2s)` — nøjagtig bunden af rep 1, det
øjeblik bevægelsen vender fra nedtur til optur.

| Frame (t) | Fundet Y | Sand Y (truePos) | Afstand (px) | Gyldig | Afvisningsgrund |
|---|---|---|---|---|---|
| 96 (3,200s) | 897 | 898 | 22,4 | ja | — (sidste korrekte frame) |
| 97 (3,233s) | 897 | 886 | 25,9 | **nej** | `feature-match` (for få gode punkt-match) |
| 98 (3,267s) | 897 | 873 | 33,8 | nej | `feature-match` |
| 99 (3,300s) | 915 | 861 | 57,7 | ja (ét glimt) | — |
| 100 (3,333s) | 915 | 849 | 69,6 | nej | `feature-match` |
| 101–598 | **fastfrosset ved (381, 915)** | bevæger sig videre (4 flere reps) | vokser til 570+ | nej (299/599 i alt) | `feature-match` hver gang |

Fra frame 101 og resten af klippet (16,6 af klippets 20 sekunder, gennem
reps 2–5) rapporterer trackeren **`valid:true, confidence:1`** for et punkt
der aldrig rører sig — den er ikke bare "usikker", den er falsk sikker på et
dødt punkt. Hjemme-genfindingsmekanismen (`homeRecoveries` i
`startMultipointTracking`, søger nær klik-punktet når stangen er tabt) prøvede
aldrig at genfinde den (`homeRecoveries: 0` i det fangede benchmark-run) —
trods at stangen passerer tæt på hjem-punktet igen ved toppen af hver
efterfølgende rep.

**Konsekvens: `path.analysis.reps.length = 0`.** Ikke "reps fundet men uden
finit mcv/romCm" (ordre 200's egen hypotese) — der bliver ALDRIG dannet en
rep-kandidat, fordi rep-detektionens amplitude-krav (`analyzeCleanPath`,
`smoothedY[repStart]-smoothedY[repEnd] > range*.4`) aldrig kan opfyldes når
banen er fastfrosset efter 3,3s. "97-98%" er andelen af VIDEOENS TID
trackeren nåede at behandle (`pct=Math.round(tNow/video.duration*100)`,
public/videocoach.html) — ikke et mål for sporingskvalitet. Den behandler
næsten hele klippet, men mister det brugbare indhold efter 3,3 sekund.

**Hvad det betyder for rigtige klip:** siden fejlen er "sporet", ikke
"kravet", er kravet til en "brugbar rep" IKKE for strengt i sig selv — det
ville korrekt afvise et rigtigt klip med samme sporingstab. Spørgsmålet
flytter til: mister trackeren OGSÅ rigtige klip på samme måde? Se
"Hvad er næste" i `docs/RAPPORT-211.md`.

## Afprøvet forklaring på HVORFOR (commit 3, ikke en rettelse)

Den gamle `worldY(t)` i `scripts/make-test-clip.mjs` var en ren
trekantsbølge: konstant hastighed hele vejen ned og op, med et ØJEBLIKKELIGT
fortegnsskifte i bunden (uendelig acceleration — ikke-fysisk). Trackerens
bevægelsesforudsigelse (`pred=cur+vel*dt` i `startMultipointTracking`)
antager konstant hastighed mellem frames — ved en øjeblikkelig vending
peger forudsigelsen forkert, søgevinduet rammer ved siden af, og
punkt-matchet fejler. Tidspunktet for tabet (t=3,2s) matcher denne
mekanisme PRÆCIS (se `docs/RAPPORT-211.md`s "Hvad er næste" for hvorfor
denne forklaring alligevel ikke blev en rettelse denne ordre).
