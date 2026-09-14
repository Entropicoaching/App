# `npm run maal:telefon`

Måler de fem skærme en atlet bruger (login, dagens pas, sæt-logger, check-in,
videocoach-forside) gennem den rigtige, autentificerede app mod
`e2e/mock-supabase.mjs` (Lighthouse mobilprofil, 3 løb, median) og skriver
`outputs/maal/<dato>.json` + en tabel i terminalen — se `scripts/maal-telefon.mjs`.

Dækker ikke: rigtig Supabase (kører mod en lokal mock), rigtig netværksvej
(localhost, ikke et rigtigt mobilnet), rigtige atletdata (ét syntetisk
testatlet, se `e2e/fixtures.mjs`).
