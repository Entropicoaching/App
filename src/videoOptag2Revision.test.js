import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, settle } from './videoOptag2Fakes.mjs';

// Same counterexamples run against pinned input and delivered modules.
const before = process.argv.includes('--before');
const compression = before ? './input-991-videoCompression2.mjs' : './videoCompression2.mjs';
const source = readFileSync(new URL(before ? './input-992-videoOptag2.mjs' : './videoOptag2.mjs', import.meta.url), 'utf8')
  .replace("'./videoCompression2.mjs'", JSON.stringify(new URL(compression, import.meta.url).href));
const { mountVideoOptag2 } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const make = () => fixture({ factory: mountVideoOptag2 });

test('K1: recorder stop at 4 of a 12-second encode rejects one-second output', async () => {
  const f = make(); const selected = f.api.select({ name: '12s' });
  await f.metadata(12);
  // 12 seconds is short; it is already being encoded from zero.
  f.preview.currentTime = 4; f.active.stop(); await settle();
  await f.metadata(1); await selected;
  assert.equal(f.ready.length, 0); f.api.dispose();
});

test('K1: unexpected recorder stop inside explicit trim is rejected', async () => {
  const f = make(); const selected = f.api.select({ name: 'long' });
  await f.metadata(90); await selected;
  f.fields[0].value = '10'; f.fields[1].value = '20';
  const work = f.button('Klip og brug video').click();
  f.preview.emit('seeked'); await settle();
  f.preview.currentTime = 11; f.active.stop(); await settle();
  await f.metadata(1); await work;
  assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0); f.api.dispose();
});

test('K2: source reaches endpoint but twelve-second encode decodes to three seconds', async () => {
  const f = make(); const selected = f.api.select({ name: '12s' }); await f.metadata(12);
  f.preview.currentTime = 12; f.preview.emit('timeupdate'); await settle();
  await f.metadata(3); await selected;
  assert.equal(f.ready.length, 0); f.api.dispose();
});

test('capture: decoded raw duration must match actual recorded elapsed time', async () => {
  const f = make(); await f.button('Start optagelse').click(); f.advance(12000);
  f.button('Stop optagelse').click(); await f.metadata(3);
  // If incorrectly accepted as a source, finish its encode too.
  if (f.active?.state === 'recording') {
    f.preview.currentTime = 3; f.preview.emit('timeupdate'); await settle(); await f.metadata(3);
  }
  assert.equal(f.ready.length, 0); f.api.dispose();
});

test('long source does not show a size until a valid interval is selected', async () => {
  const f = make(); const work = f.api.select({ name: '125s' }); await f.metadata(125); await work;
  assert.ok(!f.nodes.some(n => n.textContent?.includes('2.0 MB')));
  f.fields[0].value = '20'; f.fields[1].value = '35'; f.fields[1].oninput?.();
  assert.ok(f.nodes.some(n => n.textContent?.includes('2.0 MB'))); f.api.dispose();
});
