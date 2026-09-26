Ordre 422

# Atletens uge, del 2: tallet på Fremgang kan læses, én kvittering efter video, og de tre små fra 419

Alle mål er taget headless i Chromium ved 390 × 844 med touch og iPhone-UA, mod e2e-mocken
og den syntetiske uge fra `outputs/419/uge-faelles.mjs`. Der er ingen atletdata og ingen
kald mod prod.

## Gren

`atletens-uge-2` fra `main` (`30d71dd`, 419 merget). Grenen er ikke pushet.
- blok 1: `74e352f` I4, Fremgang
- blok 2: `44b2221` I5 og de tre små
- blok 3: commit efter `44b2221` med build, offline-bevis, VideoCoach-test og denne rapport

## Hvad ændret

**I4, Fremgang** (`src/athlete/FremgangTab.jsx`)
- Over grafen står nu én linje i normal størrelse (15 px):
  "Squat e1RM 114 kg, +6 kg siden uge 36". Det samme gælder for Bænk, Dødløft og alle
  andre øvelser med mindst to uger. Går tallet ned, står der "−X kg", og står det stille,
  står der "uændret".
- Etiketterne står inden for grafen, 11–14 px høje (før 6–8 px). Det sidste punkt har
  "114 kg 97.5×5" over sig, det første punkt har sit eget tal, og aksen viser "uge 36" og
  "uge 38" i stedet for "W36"/"W38".
- Før og efter ved 390 px: `outputs/422/foer/fremgang-*.png` og `outputs/422/efter/fremgang-*.png`.
  Før var etiketten "114 kg e1" skåret af ved kanten.

**I5, én kvittering efter Send** (`public/videocoach.html`, trackeren er ikke rørt)
- Efter Send skjules statuskortet "Sendt til din coach". Tilbage står kun "Video modtaget ✓ ·
  din coach ser den, når han åbner den", med tæt baggrund, 16 px almindelig skrift og grøn
  tekst på to linjer (`efter/16-video-sendt.png`).
- Før blev kvitteringen ryddet efter 5 s eller tidligere af en ældre timer fra videoindlæsningen.
  Nu står den i 8 s, og en ny besked erstatter den stadig med det samme.

**De tre små fra 419** (`src/athlete/DagensPasCard.jsx`, `src/athlete/saetSkrivning.js`)
- **Ret-panelet** har vægt på én linje og reps på den næste, så det ikke længere brækker
  midt i reps-kontrollerne. Det er samme rettelse, som ordre 314 gav selve kortet.
  Målt: reps − / felt / + står alle på y 388 (før 286/336/336).
- **Pauselinjen** starter ikke efter passets sidste sæt og ryddes, hvis en pause stadig kører
  fra forrige sæt. Det gælder også, når sidste sæt springes over. Mellem sæt starter pausen
  som før.
- **"vis / ret"** husker nu øvelsen, den blev åbnet på, så listen foldes sammen af sig selv,
  når kortet går videre til en ny øvelse eller et nyt pas.

## Testresultat

- `node outputs/422/verify-422.mjs --blok 1`: **GRØN** for Squat, Bænk og Dødløft. Linjen
  har den rigtige form og er 15 px, alle etiketter står inden for grafen og er mindst 10 px høje.
  Før-kørslen (`--foer`) viste etiketter på 6–8 px og tallet uden for grafen.
- `node outputs/422/verify-422.mjs --blok 2`: **GRØN**
  - "vis / ret" er foldet sammen efter skift af øvelse (før: stod foldet ud).
  - Ret-panelet holder hver række på én linje ved 390 px.
  - Der er 1 pauselinje mellem sæt og 0 efter passets sidste sæt (før: 1).
  - Der er én kvittering, 16 px, og den står der stadig efter 6 s (før: to oven i hinanden på
    14 px, væk efter 6 s).
- `npm run lint`: grøn.
- `npm run build`: grøn (`outputs/422/koersel-build.txt`).
- **Offline-beviset** (`BEVIS_UD=outputs/422/offline-bevis node outputs/414/offline-bevis.mjs`):
  grønt i alle tre scenarier, tid, hænger og fortryd-dør (`koersel-offline-bevis.txt`).
- **VideoCoach** (`koersel-videocoach.txt`): upload-flow, submission, buttons-layout, upload,
  labels, film-guide og zoom er grønne.
  - `verify:videocoach-clip` var rød én gang lige efter de andre tests (1,12x mod kravet
    ≤1,1x, meanPx 0,00). Kravet er et tidsforhold.
  - Samme test på main's html var grøn (1,09x), og på grenen var den grøn to gange i træk
    (1,07–1,08x).
- Også grønne: verify:athlete-reps-per-set-mobile, -rest-timer-drift, -tap-targets,
  -training-inputs, -first-day-flow, atletens-uge-holder og `src/nextSet.test.js`.

## Hvad er næste

Efter push kan Marc se følgende på telefonen:
1. Fremgang: "Squat e1RM … kg, +… kg siden uge …" står over grafen, og tallene i grafen kan læses.
2. VideoCoach: efter Send står kun "Video modtaget ✓", tydeligt, i 8 sekunder.
3. Dagens pas: ret-panelet holder reps på én linje, pausen stopper ved passets slut, og "vis / ret" lukker ved ny øvelse.

## Ærlige grænser

- I5 er kun rettet på Send-vejen (standardvejen). To andre veje, der ender i "sendt",
  bruger stadig både statuskortet og banneret: "Din gemte analyse er nu sendt" og
  auto-send efter sporing. De ligger tæt på trackeren, og ordren siger, at trackeren
  ikke må røres.
- "+X kg siden uge N" sammenligner første og sidste uge med en logget vægt på øvelsen. Det
  er ikke nødvendigvis blokkens start. Er der kun én uge, står den gamle tekst "for få uger
  endnu til en kurve".
- Kvitteringens 8 s er et valg. Går atleten fra skærmen, er den væk, ligesom før.
- `verify:videocoach-clip` måler tid og kan blive rød på en travl maskin (se ovenfor).
- Målt mod mocken, ikke på en rigtig telefon.
- For Hara ("Appen mærkbart bedre"): atleten ser nu sin fremgang som ét læsbart tal med
  ændring og får én tydelig kvittering efter video. Det er de to steder i ugen, hvor
  atleten skulle føle, at der sker noget.
