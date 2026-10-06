# Order 1263: fixed numeric reps, local continuation of 1230

Task: kilder/arundhati-opgave-42.md. Branch ordre-1263 was created from
ordre-1230 in the existing entropi-app-wt-1230 worktree. Both branches point to
b08337d3e7b28062a2ddbab89989c63c26aaa590; inherited 1230 changes were uncommitted
and remain present. No commit, merge, push, migration or deployment.

## Scope

New product changes: src/fixedRepsEntry.js, src/athlete/DagensPasCard.jsx and
src/athlete/ProgramTab.jsx. Only plain integer prescriptions expose the existing
actual-reps controls. The planned prescription still appears above the controls.
Numeric defaults use the plan, not history; the next set also starts at its plan.
The existing logSet receives actual reps without changes to payload or transport.
Text prescriptions, range/free parsing, authentication and persistence are unchanged.

New verification: src/fixedRepsEntry.test.js, scripts/audit-athlete-1263.mjs,
scripts/audit-fixed-reps-1263.mjs and scripts/evidence-athlete-1263.mjs.
Evidence: outputs/ordre-1263. The sole task report is RAPPORT-1263.md in orders.

## Replay current delivery

Run sequentially from this worktree:

1. node --test src/fixedRepsEntry.test.js src/setLogDefaults.test.js src/repsPrescription.test.js
2. npm test
3. npm run build -- --config scripts/local-audit.config.mjs
4. node scripts/audit-fixed-reps-1263.mjs after
5. node scripts/audit-athlete-1263.mjs after
6. node scripts/evidence-athlete-1263.mjs
7. node node_modules/eslint/bin/eslint.js src/athlete/DagensPasCard.jsx src/athlete/ProgramTab.jsx src/fixedRepsEntry.js src/fixedRepsEntry.test.js
8. npm run verify:athlete-training-inputs
9. npm run verify:athlete-write-failures
10. git diff --check

Audit builds disable env-file loading and provide only synthetic localhost mock
settings. Browser requests outside localhost are blocked. No real account or
athlete is used. Ports 5230 and 9230 must be free. Existing dependencies are used.

## Before and after

before.json was measured before this order's product edits, with all inherited
1230 fixes present. after.json uses the delivered code. Three cold-context runs
per phase: Chromium 390x844, 150ms latency, 1.6Mbps down / 750kbps up and CPU x4.
The benchmark keeps the original range-reps scenario for a matching comparison.
It measures click-to-ready including Playwright actionability and two frames.
Service workers are blocked, assets use no-store; this is not production caching.

fixed-before.json independently reproduces the missing field for an 8-rep plan
in both screens. fixed-after.json verifies 3 actual reps, zero actual reps, the
next set default of 8 and an unchanged 8-rep submission against stored mock rows.
These focused cases are unthrottled and are functional checks, not timing data.
Both have no page errors or horizontal overflow, with 390px screenshots.

The recorded baseline is preserved. Re-running the fixed runner with 'before'
on delivered code intentionally fails: that mode requires the pre-1263 UI.
There is no committed 1230 snapshot, so do not reset the tree to reconstruct it.
Compare the small current changes with the task report and the original 1230 audit.

The timing medians cannot establish a general speed improvement from this small
UI change. Host load, module/browser cache and scroll/actionability vary. The
large Program median difference is not evidence of an intentional optimization.

## Remaining protected work

Program's offline fallback, draft lifetime/account cleanup, untouched-RPE data
semantics and VideoCoach reopen transport remain unchanged. Recommendations and
Marc-time / implementation estimates are in the task report. Untouched RPE=8 is
also visible in the focused mock rows; draft loss remains in both timing phases.
No closure-during-write reproduction, live RLS/schema validation, real phone or
large video test, independent QA, or product approval is claimed.
