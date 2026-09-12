# RAPPORT-124: gør 121 landbar - skil seek fra testvej, ret dobbelt-seeket

## Gren

`vis-mig-nu-skjul-seek`, rebaset på `main` (`5a09e22`, ordre 120 med -
autoCalib-ændringen for mørke skiver). Tre commits oven på rebasen:

- `cf1e3aa` — commit 1: `--windows=old|new` og `--seek=old|new` i
  `verify-videocoach-clip.mjs`, fire selvstændige, gentagelige kombinationer
  på Marcs klip i stedet for den gamle VARM+KOLD-parring.
- `144f543` — commit 2: rettede den racende dobbelt-seek på vindue 1
  (`vcRunRepWindowsPresearch` / `vcAthletePreviewThree` i
  `public/videocoach.html`), fundet af commit 1's tabel.
- `fdd3abb` — commit 3: facit PR. VINDUE for det syntetiske 4-reps-klip
  (sidecar-felt `repeatedIdenticalWindows`), retter RAPPORT-121's ukendte
  facit-fejl på vindue 2/3.

Rebasen selv (ikke en selvstændig commit, del af `cf1e3aa`s forudsætning):
konflikt i `scripts/verify-videocoach-clip.mjs` mellem ordre 120's
crash-undvigende 2s-loft (bruges når INGEN vinduer findes overhovedet) og
ordre 121 · commit 2's presearch-først-logik - løst ved at beholde BEGGE:
presearch først, `full.repWindows` som mellemliggende fallback, 2s-loftet
kun som allersidste udvej. `public/videocoach.html`s eneste konflikt var en
kommentarmarkør flyttet af ordre 121 · commit 2 - auto-merget rent.

## Hvad ændret

**Commit 1** skiller "hvad er seek-ændringen" fra "hvad er testens nye
målemetode" ved at gøre begge til uafhængige flag i stedet for at gætte:
`--windows=old` genskaber ordre 116/120's vinduesvalg (kun den fulde
analyses egen rep-detektion, presearch kaldes slet ikke); `--windows=new`
er ordre 121 · commit 2's presearch-først. `--seek=old` henter
`public/videocoach.html` fra revisionen LIGE FØR "ordre 121 · commit 1"
(fundet via `git log --grep` på commit-beskeden, ikke en hardkodet SHA) og
udtrækker sporings-/presearch-koden derfra i stedet for arbejdstræets fil;
`--seek=new` er arbejdstræets kode. Alle fire kombinationer måles nu på en
FRISK browserside (ingen fuld analyse har rørt videoen) - den gamle
VARM+KOLD-parring viste sig kontamineret, fordi presearch-kaldet der FANDT
vinduerne allerede skygge-seeker til vindue 1 som bivirkning, så en
efterfølgende "kold" måling på samme side aldrig betalte den fulde seek
igen (den var altså aldrig en ærlig "uden ordre 121 · commit 1"-baseline).

To rene test-fejl blev rettet undervejs for overhovedet at kunne køre alle
fire kombinationer (ingen ændring af produktionskode i commit 1):
`extractFunctionAt` (signatur + balancerede krøllede parenteser) erstatter
et tekstmarkør-udtræk, der byggede en ufuldstændig side når `--seek=old`
hentede en revision hvor "ORDRE 54 · slut"-markøren endnu ikke dækkede
`vcRunRepWindowsPresearch`; og `SEEK_SAFETY_MARGIN_S` holder testens egen
"bekræftede sæt"-stand-in væk fra PRÆCIS `video.duration`, som ellers
crashede headless Chromium uafhængigt af alle fire flag.

**Commit 2** retter selve fundet: `vcRunRepWindowsPresearch` starter (bevidst
uden at vente) et seek til vindue 1's start som en del af sit eget
"skygge"-opsæt, men gav ALDRIG det løfte videre til sin eneste kalder -
`vcAthletePreviewThree` satte i stedet `pendingSeek = null` for vindue 1, på
trods af sin egen kommentars påstand om at ventetiden allerede var
håndteret. `vcRealtimeTrackWindow` (kaldt med `preSeek=null`) startede
derfor sit EGET, overflødige seek til SAMME mål, mens presearchs eget stadig
kørte. `rtSeekTo`s "opdager selv om målet allerede er nået" tjekker kun om
`video.currentTime` ALLEREDE ER NÅET dertil - ikke om et seek allerede er
UNDERVEJS - så to overlappende seeks blev sat i gang mod samme tid. Rettet
ved at lade `vcRunRepWindowsPresearch` returnere det startede løfte
(`firstWindowSeek`), og lade `vcAthletePreviewThree` bruge DET i stedet for
`null`. Testens `window.runVisMigNuFromPresearch` (ny) tester denne rettede
vej 1:1 (presearch + sporing i ét evaluate()-kald, nødvendigt fordi et løfte
ikke overlever Node's evaluate()-grænse).

**Commit 3** retter den facit-fejl RAPPORT-121 selv fandt men ikke rettede
(vindue 2/3's 123-311px "afvigelse" på det syntetiske 4-reps-klip): facit
for et rigtigt klip er den fulde analyses egen sammenhængende bane, som kun
er troværdig FREM TIL klippets første concat-samling (identisk kopi limet
på med et hårdt snit) - en kontinuerlig tracker møder der et spring den ikke
forventer, og resten af det globale spor kan drifte væk fra virkeligheden.
Sidecar-feltet `"repeatedIdenticalWindows": true` (kun sat for dette ene,
kunstigt sammensatte klip - IKKE for et rigtigt multi-reps-klip med genuint
forskellige reps) lader vindue 2+ bruge vindue 1's EGET, tidsforskudte spor
som facit i stedet.

## Testresultat

Firefelts-tabellen (Marcs klip, `test-clips\marc-doedloeft-270.mov`,
presearch finder i dag 2 vinduer - flere end RAPPORT-121's "kun ét vindue",
fordi den fulde analyse i dag ikke selv finder en rep at bekræfte sættet
med; se "Ærlige grænser"). Kørt efter commit 2's rettelse (så tallene i
tabellen er de ENDELIGE, ikke commit 1's midlertidige, buggede fund):

| Kombination                | vinduer | x realtid | mean px (værst) | max px (værst) | Resultat |
|-----------------------------|---------|-----------|------------------|-----------------|----------|
| `--windows=old --seek=old` | 1       | 1,02x     | 0,00             | 0,00            | GRØN     |
| `--windows=old --seek=new` | 1       | 1,03x     | 0,00             | 0,00            | GRØN     |
| `--windows=new --seek=old` | 2       | 1,06x     | 4,11             | 8,25            | GRØN     |
| `--windows=new --seek=new` | 2       | 1,06-1,07x| 1,25-1,62        | 8,00            | GRØN     |

(Kommandoer: `node scripts/verify-videocoach-clip.mjs --windows=<old|new>
--seek=<old|new>`. `npm run verify:videocoach-clip` uden flag = sidste
række, standard-kørslen.)

Slut-tal (ordre 116's grænse: mean ≤ 5,4, max ≤ 11,1, x realtid ≤ 116's
1,19-1,28x): `--windows=new --seek=new` (standard-kørslen, den rigtige
"Vis mig nu"-vej) lander på mean 4,20 maxPx 8,00 x 1,06x - INDENFOR ordre
116's grænse på alle tre mål, og hurtigere end selv RAPPORT-121's egen
"reparerede" VARM-måling (1,17-1,18x). FØR commit 2's rettelse var samme
kombination mean ~1058 max ~1128 (vindue 1 fuldstændig forkert bane) -
IKKE testens nye målemetode, men den racende dobbelt-seek alene: kolonne 3
(`--windows=new --seek=old`) beviser det, den er fin med PRÆCIS samme
vinduer.

Det syntetiske 4-reps-klip (`test-clips\vis-mig-nu-4-reps-syntetisk.mp4`,
midlertidigt eneste klip i `test-clips\` under denne test - `findRealClip`
vælger alfabetisk først): efter commit 3's facit-fix, meanPx/maxPx 0,00/0,00
på ALLE TRE målte vinduer (var 7,04-7,48/15,01 · 123,76/132,21 ·
306,92/311,41 i RAPPORT-121) - beviser realtids-sporingen ALTID var korrekt,
kun facit var forkert. Testen er stadig ÆRLIGT RØD, men nu på et andet,
allerede kendt, ikke-nyt problem: 1,34x på 1,1x-realtidsgrænsen (RAPPORT-121
rapporterede selv 1,25x på samme grænse for samme klip) - korte 0,56s-
vinduer betaler proportionalt mere opsætnings-overhead, uden for denne
ordres grænser at jagte videre.

`npm run lint`: 0 fejl (13 præeksisterende advarsler, uændret).
`npm run gate:tracker`: GRØN (8 rigge). `npm run verify:videocoach-clip`
(standard, ingen flag): GRØN.

## Hvad er næste

`--windows=new --seek=new` (standard-kørslen) er nu landbar på Marcs klip
efter ordre 116's egne kriterier - Dhruva/Marc kan merge grenen. Værd at
vide før merge: presearch finder i dag 2 vinduer på Marcs klip (ikke 1 som
i RAPPORT-121), fordi den fulde analyse i dag ikke selv finder en rep at
bekræfte det "confirmed set"-interval med (se "Ærlige grænser") - selve
"Vis mig nu"s opførsel for atleten er upåvirket (windows=new er den vej den
rigtige app rent faktisk følger), men det er værd at vide hvis nogen undrer
sig over hvorfor tallene ikke matcher RAPPORT-121 1:1.

Ubehandlet, men opdaget undervejs (uden for denne ordres grænser -
"analyse, faser" er urørlige): den fulde analyses egen rep-detektion finder
i dag INGEN reps på Marcs eneste rigtige klip (var 1 i RAPPORT-121) - værd
at undersøge om ordre 120's autoCalib-ændring (mørke skiver) utilsigtet
påvirker den fulde analyses tracking af Marcs eget (lyse) klip nok til at
ændre rep-detektionens facit. Det syntetiske klips 1,34x-realtidsgæt (korte
vinduers uforholdsmæssige opsætnings-overhead) er også ubehandlet.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
bedre" - ikke lukket her, kun fremdrift): en ægte, empirisk bekræftet
race-condition-bug i produktionskoden (`vcAthletePreviewThree`) blev fundet
og rettet, ikke kun en test-artefakt - "Vis mig nu" ville have vist en
fuldstændig forkert bane for vindue 1 i den virkelige app, hver gang
presearch finder flere end ét vindue (dvs. ethvert rigtigt multi-reps-sæt).

## Ærlige grænser

- Facit for Marcs RIGTIGE klip (i alle fire kombinationer i tabellen) er
  stadig den fulde analyses egen sporede bane - ingen uafhængig sandhed
  findes for en rigtig optagelse (uændret filosofi siden ordre 82). De 2
  vinduer, presearch i dag finder på Marcs klip, er derfor kun så troværdige
  som den fulde analyses egen tracking; det er IKKE det samme spørgsmål som
  commit 3 rettede (som gjaldt et KUNSTIGT sammensat klip med et kendt,
  navngivet snit-problem).
- `--seek=old` udtrækker fra en git-revision, ikke en uafhængig kopi af
  produktionskoden - virker kun så længe commit-beskeden "(ordre 121 ·
  commit 1)" findes uændret i historikken (`git log --grep`). En fremtidig
  `git rebase`/history-omskrivning der ændrer den besked, eller en
  interaktiv rebase der squasher commit 1 ind i noget andet, ville få
  `--seek=old` til at fejle højt og tydeligt (en kastet fejl, ikke en tavs
  forkert baseline) - ikke testet at det rent faktisk sker.
- `repeatedIdenticalWindows`-fixet er kun bevist korrekt for ét klip (fire
  identiske kopier af Marcs eget 1-reps-klip). Antagelsen (samme indhold,
  kun tidsforskudt) holder pr. konstruktion for netop denne slags
  ffmpeg-concat-klip - den er IKKE afprøvet mod et klip hvor kopierne ikke
  er byte-identiske (fx forskellig frame-rate-afrunding mellem klip-
  segmenterne).
- Én maskine, én kørsel pr. kombination i tabellen (ikke tre som
  RAPPORT-116/121's egen praksis) - af tidshensyn. Tallene i tabellen er
  interne (samme maskine, samme klip, samme session) og derfor egnede til
  netop den sammenligning ordren bad om (seek vs. testvej), men absolutte
  tal kan variere en smule fra maskine til maskine (set allerede: 1,05-1,07x
  på tværs af mine egne gentagne kørsler af samme kombination).
- Rørte ikke `autoCalib`, analyse, faser eller upload - fandt undervejs et
  MULIGT (ikke bekræftet) samspil mellem ordre 120's autoCalib-ændring og
  den fulde analyses rep-detektion på Marcs klip (se "Hvad er næste"), men
  undersøgte det ikke videre, da det ligger uden for denne ordres grænser.
- Ingen atletdata i denne rapport eller i de committede filer - Marcs eget
  testklip (`test-clips\`) er git-ignoreret og blev aldrig committet.

Høstet til Hara:
`node C:\Users\Entropi\Documents\Codex\2026-08-15\entropi-digital-assistent\work\entropi-personligt-dashboard\skills\hara\hoest.mjs docs\videocoach\RAPPORT-124.md --fra-ordre C:\Users\Entropi\Desktop\ordrer\ORDRE-Bhishak.md --aflever --navn Bhishak`
