// ENT0093 bræk-test: riggens tre-variant-påstand skal kunne fejle og gendannes.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rig = join(here, 'tracker-deadlift-rig.js');
const videoCoach = join(here, '..', '..', 'public', 'videocoach.html');
const original = readFileSync(rig, 'utf8');
const originalVideoCoach = readFileSync(videoCoach, 'utf8');
const precise = 'const EXPECTED_VARIANTS = 3;';
const productionPrecise = 'homePending=delta;';
if (!original.includes(precise)) throw new Error('BEVIDST SPRUNGET: præcist brækpunkt findes ikke');
const run = () => spawnSync(process.execPath, [rig], { encoding: 'utf8' });
try {
  writeFileSync(rig, original.replace(precise, 'const EXPECTED_VARIANTS = 4;'));
  const broken = run();
  if (broken.status === 0 || !/alle tre varianter/.test(broken.stderr))
    throw new Error('brækket blev ikke fanget af tre-variant-påstanden');
  writeFileSync(rig, original);
  const restored = run();
  if (restored.status !== 0 || !/GRØN:/.test(restored.stdout))
    throw new Error('riggen blev ikke grøn efter gendannelse');
  if (!originalVideoCoach.includes(productionPrecise))
    throw new Error('VideoCoach-brækpunkt findes ikke');
  writeFileSync(videoCoach, originalVideoCoach.replace(productionPrecise, 'homePending=null;'));
  const productionBroken = run();
  if (productionBroken.status === 0 || !/VideoCoach mangler/.test(productionBroken.stderr))
    throw new Error('brækket af den faktiske VideoCoach-korrektion blev ikke fanget');
  writeFileSync(videoCoach, originalVideoCoach);
  const productionRestored = run();
  if (productionRestored.status !== 0 || !/GRØN:/.test(productionRestored.stdout))
    throw new Error('VideoCoach-porten blev ikke grøn efter gendannelse');
  console.log('FANGET: præcist bræk gjorde riggen rød. GENDANNET: riggen er grøn igen.');
} finally {
  writeFileSync(rig, original);
  writeFileSync(videoCoach, originalVideoCoach);
}
