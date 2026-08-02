# Programversion og tildeling — minimal sikker kontrakt v1

Status: lokal designkontrakt til shadow-piloten. Den opretter hverken en
programversion, en tildeling eller nogen Supabase-ændring.

## Formål og grænse

Generatoren må producere et **reviewudkast**. Før en atlet kan se eller logge et
program, skal en kontrolleret server-side proces omsætte netop dét udkast til en
godkendt, uforanderlig programversion og eventuelt tildele den. Klienten må kun
vise sit lokale udkast; den må ikke kunne gøre det til produktdata.

Dette gælder kun shadow-projektet. Ingen del af kontrakten læser eller skriver
`profiles.role`, 1:1-tabeller eller entitlements.

## Invarianter

1. Et `reviewId` er et sammenligningsfingeraftryk, **ikke** autorisation eller
   sikkerhedsnøgle.
2. Kun en kontrolleret server/service-procedure må oprette eller publicere
   `sub_programs` og oprette/afslutte `sub_assignments`.
3. Når en version er `published` eller `retired`, er dens træningsindhold,
   beslutningsspor, progressionstekst, slug og versionsnummer uforanderlige.
   En rettelse er altid en ny række med samme slug og højere version.
4. En assignment peger altid på én konkret `sub_programs.id` — aldrig på slug,
   "seneste version" eller et klientudkast.
5. Entitlement afgøres på serveren ved tildelingstidspunktet gennem den fælles,
   kontrollerede tier-funktion. Klienten skriver aldrig `sub_entitlements`.
6. Én bruger kan kun have én aktiv assignment. Et skift afslutter først den gamle
   og opretter derefter den nye i samme transaktion.
7. Ufuldstændigt, ukendt eller ikke-reviewet generatorinput fejler lukket; det
   bliver ikke normaliseret til et standardprogram.

## Kontrakt A: reviewudkast (kun lokal klient)

Kilden er `createProgramReviewPackage()`. Følgende felter skal følge et
godkendelsesforslag som en samlet, kanonisk JSON-pakke:

```text
schemaVersion
reviewId
status = "awaiting-marc-program-version-approval"
decisionTrail:
  matcherVersion, engineVersion, catalogueVersion,
  prescriptionLibraryVersion, policyPackId, template, matchInput
program:
  status = "review", days, sessions[]
  sessions[].id, label, movements[]
  movements[].role, roleClass, exerciseId, exerciseName,
  selection, substitutionMode, prescription
  prescription.sets, reps, targetRpe, libraryVersion, status = "review"
guards[]
```

Et reviewudkast mangler altid `programVersionId`, `assignedUserId` og
`assignmentId`. Det må ikke indeholde adgangsnøgler, entitlements eller
fritolkede helbreds-/skadedata.

## Kontrakt B: godkendt programversion (server/service)

Den kontrollerede procedure validerer hele pakke A og opretter derefter én
`sub_programs`-række. Ud over den eksisterende tabelkontrakt skal det gemte
`content` indeholde den fulde, kanoniske `program.sessions` samt dette
proveniensobjekt:

```text
generator:
  review_id
  review_schema_version
  matcher_version
  engine_version
  catalogue_version
  prescription_library_version
  policy_pack_id
  template_id
  template_version
  match_input
approval:
  approved_at
  approval_method = "controlled-shadow-procedure"
  source_review_id
```

Den ydre række skal mindst have `id`, `slug`, `version`, `status`, `name`,
`progression_rule`, `days`, `min_tier`, `content` og `published_at`.
`slug + version` er den menneskeligt læsbare identitet; `id` er den eneste
reference i assignments og workouts.

`approved_by` må kun tilføjes, hvis det refererer til en separat, kontrolleret
server-side operator-identitet. Det må aldrig komme fra `profiles.role` eller
fra et klientfelt.

## Kontrakt C: fremtidig server-side tildeling

Den interne tildelingskommando skal som minimum modtage:

```text
request_id                 # unik idempotensnøgle, oprettet server-side
target_user_id
program_version_id         # konkret sub_programs.id
match_input                # den validerede, oprindelige matchInput
assignment_source          # fx "shadow-pilot-manual"
requested_at
```

Før skrivning verificerer serveren: målbrugeren findes, programmet er
`published`, `program_version_id` matcher den godkendte uforanderlige version,
programmets `min_tier` er opfyldt via den fælles tier-logik, og der er ingen
uafsluttet assignment. Den må ikke tage tier, programindhold eller målbrugerens
adgang som sandhed fra klienten.

Resultatet er præcis én ny `sub_assignments`-række med den validerede
`match_input`. Hvis der findes en aktiv assignment, sker afslutning og ny
tildeling atomisk; ved genkørsel med samme `request_id` returneres samme resultat
uden en ekstra tildeling. Indtil der findes en sådan procedure, er den eneste
tilladte vej den dokumenterede, manuelle shadow-procedure.

## DB-håndhævelse ved implementering

RLS alene er ikke nok, fordi service-role omgår RLS. Implementeringen skal derfor
have en databasevagt, som afviser ændring af beskyttede versionfelter efter
`published_at` er sat (også for service-role): `slug`, `version`, `content`,
`progression_rule`, `days`, `min_tier`, generator-proveniens og
`published_at`. `retired` må kun ændre status/retirement-metadata.

Den samme migration skal bevare de eksisterende regler: klienten har ingen
INSERT/UPDATE/DELETE-policy på `sub_programs` eller entitlements, og ingen
autorisation må baseres på `profiles.role`.

## Accepttest før en ekstern tester

1. Samme gyldige input giver samme reviewpakke og `reviewId`; en ændret variant,
   recipe- eller engineversion giver et andet reviewspor.
2. Et reviewudkast med manglende/ukendt variant, manglende prescription eller
   status forskellig fra `review` afvises uden databaseændring.
3. Klientens forsøg på at INSERT/UPDATE `sub_programs`, `sub_assignments` eller
   `sub_entitlements` afvises af RLS/API.
4. Den kontrollerede procedure kan publicere én valideret version; efterfølgende
   ændring af dens beskyttede felter afvises, også med service-role.
5. Ny version med samme slug og højere version kan publiceres; gammel assignment
   og gamle workouts peger fortsat på den oprindelige `program_id`.
6. Member-program afvises for free-bruger og accepteres for gyldigt member-
   entitlement. En bruger med selvvalgt `profiles.role='coach'` får ingen ekstra
   abonnementstilladelse.
7. To parallelle eller gentagne tildelingskald giver højst én aktiv assignment;
   samme `request_id` er idempotent.
8. En assignment kan kun læse sin konkrete, tildelte version efter et eventuelt
   tier-udløb; den åbner ikke resten af biblioteket.

## Næste implementeringssøm

Første kodeændring bør være en **kun-shadow migration + test** for
versionsimmutabilitet og en snæver, server-side tildelingsprocedure. Frontenden
skal derefter kun kalde en læse-/statusvej; den skal ikke få en generel
"opret program"- eller "tildel program"-knap.
