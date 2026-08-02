# Subscription shadow-pilot — behavioural QA runbook

Status: **ready for an authorised shadow execution; no database test has been run by this package.**

This runbook is limited to the isolated shadow project `maxhsefxbrvsgolscqwh`.
It neither applies a migration nor creates accounts, changes frontend auth, alters
environment files, or sends network/database calls. Its companion matrix is
machine-validated at `docs/qa/subscription-shadow-behavioral-matrix-v1.json`.

## Entry gate

Do not start if any item below is false:

1. An authorised operator has deliberately selected only the shadow project.
2. `sub-01` through `sub-11` are committed and the final contract gate succeeded.
3. `npm run verify:subscription-shadow-readiness` is green locally.
4. The operator has prepared four isolated test identities described in the matrix:
   `free`, `memberA`, `memberB`, and `roleEscalator`.
5. All invitations, activations and assignments use the controlled service-only
   procedures in `subscription-shadow-backend-safe-path.md`. Never use a direct
   product-state write to improvise a fixture.

Record the project ref, migration identifiers, tester aliases (not their raw
email addresses), start time and operator in the evidence log before BQA-01.

## Execute the matrix

Open `subscription-shadow-behavioral-qa.html` from the local pilot server, or
read its source matrix directly. It intentionally starts every case as
**PENDING**; changing a result is an operator/tester action after a real run.

Run BQA-01 through BQA-06 in order. For each case:

1. Confirm its preconditions and capture a before-state count only through a
   read-only operator view.
2. Perform its listed actions using the named actor session.
3. Compare each observed result to every expected result.
4. Add evidence references and mark Pass, Fail or Blocked in the local review
   page. A screenshot, timestamped response and read-only before/after count are
   sufficient; do not copy secrets into the evidence.
5. On a failed expected result, stop immediately: freeze new invitations,
   activations and assignments; mark the case FAIL; then proceed only to BQA-07.

BQA-07 is a decision-and-evidence test. It does not authorise or execute a
rollback. Any rollback remains a separate, explicit authorised shadow-only
operation with its own reviewed procedure.

## Exit criteria

The first 10 invited testers may begin only if BQA-01 through BQA-06 are all
PASS with evidence, BQA-07 records a **retain shadow / proceed** decision, and
there is no stop condition. A PENDING, BLOCKED or FAIL result means the pilot is
not cleared.

Stop conditions: wrong project reference, a production connection, any
cross-user data, client write access to protected product state, an altered or
partial workout history, or any unexplained privilege change.

## Local verification

Run this before the authorised execution and whenever the matrix changes:

```powershell
npm run verify:subscription-shadow-behavioral-qa
```

This is a **static completeness check** only. It proves the local QA package
contains the seven required cases and safety wording; it cannot prove a database
behavioural test passed.
