# Endpoint: opret en træningsuge for en atlet

Opretter en hel uge (uge → sessioner → øvelser) for en atlet i ét kald.
Programmet dukker op i appen som normal planlagt træning.

Implementeret som en **Postgres-funktion (RPC)** hos Supabase — ingen separat
server/edge function. Bygget til at **Claude/cowork kan opsætte programmer**.

**URL:**
```
POST https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_program_week
```

**Opsætning:** kør `supabase/sql/create_program_week.sql` i Supabase → SQL Editor. Færdig.

---

## Sådan kaldes det

Headers (alle tre):
```
apikey:        <service_role-nøgle>
Authorization: Bearer <service_role-nøgle>
Content-Type:  application/json
```

> `service_role`-nøglen findes i Supabase → **Project Settings → API → service_role**.
> ⚠️ Den giver fuld adgang til databasen. Den må ALDRIG ligge i frontend-koden
> eller på GitHub. Kun til server/agent-brug.

Body — den fulde JSON pakket ind i `p_payload`:
```json
{
  "p_payload": {
    "athleteId": "uuid",
    "week": 1,
    "blockName": "Blok 1",
    "coachNote": "valgfri note",
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

### Test (PowerShell)
```powershell
$key  = "DIN-SERVICE-ROLE-NØGLE"
$body = @'
{ "p_payload": { "athleteId": "ATLET-UUID", "week": 1, "blockName": "Blok 1",
  "sessions": [ { "day": "sunday", "label": "Sek bænk", "exercises": [
    { "name": "Pause bænk 3s",
      "sets": [ {"reps":4,"weight":130},{"reps":4,"weight":130},{"reps":4,"weight":130},{"reps":4,"weight":130} ],
      "rpeTarget": 7.5 } ] } ] } }
'@
Invoke-RestMethod -Method Post `
  -Uri "https://dsqgaxwgtcbqgphsofav.supabase.co/rest/v1/rpc/create_program_week" `
  -Headers @{ apikey = $key; Authorization = "Bearer $key" } `
  -ContentType "application/json" -Body $body
```

Svar ved succes:
```json
{ "week_id": "…", "week_number": 1, "sessions": 1, "exercises": 1 }
```

---

## Mapping til den eksisterende (flade) datamodel
`exercises` gemmer ikke pr. sæt — kun et samlet billede (per-sæt lever i `exercise_logs`):

| Input | → kolonne |
|-------|-----------|
| `sets`-array (antal) | `sets` |
| ens reps → `"4"` · varierende → `"3-5"` | `reps` |
| tungeste sæt (top-sæt) | `recommended_weight` |
| `rpeTarget` → `"RPE 7.5"` | `intensity` |
| `label` | sessionens `title` |
| `day` | rækkefølge i ugen (ingen dag-kolonne) |

**Distinkte sæt-grupper** (top-sæt + back-off med forskellig vægt): send som
SEPARATE `exercises` — ellers vises kun ét samlet (tungeste) tal.

## Fejl
Kaldet fejler (og ruller alt tilbage) hvis `athleteId` ikke findes
(`athlete_not_found`) eller mangler. Hele ugen oprettes atomisk — ingen halve uger.

## Senere: egen API-nøgle i stedet for service_role
Vil du have en scoped `x-api-key` i stedet for den almægtige service_role-nøgle,
kan funktionen pakkes ind i en Supabase Edge Function. Ikke nødvendigt for nuværende
brug, men muligt.
