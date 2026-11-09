# Local intake evidence writer v1

Candidate E2-KOST-MIKRO-INDTAG-WRITER1, SOURCE1/MAX3, base
`48dcad67dbc2a3d949ba5eb5e1951b17c62855e0`. This is executable local transport
code for the accepted **DRAFT** contract. It is not mounted, applied or enabled.
The athlete UI and live micronutrient intake do not work through this module yet.
Exactly four files are added; existing SQL, model, controller, view, flags, main
imports and legacy seven-field saves remain unchanged. The independent Frida UI
pipeline is unaffected.

## Callable API

```js
import { createIntakeEvidenceWriter } from './intakeEvidenceWriter.mjs'

const writer = createIntakeEvidenceWriter({
  enabled: true,                 // otherwise entirely inert
  client,                       // existing caller-owned Supabase-style client
  getCurrentContext: () => ({
    enabled: featureStillEnabled,
    writable: existingGuardsAllowWriting, // includes readonly and future-day checks
    future: isFutureDay,         // true also explicitly revokes capability
    ownerId: currentOwnerId,     // existing account/owner scope, not athlete ID
    athleteId: currentAthleteId, // canonical lowercase UUID
    date: selectedDate,          // exact YYYY-MM-DD
    generation: sessionEpoch,   // nonempty string or finite number
    client: currentClient,      // exact same instance
  }),
})

// requestId comes from the caller's guarded intent journal. Never change it
// merely because a response was lost. No UUID is generated here.
writer.prepare({ athleteId, date, requestId, grams, meal, food })
const result = await writer.submit()
// Only after an explicit user retry action and in the SAME current scope:
// const result = await writer.retry()
const currentStatus = writer.snapshot()
// Effect cleanup / account or selected-day lifecycle:
writer.dispose()
```

`prepare(input)` validates through the actual `createIntakeEvidenceRequest` and
checks the bound athlete/day. It makes a recursively frozen private copy of the
canonical request, including food, preparation, source, all nutrients, zero/null,
grams, meal, version and IDs. It performs no RPC. Input must have the model's six
input fields, not its seven-field output (which includes version).

`submit(input?)` optionally prepares, then sends a prepared intent. Concurrent
exact repeats return the **same Promise**, including synchronous transport
reentry, and issue one RPC. After an attempt it only returns the current status;
it never automatically retransmits. `retry()` is the explicit retransmission
operation for uncertain/conflict/denied/unavailable states and uses the identical
frozen request object and serialized bytes. An in-flight retry shares its Promise.
Enabled submit/retry always return Promises; OFF methods return an inert status
object which is also safe to await. `prepare`, `snapshot`, `dispose` are synchronous.

`snapshot()` returns a frozen status, optional requestId and validated success
`value`. It never exposes the pending payload or raw errors. The value is the
actual model's read result, deeply copied/frozen. Returned values already held
by the old caller cannot be revoked; that caller must keep its normal UI scope
guards. There are no listeners, telemetry, console output or persistence.

| Status | Meaning / next action |
| --- | --- |
| off | No client, scope callback or input/food getters are read. Create a new explicitly enabled instance if appropriate. |
| idle | Active scope, no intent. |
| invalid | This call failed model or athlete/day validation; no RPC and retained state unchanged. |
| prepared | One validated intent, not transmitted. Replacing it requires disposing the instance before any send. |
| pending | One RPC operation is in progress. |
| success | Normal JSON pair passed the actual read model and echoed the complete original canonical request, including requestId. |
| uncertain | Rejection, unknown SQL code, absent/malformed or valid-but-unrelated pair; a commit may already exist. Explicit same-intent retry only. |
| conflict | Changed reuse of a known UUID, or actual 23505. A local rejected prepare leaves retained state unchanged. No successful save is inferred. |
| denied | Actual 42501 from the Supabase-shaped error result. No fallback. |
| unavailable | PGRST202, 42P01 or 42883 error result: required contract unavailable. No fallback or schema activation. |
| blocked | Another prepared, pending or unresolved intent prevents replacement; retained state unchanged. |
| retired | Scope changed, capability was revoked, context failed, or disposed. No payload/value/requestId is returned and no later method can transmit. |

Matching success clears uncertainty. `mayHaveCommitted` remains true after an
uncertain attempt even if a later retry is denied/unavailable/conflicted; that
later error does not prove the earlier attempt rolled back. A fresh definitive
error is a known rejection of that attempt. Thrown transport exceptions are
conservatively uncertain. An intentional new log uses a NEW caller UUID only
after a known outcome; unresolved attempts block new IDs. All previously prepared
IDs retain their canonical fingerprints in this instance so changed UUID reuse
is rejected locally. This in-memory history is cleared on retirement.

Caller-owned reconciliation must resolve an uncertain operation before replacing
the writer. Creating a new UUID or disposing/reloading is **not reconciliation**.
There is no automatic macro save fallback. Missing contract metadata is a status,
not permission to install or activate anything.

## Scope and authorization

The constructor binds owner, athlete, day, caller epoch and exact client instance.
Before RPC, after await, and on every snapshot/retry/prepare/submit, it checks
enabled/writable capability and these same identities. Once a mismatch is observed,
the instance stays retired even if the old scope returns. The caller must advance
generation for every session/permission lifecycle change, including a switch away
and back between observations. The callback must synchronously report existing
guards; it does not look up profiles, dates, email, sessions or credentials.

`writable: true` must already include the existing readonly/future-date policy.
The optional `future: true` is an additional explicit veto. This module cannot
discover the user's current day or authorization independently. A changed owner
or `ownerId === athleteId` is never an authorization grant: existing SQL
`auth.uid()` and unchanged legacy RLS remain authoritative. SQL tests use a coach
UID different from both athlete and athlete owner, with nonowner authenticated role.

Retirement hides the pending intent and late result, including from captured old
callbacks. It does not cancel an in-flight server transaction: that transaction
may already have committed. Never label retirement a cancelled write, and never
replace it with another write to compensate. Previously delivered success data
still needs caller lifecycle guards. Client and callback references are released
on retirement; no authentication cache is created.

The writer is intentionally memory-only. Reload or dispose loses its private
request and UUID history. A later reviewed UI must bind its **existing guarded
intent journal** and explicit reconciliation; this module promises no reload
recovery and adds no localStorage, clipboard, registry or persistence.

## Actual SQL transport and test limits

The sole call is
`client.rpc('record_meal_intake_evidence_v1', { p_request: immutableRequest })`.
The reply must be `{ data: { mealLog, evidence }, error: null }` containing normal
DataAPI JSON. Actual `readIntakeEvidence` validates the pair; structural equality
then checks its full canonical request against the original. SQL jsonb key order
is irrelevant. A valid unrelated pair, swapped IDs, changed source or null/zero
cannot count as success. Typed PGlite Date/NUMERIC rows are not this JSON contract.

The SQL integration file uses one shared PGlite fixture, closed in finally,
the verbatim existing public auth/RLS fixture, old plan DRAFT and unchanged
accepted evidence DRAFT. Only fixture setup runs as owner; actual business RPCs
run as authenticated nonowner without superuser/BYPASSRLS. The thin client binds
the JSON parameter and returns the real RPC's to_jsonb pair or SQL error code.
It simulates lost transport only **after** the real transaction committed.
Retry preserves complete rows/timestamps in all three tables. Old parent edits
and DELETE still cause original 23505 with no resurrection. Missing-contract
metadata is tested separately with a clearly synthetic transport, not an uninstall.

Direct `INSERT RETURNING *` retains its accepted statement-snapshot 42501
limitation; this API uses the actual RPC's returned pair. These are sequential
local SQL and state-machine tests, not actual PostgREST, live release, visual,
true multiconnection stress or athlete UI acceptance. Full suite/build/global
checks and fresh independent native same-engine Codex K review belong to the
coordinator. No schema, RPC, role, policy, grant or production activation is added.

References remain user-reported food/amounts, not individually measured intake,
attestation, medical targets or needs percentages. Legacy logs are not enriched.
Future normal UI requires exact approved schema activation and its own reviewed
integration, retaining all current owner/date/version/intent guards.
