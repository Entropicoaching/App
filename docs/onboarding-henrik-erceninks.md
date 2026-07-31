# Oprettelse i appen — Henrik Erceninks
Verificeret mod koden 31/7-2026 (efter Codex' commit 163d1fc "Harden athlete identity").

## Før samtalen — status (alt er klar, du skal intet gøre)

| Tjek | Status |
|---|---|
| Atletprofil oprettet | ✅ `Henrik Erceninks`, id `796c5573…9db1` |
| Email på profilen | ✅ `henerceninks@gmail.com` |
| Koblet til en bruger | ⬜ `user_id` er tom — venter på hans login |
| Program klar | ✅ Uge 0 (start 27/7, session lør 1/8) + uge 1 (start 3/8) |
| Email-bekræftelse påkrævet | ❌ Nej — auto-bekræftes, han kan logge ind med det samme |
| Byg + identitetstest | ✅ `npm run build` og `verify-athlete-identity.mjs` kører rent |

**Appens adresse: `https://app.entropicoaching.dk`**

---

## Step by step — sig dette til Henrik

**1. Åbn `app.entropicoaching.dk`** i browseren på telefonen (Safari på iPhone, Chrome på Android).

**2. Tryk "Opret her"** nederst under den gyldne knap. Teksten på knappen skifter til "Opret konto".

**3. Skriv emailen `henerceninks@gmail.com`.**
> ⚠️ Vigtigst i hele processen. Profilen kobles på email. Bruger han en anden mail, lander han i en
> tom app uden program. Store/små bogstaver er ligegyldigt, men adressen skal ellers være præcis.

**4. Vælg en adgangskode** — mindst 6 tegn.

**5. Tryk "Opret konto".** Han bliver logget ind med det samme. Ingen bekræftelsesmail, intet link at klikke.

**6. Han skal nu se sit program:** lørdag 1/8 "readiness-session" med squat/bænk let RPE 5 + lat pulldown + core.
Ser han det, er koblingen lykkedes.

**7. Læg appen på hjemmeskærmen** (den er en PWA, så den opfører sig som en rigtig app):
- iPhone: Del-ikonet → "Føj til hjemmeskærm"
- Android: menuen ⋮ → "Installer app" / "Føj til startskærm"

**8. Vis ham hvordan han logger:** åbn dagens session, indtast vægt + reps + RPE pr. sæt, og brug
notefeltet hvis noget gør ondt eller føles skævt. Sig eksplicit at noterne er dem du læser først —
det er dem der styrer næste uges program.

---

## Bagefter — bekræft koblingen

```sql
SELECT name, email, user_id FROM athletes
WHERE id = '796c5573-55f2-4318-b13f-6791703a9db1';
```
`user_id` skal nu have en værdi. Er den stadig tom, gik koblingen galt — se nedenfor.

---

## Fejlfinding (de præcise beskeder han kan møde)

| Besked på skærmen | Betyder | Løsning |
|---|---|---|
| `User already registered` | Han har oprettet sig før | Tryk "Log ind" i stedet. Kan han ikke huske koden, lav en ny bruger-invitation via Supabase |
| `Invalid login credentials` | Forkert kode eller forkert mail | Tjek stavning af mailen først — det er den hyppigste årsag |
| `Password should be at least 6 characters` | For kort kode | Længere kode |
| `No unclaimed athlete profile matches this login` | Han skrev en anden mail end den på profilen | Log ud, opret igen med `henerceninks@gmail.com` — eller ret `athletes.email` til den mail han faktisk brugte |
| `Matching athlete profile is already linked to another user` | Profilen er koblet til en anden bruger | Kræver at du nulstiller `user_id` på hans række |
| `Athlete profile match is ambiguous; coach linking required` | To atletrækker har samme mail | Slet/ret dubletten |
| Logger ind, men appen er tom | Koblingen kørte ikke igennem | Bed ham lukke appen helt og åbne igen — koblingen forsøges ved hver indlæsning |

**Nødløsning hvis intet virker:** find hans bruger-id og kobl manuelt.
```sql
-- 1) find id'et
SELECT id, email FROM auth.users WHERE email ILIKE '%erceninks%';
-- 2) kobl (indsæt id'et)
UPDATE athletes SET user_id = '<bruger-id>'
WHERE id = '796c5573-55f2-4318-b13f-6791703a9db1';
```

---

## Sådan virker koblingen teknisk (Codex' ændring)

Ved oprettelse laver en database-trigger automatisk en profil med rollen `athlete`. Første gang
appen indlæses, slår den først op på `user_id`; findes intet, kalder den `claim_athlete_profile_v3`,
som matcher på email i småt, sætter `user_id` og henter profilen igen.

Det direkte email-opslag i appen er fjernet — koblingen sker nu kun via den kontrollerede
databasefunktion, og den nægter at koble hvis mailen rammer flere profiler eller en profil der
allerede tilhører en anden bruger. Derfor er den præcise mail (trin 3) det eneste kritiske punkt.
