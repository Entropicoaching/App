# Ordre 1328: Entropi Coach, QA 1317 funds 1-3

Task: ordrer/kilder/arundhati-opgave-49.md. Base: ordre-1302, 4deb4954.
1302 working files were first committed locally as explicitly requested.

## Changes
Home next-label AND pause.label are projected through exerciseSetView; original
rest timer state/storage and writers stay untouched. Home best records merge
set types by folded base name, keeping greatest load and then greatest reps.
Progress selector, default selection, curve filtering and record-list input use
base names. Variants remain separate; source program/log objects are not changed.
The single-exercise family button also uses its actual exercise name.
Parser handles spaced Top set, parenthesized top set, leading Back-off/Topsaet
and comma-separated top. Each requested spelling has a unit test.
Program hides adjacent identical load/set/reps/intensity prescriptions. Different
prescriptions remain visible. Unknown suggested loads retain their original-name
lookup and are not assumed identical. Set labels cannot wrap, and input rows wrap
at narrow widths to keep all controls within the viewport.

## Reproduce without live services
1. node --test src/exerciseSetView.test.js
2. npm run build -- --config scripts/exercise-set-audit.config.mjs --mode audit --outDir dist-1328
3. node scripts/verify-exercise-set-view-1328.mjs
4. node scripts/verify-exercise-set-scope-1328.mjs
5. npm test
6. npx eslint src/exerciseSetView.js src/exerciseSetView.test.js src/athlete/HjemTab.jsx src/athlete/FremgangTab.jsx src/athlete/ProgramTab.jsx
7. git diff --check

Build config disables env-file loading and uses a synthetic localhost mock.
Browser blocks external requests. All data is synthetic. Ports: 5230 and 9230.
27 focused tests and 494 full tests pass. Targeted ESLint and build pass.
Browser asserts Home pause and best-record names, a single Progress choice and
its 110kg e1RM curve, original exercise IDs and per-row set numbering, different
versus identical prescriptions, nowrap labels, no horizontal scroll and no page
errors. Six 390px PNGs are in outputs/ordre-1328 and were visually inspected.
The scope check proves 20 protected hashes unchanged from 90cdf711, and empty
auth/transport/schema/workflow diffs.

## Limits
Headless Chromium, synthetic data, no physical phone or live Supabase.
Independent QA and Marc's product acceptance remain pending.
No push, merge, deploy or migration. Historical database names remain intact.
