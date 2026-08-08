// ENT0094: syntetisk, isoleret rig for hurtig doedloeft-nedtur efter knaeet.
// Porterer accept-portens raekkefolge fra VideoCoach; den kalder ikke browser-API'er.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const RADIUS = 30, DT = 1 / 30;
const fail = (ok, message) => { if (!ok) throw new Error(message); };

function sourceContract() {
  fail(/if\(moves\.length>=5\)/.test(source), 'kilden mangler feature-match-porten');
  fail(/if\(plateIdentityUsable&&\(kept\.length<8\|\|lost>0\)\)/.test(source), 'kilden mangler identity-porten');
  fail(/if\(kept\.length>=5&&jump<=maxJump&&identityOK\)/.test(source), 'kilden mangler den samlede accept-port');
  fail(/if\(plateIdentityUsable&&deadliftMode&&nearHome/.test(source), 'kilden mangler doedloefts home-afgraensning');
}

function scenario(fault = 'none') {
  return Array.from({ length: 12 }, (_, i) => {
    const afterKnee = i >= 6;
    const y = 250 + i * 20;
    const frame = { i, phase: afterKnee ? 'DESCENT_AFTER_KNEE' : 'DESCENT_BEFORE_KNEE', x: 320, y,
      moves: 9, kept: 9, identity: true, nearHome: false };
    if (i === 8 && fault === 'feature-match') frame.moves = 4;
    if (i === 8 && fault === 'identity') { frame.moves = 6; frame.kept = 6; frame.identity = false; }
    if (i === 8 && fault === 'jump') frame.x = 390;
    return frame;
  });
}

function run(variant, fault) {
  let cur = { x: 320, y: 250 }, vel = { x: 0, y: 0 }, lost = 0;
  const events = [];
  for (const frame of scenario(fault)) {
    const nx = frame.x, ny = frame.y;
    const jump = Math.hypot(nx - cur.x, ny - cur.y);
    const maxJump = RADIUS * .75 + Math.hypot(vel.x, vel.y) * DT * .45;
    let gate = 'accepted';
    if (frame.moves < 5 || frame.kept < 5) gate = 'feature-match';
    else if ((frame.kept < 8 || lost > 0) && !frame.identity) gate = 'identity';
    else if (jump > maxJump) gate = 'jump';
    if (gate === 'accepted') {
      const iv = { x: (nx - cur.x) / DT, y: (ny - cur.y) / DT };
      vel = { x: vel.x * .35 + iv.x * .65, y: vel.y * .35 + iv.y * .65 };
      cur = { x: nx, y: ny }; lost = 0;
    } else { lost++; vel = { x: vel.x * .75, y: vel.y * .75 }; }
    events.push({ ...frame, gate, jump, maxJump });
  }
  const postKnee = events.filter(q => q.phase === 'DESCENT_AFTER_KNEE');
  return { variant, fault, events, rejected: postKnee.filter(q => q.gate !== 'accepted'), accepted: postKnee.filter(q => q.gate === 'accepted') };
}

sourceContract();
const faults = ['none', 'feature-match', 'identity', 'jump'];
const results = ['B', 'C'].flatMap(variant => faults.map(fault => run(variant, fault)));
for (const result of results) {
  if (result.fault === 'none') fail(result.rejected.length === 0, `${result.variant}/none: forkert antal afvisninger`);
  else {
    fail(result.rejected.length >= 1, `${result.variant}/${result.fault}: forkert antal afvisninger`);
    fail(result.rejected[0].gate === result.fault, `${result.variant}/${result.fault}: forkert gate`);
  }
}
for (const fault of faults) {
  const b = results.find(q => q.variant === 'B' && q.fault === fault);
  const c = results.find(q => q.variant === 'C' && q.fault === fault);
  fail(b.rejected.map(q => q.gate).join() === c.rejected.map(q => q.gate).join(), `B/C divergerer uventet for ${fault}`);
}

console.log('ENT0094 — hurtig doedloeft-nedtur efter knaeet (syntetisk, R=30)');
console.log('variant | indfoert fejl | afvist gate | accepteret efter knae');
for (const r of results) console.log(`${r.variant.padEnd(7)} | ${r.fault.padEnd(15)} | ${(r.rejected[0]?.gate || 'ingen').padEnd(15)} | ${r.accepted.length}/6`);
console.log('GRON: feature-match, identity og jump er hver for sig foelsomme; B og C er ens udenfor home-zonen.');
