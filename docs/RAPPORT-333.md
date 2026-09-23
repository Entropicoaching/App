# Rapport: ordre 333, VideoCoach virker ikke (find fejlen, ret den, bevis den)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Marcs dom var: "VideoCoach i coaching-appen virker vist ikke." Han har ret. Der var to fejl, og ingen af dem kom fra 293, 301, 314, 320, 325 eller 330. Betydning for Hara (Coaching-planeten, delmålet "Appen mærkbart bedre"): ja. Ingen atlet har kunnet sende en video til coachen siden 5. sep. "Vis mig nu" har aldrig vist en sporet rep i appen siden 6. sep.

## Gren

Grenen hedder `videocoach-virker` og er lavet fra `main` (`ce65d2e`).

- `1912f23` blok 1: rettelse af storage-policyerne som en migration, der IKKE er kørt, plus en enhedstest
- denne commit, blok 2: rettelse af "Vis mig nu" i `public/videocoach.html`, e2e-prøven i `proever`, skærmbilleder og rapport

Ingen push. Ingen migration er kørt. Ingen storage-ændringer. Produktionen er kun læst med `select` og logforespørgsler. Ingen atletdata eller rigtige videoer, kun syntetisk klip.

## Hvad ændret

**Fejl 1: produktionen afviser hver upload (den der gør VideoCoach ubrugelig for atleten).**
- Den brækkede ændring er ordre 57, migrationen `video_upload_and_go_v1` (kørt 5. sep, version `20260905164018`). Linjen der gør skaden, i alle fire policies:
  ```
  +      where a.id::text = (storage.foldername(name))[1]
  ```
  Linjen står inde i `exists (select 1 from public.athletes a ...)`. `athletes` har selv en kolonne `name`, så Postgres binder `name` til atletens navn og ikke til objektets sti. Postgres' egen gengivelse af policyen i `pg_policies` viser det direkte: `storage.foldername(a.name)`.
- Beviserne fra produktionen (kun læsning):
  - Bucketen `videocoach-uploads` er som i migrationen: privat, 500 MB og de fem video-MIME-typer.
  - Alle fire policies findes med de rigtige navne, kommandoer og roller, men med `a.name`.
  - `count(*) filter (where a.id::text = (storage.foldername(a.name))[1])` giver 0 af 10 atleter. Den samme test med objektstien giver 10 af 10.
  - Bucketen har haft 0 objekter nogensinde. Der er 0 `awaiting_analysis`-rækker, og den seneste `video_analyses`-række er fra 7. sep.
  - Edge-loggen viser i dag `POST /storage/v1/object/videocoach-uploads/…` med **400** tre gange (07:36, 07:44 og 07:44 UTC). Det er en atlets forsøg, der blev afvist.
- RPC'erne er i orden, også efter `coach_briefing_seen_v1`. `get_my_shared_video_analyses_v3`, `get_my_video_analysis_submission_identity_v3` og `entropi_training_signals_v1` findes, `authenticated` kan køre dem, og loggen viser 200 på `get_my_shared_video_analyses_v3` hele dagen.
- Rettelsen er `supabase/migrations/20260923120000_video_upload_policy_name_fix_v1.sql`. Den ændrer de fire policies med `alter policy` og skriver `objects.name` i stedet for `name`. Alt andet er uændret. **Den er ikke kørt, Marc kører den.**
- Enhedstesten er `src/storagePolicySql.test.js` med `src/storagePolicySql.js`. Den finder en ukvalificeret `storage.foldername(name)` i en storage-policy med en underforespørgsel. Den kører mod den policy-tekst, der faktisk kørte i produktion (testen er rød på den), og mod alle filer i `supabase/migrations/`. Den tjekker også, at rettelsen dækker alle fire policies. Med `objects.name` skiftet tilbage til `name` giver den 4 fund.

**Fejl 2: "Vis mig nu" sporede 0 reps og faldt altid tilbage til ren upload.**
- Den brækkede ændring er `9e10e07` (6. sep, ordre 80), som introducerede `vcRealtimeTrackWindow` med linjen:
  ```
  +      if (tNow + 1e-3 >= windowEnd || video.ended || !tracking) { finish(); return; }
  ```
  `vcAthletePreviewThree` sætter kun `analyzing = true` og aldrig `tracking = true`. Derfor stoppede hvert vindue ved første frame (1 punkt), og atleten fik "Ingen af de tre prøve-gentagelser gav et brugbart spor". Verify-harnessen (`verify-videocoach-clip.mjs`) sætter selv `tracking = true` og skjulte derfor fejlen.
- Rettelsen: `tracking = true` før vindues-løkken og `tracking = false` efter.
- En følgefejl kom frem, da sporingen først kørte. `updateTimeline` pauser videoen ved `trimEnd` (= vinduets slut). Kom den pause før en frame med `mediaTime >= windowEnd`, fyrede `requestVideoFrameCallback` aldrig igen, og vinduet hang for altid. Det skete i 1 af 3 kørsler headless. Nu afslutter en `pause` også vinduet (`vcRealtimeTrackWindow`, nogle få linjer).

**Prøven:** `e2e/videocoach-flow.spec.mjs` kører på 390×844 med sin egen mock-instans og uden afbrydelse:
1. Atleten åbner VideoCoach-kortet bag "Mere", vælger et syntetisk klip og vælger Squat i sendearket.
2. Atleten sætter start, finder skiven og trykker "Vis mig nu". Prøven kræver tilstanden `done` med "Viser N af" og N ≥ 2, og derefter `sent`, én ny `awaiting_analysis`-række, stien `<athlete_id>/…` og objektet i mock-storage.
3. Coachen ser "Afventer sporing", trykker "Spor nu", og videoen loader.

Prøven fejler også på browserfejl og på netværkskald ≥ 400. Den er tilføjet som punkt 17 i `scripts/proever.mjs`. Skærmbilleder ligger i `outputs/333/`.

## Testresultat

- `npm run proever`: **92/92 grønne** i én ubrudt kørsel, inklusive den nye `e2e (videocoach-flow.spec.mjs)` på 24,8 s og `src/storagePolicySql.test.js`. Kopien ligger i `outputs/333/proever.md`.
- `videocoach-flow.spec.mjs` alene med begge rettelser: 5/5 grønne (24,4–24,5 s).
- Uden `tracking`-rettelsen er prøven rød. Forløbet går `analyzing` → `sent` og aldrig `done`, altså fallback til ren upload. Med kun `tracking`-rettelsen og uden pause-rettelsen hang den i 1 af 3 kørsler.
- `npm run lint`: grøn. `verify:videocoach-clip`, `-upload-flow`, `-submission`, `-upload`, `-migrations`, `-buttons-layout`, `-film-guide`, `-labels`, `-zoom` og `-plate-detect`: alle grønne. `verify-videocoach-clip` kører på den ændrede `vcRealtimeTrackWindow`.
- `e2e/run-all.mjs` (upload, coach-review og feedback) var grøn allerede før rettelserne. Mocken simulerer ikke storage-policies, og derfor så ingen prøve fejl 1.

## Hvad er næste

1. **Marc kører `supabase/migrations/20260923120000_video_upload_policy_name_fix_v1.sql`** mod produktionen. Uden den virker upload stadig ikke, uanset om main pushes.
2. Test på telefonen efter migrationen:
   - Atlet: VideoCoach, vælg en kort video, send. Forventet: "Video modtaget ✓".
   - Coach: Analyse, "Afventer sporing", "Spor nu". Forventet: videoen afspiller.
   - Virker det ikke, så send et skærmbillede af fejlbanneret og klokkeslættet (minuttet). Så kan loggen slås op på præcis det kald.
3. Muligt senere: "Vis mig nu"-banneret siger "af 8 gentagelser" som fast tekst, uanset hvor mange reps sættet har.

## Ærlige grænser

- Kun en rigtig telefon kan vise, om `requestVideoFrameCallback` og pause-rækkefølgen opfører sig som i headless Chromium. Det gælder især iOS Safari og PWA-tilstand. Det samme gælder kameraoptagelse (i stedet for et valgt klip), store HEVC/.mov-filer fra iPhone og om uploaden over mobilnet når frem.
- Storage-rettelsen er ikke kørt, så den er ikke bevist mod produktionen. Beviset er Postgres' egen gengivelse af policyen og tælle-testen ovenfor, som viser, at `objects.name`-formen matcher alle atleter.
- På det syntetiske klip viser "Vis mig nu" 2 af 3 vinduer. Presearch' sidste vindue starter midt i en rep, hvor skiven ikke er ved ringen, så prøven kræver mindst 2 og ikke 3. På Marcs rigtige klip (`verify:videocoach-clip`) fandt presearch kun 2 reps. Tre sporede reps på et rigtigt sæt er ikke målt i denne ordre.
- Jeg ved ikke, om Marcs "virker vist ikke" handlede om uploaden (fejl 1), om "Vis mig nu" (fejl 2) eller om noget tredje. Produktionsloggen viser, at fejl 1 ramte en atlet i morges.
- 330's flytning af VideoCoach-kortet bag "Mere" er ikke live (live er `f68ebdf`) og er ikke årsagen.
- Commits er signeret "Claude Opus 5.5" som medforfatter.

Uploaden virker først, når Marc har kørt migrationen i "Hvad er næste", punkt 1. Koden i main kan pushes uafhængigt af den.

main kan pushes: ja
