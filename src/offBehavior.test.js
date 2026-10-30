import { useTestRelease } from './trin1TestProfile.mjs'
// Legacy fixtures explicitly select step 0; URL opt-in still exercises ON.
useTestRelease(0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { summarizeWeek } = await import('./athlete/ugeFeedback.js')
const { coachUgeFeedback, ugeFeedbackTree, erAfsluttetUge } = await import('./dashboard/coachUgeFeedback.js')
const { smerteNoter, planlagtLetUge, lokalDag } = await import('./coachFremgang.js')
const { bestHeavySetPerDay } = await import('./exerciseProgress.js')
const { dataEnoughEnabled } = await import('./dataEnough.mjs')

const training = { id: 's', title: 'Training', exercises: [{ id: 'sq', sets: 1, name: 'Squat', reps: 5 }] };
const rest = { id: 'r', title: 'Rest', exercises: [] };
const week = { start_date: '2026-10-19', sessions: [training, rest] };
const row = { logged_at: '2026-10-25T23:30:00Z', weight: 100, reps_completed: 5, exercise_id: 'sq', note: 'Ondt i knae', exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } };
const h = (tag, props, ...children) => ({ tag, props, children });
const text = n => n == null ? '' : typeof n === 'object' ? (n.children || []).map(text).join(' ') : String(n);
const withFlag = (search, fn) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    if (search === undefined) delete globalThis.location;
    else globalThis.location = { search };
    return fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'location', descriptor);
    else delete globalThis.location;
  }
};
const offValues = [undefined, '', '?appData2=0', '?appData2=true'];

test('K-REB2-PR11: OFF preserves rest-day summary and imported coach element tree', () => {
  for (const flag of offValues) withFlag(flag, () => {
    assert.equal(dataEnoughEnabled(), false);
    assert.equal(summarizeWeek(week, [row]).status, 'delvis');
    const feedback = coachUgeFeedback(week, [row], new Date('2026-11-15T12:00:00Z'));
    assert.equal(feedback.status, 'delvis');
    assert.match(text(ugeFeedbackTree(h, feedback, 1)), /Delvist gennemf/);
  });
});
test('K-REB2-PR11: OFF preserves pain date from timestamp prefix', () => {
  for (const flag of offValues) withFlag(flag, () => {
    assert.equal(dataEnoughEnabled(), false);
    assert.equal(smerteNoter([row], '2026-10-26')[0].dag, '2026-10-25');
    const boundary = { ...row, logged_at: '2026-10-11T22:30:00Z' };
    assert.deepEqual(smerteNoter([boundary], '2026-10-26'), []);
  });
});
test('K-REB2-PR11: OFF preserves host-local strength days and current day', () => {
  for (const flag of offValues) withFlag(flag, () => {
    const date = new Date(row.logged_at);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    assert.equal(lokalDag(date), day);
    assert.equal(bestHeavySetPerDay([{ ...row, exercises: { name: 'Squat' } }])[0].dag, day);
  });
});
test('K-REB2-PR11: OFF preserves host-local week closure and deload prefix', () => {
  for (const flag of offValues) withFlag(flag, () => {
    const end = new Date(2026, 9, 26);
    assert.equal(erAfsluttetUge(week, new Date(end.getTime() - 1)), false);
    assert.equal(erAfsluttetUge(week, end), true);
    assert.equal(planlagtLetUge([{ ...row, logged_at: '2026-10-15T22:30:00Z' }], '2026-10-26'), false);
  });
});
test('K-REB2-PR11: explicit ON retains all four prior corrections', () => withFlag('?appData2=1', () => {
  assert.equal(dataEnoughEnabled(), true);
  assert.equal(summarizeWeek(week, [row]).status, 'fuld');
  const feedback = coachUgeFeedback(week, [row], new Date('2026-11-15T12:00:00Z'));
  assert.match(text(ugeFeedbackTree(h, feedback, 1)), /Fuldt gennemf/);
  assert.equal(smerteNoter([row], '2026-10-26')[0].dag, '2026-10-26');
  assert.equal(lokalDag(new Date(row.logged_at)), '2026-10-26');
  assert.equal(lokalDag(new Date('2026-10-06T22:30:00Z')), '2026-10-07');
  assert.equal(lokalDag(new Date('2026-10-07T21:59:00Z')), '2026-10-07');
  assert.equal(bestHeavySetPerDay([{ ...row, exercises: { name: 'Squat' } }])[0].dag, '2026-10-26');
  assert.equal(planlagtLetUge([{ ...row, logged_at: '2026-10-15T22:30:00Z' }], '2026-10-26'), true);
  assert.equal(erAfsluttetUge(week, new Date('2026-10-25T22:59:59.999Z')), false);
  assert.equal(erAfsluttetUge(week, new Date('2026-10-25T23:00:00Z')), true);
  assert.equal(erAfsluttetUge({ start_date: '2026-10-12' }, new Date('2026-10-18T21:59:59.999Z')), false);
  assert.equal(erAfsluttetUge({ start_date: '2026-10-12' }, new Date('2026-10-18T22:00:00Z')), true);
}));

