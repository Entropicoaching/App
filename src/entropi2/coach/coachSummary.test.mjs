import test from 'node:test'
import assert from 'node:assert/strict'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { coachHomeModel } from './coachModel.mjs'
const today = '2026-11-03'
function fixture(ids = ['a']) {
  return { session: { user: { id: 'owner' } },
    readContext: { coachId: 'owner', day: today, athleteIds: ids },
    athletes: ids.map(id => ({ id, name: `Atlet ${id}` })),
    coachActionsStatus: { activity: { day: today, state: 'ready', ids, rows: [] } },
    coachMorningData: { messages: { day: today, state: 'ready', ids, rows: [] } },
    latestByTrack: {}, unreadByTrack: {} }
}
const model = p => coachHomeModel(p, today)
const line = p => model(p).summaries[0].text
const log = (p, id = 'a', date = today) => p.coachActionsStatus.activity.rows.push({ athlete_id: id, logged_at: date })
function message(p, id = 'a', date = today, unread = 0, track = 'besked') {
  const row = { athlete_id: id, created_at: date, content: 'Syntetisk besked' }
  p.latestByTrack[id] = { ...p.latestByTrack[id], [track]: row }
  p.unreadByTrack[id] = { ...p.unreadByTrack[id], [track]: unread }
}
function nutrition(p) {
  p.coachNutrition = { coachId: 'owner', day: today, athleteIds: ['a'], from: '2026-10-28', through: today,
    state: 'ready', complete: true, rows: ['2026-10-28', '2026-10-29', '2026-11-02', today]
      .map((date, i) => ({ id: `meal-${i}`, athlete_id: 'a', date, meal: 'Syntetisk', kcal: 2000, protein: 150 })),
    targets: [{ athlete_id: 'a', protein_target: 150, kcal_target: 2000 }] }
}
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] : [n, ...nodes(n.props?.children ?? n.children)]
const text = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.props?.children ?? n.children) : ''
const summaries = p => nodes(CoachView({ ...p, today, enabled: true })).filter(n => n.props?.['data-coach-summary'])

test('no data keeps one named athlete without placeholder parts', () => {
  const p = fixture(); assert.equal(line(p), ''); assert.equal(summaries(p).length, 1)
  assert.equal(text(summaries(p)[0]), 'Atlet a')
})
test('nutrition alone retains exact existing text and protein progress', () => {
  const p = fixture(); nutrition(p)
  assert.equal(line(p), model(p).nutrition.get('a').text)
  assert.match(line(p), /Protein nået 4 af 4 dage$/)
})
test('latest activity only, Danish calendar relative days and skipped logs', () => {
  const p = fixture(); log(p, 'a', '2026-11-01'); message(p, 'a', '2026-11-02')
  assert.equal(line(p), 'Sidste besked i går')
  log(p); assert.equal(line(p), 'Sidste pas i dag')
  p.coachActionsStatus.activity.rows.at(-1).skipped = true
  assert.equal(line(p), 'Sidste besked i går')
  p.latestByTrack = {}; assert.equal(line(p), 'Sidste pas for 2 dage siden')
  p.coachActionsStatus.activity.rows[0].logged_at = '2026-11-02T23:30:00Z'
  assert.equal(line(p), 'Sidste pas i dag')
})
test('combined line includes one activity, exact nutrition and summed unread tracks', () => {
  const p = fixture(); log(p); nutrition(p); message(p, 'a', '2026-11-02', 1); message(p, 'a', today, 2, 'teknik')
  const before = structuredClone(p)
  assert.equal(line(p), `Sidste besked i dag · ${model(p).nutrition.get('a').text} · 3 ulæste beskeder`)
  assert.equal(text(summaries(p)[0]), `Atlet a${line(p)}`)
  assert.deepEqual(p, before)
})
test('unread alone needs usable message evidence; note signal follows existing branch', () => {
  const p = fixture(); message(p, 'a', undefined, 1); p.latestByTrack.a.besked.created_at = undefined
  assert.equal(line(p), '1 ulæst besked')
  p.noteSignalEnabled = true; assert.equal(line(p), '')
  p.pendingByTrack = { a: { besked: { count: 2, latestNote: { athlete_id: 'a' } } } }
  assert.equal(line(p), '2 ulæste beskeder')
  p.inboxRefreshing = true; assert.equal(line(p), '')
})
test('news first then recent activity and stable name/id order without mutating roster', () => {
  const p = fixture(['z', 'b', 'c', 'a']); message(p, 'z', '2026-10-01', 1); log(p, 'b'); log(p, 'c', '2026-11-02')
  assert.deepEqual(model(p).summaries.map(r => r.athlete.id), ['b', 'z', 'c', 'a'])
  assert.deepEqual(p.athletes.map(a => a.id), ['z', 'b', 'c', 'a'])
})
test('stale, foreign, invalid, future, hidden and failed evidence stays silent', () => {
  for (const mutate of [p => { p.readContext.coachId = 'other' }, p => { p.loading = true },
    p => { p.athletes[0].hidden = true }, p => { p.hiddenAthleteIds = new Set(['a']) }]) {
    const p = fixture(); log(p); mutate(p); assert.equal(model(p).summaries.length, 0)
  }
  for (const mutate of [p => { p.coachActionsStatus.activity.day = '2026-11-02' },
    p => { p.coachActionsStatus.activity.rows[0].athlete_id = 'foreign' },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = '2026-11-04' },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = 'bad' }]) {
    const p = fixture(); log(p); mutate(p); assert.equal(line(p), '')
  }
  const p = fixture(); message(p, 'a', today, 1); p.messageInboxError = true; assert.equal(line(p), '')
})
test('rejected nutrition omitted from combined line, activity stays usable', () => {
  for (const mutate of [p => { p.coachNutrition.complete = false }, p => { p.coachNutrition.coachId = 'foreign' },
    p => { p.coachNutrition.rows.pop() }, p => { p.coachNutrition.rows[0].protein = -1 }]) {
    const p = fixture(); nutrition(p); log(p); mutate(p)
    assert.equal(line(p), 'Sidste pas i dag'); assert.equal(model(p).nutrition.size, 0)
  }
})
test('synthetic DOM: semantic keyboard button, named section, wrapping at 375px and profile route', () => {
  const p = fixture(); const calls = []; p.openProfile = (...args) => calls.push(args)
  const tree = CoachView({ ...p, enabled: true, today }); const row = summaries(p)[0]
  assert.equal(row.type, 'button'); assert.equal(row.props.type, 'button'); assert.equal(row.props.disabled, false)
  assert.equal(row.props.style.width, '100%'); assert.equal(row.props.style.boxSizing, 'border-box')
  assert.equal(row.props.style.minWidth, 0); assert.equal(row.props.style.overflowWrap, 'anywhere')
  assert.ok(nodes(tree).some(n => n.props?.['aria-label'] === 'Atletoverblik'))
  assert.match(text(tree), /focus-visible/)
  row.props.onClick(); assert.deepEqual(calls, [[p.athletes[0], 'hub', 'list']])
  assert.equal(summaries(fixture())[0].props.disabled, true)
  assert.equal(nodes(CoachView({ ...p, enabled: true, today, tab: 'inbox' })).filter(n => n.props?.['data-coach-summary']).length, 0)
})
test('OFF does not access data or mount clock hooks', () => {
  const p = { get athletes() { throw Error('OFF access') } }
  assert.equal(CoachScreen(p), null); assert.equal(CoachView(fixture()), null)
})

test('latest timestamp wins within a Danish day across activity kinds', () => {
  const p = fixture(); message(p, 'a', '2026-11-03T08:00:00Z'); log(p, 'a', '2026-11-03T10:00:00Z')
  assert.equal(line(p), 'Sidste pas i dag')
  p.latestByTrack.a.besked.created_at = '2026-11-03T12:00:00Z'
  assert.equal(line(p), 'Sidste besked i dag')
})
