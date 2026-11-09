# Intake evidence reader v1 — local read capability

This is SOURCE1/MAX3 on accepted local commit
`48dcad67dbc2a3d949ba5eb5e1951b17c62855e0`. The SQL draft has not been
applied to production. No existing imports, flags, controller, writer or UI
are changed. The current mounted `Entropi2Kost.mjs` / nutrition controller /
`nutritionContracts` food flow still writes only the original macro fields.
The future assembly must explicitly import and own this reader after separate
integration review; this package does not activate that assembly.

```js
import { createIntakeEvidenceReader } from './intakeEvidenceReader.mjs'

// The caller owns this synchronous scope, derived from its current lifecycle.
// Replace it and increment generation for every owner/day/client/permission
// transition, even A -> B -> A. Do not derive it from an old closure/session.
let current = { enabled: true, client, ownerId, athleteId, date, generation: 1 }
const reader = createIntakeEvidenceReader({ ...current,
  getCurrentScope: () => current })
const result = await reader.load()
// Before consumption, validate current lifecycle again with snapshot().
// Render only this current reader's ready snapshot, never an older load result.
const visible = reader.snapshot()
// On replacement: update current scope, dispose the old reader, create new one.
reader.dispose()
```

`enabled` must be strict `true`. OFF reads no other option and never calls a
client or scope getter. IDs must be canonical lowercase UUID strings, date an
actual ISO calendar day from 1900 through 9999, and generation a nonnegative
safe integer. `ownerId` partitions client lifecycle; it grants no authority.
Only the injected client's real server auth/RLS determines readable rows.
`getCurrentScope()` returns all seven fields shown above, including the current
client object and strict gate. Missing/invalid initial scope is terminal without
I/O. Every observed scope mismatch or throwing getter permanently retires the
instance. Future dates are explicitly supported as read capability alone;
there is no writable-day inference, clock, auth lookup or ambient state access.

## API and statuses

`load()` explicitly refreshes, clears previous data immediately, and returns a
Promise of an immutable snapshot. Double clicks share exactly one pending
Promise; a completed operation permits another explicit load. There is no
background polling, automatic retry, subscription, fallback write or cache.
`snapshot()` checks scope synchronously. `dispose()` permanently clears data
and blocks I/O; an inert OFF reader remains OFF on disposal.

Every snapshot has `status`, `reason`, `scope`, `summary`, `entries`, `mealLogs`
and `evidenceRows`. Only `ready` contains a scope or data; all other statuses
have null summary/scope and empty arrays. Raw backend errors and user food
details are never logged or included in error snapshots.

| Status | Meaning |
| --- | --- |
| `off` | Strict gate disabled; inert API |
| `invalid-scope` | Initial scope/client/getter invalid; create a new instance |
| `idle` / `loading` | No completed current read yet |
| `retired` / `disposed` | Terminal; create a new instance |
| `unavailable` | Missing table/function/schema-cache object; never an empty day |
| `error` | Query rejection or backend error; no retained total |
| `incomplete` | Malformed/foreign rows, invalid evidence, duplicates, unstable/partial pagination or row cap |
| `ready` | Transport completed; individual model nutrients may still be unknown |

`reason` is a fixed code, including `partial-page`, `pagination-changed`,
`pagination-identity`, `invalid-row`, `invalid-evidence`, `invalid-response`,
`row-limit`, `evidence-unavailable`, or `read-failed`. It contains no raw errors.

## Exact projection and bounded completeness

Each query selects only the actual model's public columns. For `meal_logs`:
`id,athlete_id,date,meal,kcal,protein,carb,fat`. For `meal_intake_evidence_v1`:
`meal_log_id,request_id,athlete_id,date,version,food,grams,meal,kcal,protein,carb,fat,created_at`.
Both use exact athlete and date equality, ascending unique ID order, inclusive
`.range()` pages of at most 500, and `.select(columns, { count: 'exact' })`.
The transport must supply an exact nonnegative integer count on every page.
It must honor the entire requested range; silent backend limits, missing counts,
count changes, duplicate/nonprogressing identities, oversized or short pages
are rejected. The reader never uses a short page alone as proof of completion.

The model's actual `INTAKE_LIMITS.rows` is 1000 per table. A full page always
gets a next-page probe; the 1001st actual row is explicitly requested and
rejected, with no truncated summary. Each complete table read uses at most
three queries. Parent/evidence/final-parent therefore use at most nine queries,
at most 1001 rows per stage, and no unbounded children or retries. Exact counts
provide additional truncation detection, not a transaction guarantee.

Rows must be JSON (including string dates/timestamps and numeric JSON numbers),
have the exact selected shape, and belong to the requested athlete/day.
Evidence self-pair validation calls the original `readIntakeEvidence`; it does
not reimplement food, nutrients, portion rounding or identity rules. Invalid or
conflicting evidence cannot manufacture known intake. Transport data is copied
before later awaits, and all exposed nested rows/results are frozen.

## Parent freshness and honest model output

The reader fetches complete parents, complete evidence, then **reloads complete
parents under the same scope**. It passes only the final parents to the actual
`summarizeIntakeEvidence` and `readIntakeEvidence`. Parent edits become unknown
when pairing no longer matches; deleted parents no longer contribute, and new
legacy rows contribute unknown values. If final completeness cannot be proved,
the entire load is incomplete with no summary. A failed refresh never reuses
cached parents or the preceding ready result. Scope is checked before and after
every await, including every page; stale completions expose no rows or totals.

Separate HTTP reads are not an atomic snapshot. Edits **after the final read**,
or changes that do not affect observable count/order during pagination, cannot
all be detected. A future UI must explicitly refresh after writes and on relevant
lifecycle changes. RLS restrictions may make data invisible; an empty response
does not attest that a person ate nothing. There is no realtime or concurrency
benchmark claim.

Only the existing model supplies summary completeness, reference kind and food
source. `entries` aligns with final parents and contains actual model references
or null (including excluded day receipts). Nutrient `total` is null unless every
recorded food row has a known value for that nutrient. Genuine known zero stays
zero; missing values stay null; macro-only legacy rows stay unknown. Empty days
have no zero total. Day-receipt exclusion uses the original model. Meal names,
legacy catalogues, plans, need percentages and dietary adequacy supply no food
or intake inference. References are user-reported reference nutrients with
entered amounts, not measured individual intake or confirmation of a full day.

The SQL integration test uses one shared finally-closed synthetic PGlite fixture,
the original unchanged public auth/RLS fixture and accepted DRAFT SQL. A thin
query translator executes the exact reader projection/filter/order/range,
returning SQL `to_jsonb` rows and real RLS filtering. This is local SQL/JSON
contract evidence, not a real PostgREST service, production or live UI test.
