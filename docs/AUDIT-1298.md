# Order 1298: complete and commit the 1263 delivery

Task: orders/kilder/arundhati-opgave-46.md. Entropi Coach only.
Branch: ordre-1298 from ordre-1263 at b08337d3.
Current task explicitly authorizes commits. No push, merge or deploy.

## Review separate changes

- e0312e0a: reconstructed order 1230 snapshot. Tap guard, next-set draft preservation,
  complete-session markers, Danish document language and local test/audit tooling.
- 11e4deca: isolated order 1263. Only DagensPasCard, ProgramTab and fixedRepsEntry
  source/test changes under src. Existing numeric plans now use the reps control.
- Order 1298 follow-up: documentation, replay compatibility and synthetic evidence.
  No further athlete-facing product changes.

The index-only reconstruction removed exactly the 1263 hunks from DagensPasCard;
the working source was preserved. ProgramTab in the 1230 commit is identical to
the original base. verify-order-1298.mjs checks both facts and the commit parents.
Historical outputs/ordre-1230 and outputs/ordre-1263 describe their original runs;
their recorded branch and uncommitted status are historical, not current status.
Ignored *.log files remain local. Committed JSON and screenshots carry the evidence.

## QA 1294 dispositions, one check per finding

| Finding | Disposition | Check / limit |
|---|---|---|
| 1 Uncommitted, mixed 1230/1263 | Closed locally | Separate commits; verifier checks ancestry, absence of fixedRepsEntry in 1230 and the exact four src files in 1263. Final git status must be empty. |
| 2 Too many visible changes in one delivery | Review split complete; integration scope requires Marc | 1263 adds only editable actual reps for plain numeric plans in Dagens pas and Program. 1230 separately changes double-tap handling, draft preservation, completion markers and document language. Existing setTapGuard, athleteTrainingInputs and nextSet tests cover those behaviors. No integration performed. |
| 3 Planned RPE saved as actual | OPEN, requires Marc | New fixed-after mock rows reproduce planned=8 and actual=8 with untouched RPE in both screens. This is evidence of a defect, not a passing RPE correctness test. Protected writer unchanged. |
| 4 Timing attribution and phone coverage | Reporting caveat closed; device coverage still limited | No new performance claim or timing benchmark. Earlier 944->387 ms is not attributed to reps. New run is functional headless Chromium, 390x844, not a physical phone. |
| 5 Wording suggests five fixes complete | Closed in current report | One of the five remaining 1230 product findings is fixed: numeric actual reps. Offline Program, draft lifetime, missing actual RPE and VideoCoach reopening remain OPEN. |

## Athlete-visible behavior

1263: an existing reps control is shown for plain numbers such as 8. Plan stays 8;
the athlete can record 3 or 0; the next untouched set starts at 8. No new dialog.
AMRAP, time and per-side prescriptions retain their previous behavior.

1230: a fast second set tap is ignored for 500 ms; an already typed next-set reps
draft stays; calendar and Mit program wait for all sets before showing completion.
The page announces Danish to assistive technology. These are a separate review unit.

## Concrete choices for Marc, recommendations first

1. RPE: recommend a separate authorized writer change so untouched actual RPE is
   null, planned RPE remains separate and explicit athlete selections stay actual.
   Review all log/edit/auto-fill callers and progression handling of null. Preserve
   real-RPE-only trend rule. Estimate: 2 minutes decision, 2-3 hours implementation.
   Alternative: retain current behavior; misleading actual-RPE data remains.
2. Integration: recommend reviewing/integrating numeric actual reps as the small
   1263 unit, with the 1230 unit reviewed separately. The 1263 commit also uses
   1230's local audit config for its audit scripts; a standalone cherry-pick needs
   tooling dependency handling. No cherry-pick or merge was attempted here.
3. Offline Program: recommend a separate protected-write task for durable local
   enqueue/replay with close-during-write, full-store and duplicate-replay tests.
   Static risk, not reproduced here. Estimate: 1 minute decision, 2-4 hours work.
4. Drafts: recommend current-session/account-scoped drafts with expiry and explicit
   logout/account-switch cleanup. Needs lifetime decision and protected auth scope.
   Estimate: 2 minutes decision, 3-5 hours work.
5. VideoCoach: recommend investigate normal caching before an iframe-lifetime change,
   preserving identity/upload/bridge contracts. Estimate: 1 minute, 4-8 hours work.

Estimates are not commitments. No protected change or new authorization is inferred.

## Replay, sequential and local only

1. node --test src/fixedRepsEntry.test.js src/setLogDefaults.test.js src/repsPrescription.test.js src/athlete/setTapGuard.test.js src/athleteTrainingInputs.test.js src/nextSet.test.js
2. node scripts/audit-fixed-reps-1263.mjs after ordre-1298
3. node scripts/verify-order-1298.mjs
4. node node_modules/eslint/bin/eslint.js src/athlete/DagensPasCard.jsx src/athlete/ProgramTab.jsx src/athlete/HjemTab.jsx src/athlete/WeekCalendar.jsx src/athleteTrainingInputs.js src/athleteTrainingInputs.test.js src/athlete/setTapGuard.js src/athlete/setTapGuard.test.js src/fixedRepsEntry.js src/fixedRepsEntry.test.js scripts/verify-order-1298.mjs
5. npm run verify:athlete-training-inputs
6. npm run verify:athlete-write-failures
7. npm test (entire unit suite, alone, last)
8. git diff --check and git status --short after final commit

The browser runner performs a production build with envDir:false and only synthetic
localhost mock settings, blocks external browser requests and uses no real account.
Ports 5230/9230 must be free. Existing dependencies reused, no npm ci or fetch.
Proof checks 20 protected file hashes against b08337d3 and empty auth/transport,
schema and workflow diffs in both delivery commits, HEAD and the working tree.

This completes the local commit/review task. Independent QA of this follow-up and
Marc's product approval remain pending. Entropi Coach is not declared bug-free.
