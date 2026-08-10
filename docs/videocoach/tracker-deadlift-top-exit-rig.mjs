// Clean rebuild: lockout afslutter koncentrisk metrics, ikke raw review-path.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
for (const marker of [
  'path.reviewStartTime = raw.start;',
  'path.reviewEndTime = raw.end;',
  'trimStart = path.raw.start;',
  'trimEnd = path.raw.end;',
  "repPhases.push(phase('concentric', detectedRep.start, detectedRep.end));",
  "repPhases.push(phase('lockout', detectedRep.end, returnStart - 1));",
  "repPhases.push(phase('return', returnStart, viewEnd));"
]) fail(source.includes(marker), `kilden mangler full-return-kontrakten: ${marker}`);

const y = [520,500,470,430,390,350,310,280,260,255,255,255,
  265,285,315,350,390,430,470,505,520];
const times = y.map((_, index) => index / 30);
const lockout = 9, rawEnd = times.at(-1);
fail(times[lockout] < rawEnd, 'fixture skal indeholde pause og fuld retur efter lockout');
const raw = Object.freeze({pts:Object.freeze(y.map((value,index)=>Object.freeze({x:320,y:value,index}))),
  times:Object.freeze(times),confidence:Object.freeze(times.map(()=>1)),valid:Object.freeze(times.map(()=>true))});
fail(Object.isFrozen(raw) && Object.isFrozen(raw.pts) && raw.pts.length === y.length,
  'raw acquisition skal være immutable og komplet');
fail(raw.times.at(-1) === rawEnd && raw.pts.at(-1).y === 520,
  'review/export skal kunne nå sidste gulvframe');
console.log(`GRØN: lockout frame ${lockout}; raw review/export fortsætter til frame ${y.length-1} ved gulvet.`);
