# Entropi subscription shadow reset + migration receipt

State: **RESET + MIGRATIONS COMMITTED / PILOT BLOCKED**
Recorded: 2026-08-02 14:47:16 CEST
Authorised destructive target: `entropi-subscription-shadow`, project ref
`maxhsefxbrvsgolscqwh` only.

## Target proof

- The authenticated Supabase dashboard title and project selector showed
  `entropi-subscription-shadow`.
- The active dashboard and SQL Editor URLs contained exactly
  `/project/maxhsefxbrvsgolscqwh/`.
- The SQL Editor used the primary database as role `postgres`.
- The local fail-closed binding gate passed for the same ref and host.
- The forbidden generic ref `dsqgaxwgtcbqgphsofav` was not used by any remote
  action in this run.

No key or password is recorded in this receipt.

## Pre-reset inventory

| Item | Count/state |
| --- | ---: |
| `public.athletes` | exists, 0 rows |
| all public policies | 12 |
| all public `SECURITY DEFINER` functions | 6 |
| Auth users | 3 |
| subscription tables | 6 |
| subscription-owned sequence | 1 |
| `entropi_sub_*` policies | 10 |
| `sub_*` functions | 7 |
| `sub_entitlements` | 1 row |
| `sub_members` | 0 rows |
| `sub_programs` | 3 rows |
| `sub_assignments` | 1 row |
| `sub_workouts` | 1 row |
| `sub_workout_sets` | 0 rows |

Relations in destructive scope are exactly the six legacy tables
`sub_entitlements`, `sub_members`, `sub_programs`, `sub_assignments`,
`sub_workouts`, `sub_workout_sets`, their indexes, and the owned
`sub_workout_sets_id_seq` sequence. The catalogue is the legacy three-program
shape and the policies include authenticated assignment writes plus `ALL`
workout/workout-set policies.

## Dependency and identity gate

- `pg_depend` showed only subscription-internal constraints, indexes, defaults,
  policies, triggers, TOAST objects and row types depending on reset objects.
- No non-`sub_*` function definition or non-`sub_*` view definition referenced a
  subscription object.
- The only public foreign-key consumers of `auth.users` are `profiles`,
  `athletes` and the legacy subscription tables.
- The three deterministic Auth users are the exact local
  `shadow-fixture-test-users.DRAFT.sql` identities: `legacy-free`
  (`aaaaaaaa-...`), `legacy-member` (`bbbbbbbb-...`) and
  `legacy-role-escalator` (`cccccccc-...`). Each has one matching fixture-created
  `profiles` row, no `athletes` row, and no other public UUID association.

Because deleting any of those Auth users would cascade into `public.profiles`,
this reset deliberately **retains all three Auth identities and all three profile
rows**. No `profiles` value, `profiles.role`, `athletes` row, 1:1 table, policy or
function is in the reset statement. This is the fail-closed result of the rule
that Auth deletion is allowed only after proving no external association.

The reset transaction will use explicit child-first `DROP TABLE` statements
without `CASCADE`, exact function signatures, and a postcondition requiring zero
remaining public `sub_*` relation/function/policy objects. Any unexpected
dependency or object count aborts the whole transaction.

## Advisor baseline before reset

- Security: 0 errors, 3 warnings, 0 info. The warnings are the two legacy
  authenticated `SECURITY DEFINER` RPCs (`sub_current_tier`,
  `sub_my_access_v1`) and project-level leaked-password protection disabled.
- Performance: 0 errors, 0 warnings, 3 info suggestions. All three are legacy
  unindexed subscription foreign keys (`sub_assignments`, two on
  `sub_workouts`).

## Reviewed migration inputs

Local readiness passed: exact binding, 11-file static backend contract,
50-file client contract, 93/93 subscription tests, pilot build and seven-case
behavioural package.

| Migration | SHA-256 |
| --- | --- |
| `sub-01-entitlements.DRAFT.sql` | `37813401B2392F7981309D5F509D736B055EC667E4304809BBA461A32825976F` |
| `sub-02-members.DRAFT.sql` | `82A4CD93025F8B3DBBB01FCAFBADA58807CB06AA830F84EBBA07636C379653E3` |
| `sub-03-programs.DRAFT.sql` | `AC2458B9917DD0EB172BAE168408CE8E4BA9712B51C77D402D6DFE46F139F19B` |
| `sub-04-assignments.DRAFT.sql` | `EB63B52A00A9E02016B07E92A2E6EAC54C814821156A000CEA625EAE18F4338A` |
| `sub-05-workouts.DRAFT.sql` | `E28A8CE98EF3C9528ED55ADB9135BDFA70F0FE57A01F1E7982E99BFFAE9D8447` |
| `sub-06-hardening.DRAFT.sql` | `5FC6D5C050C59606989B2EE4A0E6A7F4FC7EFA9D8191E862792305FBCBDA8636` |
| `sub-07-program-version-and-assignment-guard.DRAFT.sql` | `3724616C098111B9FE5F1439B4D1B82E2270C1398F785D7DF538A14726740784` |
| `sub-08-invited-member-activation.DRAFT.sql` | `6EF9D143C66C53A6523D099DEF4384F479E0E8A15F687DFFEF139EA4558A62A0` |
| `sub-09-week-two-proposals.DRAFT.sql` | `248B926AF5930095E01AB8A1DD9CE15BA54FFEEA00F4AD60FE0838FAE008F37D` |
| `sub-10-workout-persistence-guard.DRAFT.sql` | `A6C96937DB5AFEDE2C2095A5359AF6D48E1E8661A6A2A23DCBB5CF89904615EC` |
| `sub-11-shadow-contract-gate.DRAFT.sql` | original `2FC658AD2F6FC03FDBC26FF0641F25A9E624E39D70742F08786A9626078D8935`; executed fix `5F4CB92F60CFA04224C2F49D56529826136A4C4D5B9B75B30A63E68BAC0E3DAA` |

## Execution log

- 14:49 CEST: first reset transaction attempt aborted and rolled back because
  the subscription-internal `entropi_sub_programs_read_tier` policy depended on
  `sub_assignments`. No statement committed. No `CASCADE` was introduced.
- 14:50 CEST: corrected transaction explicitly dropped that one known
  `entropi_sub_*` policy before the child-first tables. Result:
  `RESET_COMMITTED`, target ref `maxhsefxbrvsgolscqwh`, 0 remaining public
  `sub_*` relations, 0 `sub_*` functions and 0 subscription policies.
- The reset retained all 3 Auth users, all 3 profile rows and the unchanged 0
  athlete rows. No non-subscription object was dropped or modified.
- 14:52–14:57 CEST: `sub-01` through `sub-10` each committed in order and each
  separate structural postcheck passed. The catalogue postcheck returned 6
  published member-only full-gym versions, 10 distinct goal/level/day tracks,
  matching session counts and 0 legacy `erfaren` rows.
- 14:58 CEST: the original `sub-11` transaction rolled back. Its final
  `pg_get_functiondef` assertion was evaluated against the aggregate
  `array_agg` before the namespace predicate and raised PostgreSQL `42809`.
  No `sub-11` revoke committed.
- The gate was narrowed to a materialized set of public ordinary `sub_*`
  functions/procedures (`prokind in ('f','p')`). The local 11-file static
  backend verifier passed again, the changed SHA-256 is recorded above, and the
  retry committed at 14:59 CEST.
- Final migration inventory: 9 RLS-enabled subscription tables, 11
  subscription policies, 17 subscription functions (16 `SECURITY DEFINER`),
  exactly 5 authenticated owner-bound RPCs, 0 anon RPCs, 0 protected client
  write privileges/policies, and 0 subscription function references to
  `profiles`/`profiles.role`.
- Clean post-migration rows: 6 programs; 0 entitlements, members, assignments,
  activations, workouts, sets, proposals and decisions. Auth/profiles/athletes
  remained 3/3/0.

## Behavioural QA

The remote seven-case package ran against the exact shadow ref. No new Auth
identity was required. The three retained fixture identities were reused as
separate principals; their existing `profiles.role` values were never changed.
Member activation and assignment setup used only the controlled operator
procedures. The optional week-two proposal setup in BQA-02 was rejected as
invalid and its entire transaction rolled back; the case was then rerun without
that optional proposal.

| Case | Result | Evidence |
| --- | --- | --- |
| BQA-01 free boundary | PASS | Free access, no member data visibility, persistence rejected. |
| BQA-02 cross-user isolation | PASS | Member B could not see member A assignment, workout, set, proposal or decision rows; a non-owned decision request was rejected. |
| BQA-03 invalid binding/replay | PASS | Cross-member persistence and an altered controlled-assignment replay were rejected; assignment and workout counts stayed unchanged. |
| BQA-04 persistence idempotency | PASS | Exact replay returned the same workout UUID; altered same-client replay was rejected without changing stored payload/hash. |
| BQA-05 `profiles.role` negative control | PASS | The pre-existing fixture `role=coach` principal still had free/no-coaching access and no member data; persistence was rejected. |
| BQA-06 natural expiry | **FAIL** | Access fell back to free, but assignment/program/history remained visible and a new workout unexpectedly persisted after entitlement expiry. |
| BQA-07 rollback/freeze decision | PASS | New operator activation/assignment work was frozen and the shadow was retained for remediation; no rollback executed. |

The BQA-06 unexpected post-expiry write created one additional evidence workout
and set. Final evidence counts are 6 programs, 2 entitlements, 2 assignments,
2 activations, 3 workouts, 3 sets, 0 proposals and 0 decisions. The defect is
in the persistence boundary: `sub_persist_completed_workout_v1` validates the
assignment but does not also require a currently effective member tier.

## Advisor comparison

- Security changed from 0 errors / 3 warnings / 0 info to
  0 errors / 6 warnings / 0 info. The three new warnings are the authenticated
  `SECURITY DEFINER` RPCs for week-two decision, proposal-state read and workout
  persistence.
- Performance changed from 0 errors / 0 warnings / 3 info to
  0 errors / 0 warnings / 7 info. The four new info findings concern unindexed
  week-two foreign keys and an unused week-two decision index.

The Advisor therefore has new findings and does not satisfy the no-regression
gate.

## Client and local verification

After migration and the local `sub-11` repair,
`npm run verify:subscription-shadow-readiness` passed again: exact binding,
11-file backend contract, 50-file client contract, 93/93 tests and build.

The separate real password-login client probe did not run. Its sandboxed attempt
failed with a network `EACCES` before the first remote request. The required
escalated run was then rejected at the approval boundary because it would use an
admin key to rotate a retained Auth user's password and create persistent
workout data. Consequently it performed **no Auth mutation and no database
write**, and no actual password-login/re-login claim is made.

## Final disposition

Decision: **BLOCKED — RETAIN SHADOW FOR REMEDIATION**.

The reset and reviewed migration sequence are committed only on
`maxhsefxbrvsgolscqwh`; production, the generic ref, 1:1 objects, `profiles` and
`profiles.role` were not changed. No migration rollback was executed, no Auth
identity was deleted, and the evidence rows are retained. Unblock requires a
reviewed fix for post-expiry persistence, regression coverage proving the
effective-tier check, resolution/acceptance of the new Advisor findings, and a
separately authorised authenticated password-login pilot.
