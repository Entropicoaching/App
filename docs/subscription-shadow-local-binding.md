# Subscription shadow: lokal projektbinding

Dette er kun et lokalt fail-closed værn. Det læser kun disse to ikke-hemmelige
identifikatorer fra `.env.local`:

- `VITE_SUB_SUPABASE_URL` (kun hosten bruges)
- `VITE_SUB_SUPABASE_PROJECT_REF`

Det læser ikke, udskriver ikke og validerer ikke anon-/publishable-nøglen. Det
foretager ingen netværks-, Supabase-, Auth- eller databasekald.

Den eneste autoritative subscription-shadow-reference ligger i
`config/subscription-shadow-binding.json`. Den er isoleret fra den nuværende
1:1-app og må aldrig erstattes med produktion eller en vilkårlig testreference.

## Korrekt lokal binding

1. Sammenlign manuelt Supabase-dashboardets **project ref** med
   `config/subscription-shadow-binding.json`. Stop ved enhver tvivl.
2. Kopiér `.env.shadow-binding.example` til `.env.local` eller ret kun de to
   identifikatorer i den eksisterende lokale fil. Sæt den rigtige shadow
   anon-/publishable-nøgle lokalt; nøgle må aldrig commit'es eller indsættes i
   dokumentation.
3. Kør:

   ```powershell
   node scripts/verify-subscription-shadow-binding.mjs
   ```

4. Kun et grønt `PASS shadow binding` betyder, at den lokale konfiguration
   peger mod den autoriserede shadow-reference. Det betyder **ikke**, at SQL
   må køres, at Auth må aktiveres eller at en bruger må inviteres.
5. Før en senere, særskilt autoriseret shadow-kørsel skal også
   `node scripts/verify-subscription-shadow-backend.mjs` være grøn, og den
   dokumenterede DRAFT-rækkefølge skal følges.

## Når værnet fejler

Stop. Ret kun den lokale URL/reference, og kør værnet igen. Kør aldrig DRAFT
SQL for at “se om det virker”, og brug aldrig en produktions-URL som
midlertidig løsning.
