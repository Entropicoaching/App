// ENT0095 — samlet lokal port for de tre afgrænsede dødløft-fund.
// Kører kun Node-rigs mod arbejdskopien; den åbner ingen browser, ændrer ingen data
// og er ikke en erstatning for Marcs test med et rigtigt klip.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const steps = [
  ['home-anchor C', 'tracker-deadlift-rig.js'],
  ['home-anchor bræk', 'braek-deadlift-rig.mjs'],
  ['hurtig nedtur', 'tracker-deadlift-descent-rig.mjs'],
  ['hurtig nedtur bræk', 'braek-deadlift-descent-rig.mjs'],
  ['top-exit/review', 'tracker-deadlift-top-exit-rig.mjs'],
  ['tracker-probe', 'tracker-probe-test.mjs'],
  ['tracker-probe bræk', 'braek-tracker-probe-test.mjs']
];

for (const [label, file] of steps) {
  const result = spawnSync(process.execPath, [join(here, file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`RØD: ${label}\n${result.stdout}${result.stderr}`);
    process.exit(result.status || 1);
  }
  console.log(`GRØN: ${label}`);
}

const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(q => q[1]);
if (!scripts.length) throw new Error('RØD: ingen scriptblok fundet i VideoCoach');
for (const script of scripts) {
  const syntax = spawnSync(process.execPath, ['--check'], { input: script, encoding: 'utf8' });
  if (syntax.status !== 0) {
    process.stderr.write(`RØD: VideoCoach-syntaks\n${syntax.stderr}`);
    process.exit(syntax.status || 1);
  }
}

console.log(`GRØN: VideoCoach-syntaks (${scripts.length} scriptblok${scripts.length === 1 ? '' : 'ke'})`);
console.log('GRØN: dødløft-port — home-anchor, hurtig nedtur, top-exit og diagnosekanal.');
