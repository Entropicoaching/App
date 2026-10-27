import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './coachFourWeeksLoader.mjs'
install()
const { buildFourWeeks, fourWeekRpe, readFourWeekSource, reduceFourWeekRead } = await import('./coachFourWeeks.mjs')
const { default: CoachFourWeeks } = await import('./CoachFourWeeks.jsx')
const { mount, nodes, text, button } = await import('./coachFourWeeksDom.mjs')
const { lavLaesninger } = await import('./laesninger.js')
const { useDashboardEffekter } = await import('./useDashboardEffekter.js')
const fake = await import('./coachFourWeeksFake.mjs')
const today = '2026-10-27'
const ready = (rows, athleteId = 'a') => ({ status: 'ready', athleteId, rows })
const plan = { id: 'w', athlete_id: 'a', start_date: '2026-10-26', week_number: 3, sessions: [{ id: 's', title: 'Mandag', athlete_comment: 'Godt pas', exercises: [{ id: 'e', name: 'Squat', sets: 3, reps: '5', intensity: 'RPE 8' }] }] }
const log = { id: 'l', athlete_id: 'a', logged_at: '2026-10-26T23:30:00Z', exercise_id: 'e', set_number: 1, weight: 100, reps_completed: 5, rpe_actual: 9, exercises: { name: 'Squat', intensity: 'RPE 8' }, note: 'Holdt pause' }
const video = { id: 'v', created_at: '2026-10-26', lift: 'Squat', status: 'shared', video_path: 'synthetic-only' }
const reads = { weeks: ready([plan]), logs: ready([log]), videos: ready([video]) }

test('four calendar weeks, Danish midnight, plans, logged sets and RPE', () => {
  const before = JSON.stringify(reads)
  const model = buildFourWeeks({ athleteId: 'a', reads, today })
  assert.equal(model.days, 28); assert.equal(model.start, '2026-10-05'); assert.equal(model.end, '2026-11-01')
  assert.equal(model.weeks[0].plannedSets, 3); assert.equal(model.weeks[0].completed, 1)
  assert.equal(model.weeks[0].logs[0].day, today); assert.equal(model.weeks[0].logs[0].delta, 1)
  assert.equal(model.weeks[0].notes.length, 2); assert.equal(model.weeks[0].videos[0].id, 'v')
  assert.equal(JSON.stringify(reads), before)
})

test('DOM imports actual component, notes are text, video handler receives exact item', () => {
  let opened
  const attack = '<img src=x onerror=alert(1)>'
  const props = { athlete: { id: 'a', name: 'Syntetisk A' }, reads: { ...reads, logs: ready([{ ...log, note: attack }]) }, today, onOpenVideo: item => { opened = item } }
  const tree = mount(CoachFourWeeks, props).render()
  assert.equal(nodes(tree, n => n.type === 'article').length, 4)
  for (const expected of ['3 planlagte sæt', '1 loggede sæt', 'RPE-afvigelse +1', 'Godt pas', attack, 'Delt']) assert.ok(text(tree).includes(expected), expected)
  assert.equal(nodes(tree, n => n.type === 'img' || n.props.dangerouslySetInnerHTML).length, 0)
  button(tree, 'Åbn videoanalyse').props.onClick()
  assert.equal(opened.id, video.id); assert.equal(opened.video_path, video.video_path)
})

test('counterprobe: boundaries, future entries, malformed dates, skipped sets and foreign owner', () => {
  const candidates = [
    { ...log, id: 'first', logged_at: '2026-10-05' },
    { ...log, id: 'old', logged_at: '2026-10-04' },
    { ...log, id: 'future', logged_at: '2026-10-28' },
    { ...log, id: 'bad', logged_at: '2026-02-30' },
    { ...log, id: 'foreign', athlete_id: 'b' },
    { ...log, id: 'skip', skipped: true },
  ]
  const model = buildFourWeeks({ athleteId: 'a', today, reads: { ...reads, logs: ready(candidates), weeks: ready([{ ...plan, start_date: null }, { ...plan, start_date: '2026-11-02' }]) } })
  assert.deepEqual(model.weeks.flatMap(w => w.logs.map(l => l.id)).sort(), ['first', 'skip'])
  assert.equal(model.weeks[0].completed, 0); assert.equal(model.weeks[0].skipped, 1)
  assert.equal(model.undated, 1); assert.equal(model.weeks[0].plannedSets, 0)
  assert.equal(fourWeekRpe({ ...log, skipped: true }), null)
  assert.equal(fourWeekRpe({ ...log, rpe_actual: null }), null)
  assert.equal(fourWeekRpe({ ...log, rpe_planned: '7,5' }), 1.5)
  assert.equal(fourWeekRpe({ ...log, rpe_actual: 11 }), null)
})

test('counterprobe: profile switch cannot display unowned videos or previous notes', () => {
  const tree = mount(CoachFourWeeks, { athlete: { id: 'b', name: 'Syntetisk B' }, reads, today }).render()
  assert.ok(!text(tree).includes('Godt pas')); assert.ok(!text(tree).includes('Holdt pause'))
  assert.equal(nodes(tree, n => n.type === 'button').length, 0)
  assert.equal(nodes(tree, n => n.props.role === 'status').length, 3)
})

test('capture latest request wins, errors and rejection remain visible, OFF is transparent', async () => {
  let state = {}; const capture = event => { state = reduceFourWeekRead(state, event) }
  let finish
  const slow = readFourWeekSource(capture, 'logs', 'a', () => new Promise(resolve => { finish = resolve }))
  await readFourWeekSource(capture, 'logs', 'a', async () => ({ data: [log] }))
  finish({ data: [{ id: 'stale' }] }); await slow
  assert.equal(state.a.logs.rows[0].id, 'l')
  await readFourWeekSource(capture, 'videos', 'b', async () => ({ error: { message: 'synthetic' }, data: [video] }))
  assert.equal(state.b.videos.status, 'error'); assert.deepEqual(state.b.videos.rows, [])
  await assert.rejects(readFourWeekSource(capture, 'weeks', 'a', async () => { throw Error('synthetic') }))
  assert.equal(state.a.weeks.status, 'error')
  const result = { data: [plan] }; assert.equal(await readFourWeekSource(undefined, 'weeks', 'a', async () => result), result)
})

test('actual read handlers use unchanged queries, snapshot each source and fail honestly', async () => {
  fake.calls.length = 0; fake.pending.length = 0
  let state = {}; let storedWeeks; let storedLogs
  const fn = () => {}
  const handlers = lavLaesninger({ fourWeekCapture: e => { state = reduceFourWeekRead(state, e) }, setWeeks: x => { storedWeeks = x }, setAthleteLogs: x => { storedLogs = x }, setVideoAnalysisLoading: fn, setVideoAnalysisError: fn, setVideoAnalyses: fn, setVideoBaselines: fn })
  fake.pending.push({ data: [plan] }); await handlers.fetchWeeks('a')
  fake.pending.push({ data: [log] }); await handlers.fetchAthleteLogs('a')
  fake.pending.push({ data: [video] }, { data: [] }); await handlers.fetchVideoCoachHistory('a')
  assert.equal(storedWeeks[0].id, 'w'); assert.equal(storedLogs[0].id, 'l')
  assert.deepEqual(fake.calls.map(c => c.table), ['weeks', 'exercise_logs', 'video_analyses', 'athlete_baselines_v3'])
  for (const call of fake.calls) assert.ok(call.steps.some(s => s[0] === 'eq' && s[1] === 'athlete_id' && s[2] === 'a'))
  assert.equal(state.a.videos.rows[0].id, 'v')
  fake.pending.push({ error: { message: 'synthetic' }, data: null }); await handlers.fetchAthleteLogs('a')
  assert.equal(state.a.logs.status, 'error')
})

test('actual effect opts in video data on overview; default OFF adds no requests', () => {
  for (const enabled of [undefined, false, 'true', true]) {
    fake.effects.length = 0; const called = []
    useDashboardEffekter({ activeTab: 'oversigt', selectedAthlete: { id: 'a' }, coachFourWeeksEnabled: enabled, fetchVideoCoachHistory: id => called.push(id) })
    const effect = fake.effects.find(e => e.fn.toString().includes('fetchVideoCoachHistory(selectedAthlete.id)'))
    effect.fn(); assert.deepEqual(called, enabled === true ? ['a'] : [])
  }
})

test('Dashboard imports and compiles actual final JSX; strict OFF wiring and baseline line endings', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const base = new URL('./', import.meta.url)
  const flat = existsSync(new URL('Dashboard.jsx', base))
  const path = new URL(flat ? 'Dashboard.jsx' : '../Dashboard.jsx', base)
  const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /coachFourWeeksEnabled = COACH_FOUR_WEEKS_ENABLED/)
  assert.match(source, /coachFourWeeksEnabled === true && <CoachFourWeeks athlete=\{a\} reads=\{fourWeekReads\[a.id\]\}/)
  assert.match(source, /fourWeekCapture,/)
  assert.equal(typeof (await import(path.href)).default, 'function')
  assert.ok(fake.calls.find(c => c.table === 'exercise_logs').steps.some(s => s[0] === 'limit' && s[1] === 2000))
})

test('actual Dashboard renders overview with strict flag and preserves OFF DOM', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const base = new URL('./', import.meta.url)
  const path = new URL(existsSync(new URL('Dashboard.jsx', base)) ? 'Dashboard.jsx' : '../Dashboard.jsx', base)
  const { default: Dashboard } = await import(path.href)
  const source = readFileSync(path, 'utf8')
  const hooks = [...source.matchAll(/const (?:\[([^\]]+)\]|(\w+)) = use(?:State|Ref)\(/g)].map(m => (m[1] || m[2]).split(',')[0])
  const values = []
  for (const [name, value] of Object.entries({ view: 'profile', selectedAthlete: { id: 'a', name: 'Syntetisk A' }, activeTab: 'oversigt', fourWeekReads: { a: reads } })) {
    const index = hooks.indexOf(name); assert.ok(index >= 0, name); values[index] = value
  }
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => null }
  try {
    const render = flag => mount(Dashboard, { session: { user: { id: 'synthetic-coach' } }, programCopyEnabled: false, coachFourWeeksEnabled: flag }, values).render()
    const off = render(undefined)
    assert.deepEqual(render(false), off); assert.deepEqual(render('true'), off)
    assert.equal(nodes(off, n => n.props['aria-label'] === 'De seneste fire uger').length, 0)
    assert.equal(nodes(render(true), n => n.props['aria-label'] === 'De seneste fire uger').length, 1)
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})
