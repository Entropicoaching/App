// Render-only kontrakt: små frame-til-frame-ryk skal dæmpes visuelt uden at
// ændre acquisition, timing, validitet eller de punkter metrics beregnes fra.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');

const visualPoints = (points, valid, times, maxOffset = 2.5) => Object.freeze(points.map((point, index) => {
  const previous = points[index - 1], next = points[index + 1];
  const previousTime = times[index - 1], nextTime = times[index + 1];
  if (!previous || !next || !valid[index - 1] || !valid[index] || !valid[index + 1] ||
      !Number.isFinite(previousTime) || !Number.isFinite(nextTime) ||
      times[index] - previousTime > 1 / 12 || nextTime - times[index] > 1 / 12) {
    return Object.freeze({x:point.x,y:point.y});
  }
  const verticalWindow = points.slice(index - 2, index + 3);
  const verticalReady = verticalWindow.length === 5 &&
    valid.slice(index - 2, index + 3).every(Boolean) &&
    times.slice(index - 2, index + 3).every((time, offset, window) =>
      !offset || time - window[offset - 1] <= 1 / 12);
  const target = {x:(previous.x + point.x * 2 + next.x) / 4,
    y:verticalReady
      ? (verticalWindow[0].y + 4 * verticalWindow[1].y + 6 * verticalWindow[2].y +
        4 * verticalWindow[3].y + verticalWindow[4].y) / 16
      : (previous.y + point.y * 2 + next.y) / 4};
  const dx = target.x - point.x, dy = target.y - point.y;
  const distance = Math.hypot(dx, dy), scale = distance > maxOffset ? maxOffset / distance : 1;
  return Object.freeze({x:point.x + dx * scale,y:point.y + dy * scale});
}));

const roughness = (points, valid) => {
  const values = [];
  for (let index = 1; index < points.length - 1; index++) {
    if (!valid[index - 1] || !valid[index] || !valid[index + 1]) continue;
    values.push(Math.hypot(points[index - 1].x - 2 * points[index].x + points[index + 1].x,
      points[index - 1].y - 2 * points[index].y + points[index + 1].y));
  }
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
};

const axisRoughness = (points, valid, axis) => {
  const values = [];
  for (let index = 1; index < points.length - 1; index++) {
    if (!valid[index - 1] || !valid[index] || !valid[index + 1]) continue;
    values.push(Math.abs(points[index - 1][axis] - 2 * points[index][axis] +
      points[index + 1][axis]));
  }
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
};

const times = Array.from({length:41}, (_, index) => index / 30);
const valid = times.map(() => true);
valid[20] = false; // et hul må aldrig blive udglattet hen over.
const raw = times.map((_, index) => ({
  x:320 + index * .08 + (index % 2 ? .7 : -.7),
  y:520 - index * 5 + index * index * .025 + ([.9,.9,-.9,-.9][index % 4])
}));
const rawBefore = JSON.stringify(raw);
const visual = visualPoints(raw, valid, times, 2.5);
const rawRoughness = roughness(raw, valid), visualRoughness = roughness(visual, valid);
const rawX = axisRoughness(raw, valid, 'x'), visualX = axisRoughness(visual, valid, 'x');
const rawY = axisRoughness(raw, valid, 'y'), visualY = axisRoughness(visual, valid, 'y');

assert(rawRoughness > 2, 'fixturen reproducerer ikke synlig frame-jitter');
assert(visualRoughness < rawRoughness * .45,
  `visningen dæmper ikke jitter nok (${rawRoughness.toFixed(2)} → ${visualRoughness.toFixed(2)})`);
assert(visualX < rawX * .2, `sideværts ro blev forringet (${rawX.toFixed(2)} → ${visualX.toFixed(2)})`);
assert(visualY < rawY * .35, `lodret jitter dæmpes ikke nok (${rawY.toFixed(2)} → ${visualY.toFixed(2)})`);
assert.equal(JSON.stringify(raw), rawBefore, 'render-udglatning muterede raw acquisition');
assert(Object.isFrozen(visual) && visual.every(Object.isFrozen), 'den afledte visningsbane skal fryses');
assert.deepEqual(visual[20], raw[20], 'et ugyldigt punkt må ikke interpoleres');
assert.deepEqual(visual[19], raw[19], 'visningen må ikke glatte ind over et ugyldigt hul');
assert.deepEqual(visual[21], raw[21], 'visningen må ikke glatte ud fra et ugyldigt hul');
assert(Math.max(...visual.map((point, index) => Math.hypot(point.x - raw[index].x,
  point.y - raw[index].y))) <= 2.5 + Number.EPSILON,
  'visningspunktet må ikke flyttes langt væk fra den målte skive');

assert(/function buildVisualBarPath\(points, valid, times, maxOffset/.test(html),
  'produktkilden mangler en særskilt render-only udglatning');
assert(/const verticalWindow = points\.slice\(index - 2, index \+ 3\)[\s\S]{0,600}verticalWindow\[4\]\.y\) \/ 16/.test(html),
  'produktkilden mangler den stærkere, symmetriske lodrette udglatning');
assert(/visualPts:buildVisualBarPath\(analysisPts, raw\.valid, raw\.times/.test(html),
  'analysen gemmer ikke en afledt visningsbane');
assert(/const pts = analysis\.visualPts \|\| analysis\.pts \|\| path\.raw\.pts/.test(html),
  'review-renderen bruger ikke den udglattede visningsbane');
assert(!/path\.raw\.pts\s*=|path\.pts\s*=\s*(analysis\.visualPts|visualPts)/.test(html),
  'visningsbanen må aldrig skrives tilbage i raw eller path.pts');

console.log(`GRØN: render-jitter x ${rawX.toFixed(2)} → ${visualX.toFixed(2)} px; `+
  `y ${rawY.toFixed(2)} → ${visualY.toFixed(2)} px; raw uændret.`);
