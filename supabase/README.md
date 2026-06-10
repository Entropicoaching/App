# Opret træningsprogram for en atlet — guide til Claude/cowork

Denne fil er **kilden til sandhed** for at oprette træningsprogrammer via API.
Den ligger i repoet, så enhver Claude-session med projektet forbundet kan læse den
(Claude Code's lokale memory rejser IKKE med — derfor står alt her).

---

## 1. Hvad det er
Et endpoint der opretter en hel træningsuge (uge → sessioner → øvelser) for en
atlet i ét kald, atomisk. Programmet dukker op i appen som normal planlagt træning.

Implementeret som en Postgres-funktion eksponeret via PostgREST RPC.
**URL:**
```
POST https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_program_week
```
Funktionens kildekode: `supabase/sql/create_program_week.sql` (allerede kørt i Supabase).

---

## 2. Din rolle (VIGTIGT)
Du er et **trofast indtastningsværktøj** — IKKE en autonom program-designer.
Marc (coachen) beskriver programmet i sit coach-sprog; din opgave er at oversætte
det 1:1 til endpointet og gemme de rigtige datapunkter.

- Opfind ALDRIG øvelser, vægte eller RPE som Marc ikke har sagt.
- Er noget uklart (vægt, ugenummer, atlet) → **spørg**, gæt ikke.
- Efter oprettelse: rapportér hvad der blev oprettet, og hvad du evt. lod stå tomt.

---

## 3. Auth
Tre headers — brug den **hemmelige** nøgle (`sb_secret_...`), aldrig den offentlige:
```
apikey:        <sb_secret-nøgle>
Authorization: Bearer <sb_secret-nøgle>
Content-Type:  application/json
```

**Hvor finder du nøglen:** læs `SUPABASE_SECRET_KEY` fra `.env.local` (lokal,
git-ignoreret fil i projektroden). **Bed IKKE Marc om at indsætte nøglen i chatten**
— så slipper han for at rulle den hver gang. Mangler den i `.env.local`, så bed ham
om at lægge den dér (Supabase → Project Settings → API → Secret keys → create).

⚠️ Nøglen giver fuld DB-adgang — må aldrig i frontend, git eller en chat-besked.
Den offentlige `sb_publishable_`-nøgle virker IKKE (bevidst låst ude af funktionen).

---

## 4. Body — den rige JSON pakket i `p_payload`
```json
{
  "p_payload": {
    "athleteId": "uuid (skal findes i athletes)",
    "blockName": "Blok 1",
    "coachNote": "valgfri note til atleten",
    "sessions": [
      {
        "day": "sunday",
        "label": "Sek bænk",
        "exercises": [
          {
            "name": "Pause bænk 3s",
            "sets": [
              { "reps": 4, "weight": 130 },
              { "reps": 4, "weight": 130 },
              { "reps": 4, "weight": 130 },
              { "reps": 4, "weight": 130 }
            ],
            "rpeTarget": 7.5,
            "note": "valgfri"
          }
        ]
      }
    ]
  }
}
```
Svar ved succes: `{ "week_id": "...", "week_number": 1, "sessions": 1, "exercises": 1 }`
Fejler + ruller alt tilbage hvis `athleteId` mangler/ikke findes.

---

## 5. Workflow
1. **Atlet:** find `athletes.id` — `GET /rest/v1/athletes?email=eq.<email>&select=id,name`
2. **Ugenummer:** sættes AUTOMATISK af endpointet (= atletens højeste `week_number` + 1).
   Du behøver IKKE slå det op eller sende `week` — feltet ignoreres bevidst, så to uger
   aldrig kan få samme nummer (det fragmenterede periodiserings-visningen tidligere).
   Send blokkens uger i rækkefølge (ét kald pr. uge) → de nummereres fortløbende.
3. **Byg JSON** ud fra det Marc dikterer, kald endpointet.
4. **Rapportér** uge/sessioner/øvelser + hvad der blev null.

---

## 6. Mapping til den FLADE datamodel (funktionen gør det selv)
`exercises` gemmer IKKE pr. sæt — kun et samlet billede (de faktiske sæt lever i
`exercise_logs` når atleten logger):

| Input | → kolonne |
|-------|-----------|
| `sets`-array (antal) | `sets` |
| ens reps → `"4"` · varierende → `"3-5"` | `reps` |
| tungeste sæt (top-sæt) | `recommended_weight` |
| `rpeTarget` → `"RPE 7.5"` | `intensity` |
| `label` | sessionens `title` |
| `day` | rækkefølge i ugen (der er INGEN dag-kolonne) |

**Distinkte sæt-grupper** (top-sæt + back-off med forskellig vægt): send som
SEPARATE `exercises` — ellers vises kun ét samlet (tungeste) tal.

---

## 7. Navnekonsistens — så appen virker
Endpointet gemmer øvelsesnavnet RÅT (ingen auto-korrektion). Appen matcher på
øvelsesnavn til anbefalet vægt, PR-tracking og historik. Brug derfor navne der
matcher det eksisterende bibliotek:
```
GET /rest/v1/exercise_library?select=name,category
```
Genbrug eksisterende navne i stedet for nye stavemåder.

---

## 8. Marcs metodik (kontekst — så du forstår hvad han dikterer)
- **Blokke:** typisk 4–6 uger, men varierer efter generel periodisering og atletens
  liv/planer. Ikke fast.
- **Blok-periodisering:** rep/intensitet starter lavt, ender højt over blokken.
  Nogle gange kører reps NED over blokken.
- **Løft:** hovedløft = SBD (Squat, Bænk, Dødløft). Sekundære løft = variationer/
  assistance med fokus på **fatigue management**, ikke maksimal load.
- **Frekvens / SBD-fordeling:** svinger fra atlet til atlet og efter mål.
- **Intensitet:** RTS-RPE-skala (5.5–10). Hvis Marc siger % i stedet, læg det i
  `intensity` direkte (fx "75%").

---

## 9. Terminologi / forkortelser (udfyldes løbende med Marc)
- "Sek bænk" = sekundær bænk-session.
- SBD = Squat / Bænk / Dødløft.
- _(Tilføj Marcs faste øvelsesnavne + variationer her: squat pause/tempo/pin,
  bænk pause/spoto/board, dødløft deficit/sumo/stiff, osv.)_

---

## Test (PowerShell)
```powershell
$key  = "DIN-SB_SECRET-NØGLE"
$body = @'
{ "p_payload": { "athleteId": "ATLET-UUID", "week": 1, "blockName": "Blok 1",
  "sessions": [ { "day": "sunday", "label": "Sek baenk", "exercises": [
    { "name": "Pause baenk 3s",
      "sets": [ {"reps":4,"weight":130},{"reps":4,"weight":130},{"reps":4,"weight":130},{"reps":4,"weight":130} ],
      "rpeTarget": 7.5 } ] } ] } }
'@
Invoke-RestMethod -Method Post `
  -Uri "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_program_week" `
  -Headers @{ apikey = $key; Authorization = "Bearer $key" } `
  -ContentType "application/json" -Body $body
```
> Bemærk: med `curl`/Invoke-RestMethod kan æøå i body give "invalid json" hvis
> shell-encoding driller — læg da payloaden i en UTF-8 fil og send med
> `curl --data-binary @fil.json`.

---

## 10. Kost-madplaner — `create_meal_plan` (fulde dage)

Kost-pendant til `create_program_week`: skub en eller flere **fulde dags-madplaner**
ind for en atlet i ét kald, atomisk. Hver "dag" bliver en **meal_template** — atleten
ser den under "Skabeloner" i Kost-fanen og trykker **"Log alt"** for at logge hele
dagen på én gang. Kan valgfrit sætte atletens kcal/protein-mål samtidig.

**URL:**
```
POST https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_meal_plan
```
Samme auth som programmer (sektion 3): den **hemmelige** service_role-nøgle fra
`.env.local` → `SUPABASE_SECRET_KEY`. Kildekode: `supabase/sql/create_meal_plan.sql`
(allerede kørt i Supabase).

**Din rolle:** samme som ved programmer — trofast indtastningsværktøj. Opfind ALDRIG
makroer/mængder Marc ikke har givet. Makroer opgives **pr. item** (du/Marc har tallene).

**Body — rig JSON pakket i `p_payload`:**
```json
{
  "p_payload": {
    "athleteId": "uuid (skal findes i athletes)",
    "kcalTarget": 3000,
    "proteinTarget": 200,
    "days": [
      { "name": "Dag 1 · 3000 kcal", "items": [
        { "meal": "Havregryn 100g + skyr 200g", "kcal": 520, "protein": 38, "carb": 70, "fat": 9 },
        { "meal": "Kylling 200g + ris 150g",     "kcal": 610, "protein": 55, "carb": 65, "fat": 12 }
      ] }
    ]
  }
}
```
- `kcalTarget` / `proteinTarget`: **valgfri** — sætter `athletes.kcal_target` / `protein_target` (kun de angivne).
- `days[]`: hver dag → én meal_template. `name` defaulter til "Dagsplan N". Tomme dage (ingen items) springes over.
- `items[]`: `meal` (tekst) + makroer (`kcal`/`protein`/`carb`/`fat`, rundes til heltal). Samme form som en log-linje.

Svar: `{ "athlete_id": "...", "days_created": 1, "items_total": 2, "kcal_target": 3000, "protein_target": 200 }`
Fejler + ruller alt tilbage hvis `athleteId` mangler/ikke findes.

**Test (PowerShell):**
```powershell
$key  = "DIN-SB_SECRET-NØGLE"
$body = @'
{ "p_payload": { "athleteId": "ATLET-UUID", "kcalTarget": 3000, "proteinTarget": 200,
  "days": [ { "name": "Dag 1", "items": [
    { "meal": "Havregryn + skyr", "kcal": 520, "protein": 38, "carb": 70, "fat": 9 },
    { "meal": "Kylling + ris",    "kcal": 610, "protein": 55, "carb": 65, "fat": 12 } ] } ] } }
'@
Invoke-RestMethod -Method Post `
  -Uri "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_meal_plan" `
  -Headers @{ apikey = $key; Authorization = "Bearer $key" } `
  -ContentType "application/json" -Body $body
```
