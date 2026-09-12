# Test-klip til trackeren

1. Læg videoklip (mp4/mov) i `test-clips\` - git-ignoreret, aldrig committet.
2. Kør `npm run verify:videocoach-clip` - måler ALLE klip, én tabel pr. klip.
3. Krav pr. klip: `test-clips\manifest.json` (kopiér `test-clips.manifest.example.json` fra repo-roden, se skemaet der).

## Optagelse (ordre 127)

- 3-5 reps, telefon i hoftehøjde, 3-4m fra skiven, liggende, skiven fri af rack, hele løftet i billedet fra start til slut.
- Ingen atletdata i filnavn - kun løfteart, fx `dodloft-lys.mp4`.
- **Lys skive** (`dodloft-lys.mp4`): facit for normal bane.
- **Mørk skive på mørkt gulv** (`dodloft-mork.mp4`): nav/mørk-skive-detektion (ordre 120/127) på ægte optagelse.

## Klip der findes

- `marc-doedloeft-270.mov` - Marcs ægte 1-reps-klip, GRØN facit-reference.
- `vis-mig-nu-4-reps-realistisk.mp4` (ordre 139): 4 reps bygget af Marcs rigtige rep-vindue (0,00-2,55s), strukket til 3,00s ved at GENTAGE frames (ffmpeg `setpts`+`fps`, ikke slowmo - samme bane, flere fysiske frames), 4,00s stille-stang-pause mellem reps - se `scripts/make-realistic-test-clip.mjs`.
- `vis-mig-nu-4-reps-syntetisk.mp4` - ordre 121's ældre, kortere (0,56s-vinduer) klip; kun diagnostisk (manifestet), erstattet af klippet ovenfor som normal-krav.
