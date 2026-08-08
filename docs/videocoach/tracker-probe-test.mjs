// ENT0094: kontrakt- og adfaerdstest for den lokale trackerProbe-kanal.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const enabled = params => params.benchmark === '1' && params.trackerProbe === '1';
const classify = q => {
  if (q.accepted) return null;
  if (q.moves < 5 || q.kept < 5) return 'feature-match';
  if (q.jump > q.maxJump) return 'jump';
  if (q.identityChecked && !q.identityOK) return 'identity';
  return 'next-features';
};
const benchmarkRun = params => ({ schema:1, outcome:'completed', ...(enabled(params) ? { frameProbe:[] } : {}) });

assert(source.includes("const TRACKER_PROBE = TRACKER_BENCHMARK && MODE_PARAMS.get('trackerProbe') === '1';"),
  'probe kræver ikke præcist begge flags');
assert(/const probe=TRACKER_PROBE\?\{t:tNow,moves:0,kept:0,identityChecked:false,/.test(source),
  'pr-frame probe-format mangler');
assert(/trackerProbe\.push\(probe\)/.test(source), 'probe gemmes ikke pr. frame');
assert(/\.\.\.\(TRACKER_PROBE\?\{frameProbe:trackerProbe\}: \{\}\)/.test(source),
  'probe lækker til normal benchmark eller mangler i benchmark-JSON');
for (const gate of [
  "if(probe.moves<5||probe.kept<5)probe.rejectGate='feature-match';",
  "else if(probe.jump>probe.maxJump)probe.rejectGate='jump';",
  "else if(probe.identityChecked&&!probe.identityOK)probe.rejectGate='identity';",
  "else probe.rejectGate='next-features';"
]) assert(source.includes(gate), `kilden mangler ${gate}`);

assert(!enabled({}) && !enabled({benchmark:'1'}) && !enabled({trackerProbe:'1'}),
  'probe må ikke findes uden begge flags');
assert(!('frameProbe' in benchmarkRun({benchmark:'1'})), 'normal benchmark må ikke få probe-data');
assert('frameProbe' in benchmarkRun({benchmark:'1',trackerProbe:'1'}), 'dobbelt flag skal få probe-data');

const base = { moves:9, kept:9, jump:10, maxJump:30, identityChecked:false, identityOK:null, accepted:false };
for (const [name, patch] of Object.entries({
  'feature-match':{moves:4}, jump:{jump:31}, identity:{identityChecked:true,identityOK:false},
  'next-features':{}
})) assert(classify({...base,...patch}) === name, `${name}-gaten kan ikke repræsenteres`);
assert(classify({...base,accepted:true}) === null, 'accepteret frame skal ikke få rejectGate');
console.log('GRØN: probe kræver begge flags; normal benchmark bevares; alle fem udfald repræsenteres.');
