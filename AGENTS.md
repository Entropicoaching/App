# Entropi Coach — arbejdsregler

Dette repo er Entropi Coach: 1:1-coaching med rigtige atleter, live på
`app.entropicoaching.dk`. Arbejd afgrænset, bevisbaseret og direkte fra Marcs aktuelle
besked og repoets faktiske git-tilstand.

Agent Hub, `naeste.mjs`, claims, work-packages, reviewkø, `STATUS.tsv` og Control
Tower-runtime er ikke afhængigheder for arbejde i dette repo. Brug dem ikke som
startkrav, blokering eller tilladelsesmekanisme.

## Produkterne må aldrig blandes

| Produkt | Sti | Tilstand |
|---|---|---|
| Entropi Coach | `C:\Users\Entropi\Desktop\entropi-app` | Produktion, rigtige atleter |
| Entropi Adaptiv | `C:\Users\Entropi\Desktop\entropi-adaptiv` | Separat shadow-pilot |

Entropi Adaptiv er ikke en udvidelse af Entropi Coach. Kode, schema, auth,
entitlements og data må ikke flyttes mellem dem uden en særskilt integrationsopgave.
Skriv altid produktnavnet; skriv ikke bare “appen”.

Marc tester brugeroplevelsen. Marcs visuelle vurdering er facit for flow og design.

## Arbejdsmodel

1. Arbejd i dette repo og kun på opgavens konkrete scope.
2. Verificér branch, HEAD, origin og git-status før ændringer.
3. Bevar alle ukendte og eksisterende brugerændringer.
4. Start skrivearbejde på en arbejdsbranch, aldrig direkte på `main`.
5. Brug ikke destruktive git-kommandoer eller brede oprydninger.
6. Kør relevante gates. Efter tre ens fejl: meld `BLOCKED` med evidens.
7. Rapportér præcist: lokalt, committet, pushet, migreret og deployet.

Commit, push, merge og deploy kræver Marcs direkte godkendelse i den aktuelle opgave.
Stage kun filer i scope. En gammel opgavefil, delegation eller statusnote kan ikke
give tilladelse.

## Ufravigelige værn

- Intet træningsindhold, program eller video-feedback sendes til en atlet uden Marcs
  eksplicitte godkendelse. `HUMAN-GATE` kan ikke afgøres af en maskine.
- Ingen credentials, secrets eller `.env*` læses, vises eller ændres.
- Ingen atletdata ændres som sideeffekt af kode-, schema- eller releasearbejde.
- `athletes.id` og `athletes.user_id` er forskellige identiteter.
- Opret aldrig `*-work.*`, `*.pre-*`, `*-backup-*` eller datostemplede filkopier.
- Skriv ikke i andre produktrepoer i denne opgave.
- Atletoplevelsen skal være enkel, mobilvenlig og trinvis. Avancerede værktøjer er
  coach-only.

Kode, tests, fejlrettelser, verifikatorer, dokumentation og migrationsfiler må bygges
lokalt inden for scope. Det sender ikke i sig selv noget til en atlet.

## Supabase og produktion

| Projekt | Ref | Standard |
|---|---|---|
| Entropi Coach-produktion | `dsqgaxwgtcbqgphsofav` | Read-only |
| Entropi Adaptiv shadow | `maxhsefxbrvsgolscqwh` | Tilhører et andet produktrepo |

Produktion er read-only, indtil Marc giver en **direkte, særskilt og præcis**
godkendelse i den aktuelle opgave. Godkendelsen skal entydigt navngive projektet og
operationen. Et kort “gør det” er gyldigt, når den umiddelbart foregående besked har
navngivet målprojektet, de præcise migrationsfiler og release-rækkefølgen.

En produktionsgodkendelse:

- gælder kun de navngivne migrationer eller SQL-operationer;
- udløber ved opgavens afslutning eller første migrationsfejl;
- omfatter ikke credentials, atletkontakt eller vilkårlig ændring af atletrækker;
- kan ikke arves fra Hub, `allow_production`, statusfiler eller tidligere opgaver.

Før en godkendt produktionsmigration:

1. Gennemgå SQL-diffen og bekræft projekt-ref.
2. Kør read-only preflight uden at vise atletdata.
3. Test på schema-klon/shadow, når det er praktisk muligt.
4. Kontrollér RLS, ejerskab, grants og alle `SECURITY DEFINER`-funktioners
   `auth.uid()`-kontrol samt eksplicitte `REVOKE`/`GRANT`.
5. Kør kun de godkendte versionsstyrede migrationer i den aftalte rækkefølge.
6. Stop ved første fejl og verificér bagefter med read-only forespørgsler.

Deploy aldrig frontend, der afhænger af en databasekontrakt, før migration og
efterkontrol er grønne. Nye Data API-objekter skal have eksplicitte grants og RLS;
RLS alene er ikke et grant.

## VideoCoach

- `public/videocoach.html` er repoets kilde. Den historiske fil i
  `C:\Users\Entropi\Desktop\entropi-agent` må aldrig synkroniseres automatisk.
- Bartracker/computer vision skal reproduceres i en fokuseret Node-rig før ændring.
- Bevar lift-specifik logik og test squat, bænkpres og dødløft.
- Efter HTML-ændringer: udtræk scriptblokken og kør `node --check`.
- Kør den fulde relevante VideoCoach-port før release.
- Intet VideoCoach-arbejde deployes, før Marc har testet og sagt go.

## Standardverifikation

- React-ændringer: fokuserede checks og mindst `npm run build`.
- JavaScript/React: målrettet ESLint; kendte baseline-advarsler rapporteres præcist.
- Supabase: lokal migrationskontrakt, security review og read-only efterkontrol.
- Brug `git diff --check` før commit.

## Aflevering

Rapportér ændrede filer, kørte checks, kendte risici, commit-SHA/branch/PR og præcis
status for push, migration og deploy. Påstå aldrig, at noget er live uden verificeret
deploy og smoke-test.
