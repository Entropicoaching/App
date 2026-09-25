# RAPPORT 355: VideoCoach holder stangen på vej ned (Vaidya)

## Gren og commits

- Gren: `stangen-holder-nedturen` (fra `main` `e524d5e`), ikke pushet.
- Blok 1: `695833f`: telemetri (`docs/videocoach/nedtur-telemetri-355.mjs`), ingen produktionsfil ændret.
- Blok 2: den commit der indeholder denne fil: rettelsen i `public/videocoach.html`, `desc=`-feltet i telemetrien, migrations-kommentaren og denne rapport.
- Genstart efter strømsvigtet 19:07: blok 2 var skrevet, men ikke committet. Den blev genoptaget uændret fra de to urene filer og derefter verificeret.
- GENSTART 3 (25. sep): samme tilstand (fire urene filer). Verificeringen er kørt igen på de urene filer uden ændringer i koden, og derefter er blok 2 committet.

## Hvad blev ændret

**Klip:** `test-clips\doedloeft-3reps.mp4` findes ikke. Det primære bevis er derfor Marcs eget `marc-doedloeft-270.mov` (1440x1920, 3,88 s, manuelt pladecenter 705,1375, R=195). Det er et andet klip end telefonens sæt på tre reps, men nedturen har samme mønster. Kontrol: `vis-mig-nu-4-reps-realistisk.mp4`.

**Blok 1, fund (frame for frame, basen):**

| frame | t | pos y | vel y | port |
|---|---|---|---|---|
| f110 | 3.667 | 1207 (0,86R over gulvet) | 930 px/s | ok, moves 12 |
| f111 | 3.700 | fastfrosset | 0 | **feature-match**: moves 4, kept 0, krav ≥5 |
| f112-f115 | | fastfrosset | 0 | feature-match; home-recovery: pending-first-look, recovered-features-too-few, pending-mismatch, recovery-jump-too-large |
| f116 | 3.867 | 1352 | 4358 | home-recovery `recovered` (hop på 145 px) |

Identity og jump kom aldrig i spil, for feature-match afviser først (det samme som ENT0094 forudsagde). To ting får genfindingen til at vente: den kræver `lost>=2`, og den søger kun i home-zonen omkring p0 (gulvet). Samtidig dæmpes `vel` ×0,75 pr. tabt frame, så forudsigelsen står stille. Stangen blev derfor først fundet igen, da den lå på gulvet (i Marcs telefonsæt altså først i næste rep).

**Årsagen i én sætning:** Bevægelsessløret ved ~930 px/s på vej ned giver under 5 feature-matches. Den eneste genfinding (home-recovery) kræver `lost>=2` og kan kun finde pladen ved gulvet, så banen fryser midt i nedturen, indtil stangen er tilbage ved startpositionen.

**Blok 2, rettelse (`startMultipointTracking`, ~25 linjer):**
- `lastGoodVel` gemmer hastigheden fra sidste accepterede frame, altså ikke den dæmpede.
- Ved det første tab (`lost=1`), kun i dødløft og kun når nedadhastigheden er over 1 R/s, søger trackeren efter pladen omkring nedturs-forudsigelsen `cur + lastGoodVel·dt`. Den bruger home-recoveryens pladekrav uændret (circle > max(9, 0,34·base), cover ≥ 0,45, pairCover ≥ 0,35, app < 2,6) og accepterer kun fund, der ligger på eller under den nuværende position. Et fund genankrer banen med friske features.
- Home-recovery kører som før, bare kun hvis den nye søgning ikke fandt pladen (`!accepted&&`).
- Telemetrien viser nu `desc=` (no-hit/weak/upward/accepted).
- `supabase/migrations/20260923120000_video_upload_policy_name_fix_v1.sql`: kommentaren er ændret fra "IKKE KØRT" til "KØRT 24. sep 2026 17:45 af Dhruva (Supabase MCP), Marcs ja". SQL'en er uændret, og intet er kørt.

**Efter rettelsen (samme frames):** f111 desc=accepted y=1237 · f112 feature-match ok y=1281 · f113-f115 desc=accepted y=1327, 1375, 1381 · f116 ok. Banen følger stangen hele vejen ned, uden at fryse og uden et hop på 145 px.

## Testresultat

| Kontrol | Base (`695833f`) | Med rettelsen |
|---|---|---|
| Telemetri marc-270, stride 1 / 2 / 3 | 1 / 1 / 1 tab-episode | **0 / 0 / 0** |
| `verify:videocoach-clip` marc-doedloeft-270 | GRØN meanPx 4,15, maxPx 8,00 | **GRØN meanPx 4,15**, maxPx 8,00, 1,06x (25. sep; 24. sep: 4,05). Samme som basen, ikke dårligere |
| `verify:videocoach-clip` vis-mig-nu-4-reps | GRØN 0,00/0,00 | GRØN 0,00/0,00, 1,08x |
| Telemetri 4-reps (autoCalib) | | 0 tab-episoder |
| `node docs/videocoach/tracker-deadlift-descent-rig.mjs` | | GRØN (portene er stadig hver for sig følsomme) |
| `npm run lint` | | grøn |
| `verify:videocoach-migrations`, `-upload`, `-plate-detect` | | grønne |

Baseline blev målt i et midlertidigt worktree af `695833f` med de samme klip (fjernet igen bagefter).

## Hvad er næste

- Til Marc: film samme doedloeft-saet paa 3 reps fra siden paa telefonen, upload det i VideoCoach og se om banen foelger stangen hele vejen ned i rep 2 (ingen frossen streg midt i nedturen); laeg gerne klippet i `test-clips\doedloeft-3reps.mp4`, saa bliver det fast testklip.
- Hara (Coaching, "Appen mærkbart bedre"): VideoCoach mister ikke længere stangen på en hurtig dødløft-nedtur. Det var den fejl Marc så på telefonen efter upload-rettelsen.

## Ærlige grænser

- Telefonklippet med tre reps har jeg ikke haft. Beviset er Marcs 270-klip, hvor den samme port (feature-match ved hurtig nedtur) blev reproduceret og lukket. At det også holder på telefonsættet, er stadig ikke bevist.
- Den nye søgning gælder kun dødløft og kun nedad over 1 R/s. Andre løft og tab på vej op er uændrede.
- Frames der accepteres gennem pladesøgningen, får frameConfidence 0,5. Det indgår i den eksisterende low-confidence-visning; jeg har ikke målt effekten på UI'et.
- Headless kørsel er ikke det samme som mobilens rVFC. Stride 2 og 3 efterligner frames, der springes over, og de er grønne.
