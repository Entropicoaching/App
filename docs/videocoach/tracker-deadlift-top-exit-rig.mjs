// ENT0095: Rep-slut ved lockout er korrekt; review-vinduet skal dog beholde
// dødløftets kontrollerede nedtur. Denne rig er en Node-port af den snævre
// review-slutregel, ikke browser- eller atletdata.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;
const DT = 1 / 30;

function reviewEnd({ lift, ys, lastRepEnd, range }) {
  const vel = ys.map((y, i) => i ? (ys[i - 1] - y) / DT : 0);
  let end = lastRepEnd;
  if (lift === 'deadlift') {
    const returnY = ys[lastRepEnd] + range * .80;
    let downRun = 0;
    for (let j = lastRepEnd + 1; j < ys.length; j++) {
      if (vel[j] < -.05) downRun++;
      else if (Math.abs(vel[j]) <= .05) { /* kontrolleret pause */ }
      else downRun = 0;
      if (downRun >= 3 && ys[j] >= returnY) { end = j; break; }
    }
  }
  return end;
}

function reviewWindow({ lift, times, repStart, observedEnd, naturalStart }) {
  const lead = lift === 'deadlift' ? 1 : .8;
  const tail = lift === 'deadlift' ? 1 : .5;
  return {
    start: Math.max(times[0], lift === 'deadlift'
      ? Math.min(naturalStart, times[repStart] - lead)
      : naturalStart),
    end: Math.min(times.at(-1), times[observedEnd] + tail)
  };
}

// Bund -> lockout -> 18 frames kontrolleret tilbage mod gulvet.
const deadlift = [520,500,470,430,390,350,310,280,260,255,255,
  260,275,295,320,350,385,420,455,490,515,520];
const top = 9, range = 265;
const oldEnd = top;
const newEnd = reviewEnd({ lift:'deadlift', ys:deadlift, lastRepEnd:top, range });
fail(oldEnd === top, 'baseline skal ende review ved lockout');
fail(newEnd > top + 6, 'dødløftets review skal beholde en tydelig del af nedturen');
fail(deadlift[newEnd] >= deadlift[top] + range * .80, 'review må først slutte efter reel retur mod gulvet');

// Har videoen rammeplads, skal reviewet have et helt sekund på begge sider.
const times = Array.from({ length: 91 }, (_, i) => i * DT);
const roomy = reviewWindow({ lift:'deadlift', times, repStart:40, observedEnd:60, naturalStart:1.1 });
fail(near(roomy.start, times[10]), 'dødløft skal beholde mindst ét sekund før trækket');
fail(near(roomy.end, times[90]), 'dødløft skal beholde mindst ét sekund efter observeret slutning');

// Ved videoens reelle kanter klippes der ikke ind i en opdigtet margin.
const short = reviewWindow({ lift:'deadlift', times, repStart:10, observedEnd:80, naturalStart:.1 });
fail(near(short.start, times[0]), 'dødløft må kun ramme videoens faktiske start');
fail(near(short.end, times[90]), 'dødløft må kun ramme videoens faktiske slutning');

// Andre løft bevarer både deres returfase og deres hidtidige review-marginer.
const benchEnd = reviewEnd({ lift:'bench', ys:deadlift, lastRepEnd:top, range });
fail(benchEnd === top, 'andre løft må ikke få dødløftets returfase');
const benchWindow = reviewWindow({ lift:'bench', times, repStart:40, observedEnd:60, naturalStart:1.1 });
fail(near(benchWindow.start, 1.1) && near(benchWindow.end, times[75]), 'bænk skal beholde sine hidtidige review-marginer');

for (const snippet of [
  "const activeLift = vcV3Lift(document.getElementById('liftSel').value);",
  "if (activeLift === 'deadlift') {",
  "path.reviewEndTime = t[reviewEnd];",
  "const reviewLead = activeLift === 'deadlift' ? 1 : 0.8;",
  "const reviewTail = activeLift === 'deadlift' ? 1 : 0.5;",
  "Number.isFinite(path.reviewEndTime)"
]) fail(source.includes(snippet), `kilden mangler ENT0095-reglen: ${snippet}`);

console.log(`ENT0095 — gammel review-slut frame ${oldEnd}; dødløft med retur frame ${newEnd}; bænk frame ${benchEnd}`);
console.log('GRØN: lockout afslutter stadig rep-tallet, men dødløftets review-loop beholder nedtur + 1 s ved begge video-ender.');
