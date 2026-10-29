import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, settle } from './videoOptag2Fakes.mjs';
import { prepareVideoOptag2Upload } from './videoOptag2Upload.mjs';
import { bridge } from './optagBridgeHarness.mjs';

test('fresh counter: decoded duration outside tolerance fails in either direction', async () => {
  for (const duration of [9.49, 10.51]) {
    const f = fixture(); const work = f.api.select({ name: 'ten' }); await f.metadata(10);
    f.preview.currentTime = 10; f.preview.emit('timeupdate'); await settle(); await f.metadata(duration); await work;
    assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0); f.api.dispose();
  }
  const f = fixture(); const work = f.api.select({ name: 'ten' }); await f.metadata(10);
  f.preview.currentTime = 10; f.preview.emit('timeupdate'); await settle(); await f.metadata(9.8); await work;
  assert.equal(f.ready.length, 1); f.api.dispose();
});

test('fresh counter: recorder stopping before its start event never approves chunks', async () => {
  const f = fixture(); f.media.recorder = () => ({ state: 'recording',
    start() { this.ondataavailable({ data: { size: 2 } }); this.onstop(); }, stop() {} });
  const work = f.api.select({ name: 'ten' }); await f.metadata(10); await work;
  assert.equal(f.ready.length, 0); assert.equal(f.jobs.size, 0); f.api.dispose();
});

test('fresh counter: gate OFF touches neither document nor signal', async () => {
  const poison = new Proxy({}, { get() { assert.fail('access'); } });
  const file = new Blob(['synthetic']);
  assert.equal(await prepareVideoOptag2Upload(file, { document: poison, signal: poison }), file);
});

test('fresh counter: a second preparation aborts the first, then pagehide clears second', async () => {
  const f = fixture({ factory: () => null });
  const options = { videoOptag2: true, document: f.doc, media: f.media, clock: f.clock };
  const first = prepareVideoOptag2Upload({ name: 'one' }, options);
  const firstError = assert.rejects(first, /afbrudt/);
  const second = prepareVideoOptag2Upload({ name: 'two' }, options);
  const secondError = assert.rejects(second, /afbrudt/);
  f.leave(); await Promise.all([firstError, secondError]);
  assert.equal(f.jobs.size, 0);
});

test('fresh actual handler: codec MIME is normalized for storage and path', async () => {
  const f = await bridge({ videoOptag2: true });
  try {
    const work = f.send(); await f.metadata(5);
    f.recorder().mimeType = 'video/webm;codecs=vp8,opus';
    await f.finish(5); await work;
    assert.equal(f.replies[0].ok, true);
    assert.equal(f.uploads[0].options.contentType, 'video/webm');
    assert.match(f.uploads[0].path, /\.webm$/);
    assert.equal(f.dom.jobs.size, 0);
  } finally { f.restore(); }
});

test('fresh actual handler: recording replacement follows same upload gate and fifteen-second cap', async () => {
  const f = await bridge({ videoOptag2: true });
  try {
    const work = f.send(); await f.metadata(90);
    await f.button('Start optagelse').click();
    f.dom.advance(15000); await f.metadata(15); await f.finish(15); await work;
    assert.equal(f.uploads.length, 1); assert.equal(f.replies[0].ok, true);
    assert.equal(f.dom.jobs.size, 0);
  } finally { f.restore(); }
});
