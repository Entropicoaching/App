// VIDEOCOACH-ENTROPI-TRACK-UX-001 — samlet commitlokal produktgate.
// Kører syntetisk seam-bræktest og cachefri browser/video-A/B mod 6692edc.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = '6692edca4920de42217a6cd0278567d38f447f78';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const html = readFileSync(join(root, 'public', 'videocoach.html'), 'utf8');
const fail = (condition, message) => { if (!condition) throw new Error(message); };

for (const marker of [
  'let homeCorrectionPending=null,recoveryPending=null',
  'const rawRecoveryCenter={x:found.x,y:found.y}',
  'const calibratedRecoveryCenter={x:found.x-homeBias.x,y:found.y-homeBias.y}',
  'calibratedRecoveryJump<rawRecoveryJump',
  'recovered.length>=5&&recoveryJump<=maxJump',
  'freezeRawAcquisition', 'const pts = Object.freeze(path.pts.map', 'manualCorrections',
  'drawCleanBarPath', 'vcSystemBar', 'vcWorkspaceTabs', 'vcPhaseLegend',
  'vcRepSelector', 'vcMetricCards', 'exportPreview', 'vcSetWorkspace'
]) fail(html.includes(marker), `produktkilden mangler kontrakt: ${marker}`);

const analysis = html.slice(html.indexOf('function analyzeCleanPath'),
  html.indexOf('function analyzePathLegacy8b80f75'));
fail(analysis && !/path\.(pts|times|valid|confidence)\s*=\s*path\.\1\.slice/.test(analysis),
  'phase/lift-fortolkning må ikke slice eller mutere raw acquisition');
fail(/if \(valid\[currentIndex\]\)/.test(html) && /if \(!valid\[index\]\)/.test(html),
  'invalid/unknown skal være pen-up for punkt og segment');

const run = (file, env = {}) => {
  const result = spawnSync(process.execPath, [join(here, file)], {
    cwd:root, encoding:'utf8', env:{...process.env,...env}, maxBuffer:20_000_000
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) process.exit(result.status || 1);
};

run('tracker-bottom-seam-rig.mjs');
run('athlete-start-flow-rig.mjs');
run('bar-path-visual-smoothing-rig.mjs');
run('run-clean-rebuild-gate.mjs', {
  VC_AB_BASE:BASE,
  VC_BOTTOM_SEAM_FIXTURE:'1',
  VC_ENTROPI_UX_ACCEPT:'1'
});

console.log('GRØN: TRACK-BOTTOM-01, TRACK-PRESERVE-02, ENTROPI-SYSTEM-03, ENTROPI-UX-04 og BROWSER-ACCEPT-05.');
