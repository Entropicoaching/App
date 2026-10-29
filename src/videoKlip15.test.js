import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CAPTURE_SECONDS, validInterval } from './videoOptag2.mjs';
import { estimateVideoBytes, compressVideo2 } from './videoCompression2.mjs';
import { fixture, settle } from './videoOptag2Fakes.mjs';
import { bridge } from './optagBridgeHarness.mjs';
import { runOriginalRetention, VIDEO_SLET, RETENTION_MS } from './videoRetention.mjs';

test('KLIP15 exact limits reject fractional overflow at both gates', async () => {
  assert.equal(MAX_CAPTURE_SECONDS, 15);
  assert.equal(validInterval(7.5, 22.5, 30), true);
  assert.equal(validInterval(7.5, 22.501, 30), false);
  assert.equal(estimateVideoBytes(15), 1995000);
  assert.throws(() => estimateVideoBytes(15.001));
  await assert.rejects(compressVideo2({ video: { duration: 30 }, start: 7.5,
    end: 22.501, media: {}, clock: {}, signal: new AbortController().signal }), /interval/);
});

test('KLIP15 clock: no countdown before last five, exactly one capture stop', async () => {
  const f = fixture();
  try {
    await f.button('Start optagelse').click();
    f.advance(9900);
    assert.ok(!f.nodes.some(n => /sekunder tilbage/.test(n.textContent || '')));
    f.advance(100);
    assert.ok(f.nodes.some(n => n.textContent === '5 sekunder tilbage'));
    f.advance(4999); assert.equal(f.stops, 0);
    f.advance(1); assert.equal(f.stops, 1);
    f.advance(1000); assert.equal(f.stops, 1);
    assert.equal(f.ready.length, 0);
  } finally { f.api.dispose(); }
});

test('KLIP15 actual handler: 15.001s source waits for athlete start, then compressed upload', async () => {
  const f = await bridge({ videoOptag2: true });
  try {
    const work = f.send(); await f.metadata(15.001);
    assert.equal(f.uploads.length, 0); assert.equal(f.recorder(), undefined);
    const fields = f.dom.nodes.filter(n => n.type === 'number');
    assert.equal(fields[0].value, ''); assert.equal(fields[1].value, '');
    fields[0].value = '0.5'; fields[1].value = '15.001'; fields[0].oninput();
    const trim = f.button('Klip og brug video').click();
    assert.equal(f.uploads.length, 0);
    await f.finish(15.001, 14.501); await trim; await work;
    assert.equal(f.uploads.length, 1); assert.equal(f.rows.length, 1);
    assert.notEqual(f.uploads[0].file, f.message.file);
    assert.equal(f.uploads[0].options.contentType, 'video/webm');
    assert.equal(f.dom.jobs.size, 0);
  } finally { f.restore(); }
});

test('KLIP15 decoded output above 15 seconds is never approved', async () => {
  const f = fixture();
  try {
    const work = f.api.select({ name: 'boundary' }); await f.metadata(15);
    f.preview.currentTime = 15; f.preview.emit('timeupdate'); await settle();
    await f.metadata(15.001); await work;
    assert.equal(f.ready.length, 0);
    assert.equal(f.fields[0].value, '');
  } finally { f.api.dispose(); }
});

test('KLIP15 retention OFF is inert; synthetic ON removes old original and preserves evidence', async () => {
  assert.equal(VIDEO_SLET, false);
  const athleteId = '11111111-1111-1111-1111-111111111111';
  const id = '22222222-2222-2222-2222-222222222222';
  const original = `${athleteId}/${id}.mp4`, still = `${athleteId}/${id}.jpg`;
  const now = '2026-10-29T12:00:00.000Z';
  const input = { athleteId, now, analyses: [{ id, athlete_id: athleteId,
    video_path: original, analysis_state: 'complete', drawings: [{ points: [1, 2] }],
    comments: ['Hold spaendingen'], coach_note: 'Bevar',
    session_context: { video_retention: { still_path: still } } }],
    objects: [{ bucket_id: 'videocoach-uploads', name: original,
      created_at: new Date(Date.parse(now) - RETENTION_MS - 1).toISOString(), metadata: { size: 999 } },
    { bucket_id: 'videocoach-uploads', name: still, metadata: { size: 99 } }] };
  const before = structuredClone(input);
  const storage = new Map([[original, 'synthetic video'], [still, 'synthetic still']]);
  const adapter = { kind: 'synthetic', async deleteOriginal(item) {
    assert.equal(item.path, original); storage.delete(item.path); return { ok: true };
  } };
  const off = await runOriginalRetention(input, { dryRun: false, adapter });
  assert.deepEqual(off.removed, []); assert.equal(storage.size, 2);
  const on = await runOriginalRetention(input, { videoSlet: true, dryRun: false, adapter });
  assert.deepEqual(on.removed, [original]); assert.equal(storage.has(original), false);
  assert.equal(storage.get(still), 'synthetic still'); assert.deepEqual(input, before);
});
