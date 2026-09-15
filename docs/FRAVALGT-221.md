# Hvad jeg fravalgte (Ordre 221) — til Dhruvas næste ordre

## plateIdentityUsable=false på det syntetiske klip — ikke en lille, forstået tærskel-rettelse

`docs/RAPPORT-221.md`s commit 2 finder at `homeRecoveries` er 0 IKKE fordi en
søgeradius eller en tærskel inde i selve genfindings-forsøget er forkert (se
`recoveryGate`-instrumenteringen, `public/videocoach.html` linje ~4900-4960),
men fordi genfindings-forsøget ALDRIG starter: `plateIdentityUsable`
(beregnet ÉN gang ved sporingens start, linje ~4676, kræver
`plateBase.circle>8 && plateBase.cover>=.35`) er falsk for hele det
syntetiske klips kørsel (målt `circle=-77.4`, dybt negativ). Denne ene
boolean gater BÅDE identitets-tjekket-ved-accept (linje ~4871) OG hele
hjemme-genfindingsmekanismen (linje ~4900) — ingen af dem forsøges
nogensinde. `trackerMode` falder tilbage til `'multipoint-flow-only'`, ren
feature-flow uden noget plade-baseret sikkerhedsnet.

**Hvad jeg IKKE gjorde:** rettede ikke `plEvidence`s `circle`-scoring
(linje ~4287-4313, radial kant-konsistens omkring den kalibrerede radius)
for at få `plateIdentityUsable` til at blive sand på det syntetiske klip.
To grunde:

1. **Uklart om det er en tracker-svaghed eller en syntetisk-klip-artefakt.**
   Det syntetiske klips tegnede skive (kant-ring, midterring, centerprik, to
   roterende "feature"-prikker — se `scripts/make-test-clip.mjs`s egen
   toptekst) er designet til at give `mpGoodFeatures` nok kontrast, IKKE
   specifikt til at bestå `plEvidence`s ring-konsistens-scoring (som måler
   noget andet: en KONSISTENT kant ved præcis den kalibrerede radius, hele
   vejen rundt, med lav radial spredning mellem modstående vinkler). En
   rettelse her uden at vide om ægte klip har samme svaghed risikerer at
   overfitte til testklippets specifikke tekstur.
2. **Grænsen for denne ordre:** "ingen ændring af trackerens
   produktionsadfærd uden en test der beviser gevinsten på et rigtigt
   klip" — `plEvidence` er kernen i BÅDE identitetstjek og genfinding for
   alle løftarter, en ændring her har stort spredningsareal.

**Hvad commit 3 fandt om det samme spørgsmål på RIGTIGE klip:** se
`docs/RAPPORT-221.md`s commit 3-afsnit — afgør om denne svaghed rammer
atleter (hvis `plateIdentityUsable` også er falsk der) eller kun er en
egenskab ved det syntetiske testklip.

**Hvad det ville koste at forfølge videre:** forstå PRÆCIS hvorfor
`plGray`/`plCapture`s target-radius (fra auto-kalibreringen) og det
syntetiske klips faktiske tegnede kant-profil (v=42 indeni, v=66 lige
inden for kanten ved `r>PLATE_R-6*SCALE`, baggrund ~118±støj udenfor) giver
en NEGATIV `circle`-score i stedet for en positiv — kræver at instrumentere
`plEvidence`s mellemregninger (`edge`, `radial`, `pairDev`, `pairSpread`)
punkt for punkt, ikke kun det endelige tal. Egen ordre, med `docs/RAPPORT-221.md`s
commit 3-fund som udgangspunkt for om det overhovedet er værd at forfølge.

## Rigtige klip sidder fast nær slutningen (96-99%) i stedet for at fejle hurtigt — presserende, ikke rettet

`docs/RAPPORT-221.md`s commit 3 kørte den ægte klik-igennem-sporing mod
BEGGE rigtige klip (`marc-doedloeft-270.mov`, `vis-mig-nu-4-reps-realistisk.mp4`)
med et hånd-målt klikpunkt (samme som `scripts/verify-videocoach-plate-detect.mjs`s
`KNOWN_CLIPS`). Modsat det syntetiske klip (commit 1: fuldførte på 74s, ingen
straf) sidder BEGGE rigtige klip fast ved "Holder sidste sikre punkt · 96%"
hhv. "· 98-99%" og bliver ALDRIG færdige inden for 15 minutter — reproduceret
2/2 gange (marc) og 3/3 gange (den strukkede 4-reps-fil). `plateIdentityUsable`
er (modsat det syntetiske klip) SAND for rigtig optagelse (målt på ét
gennemført forsøg med et andet, utilsigtet klikpunkt — se
`docs/RAPPORT-221.md`), så hjemme-genfindingsmekanismen ER aktiv her, i
modsætning til det syntetiske klips helt lukkede vej (se ovenfor).

**Hvad jeg IKKE gjorde:** fandt ikke den præcise mekanisme bag "sidder fast"
(vs. det syntetiske klips "fryser og bliver hurtigt færdig alligevel", se
`docs/SVAR-211.md`). Et gennemført run med `window.__vcTrackerBenchmarkLast`
(pr.-frame `workMs`) findes ikke for et klip der ALDRIG bliver færdigt —
kun `progressLog` (banner/procent pr. 2s), som viser AT det sidder fast, ikke
HVOR i koden. Mest sandsynlige mistanke (ubekræftet): den generiske
hjemme-genfindings-sti (`lost>=2`, `plSearch` over et gitter af kandidater,
dyrt pr. kald) kører gentagne gange pr. resterende frame på et ægte
1440×1920-billede (langt dyrere end det syntetiske klips 720×1280), uden
øvre grænse for hvor mange gange den prøver igen — men dette er en
hypotese, ikke bekræftet ved instrumentering af selve `plSearch`-kaldene.

**Hvorfor dette er værre end commit 2's synteske fund:** en coach der
analyserer en RIGTIG atlets dødløft kan opleve at browseren hænger i
adskillige minutter uden feedback (ikke en hurtig, ærlig "ingen rep
fundet"-fejl som det syntetiske klip gav på 20-24s). Ingen brugerflade-
timeout er fundet i `public/videocoach.html`s sporings-loop, der ville
afbryde dette af sig selv.

**Hvad det ville koste at forfølge videre:** instrumentere `plSearch`s
egne kald (antal, tid pr. kald) bag `TRACKER_PROBE`, køre mod et klip der
rammer denne tilstand, og se om kald-antallet/tiden eksploderer nær
klippets slutning. Samme "ro til at afprøve"-behov som commit 1 (op til
15-30 min pr. forsøg). **Anbefales som NÆSTE ordre — højere prioritet end
plateIdentityUsable-spørgsmålet ovenfor, fordi det er en brugerflade-hæng,
ikke kun en manglende funktion.**
