# Ordre 1302: one exercise name, set type in the presentation

Base: ordre-1298 at 90cdf711a758afb23a3ff14da5cccc7efa5ddbb1.
Branch: ordre-1302. Local, uncommitted delivery; no production action.

## Data path and decision

Program: weeks -> sessions -> exercises, read in src/athlete/laesninger.js.
Each exercise row has name/sets/reps/intensity/recommended_weight and an ID.
Old programming embeds topsaet/backoff in the name and creates separate rows.
ProgramTab renders those rows. nextSetInSession chooses the next original row
and set_number for DagensPasCard. saetSkrivning writes exercise_id/set_number.
History/defaults still look up the original name. These contracts are untouched.

exerciseSetView derives display name and top/backoff/straight from explicit
suffixes. exerciseViewGroups merges consecutive identical folded base names
for rendering only. Original row objects, prescriptions, order and IDs survive.
No new database field, migration or data rewrite is necessary for this scope.

Program shows one heading with typed set rows. Historical Program uses exactly
the same projection and still joins old logs by original ID/set_number.
Dagens pas keeps the name across top/backoff transitions and counts across
the visual group. Its next-exercise summary skips the remaining rows of that
same visual exercise. Per-row history/defaults and writes remain separate.

## Reproduction, no environment files or live calls

1. node --test src/exerciseSetView.test.js
2. npm run build -- --config scripts/local-audit.config.mjs --mode audit
3. node scripts/verify-exercise-set-view-1302.mjs
4. npm test
5. npx eslint src/exerciseSetView.js src/exerciseSetView.test.js src/athlete/ProgramTab.jsx src/athlete/DagensPasCard.jsx scripts/verify-exercise-set-view-1302.mjs scripts/verify-exercise-set-scope-1302.mjs
6. node scripts/verify-exercise-set-scope-1302.mjs
7. git diff --check

Build config uses envDir:false and a synthetic localhost mock. Browser runner
blocks external requests and uses existing synthetic fixtures. Browser evidence
and six screenshots are in outputs/ordre-1302. Unit log is npm-test.log.

## Boundaries

Only explicit set-type suffixes are removed. Exercise variants, comp, volumen
and coaching notes stay distinct. A bare Topsaet or Backoff without a lift name
cannot safely be interpreted and is retained. No inference from neighbours.
Returning to a lift after another exercise keeps its programmed position;
circuits are not reordered. Thus one heading per contiguous exercise block.
Coach editor, analytics and stored names are unchanged. This is an athlete
presentation change, not a global exercise-library cleanup or progression change.
No real device, live Supabase or independent QA was used. Marc/Bhishak review
remains pending. Existing untouched-RPE issue is outside this order.
