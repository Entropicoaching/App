import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bridge } from './optagBridgeHarness.mjs';
import { resolveVideoSet } from './athlete/videoSetSelection.mjs';

const initial = { key: 'session:exercise:1', lift: 'squat', load_kg: 80, reps: 5,
  training_session_id: 'session', program_item_id: 'exercise' };
const recreate = () => resolveVideoSet([initial], { key: initial.key, loadKg: 80, reps: 5 });

async function compress(change) {
  const f = await bridge({ videoOptag2: true });
  try {
    const selected = recreate();
    f.setRef.current = { enabled: true, athleteId: f.athleteRef.current.id, selected };
    const task = f.send();
    await f.metadata(5);
    assert.equal(f.uploads.length, 0);
    change(f, selected);
    await f.finish(5);
    await task;
    return { uploads: f.uploads, rows: f.rows, replies: f.replies, aborts: f.aborts.size };
  } finally { f.restore(); }
}

test('R3 equal selected content recreated by actual resolveVideoSet uploads exactly once', async () => {
  const result = await compress((f, selected) => {
    const next = recreate();
    assert.notEqual(next, selected);
    assert.deepEqual(next, selected);
    f.setRef.current = { ...f.setRef.current, selected: next };
  });
  assert.equal(result.uploads.length, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.replies.length, 1);
  assert.equal(result.replies[0].ok, true);
  assert.equal(result.rows[0].load_kg, 80);
  assert.equal(result.rows[0].session_context.video_set.reps, 5);
  assert.equal(result.aborts, 0);
});

for (const [key, value] of Object.entries({ key: 'other', lift: 'bench', load_kg: 81,
  reps: 6, training_session_id: 'other-session', program_item_id: 'other-exercise' })) {
  test(`R3 changed ${key} rejects before transport`, async () => {
    const result = await compress(f => {
      f.setRef.current = { ...f.setRef.current, selected: { ...recreate(), [key]: value } };
    });
    assert.equal(result.uploads.length, 0);
    assert.equal(result.rows.length, 0);
    assert.equal(result.replies[0].ok, false);
    assert.equal(result.aborts, 0);
  });
}

test('R3 in-place mutation cannot change the captured content', async () => {
  const result = await compress((f, selected) => { selected.load_kg = 90; });
  assert.equal(result.uploads.length, 0);
  assert.equal(result.rows.length, 0);
  assert.equal(result.replies[0].ok, false);
});

for (const state of [{ enabled: false }, { athleteId: 'other' }, { selected: null }]) {
  test(`R3 invalidated selection ${JSON.stringify(state)} rejects`, async () => {
    const result = await compress(f => { Object.assign(f.setRef.current, state); });
    assert.equal(result.uploads.length, 0);
    assert.equal(result.rows.length, 0);
    assert.equal(result.replies[0].ok, false);
  });
}

test('R3 AthleteView one-line plumbing reads explicit prop and defaults OFF', () => {
  const source = readFileSync(new URL('./AthleteView.jsx', import.meta.url), 'utf8');
  const line = source.split('\n').find(line => line.includes('videoSetRef, videoOptag2:'));
  assert.ok(line);
  // Execute the exact call argument expression with the parent function's arguments.
  const capture = new Function('useVideoCoachBro', `return function AthleteView() {
    return useVideoCoachBro({${line.trim().replace(/,$/, '')}});
  }`)(x => x);
  globalThis.videoSetRef = {};
  try {
    for (const value of [undefined, false, 'true', 1, null, {}])
      assert.equal(capture({ videoOptag2: value }).videoOptag2, false);
    assert.equal(capture({ videoOptag2: true }).videoOptag2, true);
  } finally { delete globalThis.videoSetRef; }
});
