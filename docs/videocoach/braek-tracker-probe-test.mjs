// ENT0094 bræk-test: flag-kontrakten skal blive rød og gendannes uden restændring.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', '..', 'public', 'videocoach.html');
const testPath = join(here, 'tracker-probe-test.mjs');
const original = readFileSync(sourcePath, 'utf8');
const exact = "const TRACKER_PROBE = TRACKER_BENCHMARK && MODE_PARAMS.get('trackerProbe') === '1';";
if (!original.includes(exact)) throw new Error('BEVIDST SPRUNGET: præcist flagpunkt findes ikke');
const run = () => spawnSync(process.execPath, [testPath], { encoding:'utf8' });
try {
  writeFileSync(sourcePath, original.replace(exact, 'const TRACKER_PROBE = TRACKER_BENCHMARK;'));
  const broken = run();
  if (broken.status === 0 || !/kræver ikke præcist begge flags/.test(broken.stderr))
    throw new Error('brækket flag-kontrakt blev ikke fanget');
  writeFileSync(sourcePath, original);
  const restored = run();
  if (restored.status !== 0 || !/GRØN:/.test(restored.stdout))
    throw new Error('probe-porten blev ikke grøn efter gendannelse');
  console.log('FANGET: ét-flag-probe blev rød. GENDANNET: probe-porten er grøn igen.');
} finally { writeFileSync(sourcePath, original); }
