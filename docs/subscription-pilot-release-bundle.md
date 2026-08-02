# Entropi abonnement — lokal pilotpakke

Åbn `subscription-pilot-release-bundle.html` i den lokale Vite-server. Den er
den korte, menneskelige indgang til den eksisterende lokale kunderejse,
programreview og feedbackflade.

## Formål

Pakken gør det muligt at afprøve en sammenhængende browser-only demo uden at
forveksle den med en rigtig pilot. Den samler kun allerede verificerede
kontrakter:

- Kunderejse: e-mailformat → programmatch → startbelastninger → uge 1 →
  synligt uge-2-valg → første pas i uge 2.
- Programreview: lokale programudkast er reviewartefakter, aldrig assignments.
- Feedback: valideret `localOnly` JSON eksporteres kun på brugerens initiativ.
- Mobiltestliste: fem frivillige kontrolpunkter hjælper testpersonen med at
  opdage konkret UI-friktion. Fluebenene er kun React-tilstand og forsvinder
  ved genindlæsning; de kan hverken læse eller ændre programdata.
- Privatliv: det lokale democache-snapshot indeholder ikke rå e-mail og bruger
  ingen netværk, konto eller Supabase.
- Separation: abonnementet bruger ikke 1:1-portalens klient, session,
  `profiles.role`, CNAME eller PWA-artefakter.

## Ikke en launch

Pakken ændrer ikke og må ikke bruges til at aktivere:

- Supabase/shadow, Auth eller invitationer
- e-mail, betaling, hosting eller publicering
- 1:1-data, coachnoter, video eller helbredsdata
- programtildeling, entitlement eller serverpersistens

Den kommende shadow-pilot følger alene
`subscription-shadow-backend-safe-path.md`. Den kræver en særskilt autoriseret
shadow-opgave og de dokumenterede gates efter `sub-01` til `sub-11`.

## Lokal verifikation

Kør fra abonnementets worktree:

```powershell
npm run verify:subscription-pilot-smoke
npm run verify:subscription-separation
npm run build:subscription-pilot
```

En grøn lokal kontrol betyder kun, at den lokale kontrakt hænger sammen. Den er
ikke en frigivelse til shadow eller produktion.
