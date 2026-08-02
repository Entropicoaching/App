# Subscription shadow-pilot

Separat pilot-entry for abonnementsproduktet. Den må kun forbindes til Supabase-
shadowprojektet `maxhsefxbrvsgolscqwh`.

## Lokal start

1. Kopiér `.env.subscription.example` til `.env.local`.
2. Indsæt shadow-projektets anon/publishable key. Brug aldrig secret/service-role.
3. Kør `npm run dev -- --port 5199` og åbn `/subscription.html`.

Uden alle tre shadow-værdier viser appen kun en fail-closed fejlskærm. Den forsøger
ikke at falde tilbage på 1:1-portalens klient eller miljøvariabler.

## Grænser

- Kun login/logout. Ingen signup, reset, betaling eller admin-funktioner.
- Egen Supabase-klient med `storageKey: entropi-sub-auth`.
- Ingen import af `src/supabase.js`, `profiles.role` eller 1:1-komponenter.
- Adgang kommer kun fra den subscription-isolerede `sub_my_access_v2()`.
- Træningsdraft og synk-outbox er lokale, brugerspecifikke og idempotente via
  `client_id`. Et færdigt pas bliver i outbox ved fejl og forsøges igen ved reload
  eller når browseren kommer online.
- Cache-reset rører kun `entropi:sub:pilot:v1:<user-id>:*`; auth-session og remote
  shadow-data bevares.
- Ingen service worker, manifest, CNAME eller deploy-konfiguration.

## Verifikation

```text
npm run test:subscription
npx eslint src/subscription vite.subscription.config.js
npm run build:subscription-pilot
```

Buildet lander lokalt i den ignorerede mappe `dist-subscription-pilot`.
