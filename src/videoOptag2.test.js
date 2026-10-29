import test from 'node:test';
import assert from 'node:assert/strict';
import { mountVideoOptag2, validInterval, DEFAULT_VIDEO_OPTAG2 } from './videoOptag2.mjs';
import { compressVideo2, estimateVideoBytes, dimensions540, compressionProfile } from './videoCompression2.mjs';
import { fixture, settle } from './videoOptag2Fakes.mjs';

async function finishEncoding(f, end, seconds = end) {
  await settle();
  f.preview.emit('seeked'); await settle();
  f.preview.currentTime = end; f.preview.emit('timeupdate'); await settle();
  await f.metadata(seconds);
}

test('OFF and coach are inert even with throwing DOM/media/storage', () => {
  assert.equal(DEFAULT_VIDEO_OPTAG2, false);
  const poison = new Proxy({}, { get() { throw Error('forbidden access'); } });
  for (const options of [{}, { videoOptag2: false, athlete: true },
    { videoOptag2: 'true', athlete: true }, { videoOptag2: true, athlete: false }])
    assert.equal(mountVideoOptag2({ ...options, document: poison, media: poison, clock: poison }), null);
});

test('15s cap, countdown only last 5s, recorder bitrate and one automatic stop', async () => {
  let profile;
  const f = fixture();
  const recorder = f.media.recorder;
  f.media.recorder = (stream, options) => { profile = options; return recorder(stream); };
  await f.button('Start optagelse').click();
  assert.deepEqual(profile, compressionProfile);
  assert.ok(f.nodes.some(n => n.textContent === 'Optager ... stopper efter 15 sekunder.'));
  f.advance(9999); assert.equal(f.stops, 0);
  assert.ok(!f.nodes.some(n => n.textContent === '6 sekunder tilbage'));
  f.advance(1); assert.ok(f.nodes.some(n => n.textContent === '5 sekunder tilbage'));
  f.advance(4999); assert.equal(f.stops, 0);
  f.advance(1); assert.equal(f.stops, 1);
  assert.ok(f.trackStops > 0);
  await f.metadata(15); await finishEncoding(f, 15, 15);
  assert.equal(f.ready.length, 1); assert.ok(f.api.accepts(f.ready[0]));
  assert.ok(f.nodes.some(n => n.textContent?.includes('2.0 MB')));
  f.advance(5000); assert.equal(f.stops, 2); // one capture and one encode stop
  f.api.dispose(); assert.equal(f.jobs.size, 0);
});

test('late timer never approves a recording longer than 15s', async () => {
  const f = fixture(); await f.button('Start optagelse').click();
  f.jump(22000); assert.equal(f.stops, 1);
  await f.metadata(22); assert.equal(f.ready.length, 0);
  assert.equal(f.fields[1].value, ''); f.api.dispose();
});

test('short selected file is encoded before ready; original never accepted', async () => {
  const f = fixture(), original = { name: 'short.mp4', size: 1000000 };
  const task = f.api.select(original); await f.metadata(10);
  assert.equal(f.ready.length, 0); assert.equal(f.api.accepts(original), false);
  await finishEncoding(f, 10); await task;
  assert.equal(f.ready.length, 1); assert.notEqual(f.ready[0], original);
  assert.equal(f.api.accepts(f.ready[0]), true);
  assert.ok(f.nodes.some(n => n.textContent?.includes('1.3 MB')));
  f.api.dispose();
});

test('long file requires explicit valid trim and only encoded output reaches callback', async () => {
  const f = fixture(), original = { name: 'long.mp4', size: 9000000 };
  const task = f.api.select(original); await f.metadata(125); await task;
  assert.equal(f.ready.length, 0);
  f.fields[0].value = '20'; f.fields[1].value = '36';
  await f.button('Klip og brug video').click(); assert.equal(f.active, undefined);
  f.fields[1].value = '35';
  const clip = f.button('Klip og brug video').click();
  await finishEncoding(f, 35, 15); await clip;
  assert.equal(f.ready.length, 1); assert.equal(f.api.accepts(original), false);
  f.api.dispose();
});

test('bounds and estimated bytes include 64 kbit audio; no clamp or rounding bypass', () => {
  assert.equal(estimateVideoBytes(15), 1995000);
  assert.equal(estimateVideoBytes(10), 1330000);
  assert.deepEqual(dimensions540(1920, 1080), { width: 960, height: 540 });
  assert.deepEqual(dimensions540(1080, 1920), { width: 302, height: 540 });
  assert.deepEqual(dimensions540(640, 360), { width: 640, height: 360 });
  for (const value of [NaN, Infinity, 0, -1, 15.001]) assert.throws(() => estimateVideoBytes(value));
  for (const args of [[0,15.01,120],[-1,2,120],[1,1,120],[100,130,120],[0,NaN,120]])
    assert.equal(validInterval(...args), false);
  assert.equal(validInterval(30,45,120), true);
});

test('metadata errors/timeouts fail closed and release object URLs', async () => {
  for (const seconds of [NaN, Infinity, 0, -1]) {
    const f = fixture(); const task = f.api.select({ name: 'bad' });
    await f.metadata(seconds); await task;
    assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0);
    assert.equal(f.revoked.length, 1); f.api.dispose();
  }
  const f = fixture(); const task = f.api.select({ name: 'timeout' });
  f.advance(10000); await task; assert.equal(f.ready.length, 0); f.api.dispose();
});

test('cancel, visibility, pagehide, dispose discard pending encode and late chunks', async () => {
  for (const action of ['cancel','hide','leave','dispose']) {
    const f = fixture(); const task = f.api.select({ name: 'short' }); await f.metadata(10);
    await settle(); const late = f.active.onstop;
    if (action === 'cancel') f.nodes.find(n => n.tag === 'button' && n.textContent.startsWith('Annull')).click();
    if (action === 'hide') f.hide();
    if (action === 'leave') f.leave();
    if (action === 'dispose') f.api.dispose();
    late(); await task;
    assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0); assert.ok(f.trackStops > 0);
    f.api.dispose();
  }
});

test('missing encoder capability and codec error never pass through original', async () => {
  for (const mode of ['unsupported','error','stall']) {
    const f = fixture(); if (mode === 'unsupported') f.preview.captureStream = null;
    const task = f.api.select({ name: 'short' }); await f.metadata(5);
    if (mode === 'error') f.active.onerror();
    if (mode === 'stall') f.advance(21000);
    await task; assert.equal(f.ready.length, 0);
    assert.equal(f.button('Start optagelse').disabled, false); f.api.dispose();
  }
});

test('encoded output is decoded again: oversized duration, invalid dimensions or empty blob rejected', async () => {
  for (const mode of ['duration','dimensions','empty']) {
    const f = fixture(); if (mode === 'empty') f.media.file = () => ({ size: 0, type: 'video/webm' });
    const task = f.api.select({ name: 'short' }); await f.metadata(10);
    f.preview.currentTime = 10; f.preview.emit('timeupdate'); await settle();
    f.preview.duration = mode === 'duration' ? 15.1 : 10;
    f.preview.videoHeight = mode === 'dimensions' ? 1080 : 540;
    f.preview.onloadedmetadata?.(); await task;
    assert.equal(f.ready.length, 0); f.api.dispose();
  }
});

test('camera permission arriving after cancellation stops its stream', async () => {
  let resolve, stops = 0;
  const f = fixture({ media: { getStream: () => new Promise(done => { resolve = done; }) } });
  const task = f.button('Start optagelse').click(); f.api.dispose();
  resolve({ getTracks: () => [{ stop() { stops++; } }] }); await task;
  assert.equal(stops, 1); assert.equal(f.active, undefined);
});

test('compression abstraction really scales canvas and passes recording options', async () => {
  const f = fixture(); let canvas, options;
  f.preview.duration = 30; f.preview.videoWidth = 3840; f.preview.videoHeight = 2160;
  const originalCanvas = f.media.canvas, recorder = f.media.recorder;
  f.media.canvas = () => (canvas = originalCanvas());
  f.media.recorder = (stream, profile) => { options = profile; return recorder(stream); };
  const task = compressVideo2({ video: f.preview, start: 0, end: 15, media: f.media,
    clock: { timeout: () => 1, clear() {} }, signal: new AbortController().signal });
  assert.equal(canvas.width, 960); assert.equal(canvas.height, 540);
  assert.deepEqual(options, { videoBitsPerSecond: 1000000, audioBitsPerSecond: 64000 });
  f.preview.currentTime = 15; f.preview.emit('timeupdate');
  assert.equal((await task).type, 'video/webm'); f.api.dispose();
});
