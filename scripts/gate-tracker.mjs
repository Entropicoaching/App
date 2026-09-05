// ORDRE 45 · npm run gate:tracker
// -----------------------------------------------------------------------------
// Én kommando for alt tracker-relateret regressionstjek. Kør efter hvert greb
// i tracker-hastighed-ordren.
//
// To slags rigge køres:
//   GATE   - fejler processen (exit 1), hvis noget er galt. Dette er den
//            reelle beskyttelse: tracker-live-bench.mjs (den nye, levende
//            bane+tid-måler mod baseline) + de eksisterende kildetekst-
//            kontrakter der rent faktisk rører den LEVENDE startMultipoint-
//            Tracking-kode.
//   INFO   - vises altid, men fejler ALDRIG processen. tracker-testrig.js og
//            tracker-freeze-rig.js hen-porterer den GAMLE, aldrig-kaldte
//            startBarTracking (bekræftet: grep i public/videocoach.html
//            finder ingen kaldere) med forældede tærskler - de beskytter ikke
//            den kode denne ordre ændrer, men er taget med fordi ordren
//            navngiver dem eksplicit. tracker-testrig.js exit'er desuden ALTID
//            0, selv når den selv skriver "*** FEJL" (bekræftet ved kørsel på
//            uændret main - to af dens fire enhedstest fejler allerede der).
//            Se RAPPORT.md, afsnittet "Rig-fundet", for hele undersøgelsen.
//
// Bevidst UDELADT (se RAPPORT.md for begrundelse pr. fil):
//   tracker-kinskel-testrig.js        - tester et fjernet, urelateret koncept
//   run-OLDER-REPS-AFFORDANCE-*.mjs   - UX-affordance, browser-krævende, uden for scope
//   run-clean-rebuild-gate.mjs        - browser-krævende, aktuelt rød (uafhængig MIME-fejl), for bred/langsom
//   run-entropi-track-ux-gate.mjs     - samme som ovenfor
//   braek-*.mjs                       - muterer public/videocoach.html midlertidigt; meta-test af testen
//   run-deadlift-gate.mjs             - orkestrator der udløser braek-riggene; dens sikre underrigge køres direkte herfra i stedet
//   athlete-start-flow-rig.mjs        - UX/bro-kontrakt, ikke tracker-relateret

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vc = f => join(root, 'docs', 'videocoach', f);

const GATE_RIGS = [
  { name: 'tracker-live-bench (levende tracker vs. baseline)', cmd: ['node', vc('tracker-live-bench.mjs')] },
  { name: 'tracker-probe-test', cmd: ['node', vc('tracker-probe-test.mjs')] },
  { name: 'tracker-deadlift-rig', cmd: ['node', vc('tracker-deadlift-rig.js')] },
  { name: 'tracker-bottom-seam-rig', cmd: ['node', vc('tracker-bottom-seam-rig.mjs')] },
  { name: 'tracker-deadlift-descent-rig', cmd: ['node', vc('tracker-deadlift-descent-rig.mjs')] },
  { name: 'tracker-deadlift-top-exit-rig', cmd: ['node', vc('tracker-deadlift-top-exit-rig.mjs')] },
  { name: 'bar-path-visual-smoothing-rig', cmd: ['node', vc('bar-path-visual-smoothing-rig.mjs')] },
  { name: 'rep-preview-rig (ORDRE 54 · "Vis mig nu")', cmd: ['node', vc('rep-preview-rig.mjs')] },
];

const INFO_RIGS = [
  { name: 'tracker-testrig (portering af DØD startBarTracking - se ovenfor)', cmd: ['node', vc('tracker-testrig.js')] },
  { name: 'tracker-freeze-rig (portering af DØD startBarTracking - se ovenfor)', cmd: ['node', vc('tracker-freeze-rig.js')] },
];

function run(rig) {
  const startedAt = performance.now();
  const result = spawnSync(rig.cmd[0], rig.cmd.slice(1), { encoding: 'utf8' });
  const ms = performance.now() - startedAt;
  return { ...rig, ms, code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function printResult(r, { gates }) {
  const bareFail = gates && r.code !== 0;
  const status = bareFail ? 'FEJL' : 'OK';
  console.log(`${status.padEnd(5)} ${r.ms.toFixed(0).padStart(7)}ms  ${r.name}`);
  if (bareFail) {
    console.log('  ' + r.stdout.trim().split('\n').join('\n  '));
    if (r.stderr.trim()) console.log('  ' + r.stderr.trim().split('\n').slice(-8).join('\n  '));
  }
  return bareFail;
}

console.log('== GATE (fejler processen) ==');
let failed = false;
for (const rig of GATE_RIGS) {
  const r = run(rig);
  if (printResult(r, { gates: true })) failed = true;
}

console.log('\n== INFO (vises altid, fejler aldrig processen) ==');
for (const rig of INFO_RIGS) {
  const r = run(rig);
  printResult(r, { gates: false });
  const flagged = /\*\*\*\s*FEJL/i.test(r.stdout);
  if (flagged) console.log('  (bemærk: riggen selv skriver "*** FEJL" i output - forventet, se begrundelsen ovenfor)');
}

console.log('\n' + (failed ? 'GATE:TRACKER — FEJL: se rødt ovenfor.' : 'GATE:TRACKER — GRØN.'));
process.exitCode = failed ? 1 : 0;
