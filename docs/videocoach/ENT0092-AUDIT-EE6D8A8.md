# ENT0092 — audit af `ee6d8a8`

## Dom

Det kan **ikke afgøres**, om `ee6d8a8` gjorde dødløft-trackingen bedre eller værre.
Der findes ingen rigtige dødløft-klip med menneskemærkede labels i Entropi Coach-
repositoryet, og de eksisterende Node-rigs udøver ikke `homeStrong` på et mærket
klip. En kodevurdering eller en grøn syntetisk rig er ikke et mål for atletens
tracking.

Denne dom gælder den historiske ændring i `ee6d8a8`:

```js
// før
nx=homeHit.x-homeBias.x; ny=homeHit.y-homeBias.y;
// i ee6d8a8
// ingen opdatering af nx/ny
```

Den ændring var ikke benchmark-gated og kunne påvirke `nearHome`, `jump` og
identitetskontrollen. Derfor kan hverken en mulig gevinst (færre hop-afvisninger)
eller mulig skade (mere akkumuleret drift) udledes uden labels.

## Vigtig korrektion af live-præmissen

`ee6d8a8` er ikke længere den aktive adfærd. `a4d3a16` (8. august 2026) erstattede
den med en bekræftet, halveret home-korrektion: to ens `homeStrong`-frames kræves,
før `nx` og `ny` flyttes. Den lokale `main` var synkron med `origin/main`, og den
serverede `https://app.entropicoaching.dk/videocoach.html` indeholdt
`const confirmed=homePending` — ikke den gamle `if(homeStrong)path.repAnchors`
uden korrektion. Audit-resultatet er altså ikke et rollback-signal for den nuværende
kode.

## Hvad der findes — og hvad det beviser

| Kilde | Resultat | Bevisgrænse |
|---|---|---|
| `git show ee6d8a8` | 1 indsættelse, 4 sletninger; `nx`/`ny` blev fjernet ved `homeStrong` | Bekræfter den historiske adfærdsændring, ikke kvaliteten |
| `ENT0075-BENCHMARK.md` | Frosne rigs har ingen `homeStrong`-sti eller menneskemærkede dødløft-labels | Kan ikke afgøre ee6d8a8 |
| `tracker-deadlift-rig.js` | Syntetisk A/B/C-sammenligning | Har et konstrueret facit (`CX=320`), ikke et menneskemærket klip |
| `run-deadlift-gate.mjs` | Grøn | Kontrakt- og syntaksport; ikke atlet-evidens |

`git ls-files` fandt ingen versionerede video-klip, annotationsfiler eller
ground-truth-data til en før/efter-måling. Der er derfor intet autoriseret
datagrundlag, som en audit kan køre på nu.

## Minimumspakken, der mangler

Et menneske skal levere samme, samtykkede dødløft-klip med frame-/tidsmærkede labels
for mindst:

1. skivens centrum gennem hver relevant frame,
2. gulv/hjem-zonen og hver rep-start/-slut,
3. korrekt rep-antal samt frames, hvor tracking reelt er tabt.

Klippenes før/efter-kørsler skal gemme `?benchmark=1&trackerProbe=1`-output og
sammenligne parenten til `ee6d8a8` mod `ee6d8a8` på identiske startpunkter. Mål
mindst centrumfejl mod label (median og 95-percentil), tabte/afviste frames efter
`homeStrong`, falske jump-afvisninger og korrekt rep-antal. Først da kan Marc dømme,
om ændringen var bedre eller værre; samme pakke kan også vurdere `a4d3a16` separat.

## Udførte kontroller

- `git show ee6d8a8` og efterfølgende `a4d3a16`: historik og aktiv kode gennemgået.
- `node docs/videocoach/run-deadlift-gate.mjs`: grøn, inkl. syntaks og bræk-tests.
- Lokal `main...origin/main`: synkron før auditbranchen blev oprettet.
- Serveret VideoCoach: bekræftet aktuel, bekræftet home-korrektion.

Ingen trackeradfærd, `main`, data, deploy eller atletkontakt er ændret.
