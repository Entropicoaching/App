# Rapport — Ordre 221: sporet mister stangen i vendingen

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`sporet-i-vendingen`, forgrenet fra `main` (`1dad534`, ordre 211 merget).
Fem commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `6274846` | Glat vending målt uden tidsgrænse — ægte sporing lykkedes |
| 2 | `cdb9f54` | homeRecoveries er 0 fordi genfindingen aldrig starter |
| 3 | `fdc3bcd` | Trekantsbølgen mod virkeligheden — rigtige klip sidder fast |
| 4 | `85f080a` | To verify:*-scripts skriver ikke længere over leverance-facit |
| 5 | `64ef85d` | e2e til sidst — glat klip holder ikke, ikke tilføjet til run-all |

Arbejdstræet er rent efter hver commit. Ingen push. Ingen produktions-
Supabase. Ingen video committet. Ingen atletdata i denne rapport (kun
tidspunkter og pixel-tal — ingen navne, ingen billeder).

## Hvad ændret

**Commit 1 — den glatte bevægelse, målt til ende.**
`scripts/make-test-clip.mjs` fik en `--glat`-variant (genopbygget efter
ordre 211s forsøg, som blev rullet helt tilbage): smoothstep-vending i
begge ender af hver rep + en 0,3s pause i bunden, samme facit-tidslinje som
før. Skrives til egne filnavne (`synthetic-set-glat.mp4`), rører intet ved
standardklippet. `e2e/coach-sporing-trace.mjs` fik `--glat` og
`--max-minutes=N` — ingen 120s-standardgrænse.

**Fund: med maskinen for sig selv fuldførte den ægte sporing gennem alle 5
reps på 74s** (599/599 gyldige frames, 5/5 reps detekteret, `homeRecoveries`
slet ikke nødvendigt). `elapsedMs/mediaSeconds` = 3,71s ægte tid pr. sekund
video — PRÆCIS samme tal som den fejlbehæftede, frosne standard-kørsel
(også 3,71s/s, se commit 1's `raw`-felt i `outputs/_seneste/sporing-trace/`).
**Ordre 211/`docs/FRAVALGT-211.md`s "aldrig færdig" (308s, stadig fastlåst)
skyldtes efter alt at dømme fire samtidige Claude-sessioner på samme
maskine dengang, ikke en iboende 10x-omkostning ved ægte sporing** — selve
beregningskosten pr. videosekund er ens, uanset om trackeren rent faktisk
arbejder eller blot gentager et fastfrosset punkt.

Denne konklusion blev dog IKKE bekræftet som universel — se commit 5, hvor
samme `--glat`-klip en anden gang sad fast i over 300s. "Med maskinen for
sig selv" er ikke en garanti, kun det denne ordre havde denne gang.

**Commit 2 — hvorfor genfindingen aldrig finder.**
`public/videocoach.html`s hjemme-genfindingslogik (`lost>=2`-blokken) fik
`recoveryGate`-instrumentering bag den eksisterende `TRACKER_PROBE`-guard:
klassificerer hvert forsøg i én af syv gensidigt udelukkende grunde
(`pending-first-look`, `pending-mismatch`, `weak-plate-match`,
`no-plate-search-hit`, `recovered-features-too-few`,
`recovery-jump-too-large`, `recovered`) — samme betingelser og rækkefølge
som før, ingen ændring af selve accept/afvisningslogikken.

**Fund: PÅ DET SYNTETISKE KLIP forsøges genfinding ALDRIG (0 `recoveryGate`-
indslag), fordi `plateIdentityUsable` (linje ~4676, kræver
`plateBase.circle>8 && cover>=.35`) er FALSK for hele kørslen** (målt
`circle=-77,4`, dybt negativ — ikke tæt på grænsen). Denne ene boolean
gater BÅDE identitets-tjekket-ved-accept OG hele hjemme-genfindings-
mekanismen. `trackerMode` falder tilbage til `'multipoint-flow-only'`, ren
feature-flow uden noget plade-baseret sikkerhedsnet — det er derfor en
falsk, stabil positionslås (fx frame 99 i ordre 211s trace) aldrig blev
opdaget eller rettet.

Dette er IKKE en lille, forstået søgeradius/tærskel-fejl inde i selve
genfindingsforsøget — det er en strukturel forudsætning der fejler før
noget forsøges. Rettelse fravalgt (se `docs/FRAVALGT-221.md`), da det er
uklart om det er en egenskab ved det syntetiske klips tegnede tekstur eller
en ægte tracker-svaghed. Commit 3 afprøver netop dette på rigtige klip.

**Commit 3 — trekantsbølgen mod virkeligheden.**
Ny `e2e/coach-sporing-trace-real.mjs` kører samme instrumentering mod
`test-clips\marc-doedloeft-270.mov` (Marcs eget 1-reps dødløft) og
`test-clips\vis-mig-nu-4-reps-realistisk.mp4` (samme rep, strukket til 4).
Klik-punktet er MÅLT I HÅNDEN (samme tal som
`scripts/verify-videocoach-plate-detect.mjs`s `KNOWN_CLIPS`:
cx=700,cy=1230 ved 1440×1920, ca. t=1,0s) — intet uafhængigt facit findes
for et rigtigt klip.

**Undervejs fandtes en fejl i mit eget arbejde:** da commit 1+2 blev
splittet op i separate, rene commits, blev de nye `clickAtS`/`clickTarget`-
parametre midlertidigt fjernet fra `e2e/coach-sporing.spec.mjs` og ikke
gendannet før flere prøvekørsler — de brugte derfor utilsigtet det
SYNTETISKE klips egen `truePos(1.8)`-position (proportionalt ~50%/33% af
canvas) i stedet for det hånd-målte punkt. Fundet, rettet, og alle kørsler
gentaget; kun de kørsler der rent faktisk brugte det korrekte klikpunkt er
rapporteret som facit nedenfor.

**Tabel (facit-kørsler, korrekt klikpunkt):**

| Klip | Kalibreret | Sporet igennem | Vending tabt? | Genfundet? |
|---|---|---|---|---|
| `marc-doedloeft-270.mov` | Ja | ALDRIG (2/2 forsøg) | Ukendt — sad fast før klippet nåede at slutte | n/a |
| `vis-mig-nu-4-reps-realistisk.mp4` | Ja | ALDRIG (3/3 forsøg samlet, inkl. tidligere forsøg) | Ukendt — samme mønster | n/a |

Begge klip fandt en gyldig ring (kalibreringen lykkedes), og sporingen
begyndte at arbejde aktivt ("Analyserer stangbanen") — men sad fast ved
**"Holder sidste sikre punkt · 96%"** (marc) hhv. **"· 98-99%"** (den
strukkede fil) og blev ALDRIG færdige inden for 15 minutter pr. forsøg.
`plateIdentityUsable` er (modsat det syntetiske klip) SAND for rigtig
optagelse (`trackerMode: 'deadlift-fail-closed-home-recovery'`, målt på et
tidligere forsøg med det utilsigtede klikpunkt) — hjemme-genfindings-
mekanismen ER altså aktiv på rigtige klip, i modsætning til det syntetiske
klips helt lukkede vej fra commit 2.

**Svar på ordrens eget spørgsmål: JA, 211's fund rammer atleter — men
anderledes end det syntetiske klip viste, og muligvis værre.** Det
syntetiske klips fejl var hurtig og ærlig (fastfrosset punkt, men selve
kørslen blev færdig på ~20-75s med et klart "ingen rep fundet"). De rigtige
klip sidder derimod FAST nær slutningen og bliver aldrig færdige — en coach
der analyserer en atlets rigtige dødløft kan opleve browseren hænge i
adskillige minutter uden feedback, med ingen fundet timeout i selve
sporings-loopet der ville afbryde det af sig selv. Rodårsagen (formentlig
en dyr, gentaget `plSearch`-baseret genfindings-sti på et fuldt
1440×1920-billede, uden øvre grænse for forsøg — se `docs/FRAVALGT-221.md`)
er IKKE bekræftet denne ordre og anbefales som næste ordres højeste
prioritet.

**Commit 4 — de to facit-skrivere.**
`scripts/verify-videocoach-film-guide.mjs` og
`scripts/verify-athlete-reps-per-set-mobile.mjs` skrev direkte til de
COMMITTEDE `outputs/film-foer-du-sender/` og `outputs/reps-pr-saet/`
(fundet i `docs/RAPPORT-211.md`s "Hvad er næste" 3, samme fund som
`docs/RAPPORT-205.md`). Begge fik samme mønster som ORDRE 205
(`scripts/leverance-sti.mjs`): skriver nu til den git-ignorerede
`outputs/_seneste/<navn>/` som standard, kopieres kun ind over leverancen
med `--opdater-leverance`.

Verificeret: begge scripts kørt manuelt, `git status --short` tomt
bagefter.

**Commit 5 — e2e til sidst, kun hvis den holder.**
`e2e/coach-sporing-reliability.mjs` fik `--glat`-støtte for at afprøve
ordrens egen betingelse (10/10 = kom ind i `npm run e2e`).

**Fund: IKKE pålidelig.** Et enkelt forsøg
(`node e2e/coach-sporing-reliability.mjs --glat 1`) sad fast ved
"Analyserer stangbanen · 98%" og blev aldrig færdig inden for 300s — samme
klasse fund som commit 3's rigtige klip, ikke commit 1's egen succesfulde
74s-kørsel. Samme klip/kode kan altså BÅDE fuldføre på 74s OG sidde fast i
5+ minutter, afhængig af noget der endnu ikke er forstået. `e2e/run-all.mjs`
er derfor IKKE ændret — en fastlåst (ikke blot langsom) prøve i `npm run
e2e` ville gøre HELE prøvesuiten upålidelig for alle fremtidige kørsler,
langt værre end blot at udelade denne ene prøve.

## Testresultat

- **`npm run lint`:** rent.
- **Alle 34 `verify:*`-scripts:** grønne.
- **`npm run e2e`:** grøn (25,6s — uændret, coach-sporing IKKE tilføjet, se commit 5).
- **`git status --short`:** tomt efter alle fem commits.

## Hvad er næste

1. **Højeste prioritet:** rigtige klip sidder fast nær slutningen (96-99%)
   i stedet for at fejle hurtigt — se `docs/FRAVALGT-221.md`. En coach kan
   opleve browseren hænge i minutter uden feedback på en ægte atlets
   video. Anbefalet instrumentering: `plSearch`-kaldenes egen tid/antal bag
   `TRACKER_PROBE`, kørt mod et klip der rammer denne tilstand.
2. `plateIdentityUsable=false` på det syntetiske klip (commit 2) — afklaret
   af commit 3 til at være en egenskab ved TESTKLIPPET, ikke en generel
   tracker-svaghed (rigtige klip har `plateIdentityUsable=true`). Lavere
   prioritet end punkt 1.
3. Har betydning for Hara (Coaching-planeten, "Appen mærkbart bedre"):
   denne ordre viser at 211's fund IKKE er begrænset til det syntetiske
   klip — det rammer atleter, og på rigtige klip er symptomet en hængende
   browser, ikke en hurtig fejlbesked. Det ændrer hvor meget dette haster.

## Ærlige grænser

- Ingen ændring af trackerens produktionsadfærd — kun instrumentering bag
  eksisterende guards (`TRACKER_BENCHMARK`/`TRACKER_PROBE`) og test-infra.
- Rodårsagen til "sidder fast nær slutningen" på rigtige klip er IKKE
  fundet, kun observeret og reproduceret. Ingen `workMs`-percentiler findes
  for et klip der aldrig bliver færdigt.
- `plateIdentityUsable`s negative `circle`-score på det syntetiske klip er
  målt, ikke forklaret ned til `plEvidence`s mellemregninger.
- Ordre 211s spørgsmål om hvorvidt en glat vending i sig selv løser
  sporingstabet er stadig ikke endeligt: én kørsel fuldførte perfekt (commit
  1), én anden sad fast (commit 5) — samme klip, samme kode.
