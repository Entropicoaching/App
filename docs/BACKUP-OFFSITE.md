# Off-site backup til Backblaze B2 — opsætning

Formål: en kopi af alle dine data UDENFOR GitHub, så du ikke kan miste alt på én
gang. Koden er på plads (`.github/workflows/backup.yml`) — den uploader automatisk
hver 6. time, så snart de 4 secrets herunder er sat. Indtil da springes off-site
bare over, og din nuværende GitHub-backup kører uændret.

## 1. Opret Backblaze-konto (gratis, 10 GB)
- Gå til backblaze.com → "Sign Up" → vælg **B2 Cloud Storage**.
- Bekræft e-mail.

## 2. Opret en bucket
- B2 Cloud Storage → **Buckets** → **Create a Bucket**.
- Navn: fx `entropi-backups` (skal være globalt unikt — tilføj evt. et tal).
- Files in Bucket: **Private**.
- Opret. Noter **bucket-navnet**.

## 3. Find S3-endpointet
- Klik på din bucket → se **Endpoint**, fx `s3.us-west-004.backblazeb2.com`.
- Det du skal bruge er den fulde URL med https:
  `https://s3.us-west-004.backblazeb2.com` (din region kan være en anden).

## 4. Opret en Application Key
- Venstremenu → **App Keys** → **Add a New Application Key**.
- Navn: fx `github-backup`.
- Allow access to Bucket: vælg **din bucket** (ikke "All").
- Type of Access: **Read and Write**.
- Opret. Nu vises **keyID** og **applicationKey** ÉN gang — kopier begge med det
  samme (applicationKey kan ikke ses igen).

## 5. Læg de 4 secrets i GitHub
GitHub → dit repo (Entropicoaching/App) → **Settings** → **Secrets and variables**
→ **Actions** → **New repository secret**. Opret disse fire:

| Navn | Værdi |
|------|-------|
| `B2_KEY_ID` | keyID fra trin 4 |
| `B2_APP_KEY` | applicationKey fra trin 4 |
| `B2_BUCKET` | bucket-navnet fra trin 2 |
| `B2_S3_ENDPOINT` | fulde URL fra trin 3 (med `https://`) |

## 6. Sæt oprydning (retention)
- B2 → din bucket → **Lifecycle Settings**.
- Vælg en regel der sletter gamle filer, fx "Keep only the last version" + slet
  filer ældre end 60–90 dage. Så vokser det ikke i det uendelige.

## 7. Test det
- GitHub → repo → fanen **Actions** → **Supabase Backup** → **Run workflow**.
- Når den er grøn, åbn loggen for steppet **"Off-site kopi til Backblaze B2"** —
  der skal stå "Off-site backup uploadet til B2: ...".
- Tjek i B2 at filen ligger under `backups/` i din bucket.

## Hvad gør koden nu (uanset B2)
- **Fejlvagt:** hvis `athletes`-tabellen kommer tom hjem (hentning fejlede), fejler
  jobbet bevidst, og GitHub mailer dig — så tavse tomme backups fanges.
- **GitHub-backup:** uændret (kopi nr. 1 på `backup`-branchen).
- **B2-backup:** kopi nr. 2 off-site, gzippet (kopi nr. 1 + 2 = du mister ikke alt
  hvis det ene sted ryger).

## Senere (valgfrit)
- Oprydning af `backup`-branchen i GitHub (den vokser stadig). Kan tilføjes som et
  forsigtigt slette-step når off-site er bekræftet — sig til.
- Test en faktisk gendannelse én gang, så du VED en backup kan bruges.
