// VIDEOCOACH-ENTROPI-TRACK-UX-001 — koordinatkontrakt for bund-recovery.
// Syntetisk og deterministisk: ingen video-, atlet- eller produktionsdata.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(/let homeCorrectionPending=null,recoveryPending=null/.test(html),
  'home-korrektionens delta og recovery-center skal have adskilt tilstand');
assert(/const rawRecoveryCenter=\{x:found\.x,y:found\.y\}/.test(html) &&
  /const calibratedRecoveryCenter=\{x:found\.x-homeBias\.x,y:found\.y-homeBias\.y\}/.test(html),
  'recovery skal bevare både rå og kalibreret observation');
assert(/calibratedRecoveryJump<rawRecoveryJump/.test(html),
  'recovery skal vælge den observerede koordinat med mindst jump fra sidste sikre punkt');
assert(/mpGoodFeatures\(recoveryFrame,recoveryCenter,radius\)/.test(html),
  'feature-recovery skal bruge det normaliserede center');
assert(/const recoveryJump=Math\.hypot\(recoveryCenter\.x-cur\.x,recoveryCenter\.y-cur\.y\)/.test(html),
  'jump-validitet skal måles på samme normaliserede outputkoordinat');
assert(/cur=\{x:recoveryCenter\.x,y:recoveryCenter\.y\}/.test(html),
  'accepteret recovery må kun gemme det normaliserede center');

const radius = 30;
const homeBias = {x:1.5,y:6};
const lastSafe = {x:320,y:520};
const rawFinds = [{x:321.5,y:526},{x:321.7,y:526.2}];
const normalize = point => ({x:point.x-homeBias.x,y:point.y-homeBias.y});
const centers = rawFinds.map(normalize);
const agreement = Math.hypot(centers[1].x-centers[0].x,centers[1].y-centers[0].y);
const outputJump = Math.hypot(centers[1].x-lastSafe.x,centers[1].y-lastSafe.y);
const legacyDrop = Math.hypot(rawFinds[1].x-lastSafe.x,rawFinds[1].y-lastSafe.y);

assert(agreement < radius*.45, 'to stærke fund skal være enige i normaliseret domæne');
assert(outputJump < .3, 'kalibreret recovery skal bevare den observerede bundposition');
assert(legacyDrop > 6, 'fixturen skal reproducere det synlige rå-bias-drop i gammel seam');
const selected = outputJump < legacyDrop ? centers[1] : rawFinds[1];
assert(Math.hypot(selected.x-lastSafe.x,selected.y-lastSafe.y) < .3,
  'kontinuitetsvalget skal fjerne det reproducerede bunddrop');

const unstableBias = {x:-1.5,y:-6};
const unstableCalibrated = {x:rawFinds[1].x-unstableBias.x,y:rawFinds[1].y-unstableBias.y};
assert(Math.hypot(rawFinds[1].x-lastSafe.x,rawFinds[1].y-lastSafe.y) <
  Math.hypot(unstableCalibrated.x-lastSafe.x,unstableCalibrated.y-lastSafe.y),
  'rå observation skal vinde, når kalibreringen ville gøre hoppet større');

const correctionDelta = {x:0,y:-2};
assert(Math.hypot(correctionDelta.x-centers[0].x,correctionDelta.y-centers[0].y) > radius*.45,
  'delta-tilstand og absolut center er forskellige domæner og må ikke deles');

console.log(`GRØN: bund-seam normaliserer ${legacyDrop.toFixed(1)} px rå drop til ${outputJump.toFixed(1)} px og adskiller recovery-state.`);
