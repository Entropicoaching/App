# Ordre 1230: local athlete audit

Task: kilder/arundhati-opgave-39.md in the orders workspace.
Base: b08337d3e7b28062a2ddbab89989c63c26aaa590 (local main).
Branch: ordre-1230. Changes are local and uncommitted.

## Replay

Use Node and the existing repo dependencies, plus the shared Playwright runtime
used by e2e/harness.mjs. No installation, credentials or env files are needed.
The worktree links to the existing node_modules; this is not a clean-install test.

1. npm test
2. npm run build -- --config scripts/local-audit.config.mjs
3. node scripts/audit-athlete-1230.mjs after
4. node scripts/evidence-athlete-1230.mjs

The browser runner builds the real app with envDir:false, serves gzip assets on
127.0.0.1:5230 and starts a fresh synthetic Supabase mock on 127.0.0.1:9230 per run.
All non-local browser traffic is blocked. No server contacts production.
Chromium is headless at 390x844, network latency 150ms, down 1.6Mbps, up 750kbps,
CPU x4. Each of three runs starts in a fresh context. Service workers are blocked
and the asset server uses no-store. This intentionally exposes repeated iframe
load costs; normal production caching can differ.

Before data was captured with unchanged base UI and input code. After data is
captured with the delivered fixes. Actions, synthetic data, browser and throttling
match for the measured transitions. The after runner additionally records early
completion flags and a reload diagnostic after timing measurements. Restored draft
tests are diagnostics, not an assertion of a fixed persistence feature.

Click-to-ready includes Playwright actionability/scrolling and two paint frames.
Upload measures click until one persisted mock analysis exists, and verifies actual
mock storage bytes. It uses a 14,830-byte synthetic test pattern, not a real phone
video. Feedback is seeded as already shared; it is not sent to an athlete. The
optional Google font is blocked on both iframe openings, producing two expected
resource console errors per run. There are no application page errors.

## Delivered changes

- Preserve pre-entered next-set reps when logging the previous set.
- Guard log/skip taps for 500ms across immediate next-set renders.
- Use the existing all-sets completion rule in WeekCalendar and Mit program.
- Declare Danish as the document language.
- Add npm test for all source/public unit tests, with concurrency 1.

## Open issues and limits

- Unlogged draft weight disappears on reload (91 becomes 80 in all after runs).
  Persistent drafts need an explicit account/logout lifetime contract; no auth
  cleanup is changed in this order.
- Program uses logSet without the localFallback flag used by Dagens pas. Closing
  the app while a Program write is in flight risks losing it. Static finding;
  production transport and persistence are protected, so left unchanged.
- Fixed-rep prescriptions display and save prescribed reps; the athlete cannot
  immediately enter fewer reps on those rows in either primary logging screen.
- An untouched RPE picker saves planned RPE as actual RPE. This can mislead review;
  changing the data semantics needs Marc's decision and a separate review of the
  protected write path, not an incidental patch. No migration is proposed here.
- VideoCoach is 567,744 bytes (168,759 gzip), reloads on reopen, and loads coach
  tracking code even for athlete upload. Do not split the bridge/transport casually.
- No live RLS/storage/schema validation, mobile-device test, long phone-video
  transfer, offline service-worker test, independent QA or deployment is claimed.

Evidence lives in outputs/ordre-1230: before.json, after.json, timings.md, proof.json,
390px screenshots, npm-test.log, build.log, eslint.log and targeted verify logs.
The orders workspace has the sole report: rapporter/RAPPORT-1230.md.
