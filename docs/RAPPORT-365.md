# RAPPORT 365: vagt mod storage-policy-fejlen og sundhedstjek for VideoCoach (Vaidya)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Betydning for Hara (Coaching-planeten, delmålet "Appen mærkbart bedre"): ja. Den fejl, der stoppede alle VideoCoach-uploads i 19 dage (5.–24. sep), bliver nu fanget af et verify-script, før den når produktionen. Et tomt upload-spor kan også ses på et minut med én SELECT.

## Gren

- Gren: `upload-vagt` (fra `main` `7efac27`). Den er ikke pushet.
- Blok 1: `ee6359d`, vagten, beviset og `verify:storage-policies`.
- Blok 2: denne commit, med sundhedstjekket, handover-linjen og rapporten.

Ingen migration er kørt eller oprettet. Filerne `supabase/migrations/` er uændrede, og det samme gælder `public/videocoach.html`, `src/AthleteView.jsx` og `src/Dashboard.jsx`. Der er ingen atletdata.

## Hvad ændret

**Blok 1: vagten.**
- `scripts/storage-policy-guard.mjs` er selve reglen. Kommentarer og strenge maskeres, så linjenumrene bevares. Kolonnenavne hentes fra `create table` og `alter table ... add column` i alle migrationer. `public.athletes` står desuden i en lille liste, fordi den er oprettet uden for repoet. Scriptet finder alle `create policy` og `alter policy` på `storage.objects`, uanset linjeskift. For hver policy tæller kun den **seneste** definition i migrationsorden, fordi det er den, der gælder i databasen. Et ukvalificeret `name` inde i `exists (select ... from/join <tabel> ...)` er et fund, når tabellen har en kolonne `name`. Fundet angiver fil, linje, policy og tabel.
- `scripts/verify-storage-policies.mjs` er det samme som `npm run verify:storage-policies`. Det kører først beviset og derefter vagten på alle `supabase/migrations/*.sql`. Exit-kode 1 ved fund eller ved en fejlet bevis-test.
- `scripts/storage-policy-guard.test.mjs` er beviset. Det har 9 tests og bruger fixtures i `scripts/fixtures/storage-policies/`:
  - `20260905_video_upload_and_go_v1.sql` og `20260923120000_video_upload_policy_name_fix_v1.sql` er ordrette kopier.
  - `20260905_video_upload_and_go_v1.as-run.sql` er kopien af 20260905 plus de fire `create policy`, skrevet ud i den form, der kørte i produktion. **Årsag:** repoets 20260905-fil har kun policyerne som en kommentar og ingen SQL. En ordret kopi kan derfor ikke fejle, og det viser test 2 (0 policies). Den udskrevne form er rettelsens tekst med `objects.name` skiftet tilbage til `name`. Det er præcis den linje, som RAPPORT-333 viser fra produktionen (`storage.foldername(name)`, gengivet som `a.name`).
  - Testene dækker følgende: as-run alene giver 4 fund, ét pr. policy. As-run efterfulgt af 20260923 er grøn. 20260923 alene er grøn. 20260923 med `objects.name` skiftet tilbage til `name` giver 4 fund. En tabel fra `create table` med `"name"` fanges, og en tabel uden `name` går fri. `add column name` fanges. `name` i en kommentar, i en streng eller i kvalificeret form (`a.name`, `objects.name`) er ikke et fund. Policies på andre tabeller end `storage.objects` ignoreres.

**Blok 2: sundhedstjekket.**
- `supabase/health/videocoach-health.sql` er én skrivebeskyttet forespørgsel med kun SELECT. Den giver én række pr. dag i de sidste 14 dage (Europe/Copenhagen) med disse kolonner: `objekter` (nye objekter i `videocoach-uploads`), `indsendelser` (nye rækker i `public.video_analyses`, appens VideoCoach-tabel), `med_video` (rækker med `video_path`) og `uden_objekt` (rækker, hvis `video_path` ikke findes i bucketen). Derudover kommer én række `ADVARSEL`, hvis der er indsendelser med video uden objekt i 14 dage, eller hvis der er 0 objekter i de sidste 7 dage. Der er kun tællinger og ingen navne eller id'er.
- Den nye linje nederst i `docs/videocoach/HANDOVER-VIDEOCOACH.md` forklarer, at Dhruva kører filen med Supabase MCP `execute_sql`.

## Testresultat

- `npm run verify:storage-policies`: **GRØN**, 9/9 beviser og 0 fund i 7 migrationer (4 policies på `storage.objects`, alle i den rettede form).
- Gegenprøve: med `public.athletes` fjernet fra listen over kendte tabeller bliver scriptet **RØDT** (2 beviser fejler). Testen fanger altså, hvis vagten bliver blind.
- Fund på as-run-fixturen: linje 39, 50, 62 og 75, ét i hver af de fire policies.
- `npm run lint`: grøn. `npm run build`: uden fejl.

## Hvad er næste

1. Dhruva kører `supabase/health/videocoach-health.sql` én gang via MCP `execute_sql` og ser efter, at de 14 rækker kommer ud, og at der ikke er nogen ADVARSEL-række efter 24. sep.
2. Muligt senere: tilføj `verify:storage-policies` til `scripts/proever.mjs`, så den kører sammen med resten. Det er ikke gjort, fordi ordren kun nævnte package.json.
3. Muligt senere: kør sundhedstjekket fast, fx ugentligt fra n8n eller Hara, så det ikke afhænger af, at nogen husker det.

## Ærlige grænser

- **SQL'en er ikke kørt mod en database.** Mit forsøg på at køre den som read-only via MCP blev afvist af sikkerhedsreglen for produktionslæsning. Jeg har ikke fundet en lokal Postgres at teste den i. Jeg har gennemgået syntaks og typer manuelt, men første kørsel sker hos Dhruva. Fejler den, er rettelsen lille og lokal.
- Tjekket "uden objekt" antager, at `video_analyses.video_path` gemmes som objektets navn i bucketen (`<athlete_id>/…`, jf. RAPPORT-333) og ikke med bucket-præfiks. Gemmes den med præfiks, viser `uden_objekt` falske fund, og så er ADVARSEL-rækken det første tegn.
- "0 objekter i 7 dage" advarer også, hvis ingen atlet har filmet i en uge. Advarslen betyder, at nogen skal se efter, ikke at noget nødvendigvis er i stykker.
- Vagten er en tekstparser og ikke Postgres' egen navneopløsning. Den dækker den kendte form (ukvalificeret `name` i `exists` mod en tabel med `name`). Den dækker ikke andre kolonner, der kan skygge (fx `id` eller `owner`), og heller ikke underforespørgsler uden `exists` (fx `in (select ...)`). Tabeller med `name`, som er oprettet uden for repoet, skal stå i `KNOWN_TABLES_WITH_NAME`. Lige nu står kun `public.athletes` der.
- Den eksisterende `src/storagePolicySql.test.js` fra ordre 333 dækker et snævrere mønster (`storage.foldername(name)`). Den er ikke rørt eller læst, fordi ordren begrænsede, hvad jeg måtte læse. De to kan slås sammen senere.
- Commits er signeret "Claude Opus 5.5" som medforfatter.
