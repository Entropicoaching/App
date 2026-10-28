import test from 'node:test';
import assert from 'node:assert/strict';
import { mountVideoOptag2 } from './videoOptag2.mjs';
import { fixture, settle } from './videoOptag2Fakes.mjs';

test('counter: external select cannot claim encoded approval with a second argument', async () => {
  const f = fixture(); const file = { name: 'untrusted', size: 5, type: 'video/webm' };
  const task = f.api.select(file, true); await f.metadata(12);
  assert.equal(f.ready.length, 0); assert.equal(f.api.accepts(file), false);
  f.api.dispose(); await task;
});

test('counter: switching source during encode invalidates former result and cleans timers', async () => {
  const f = fixture(); const first = f.api.select({ name: 'old' }); await f.metadata(20);
  const late = f.active.onstop;
  const second = f.api.select({ name: 'next' });
  late(); await f.metadata(90); await Promise.all([first, second]);
  assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0);
  f.api.dispose();
});

test('counter: decoded width above target cannot reach onReady', async () => {
  const f = fixture(); const task = f.api.select({ name: 'wide' }); await f.metadata(10);
  f.preview.currentTime = 10; f.preview.emit('timeupdate'); await settle();
  f.preview.duration = 10; f.preview.videoHeight = 540; f.preview.videoWidth = 2000;
  f.preview.onloadedmetadata(); await task;
  assert.equal(f.ready.length, 0); f.api.dispose();
});

test('counter: no implicit activation from enabled, truthy values, missing athlete', () => {
  const document = new Proxy({}, { get() { throw Error('DOM'); } });
  for (const opts of [{ enabled: true, athlete: true }, { videoOptag2: 1, athlete: true },
    { videoOptag2: true }, { videoOptag2: true, athlete: 'athlete' }])
    assert.equal(mountVideoOptag2({ ...opts, document }), null);
});

test('counter: camera denial and empty recording retain no approved object', async () => {
  const denied = fixture({ media: { async getStream() { throw Error('denied'); } } });
  await denied.button('Start optagelse').click();
  assert.equal(denied.ready.length, 0); assert.equal(denied.jobs.size, 0); denied.api.dispose();
  const f = fixture(); await f.button('Start optagelse').click();
  f.active.ondataavailable = null; f.button('Stop optagelse').click();
  assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0); f.api.dispose();
});

test('counter: throwing ready callback revokes approval instead of leaving accepted file', async () => {
  const f = fixture({ mount: { onReady() { throw Error('host failure'); } } });
  let output; const file = f.media.file;
  f.media.file = (...args) => (output = file(...args));
  const task = f.api.select({ name: 'short' }); await f.metadata(10);
  f.preview.currentTime = 10; f.preview.emit('timeupdate'); await settle();
  await f.metadata(10); await task;
  assert.equal(f.api.accepts(output), false);
  assert.equal(f.button('Start optagelse').disabled, false); f.api.dispose();
});
