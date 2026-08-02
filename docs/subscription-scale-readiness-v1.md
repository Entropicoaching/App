# Subscription scale-readiness v1

Status 2026-08-01: local architecture review. This document makes no Supabase,
hosting, authentication, analytics, payment or release change.

## Product boundary

The subscription product must be able to grow from one shadow-pilot member to
hundreds of self-service members without ever becoming a second path into the
existing 1:1 portal. Its value is a private, explainable training loop:

```text
member input -> assigned program version -> completed workout -> evidence -> explicit next-week choice
```

Automation may prepare a suggestion. It must not silently overwrite a program,
rewrite a logged workout or infer coaching access.

## Current foundation

| Area | Present locally | Required before real members |
| --- | --- | --- |
| Product separation | Separate `src/subscription`, no `profiles.role`, own `entropi-sub-auth` session, separate Vite build | Prove the same boundary in the shadow project and on the final host |
| Training loop | Local onboarding, week-one logging and explicit week-two choice | Persist atomically against an exact assignment/program version |
| Program provenance | Program version / assignment contract and DRAFT backend sequence | Publish-reviewed catalog, immutable released versions and audit trail |
| Safety | Local completion, smoke and separation gates | Shadow RLS tests, cross-user tests and a release approval record |
| Mobile | Local mobile review surface and LAN test command | Device/browser matrix, offline behaviour decision and accessibility pass |

## Target architecture for hundreds of members

### 1. Product and identity isolation

- One product client, one hostname and one storage key: `entropi-sub-auth`.
- The subscription client only reads/writes `sub_*` resources through the
  documented owner-bound RPCs. It never imports portal data or treats
  `profiles.role` as authority.
- Membership is server-controlled and time-bound. A signed-in account is not
  automatically a member.
- A future 1:1 handoff is an explicit consent event with a named data list;
  it is not a shared-session convenience feature.

### 2. Data ownership and history

- Every workout, set, proposal and decision is bound to: `user_id`, exact
  `assignment_id`, exact `program_version_id`, client event ID and timestamp.
- Completed workouts are append-only. Corrections are new, attributable events;
  no background job mutates historical sets.
- Program updates create a new version. Existing members retain the version
  they were assigned until an explicit move is accepted.
- Export and deletion requests need a documented owner-verification route
  before paid access opens. Do not mix private feedback, medical information or
  coach notes into the self-service product by accident.

### 3. Explainable progression

- The app stores planned work separately from actual reps, load, RPE and
  skipped-state.
- A proposal names the comparable sessions and reason for `increase`, `keep`
  or `more data required`; no opaque score decides a member's plan.
- An accepted suggestion is an event, not an overwrite. The following plan
  references that decision.
- Pain, injury, missing data, conflicting signals or repeated underperformance
  stop automatic progression and present a neutral manual-review path.

### 4. Performance and reliability

- The initial member screen loads only the current assignment, current week and
  current program version. History is paginated by assignment/week.
- Persist one completed workout atomically. Retries reuse the same client ID;
  a changed retry fails closed rather than creating duplicate sets.
- Index database reads around `(user_id, assignment_id, completed_at)` and
  exact program/version foreign keys when the shadow schema is authorized.
- Treat network loss as an explicit product state: locally queued draft or
  disabled completion. Do not imply an offline guarantee until it is tested.

### 5. Observability without surveillance

- Record minimal operational events only: anonymised install/release version,
  route error, failed owner-bound request, completion latency and gate result.
- Never send free text, workout notes, raw e-mail, body/health information or
  video to generic analytics.
- Every error record needs a retention period, access owner and deletion route.
- Monitor aggregate health, not individual training compliance. Product support
  is not covert coaching.

### 6. Mobile/PWA decision

- Mobile web is the first delivery path; test current Android/iOS browser,
  small viewport and unreliable connection before calling it a PWA.
- If installability is added later, subscription receives its own manifest,
  service worker scope, update strategy and cache-version test. It must never
  reuse the portal PWA assets or CNAME.
- Start with no offline completion promise. Promote to offline only after a
  deterministic queue/retry/conflict test exists.

## Release gates

No gate may be replaced with a visual check alone.

| Gate | Evidence required | Owner / decision |
| --- | --- | --- |
| Local product | `npm run verify:subscription-pilot-completion` green; tester completes a coherent week-one journey | Marc approves product behaviour |
| Shadow binding | `verify:subscription-shadow-binding` green against only `maxhsefxbrvsgolscqwh` | Marc explicitly authorizes shadow work |
| Data isolation | RLS matrix: owner allowed; other user, anon and self-declared `profiles.role='coach'` denied | Technical evidence, no production fallback |
| Training logic | Golden cases prove no change, keep, increase and manual review using actual set logs | Marc approves rules and edge cases |
| Mobile/reliability | Tested device matrix, keyboard/zoom, slow-network behaviour and recoverable retry | Marc reviews pilot friction |
| Privacy/support | Published contact route, export/delete handling, incident owner and minimal telemetry inventory | Marc approves service promise |
| Paid/open release | Entitlement source, billing failure states, refund/cancel semantics and support load reviewed | Separate commercial decision |

## Precise build slices

These slices are deliberately sequenced. They can be implemented independently
without shipping the product early.

1. **Progression test contract (now).** Build golden tests around actual set
   logs: missing/partial, skipped, RPE above ceiling, non-comparable exercise,
   two qualifying exposures, accepted/kept decision. The result must be
   deterministic and human-readable.
2. **Plan/history read model.** Add a local contract for a member's current
   week, historical completed weeks and assignment/program identifiers. No
   backend call until shadow is explicitly authorized.
3. **Shadow RLS harness.** Once authorized, run the 11 additive DRAFT
   migrations in the isolated project and execute owner/cross-user/anon tests.
   This is the first place real accounts may exist.
4. **Operational envelope.** Add a release manifest, versioned error taxonomy,
   minimal telemetry schema and a support/export/delete runbook. Keep all
   payloads free of free-text and health content.
5. **Mobile reliability pass.** Test the actual current-week flow on target
   phones and decide, with evidence, whether draft persistence or offline queue
   belongs in the pilot.
6. **Member lifecycle.** Design expiration, cancellation, entitlement renewal,
   program retention and optional 1:1 consent as explicit state transitions.
7. **Payments/open signup.** Only after the pilot has proven training value,
   data isolation and support capacity. This is not a prerequisite for testing
   the program loop.

## Immediate recommendation

Finish slice 1 before more program breadth: a scalable product needs a
provable progression contract before it needs more templates. In parallel, the
brand track can finish its local Instagram release readiness because it does
not touch member data or training logic.
