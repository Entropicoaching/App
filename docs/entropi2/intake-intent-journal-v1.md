# Explicit local intake intent journal v1

Candidate E2-KOST-MIKRO-INTENT-JOURNAL1, SOURCE2/MAX3, base revision
`322264489d4e537ef8be2f196a2ae0090a6da9b4`.

This callable integration layer wraps the actual accepted
`createIntakeEvidenceRequest` and `createIntakeEvidenceWriter`. It preserves an
unresolved request across disposal/reload using caller-owned injected storage.
It performs no global storage discovery, enumeration, migration, expiry, UUID
generation, automatic recovery, retry, schema activation or macro fallback.
The existing mounted `nutrition/index.mjs` -> controller -> `nutritionContracts`
still uses its unchanged legacy macro save path. No UI, main import, flag, old
source/test/data, SQL or migration is changed. This is usable local code with
synthetic transport tests, not mounted/live intake or production acceptance.

## API

```js
import { createIntakeIntentJournal } from './intakeIntentJournal.mjs'

const journal = createIntakeIntentJournal({
  enabled: true, // default OFF; OFF reads none of the following getters
  client,       // existing caller-owned client, never credentials
  getCurrentContext: () => ({
    enabled: stillEnabled,
    writable: existingGuardsAllowWriting,
    future: isFutureDay,
    ownerId: currentOwnerId,     // owner need not equal athlete
    athleteId: currentAthleteId, // canonical lowercase UUID
    date: selectedDate,          // exact YYYY-MM-DD, nonfuture per caller
    generation: sessionEpoch,   // nonempty string or finite number
    client: currentClient,      // exact instance supplied above
  }),
  storage,                     // synchronous getItem/setItem; no removeItem
  withExclusiveLock,            // REQUIRED; contract below
})

// Explicit new intent: six fields accepted by the actual model.
// UUID must come from the caller's intentional logging action.
await journal.prepare({ athleteId, date, requestId, grams, meal, food })
await journal.submit()          // sends only a never-attempted prepared request
const status = journal.snapshot()
// After an uncertain/denied/unavailable/conflicted result, explicit action only:
// await journal.retry()        // identical retained request/UUID
// After private matching writer confirmation, explicit acknowledgement only:
// await journal.acknowledge()
journal.dispose()

// A later, explicitly enabled SAME-owner/athlete/day lifecycle (new generation
// and client allowed) constructs a NEW journal with the same storage/lock service:
// await next.recover()
// await next.retry()           // recovered attempted records never auto-submit
// await next.acknowledge()
```

`prepare(input)` validates with the real model synchronously and copies/freeze
its entire canonical output before scheduling storage work. Mutating input while
the returned Promise is pending cannot change persistence or replay. It stores
the canonical request INCLUDING its version, wrapper version, full owner/athlete/
day identity and explicit attempted/acknowledged booleans. The record is bounded
to 16,384 UTF-8 bytes with `TextEncoder`. It accepts no arbitrary serialized
request, nutrient validator, supplied writer or caller-provided success status.
Invalid input reaches neither lock nor storage nor RPC. Await prepare before
submit; a submit while preparation is busy cannot transmit.

`recover()` explicitly reads only the bound scoped key. Unknown versions, wrong
identity, malformed/oversize records, unknown fields and noncanonical payloads
are rejected without modifying them. The actual model reconstructs the six-input
request and the complete canonical output and record must match the stored bytes
exactly. Recovery never invents an ID or refreshes food from a catalogue. A
never-attempted recovered record becomes `prepared`; an attempted one becomes
`recovered` and needs `retry()`. Recovery with a retained in-memory request returns
its existing snapshot; it cannot switch payloads under an active instance.

`submit()` and `retry()` have no input argument: payload is accessible only inside
this guarded writer operation. In-flight submit/retry calls return the SAME
Promise and cause one RPC, including synchronous transport reentry. Other
overlapping operations return `busy`. Prepare blocks any different request while
an unresolved record exists; a new instance must recover an existing key even
when the proposed payload matches it. Repeating prepare for the exact same
never-attempted request can explicitly repersist after an initial storage failure.

Before transmission, journal storage must return the exact prepared record. The
journal then persists `attempted:true` and requires exact readback. Only afterwards
does the actual writer run; its private transport seam rechecks scope, exact
stored bytes and canonical request immediately before delegating to the exact
real client. Thrown storage calls, silent discard, readback mismatch, quota or
missing lock cannot bypass these checks. An attempted marker can be conservative
when failure occurs before actual transport; that is safer than losing a possible
commit. The accepted writer alone validates the RPC's matching mealLog/evidence
pair. No echo/nutrient/rounding oracle is duplicated here.

`acknowledge()` takes no authorization data. Only this journal's private matching
writer result in the current scope can authorize it. It rereads exact persisted
bytes under the lock, then writes and verifies a full same-ID
`acknowledged:true` tombstone. It NEVER deletes the record. This retains recovery
information if writing succeeds but readback fails. A repeated explicit
acknowledgement can verify that exact pending tombstone after a storage failure.
The still-current instance may prepare a NEW caller UUID after verified
acknowledgement, replacing exactly that tombstone under the same lock. Reusing
the just-resolved UUID as a new intent is blocked.

An acknowledged tombstone after reload is deliberately NOT authority to discard
or replace the intent: recover it, explicitly retry the SAME ID against the
writer, then acknowledge again. This costs a conservative idempotent retry but
avoids trusting a caller-edited status as server confirmation. There is no
physical-clear method, stale clear callback or automatic cleanup. Failed RPC,
denied/unavailable/conflict/uncertain results never permit replacement. Storage
failure after a possible commit leaves a retained same-ID record and no resolved
claim. A failed attempted-marker write that leaves an older prepared record can
require dispose/new-instance explicit recovery; the request ID still stays fixed.

`snapshot()` exposes only frozen status, optional requestId, mayHaveCommitted and
uncertain. It exposes no food, grams, owner, key, raw error, success value or client.
`mayHaveCommitted` stays true after an attempt, including success/resolution;
`uncertain` becomes false only after private matching confirmation/resolution.
Retired snapshots expose only status and conservative mayHaveCommitted.
`dispose()` synchronously retires the instance and releases references without
storage activity. It cannot cancel a transaction already entered.

Enabled prepare/recover/submit/retry/acknowledge return Promises. Snapshot/dispose
are synchronous. All OFF methods synchronously return `{status:'off'}`, safe to
await, and do not read inputs or injected seams.

| Status | Meaning |
| --- | --- |
| off / idle / empty | Inert, active without intent, or explicit recovery found no record. |
| invalid / invalid-record | Input or restored record rejected; retained data untouched. |
| prepared | Exact initial record persisted/read back, no attempt yet. |
| recovered | Attempted record explicitly recovered; only explicit retry sends. |
| persisting / pending | Local persistence or one writer operation is in progress. |
| confirmed | Actual matching writer success; record remains until explicit acknowledgement. |
| resolved | Acknowledgement tombstone verified; this instance can accept a new UUID. |
| uncertain / conflict / denied / unavailable | Actual writer outcome; intent still unresolved. |
| blocked / busy | Replacement/acknowledgement forbidden or another operation running. |
| lock-required | Exclusive seam absent or did not complete its callback. |
| storage-error / storage-conflict | Storage/seam failed, or exact expected record changed; no overwrite to repair it. |
| retired | Scope/capability revoked, callback failed or disposed; no subsequent storage or RPC. |

## Scope, concurrency and durability limits

The constructor binds current enabled/writable/nonfuture owner, athlete, date,
generation and exact client. The owner is a nonempty string bounded to 256 UTF-8
bytes. The model validates athlete/date on preparation and recovery. The callback
must report all existing readonly/date/authorization guards synchronously. Advance
generation for every lifecycle change, including away/back between observations;
this module cannot detect unreported changes. Every operation and storage boundary
checks current scope, and late RPC/lock completions retire without touching a new
scope. New-generation recovery requires an explicitly created new instance.

The deterministic bounded key pseudonymizes ONLY owner/athlete/day; generation
and client are intentionally absent so same-scope explicit recovery works.
Full identity checks reject collisions and foreign records. The key hash is not
encryption, a cryptographic digest or authentication, and must not be logged.
Food/source/grams in the value are caller-owned local data, not credentials,
session/auth caches or server authorization. No unrelated storage keys are read.

`withExclusiveLock(key, asyncCallback)` must invoke the callback once and hold a
genuine exclusive lock until its entire returned Promise settles, including RPC.
All instances/tabs/writers accessing this storage namespace must share the same
lock domain and obey it; storage and lock instances cannot change once bound.
The tests supply a serial per-key Promise queue shared by synthetic journal
instances. It proves local coordination only. An actual cross-tab adapter needs
its own reviewed exclusivity/lifetime guarantees; this module accesses no
`navigator`, lock globals or browser storage. Absent lock fails closed. It cannot
verify a dishonest lock service or serialize code that ignores the contract.
LocalStorage has no compare-and-swap or atomic multi-tab lock here.

Exact readback confirms the injected adapter's contract, not physical disk fsync,
quota immunity or permanent retention. Caller storage must durably preserve writes
and return string/null synchronously. Storage deletion, external tampering and
eviction are outside that contract. Same-instance byte changes are rejected;
schema/identity/model validation cannot authenticate a fully valid same-scope
record maliciously rewritten BEFORE a fresh recovery. No local record establishes
server authority. Retain the UUID and escalate storage conflicts rather than
guessing reconciliation or replacing it. No unbounded UUID history is stored;
caller must use new IDs only for intentional new logs and server idempotency
remains authoritative.

Tests use actual public Frida food/model/writer modules, synthetic scoped IDs,
Map storage, a shared synthetic lock and faithful model-shaped RPC pairs using
the existing `foodPortion` calculation. A simulated committed-row map tests lost
replies; no claim is made that a database/server was invoked. Accepted SQL/reader/
writer acceptance is supplied and not repeated. Producer tests are not independent
peer acceptance. Fresh separate native same-engine Codex review and whole-app
suite/build/release checks remain coordinator duties.
