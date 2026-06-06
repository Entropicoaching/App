# Endpoint: POST /api/programs/weeks

Opretter en hel træningsuge (uge → sessioner → øvelser) for en atlet i ét kald.
Programmet dukker op i appen som normal planlagt træning.

**URL (når deployet):**
```
https://dsqgaxwgtcbqgphsofav.supabase.co/functions/v1/programs-weeks
```

**Auth:** header `x-api-key` skal matche secret `PROGRAMS_API_KEY`.

---

## Deploy (3 trin — alt via Supabase-dashboardet, ingen terminal)

### 1. Kør SQL'en
Supabase → **SQL Editor** → indsæt og kør hele `supabase/sql/create_program_week.sql`.
(Opretter funktionen der laver selve den atomiske indsættelse.)

### 2. Opret edge-funktionen
Supabase → **Edge Functions** → **Deploy a new function** →
navngiv den nøjagtigt `programs-weeks` → indsæt indholdet af `index.ts` → Deploy.

### 3. Sæt API-nøglen som secret
Supabase → **Edge Functions** → **Secrets** (Manage secrets) → tilføj:

| Name | Value |
|------|-------|
| `PROGRAMS_API_KEY` | *(din genererede nøgle — IKKE committet til git)* |

> `SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` er allerede tilgængelige automatisk i edge-funktioner — dem skal du ikke tilføje.

---

## Test (PowerShell)

```powershell
$body = @'
{
  "athleteId": "SÆT-ATLET-UUID-HER",
  "week": 1,
  "blockName": "Blok 1",
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
          "rpeTarget": 7.5
        }
      ]
    }
  ]
}
'@

Invoke-RestMethod -Method Post `
  -Uri "https://dsqgaxwgtcbqgphsofav.supabase.co/functions/v1/programs-weeks" `
  -Headers @{ "x-api-key" = "DIN-API-NØGLE-HER" } `
  -ContentType "application/json" `
  -Body $body
```

Svar ved succes (HTTP 201):
```json
{ "ok": true, "week_id": "…", "week_number": 1, "sessions": 1, "exercises": 1 }
```

---

## Sådan mappes data til den eksisterende model

`exercises`-tabellen gemmer ikke vægt/reps pr. sæt — kun et samlet billede
(det er `exercise_logs`, der holder de faktiske loggede sæt). Derfor:

| Input | → kolonne |
|-------|-----------|
| `sets`-array (antal) | `sets` |
| ens reps i sæt | `reps` = `"4"` · varierende → `"3-5"` |
| tungeste sæt | `recommended_weight` (top-sæt) |
| `rpeTarget` | `intensity` = `"RPE 7.5"` |
| `label` | sessionens `title` |
| `day` | rækkefølge i ugen (der er ingen dag-kolonne) |

**Distinkte sæt-grupper** (fx top-sæt + back-off med forskellig vægt): send dem
som **separate exercises**, ellers vises kun ét samlet (tungeste) tal.

## Fejlkoder
- `400 validation_failed` — manglende/forkerte felter (se `details`)
- `401 unauthorized` — forkert/manglende `x-api-key`
- `404 athlete_not_found` — `athleteId` findes ikke
- `500 server_misconfigured` — `PROGRAMS_API_KEY` ikke sat
