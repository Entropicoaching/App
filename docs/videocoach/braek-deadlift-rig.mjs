// Bræktest for clean rebuilds fail-closed recovery-kontrakt.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rig = join(here, 'tracker-deadlift-rig.js');
const videoCoach = join(here, '..', '..', 'public', 'videocoach.html');
const originalRig = readFileSync(rig, 'utf8');
const originalVideoCoach = readFileSync(videoCoach, 'utf8');
const rigPoint = "assert(far.outputJump > far.maxJump, 'brækscenariet skal være uden for jump-grænsen');";
const productPoint = 'recovered.length>=5&&recoveryJump<=maxJump';
const run = () => spawnSync(process.execPath, [rig], {encoding:'utf8'});

if (!originalRig.includes(rigPoint) || !originalVideoCoach.includes(productPoint))
  throw new Error('BEVIDST SPRUNGET: præcise brækpunkter findes ikke');
try {
  writeFileSync(rig, originalRig.replace(rigPoint,
    "assert(far.outputJump < far.maxJump, 'forkert syntetisk jump-kontrakt');"));
  const brokenRig = run();
  if (brokenRig.status === 0 || !/forkert syntetisk jump-kontrakt/.test(brokenRig.stderr))
    throw new Error('brækket syntetisk kontrakt blev ikke fanget');
  writeFileSync(rig, originalRig);

  writeFileSync(videoCoach, originalVideoCoach.replace(productPoint, 'recovered.length>=5'));
  const brokenProduct = run();
  if (brokenProduct.status === 0 || !/recovery skal fail-close/.test(brokenProduct.stderr))
    throw new Error('fjernet produkt-jumpgate blev ikke fanget');
  writeFileSync(videoCoach, originalVideoCoach);
  const restored = run();
  if (restored.status !== 0 || !/GRØN:/.test(restored.stdout))
    throw new Error('recovery-rig blev ikke grøn efter gendannelse');
  console.log('FANGET: både syntetisk og produkt-jumpgate blev røde. GENDANNET: grøn.');
} finally {
  writeFileSync(rig, originalRig);
  writeFileSync(videoCoach, originalVideoCoach);
}
