# Entropi subscription — final shadow-pilot launch report

Decision: **BLOCKED — RETAIN SHADOW FOR REMEDIATION**
Recorded: 2026-08-02
Exclusive remote target: `entropi-subscription-shadow`, project ref
`maxhsefxbrvsgolscqwh`.

## Outcome

The authorised subscription-only reset completed on the exact shadow project,
and the reviewed `sub-01` through `sub-11` sequence committed in order after one
fail-closed local repair to the `sub-11` assertion. Six of seven remote behaviour
cases passed. Launch remains blocked because a naturally expired member could
still persist a new workout, the post-migration Advisor introduced new findings,
and the real password-login client probe requires separate approval for its Auth
password rotation and persistent write.

No production action, generic-project action, deployment, payment/Stripe action,
commit or push was performed. No 1:1 object, `profiles` row, `profiles.role`
value or `athletes` row was changed.

## Exact destructive actions

The pre-reset inventory found six legacy subscription tables, one owned
sequence, ten subscription policies and seven `sub_*` functions. The first
explicit reset transaction rolled back when PostgreSQL reported a known
subscription-policy dependency. The successful transaction then:

- explicitly dropped the dependent subscription policy;
- explicitly dropped the six legacy subscription tables child-first, without
  `CASCADE`;
- explicitly dropped the subscription functions by exact signature; and
- asserted zero remaining public `sub_*` relations, functions and policies
  before commit.

All three deterministic fixture Auth users and their three profile rows were
retained. Deleting them would have cascaded outside the subscription scope into
`public.profiles`, so the no-external-association deletion gate correctly failed
closed. The reset changed no Auth identity and left `athletes` at zero rows.

| Object/data | Before reset | After reset | After migrations + QA |
| --- | ---: | ---: | ---: |
| Subscription tables | 6 | 0 | 9 |
| Subscription policies | 10 | 0 | 11 |
| `sub_*` functions | 7 | 0 | 17 |
| Programs | 3 | 0 | 6 |
| Entitlements | 1 | 0 | 2 |
| Assignments | 1 | 0 | 2 |
| Activations | n/a | 0 | 2 |
| Workouts | 1 | 0 | 3 |
| Workout sets | 0 | 0 | 3 |
| Week-two proposals/decisions | n/a | 0 | 0 / 0 |
| Auth / profiles / athletes | 3 / 3 / 0 | 3 / 3 / 0 | 3 / 3 / 0 |

The final three workouts/sets include the deliberately retained BQA-06 failure
evidence. The shadow is frozen operationally for new operator activations and
assignments pending remediation.

## Migration result

`sub-01` through `sub-10` each committed separately and passed their structural
postcheck. The original `sub-11` transaction rolled back with PostgreSQL `42809`
because `pg_get_functiondef` could be evaluated on the aggregate `array_agg`
object before the filter. The assertion was narrowed to a materialized set of
public ordinary `sub_*` functions/procedures, the static verifier passed, and
the retried `sub-11` committed.

Final structural checks showed:

- 9 subscription tables with RLS enabled;
- 11 subscription policies;
- 17 `sub_*` functions, 16 `SECURITY DEFINER`;
- exactly 5 authenticated owner-bound client RPCs and 0 anon RPCs;
- 0 forbidden protected-table client write privileges or write policies;
- 0 subscription function references to `profiles` or `profiles.role`; and
- 6 published member-only full-gym program versions covering 10 distinct
  goal/level/day tracks, with no legacy `erfaren` row.

## Seven-case behavioural result

| Case | Result | Key evidence |
| --- | --- | --- |
| BQA-01 free boundary | PASS | Free/no-coaching, no member objects, persistence denied. |
| BQA-02 cross-user isolation | PASS | Member B saw none of member A's user-specific rows; non-owned decision rejected. |
| BQA-03 binding/replay abuse | PASS | Cross-member workout and altered assignment replay rejected without state change. |
| BQA-04 workout idempotency | PASS | Exact replay returned the same UUID; altered replay rejected. |
| BQA-05 `profiles.role` control | PASS | Existing `role=coach` did not grant subscription access; profile unchanged. |
| BQA-06 natural expiry | **FAIL** | Tier fell to free, yet a new workout and set persisted after expiry. |
| BQA-07 freeze/rollback | PASS | Operational freeze selected; evidence retained; rollback not executed. |

The critical defect is specific: `sub_persist_completed_workout_v1` validates
assignment ownership/binding but does not also require a currently effective
member tier. The unexpected retained workout ID is recorded in the machine-
readable evidence file.

## Advisor result

| Advisor | Before | After | Delta |
| --- | --- | --- | ---: |
| Security | 0 errors, 3 warnings, 0 info | 0 errors, 6 warnings, 0 info | +3 warnings |
| Performance | 0 errors, 0 warnings, 3 info | 0 errors, 0 warnings, 7 info | +4 info |

The security delta is three authenticated `SECURITY DEFINER` RPC warnings for
week-two decision, proposal-state read and workout persistence. The performance
delta covers week-two foreign-key indexing suggestions and an unused week-two
decision index. The no-new-findings gate therefore failed independently of
BQA-06.

## Client readiness

The final local readiness verifier passed exact shadow binding, the 11-file
backend contract, the 50-file client contract, all 93 subscription tests, the
seven-case static package and the pilot build.

No real password-login result is claimed. The first Node probe stopped with a
sandbox network `EACCES` before its first remote request. Its required escalated
rerun was rejected because it would use the admin key to rotate a retained
fixture user's password and create durable workout data. Therefore this probe
made zero Auth mutations and zero database writes.

## Test identities and rollback state

No new Auth identity, invitation or email was created. The three retained
deterministic fixture identities were reused as separate principals. Their
existing `profiles` rows and `profiles.role` values were not mutated. Controlled
operator activation/assignment procedures created two member fixtures; the
negative-control identity remained free.

No rollback was executed. The reset, migrations and QA evidence remain only in
the exact shadow project so the expiry defect can be reproduced and repaired.

## Unblock criteria

Pilot exposure requires all of the following:

1. a reviewed migration that makes workout persistence fail closed when the
   actor's effective subscription tier has expired;
2. regression tests proving natural-expiry read/write behaviour and idempotent
   replay after that fix;
3. resolution or explicit security review acceptance of every new Advisor
   finding; and
4. separate authorisation for the retained-user password rotation and durable
   authenticated client persistence/re-login probe, or a safer pre-provisioned
   test credential path.

Until those gates pass, the honest decision is **BLOCKED**.
