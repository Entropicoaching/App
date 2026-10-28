import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { install, sourceURL } from './fremgangLoader.mjs'
install()
const { compareBlocks, renderBlockComparison, readBlockLogs } = await import('./blokFremgang.mjs')
const { createElement, mount, find, setClient } = await import('./fremgangSynthetic.mjs')
const { options, weeks, logs, log, today } = await import('./fremgangFixtures.mjs')
const clone = value => structuredClone(value)
const ready = value => value.lifts.filter(l => l.status === 'ready')

test('flag is strictly opt in, with no access to data when off', () => {
  const poison = new Proxy({}, { get() { throw Error('Data accessed') } })
  for (const enabled of [undefined, false, null, 1, 'true', {}]) {
    assert.equal(compareBlocks({ enabled, weeks: poison, logs: poison }), null)
    assert.equal(renderBlockComparison(createElement, { enabled, weeks: poison }), null)
  }
})

test('two actual blocks, best Epley set, original load/reps/date and rounded delta', () => {
  const m = compareBlocks(options), s = ready(m)[0]
  assert.equal(m.status, 'known')
  assert.equal(m.previous, 'Grundstyrke, uge 1 til 2')
  assert.equal(m.current, 'Intensificering, uge 3 til 4')
  assert.equal(s.before.weight, 105); assert.equal(s.now.weight, 115)
  assert.equal(s.now.day, today); assert.equal(s.now.reps, 3)
  assert.equal(s.delta, s.now.e1rm - s.before.e1rm)
  assert.deepEqual(s.counts, [2, 2])
  const dom = mount(renderBlockComparison(createElement, options))
  assert.match(dom.textContent, /115 kg × 3/)
  assert.match(dom.textContent, /105 kg × 3/)
  assert.equal(find(dom, 'data-blok-nu').find(e => e.attrs['data-blok-nu'] === 'baenk').textContent, '-')
  assert.equal(find(dom, 'data-blok-loeft').length, 4)
})

test('rank by estimate, not weight, and display negative and unchanged differences', () => {
  const more = [...logs, log(2, '2026-10-13', 102, 0, { reps_completed: 8 })]
  const lower = ready(compareBlocks({ ...options, logs: more }))[0]
  assert.equal(lower.before.weight, 102)
  assert.ok(lower.delta < 0)
  const equal = logs.map(l => ({ ...l, weight: 100 }))
  assert.equal(ready(compareBlocks({ ...options, logs: equal }))[0].delta, 0)
})

test('one day with many sets or duplicate rows is insufficient', () => {
  const rows = [logs[0], ...Array.from({ length: 15 }, () => logs[2])]
  assert.equal(ready(compareBlocks({ ...options, logs: rows })).length, 0)
  assert.deepEqual(compareBlocks({ ...options, logs: rows }).lifts[0].counts, [1, 1])
})

test('variants, backoff, technique, skipped, fractional reps, invalid and future dates do not supply evidence', () => {
  const bad = [
    { exercises: { name: 'Front squat' } }, { exercises: { name: 'Squat backoff' } },
    { exercises: { name: 'Squat teknik single' } }, { skipped: true }, { reps_completed: 9 },
    { reps_completed: 1.5 }, { weight: Infinity }, { weight: -1 }, { reps_completed: 0 },
    { logged_at: undefined }, { logged_at: '' }, { logged_at: '2026-02-30' },
    { logged_at: '2026-10-28T10:00:00Z' }, { exercise_id: 'unknown' }, { athlete_id: 'b' },
  ]
  for (const extra of bad) {
    const m = compareBlocks({ ...options, logs: [logs[0], logs[1], logs[2], { ...logs[3], ...extra }] })
    assert.equal(ready(m).length, 0, JSON.stringify(extra))
  }
})

test('main lifts never borrow another lift or variant; aliases keep set type rules', () => {
  const all = Array.from({ length: 4 }, (_, k) => logs.map(l => log(Number(l.exercise_id[1]), l.logged_at.slice(0, 10), l.weight + k * 10, k))).flat()
  assert.equal(ready(compareBlocks({ ...options, logs: all })).length, 4)
  const alias = clone(options)
  alias.weeks.forEach(w => { w.sessions[0].exercises[0].name = 'Back squat top set' })
  alias.logs.forEach(l => { l.exercises.name = 'Squat topsæt' })
  assert.equal(ready(compareBlocks(alias)).length, 1)
  alias.weeks[3].sessions[0].exercises[0].name = 'Squat backoff'
  assert.equal(ready(compareBlocks(alias)).length, 0)
})

test('ambiguous or missing dates, week identity, gaps, foreign scope and duplicate exercise identity fail closed', () => {
  const changes = [
    o => { o.weeks[1].block_name = '' }, o => { o.weeks[1].start_date = null },
    o => { o.weeks[1].start_date = '2026-02-30' }, o => { o.weeks[1].start_date = '2026-10-06' },
    o => { o.weeks[1].id = 'w1' }, o => { o.weeks[1].week_number = 1 },
    o => { o.weeks.splice(1, 1) }, o => { o.weeks[1].athlete_id = 'b' },
    o => { o.weeks[1].sessions[0].exercises[0].id = 'e1-0' },
  ]
  for (const change of changes) { const o = clone(options); change(o); assert.equal(compareBlocks(o).status, 'unknown') }
  assert.equal(compareBlocks({ ...options, today: '2026-12-01' }).status, 'unknown')
  assert.equal(compareBlocks({ ...options, today: '2026-10-06' }).previous, null)
})

test('immediate previous block only, repeated names are separate, and no deload comparison', () => {
  const o = clone(options)
  o.weeks[1].block_name = 'Pauseblok'; o.weeks[2].block_name = 'Grundstyrke'; o.weeks[3].block_name = 'Grundstyrke'
  const m = compareBlocks(o)
  assert.equal(m.previous, 'Pauseblok, uge 2 til 2')
  assert.equal(m.lifts[0].status, 'insufficient')
  o.weeks[1].block_name = 'Deload'
  assert.equal(compareBlocks(o).status, 'unknown')
  o.weeks[1].block_name = 'Taper'
  assert.equal(compareBlocks(o).status, 'unknown')
})

test('timestamp cannot move a set into another block; deterministic and read only', () => {
  const before = JSON.stringify(options)
  const m = compareBlocks(options)
  assert.deepEqual(compareBlocks({ ...options, weeks: [...weeks].reverse(), logs: [...logs].reverse() }), m)
  assert.equal(JSON.stringify(options), before)
  const late = clone(options); late.logs[1].logged_at = '2026-10-26T10:00:00Z'
  assert.equal(ready(compareBlocks(late)).length, 0)
})

function fakeClient(rows, failPage = -1, reject = false) {
  const calls = [], q = {
    from(...v) { calls.push(['from', ...v]); return q }, select(...v) { calls.push(['select', ...v]); return q },
    eq(...v) { calls.push(['eq', ...v]); return q }, order(...v) { calls.push(['order', ...v]); return q },
    range(from, to) { calls.push(['range', from, to]); if (reject) throw Error('Synthetic rejection'); return Promise.resolve(from === failPage ? { data: null, error: { message: 'Synthetic error' } } : { data: rows.slice(from, from + 2), error: null }) },
    limit(n) { calls.push(['limit', n]); return Promise.resolve({ data: rows.slice(0, n) }) },
  }
  return { q, calls }
}

test('all pages read even if backend caps below requested page size', async () => {
  const { q, calls } = fakeClient(logs)
  const result = await readBlockLogs(q, 'a')
  assert.deepEqual(result.data, logs)
  assert.deepEqual(calls.filter(c => c[0] === 'range').map(c => c[1]), [0, 2, 4])
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'athlete_id' && c[2] === 'a'))
  for (const [failPage, reject] of [[2, false], [-1, true]]) {
    const r = await readBlockLogs(fakeClient(logs, failPage, reject).q, 'a')
    assert.equal(r.data, null); assert.ok(r.error)
  }
})

test('actual coach handler: default retains limit, opt in reads all, errors publish no partial maxima', async () => {
  const { lavLaesninger } = await import('./coachLaesninger.js')
  for (const flag of [undefined, false, 'true', true]) {
    const { q, calls } = fakeClient(logs); setClient(q)
    let result
    await lavLaesninger({ blokFremgang: flag, setAthleteLogs: rows => { result = rows } }).fetchAthleteLogs('a')
    assert.deepEqual(result, logs)
    assert.equal(calls.some(c => c[0] === 'range'), flag === true)
    assert.equal(calls.some(c => c[0] === 'limit' && c[1] === 2000), flag !== true)
  }
  setClient(fakeClient(logs, 2).q)
  let result
  await lavLaesninger({ blokFremgang: true, setAthleteLogs: rows => { result = rows } }).fetchAthleteLogs('a')
  assert.deepEqual(result, [])
  setClient(null)
})

test('actual athlete views and coach overview import and mount the shared card; off matches pinned DOM', async () => {
  const NativeDate = Date
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00Z'])) } static now() { return new NativeDate(today + 'T12:00:00Z').getTime() } }
  try {
    const props = { allWeeks: weeks, fremgangLogs: logs, currentWeek: weeks[3], exerciseLogs: [],
      a: { id: 'a', user_id: 'u' }, athleteLogs: logs, athleteReadiness: [], profilesLastSeen: {}, currentWeight: null, weeks,
      session: { user: { id: 'c' } } }
    for (const [file, base] of [['FremgangTab.jsx', 'input-233-230-FremgangTab.jsx'], ['EnkelFremgangTab.jsx', 'input-230-227-EnkelFremgangTab.jsx'], ['OversigtTab.jsx', 'input-421-418-OversigtTab.jsx']]) {
      const candidate = (await import('./' + file)).default
      const off = mount(createElement(candidate, props))
      // Worker-only parity oracle. Integrated tests use the final source paths.
      if (existsSync(sourceURL(base))) {
        const pinned = (await import('./' + base)).default
        assert.equal(off.textContent, mount(createElement(pinned, props)).textContent, file)
      }
      assert.equal(find(off, 'data-blok-fremgang').length, 0)
      const on = mount(createElement(candidate, { ...props, blokFremgang: true }))
      assert.equal(find(on, 'data-blok-fremgang').length, 1, file)
      assert.match(on.textContent, /115 kg × 3/, file)
    }
    const Enkel = (await import('./EnkelFremgangTab.jsx')).default
    assert.equal(find(mount(createElement(Enkel, { ...props, blokFremgang: true, enkelDel: 'rekorder' })), 'data-blok-fremgang').length, 0)
    const Fremgang = (await import('./FremgangTab.jsx')).default
    assert.equal(find(mount(createElement(Fremgang, { ...props, blokFremgang: true, fremgangLoading: true })), 'data-blok-fremgang').length, 0)
  } finally { globalThis.Date = NativeDate }
})

test('flag forwarding and imports in exact final files are line ending independent', () => {
  for (const ending of ['\n', '\r\n']) {
    const read = name => readFileSync(sourceURL(name), 'utf8').replace(/\r?\n/g, ending)
    const app = read('App.jsx'), athlete = read('AthleteView.jsx'), coach = read('Dashboard.jsx')
    assert.match(app, /blokFremgang = false/)
    assert.equal((app.match(/blokFremgang: blokFremgang === true/g) || []).length, 3)
    assert.match(athlete, /componentProps=\{[\s\S]*?blokFremgang: blokFremgang === true,[\s\S]*?enkelDel:/)
    assert.match(coach, /lavLaesninger\(\{\s+blokFremgang: blokFremgang === true,/)
    assert.match(coach, /<OversigtTab \{\.\.\.\{\s+blokFremgang: blokFremgang === true,/)
  }
})
