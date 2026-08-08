// ENT0094 braek-test: en gate-ordre-aendring skal goere riggen roed og gendannes.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rig = join(here, 'tracker-deadlift-descent-rig.mjs');
const original = readFileSync(rig, 'utf8');
const exact = "if (frame.moves < 5 || frame.kept < 5) gate = 'feature-match';";
if (!original.includes(exact)) throw new Error('BEVIDST SPRUNGET: praecist braekpunkt findes ikke');
const run = () => spawnSync(process.execPath, [rig], { encoding: 'utf8' });
try {
  writeFileSync(rig, original.replace(exact, "if (frame.moves < 4 || frame.kept < 5) gate = 'feature-match';"));
  const broken = run();
  if (broken.status === 0 || !/forkert antal afvisninger/.test(broken.stderr)) throw new Error('braekket feature-match-port blev ikke fanget');
  writeFileSync(rig, original);
  const restored = run();
  if (restored.status !== 0 || !/GRON:/.test(restored.stdout)) throw new Error('riggen blev ikke groen efter gendannelse');
  console.log('FANGET: feature-match-porten gjorde riggen roed. GENDANNET: riggen er groen igen.');
} finally { writeFileSync(rig, original); }
