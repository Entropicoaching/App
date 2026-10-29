import test from 'node:test';
import assert from 'node:assert/strict';
import { bridge } from './optagBridgeHarness.mjs';
import { settle } from './videoOptag2Fakes.mjs';
const before = process.argv.includes('--before');

test('K wiring: actual upload handler waits for validated compression before uploading Blob', async () => {
  const f = await bridge({ videoOptag2: true, before });
  try {
    const task = f.send();
    const earlyUploads = f.uploads.length;
    if (before) await task;
    assert.equal(earlyUploads, 0);
    await f.metadata(10); assert.equal(f.uploads.length, 0);
    await f.finish(10); await task;
    assert.equal(f.uploads.length, 1); assert.equal(f.rows.length, 1);
    assert.notEqual(f.uploads[0].file, f.message.file);
    assert.ok(f.uploads[0].file instanceof Blob);
    assert.match(f.uploads[0].path, /\.webm$/);
    assert.equal(f.uploads[0].options.contentType, 'video/webm');
    assert.equal(f.rows[0].analysis_state, 'awaiting_analysis');
    assert.equal(f.replies[0].ok, true);
  } finally { f.restore(); }
});

test('actual upload handler defaultOFF preserves original Blob and MIME without DOM', { skip: before }, async () => {
  for (const videoOptag2 of [undefined, false, 'true', 1]) {
    const f = await bridge({ videoOptag2 });
    try {
      await f.send(); assert.equal(f.uploads.length, 1);
      assert.equal(f.uploads[0].file, f.message.file);
      assert.equal(f.uploads[0].options.contentType, 'video/mp4');
      assert.equal(f.preview(), undefined);
    } finally { f.restore(); }
  }
});

test('actual handler rejects early output, allows cancel, and clears pending abort', { skip: before }, async () => {
  const f = await bridge({ videoOptag2: true });
  try {
    const task = f.send(); await f.metadata(10); f.recorder().stop(); await settle();
    assert.equal(f.uploads.length, 0);
    f.button('Annullér').click(); await task;
    assert.equal(f.replies[0].ok, false); assert.equal(f.rows.length, 0); assert.equal(f.aborts.size, 0);
    assert.equal(f.dom.jobs.size, 0);
  } finally { f.restore(); }
});

test('actual handler supports explicit trim before storage', { skip: before }, async () => {
  const f = await bridge({ videoOptag2: true });
  try {
    const task = f.send(); await f.metadata(125);
    const fields = f.dom.nodes.filter(n => n.type === 'number');
    fields[0].value = '20'; fields[1].value = '35';
    const trim = f.button('Klip og brug video').click();
    await f.finish(35, 15); await trim; await task;
    assert.equal(f.uploads.length, 1); assert.equal(f.replies[0].ok, true);
  } finally { f.restore(); }
});

test('actual handler abort, unmount, identity change and untrusted origin never upload', { skip: before }, async () => {
  for (const mode of ['abort', 'unmount', 'identity', 'origin']) {
    const f = await bridge({ videoOptag2: true });
    try {
      const task = mode === 'origin' ? f.send(f.message, 'https://other.invalid') : f.send();
      if (mode === 'origin') { await task; assert.equal(f.preview(), undefined); }
      else if (mode === 'identity') {
        await f.metadata(5); f.athleteRef.current = { id: 'changed' }; await f.finish(5); await task;
      } else {
        if (mode === 'unmount') f.cleanup();
        else await f.send({ type: 'test:vc:abort-upload', requestId: 'attempt' });
        await task;
      }
      assert.equal(f.uploads.length, 0); assert.equal(f.rows.length, 0); assert.equal(f.aborts.size, 0);
    } finally { f.restore(); }
  }
});
