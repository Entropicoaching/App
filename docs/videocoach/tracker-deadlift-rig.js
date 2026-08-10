// Clean rebuild: syntetisk kontrakt for fail-closed deadlift recovery.
// Ingen video- eller atletdata. Home-evidens må ikke flytte output direkte;
// en recovery skal desuden bestå den eksisterende jump-validitet.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(/const recoveryJump=Math\.hypot\(found\.x-cur\.x,found\.y-cur\.y\);/.test(html),
  'recovery skal måle outputJump mod sidste sikre koordinat');
assert(/recovered\.length>=5&&recoveryJump<=maxJump/.test(html),
  'recovery skal fail-close gennem eksisterende maxJump');
assert(/path\.homeConfirmations=\(path\.homeConfirmations\|\|0\)\+1/.test(html),
  'to stærke home-frames skal registreres som evidens');
const homeSection = html.slice(html.indexOf('const nearHome='),
  html.indexOf('const jump=', html.indexOf('const nearHome=')));
assert(homeSection && /nx\+=delta\.x\*\.5;ny\+=delta\.y\*\.5/.test(homeSection),
  'bekræftet home-evidens skal bevare den dæmpede centerkorrektion');
const jumpIndex = html.indexOf('const jump=Math.hypot(nx-cur.x,ny-cur.y);', html.indexOf('const nearHome='));
const acceptIndex = html.indexOf('kept.length>=5&&jump<=maxJump&&identityOK', jumpIndex);
assert(jumpIndex > 0 && acceptIndex > jumpIndex,
  'centerkorrektionen skal stadig gennem normal jump-validitet');
assert(/path\.valid\.push\(accepted\)/.test(html) &&
  /path\.confidence\.push\(accepted\?frameConfidence:0\)/.test(html),
  'accepted, valid og confidence skal have samme sandhed');
assert(/if \(valid\[currentIndex\]\)/.test(html) && /if \(!valid\[index\]\)/.test(html),
  'invalid current-point og invalid segment skal være pen-up i rendering');
assert(/let wasNearHome=deadliftMode,homeEntryFrames=0/.test(html),
  'home-audit må først armeres ved reel tilbagekomst, ikke ved første ascent');

const radius = 30, dt = 1 / 30;
const maxJump = velocity => radius * .75 + velocity * dt * .45;
const recovery = (lastSafe, found, recoverableFeatures, velocity = 0) => {
  const outputJump = Math.hypot(found.x - lastSafe.x, found.y - lastSafe.y);
  const accepted = recoverableFeatures >= 5 && outputJump <= maxJump(velocity);
  return {accepted, outputJump, maxJump:maxJump(velocity),
    output:accepted ? found : lastSafe, valid:accepted, confidence:accepted ? 1 : 0};
};

// Regressionen: lost ved lockout, to falske home-fund og fem features.
const far = recovery({x:320,y:230},{x:320,y:520},5);
assert(far.outputJump > far.maxJump, 'brækscenariet skal være uden for jump-grænsen');
assert(!far.accepted && !far.valid && far.confidence === 0,
  'falsk home-recovery skal forblive invalid og fryse sidste sikre punkt');
assert(far.output.y === 230, 'invalid output må ikke hoppe til bunden');

const near = recovery({x:320,y:500},{x:322,y:518},7);
assert(near.outputJump <= near.maxJump, 'positiv recovery skal være inden for jump-grænsen');
assert(near.accepted && near.valid && near.confidence === 1,
  'positiv recovery med featurekonsensus skal fortsat virke');

console.log('GRØN: deadlift recovery er fail-closed; far home afvises, nær recovery bevares.');
