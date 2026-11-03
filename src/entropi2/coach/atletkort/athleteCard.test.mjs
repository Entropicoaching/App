import test from 'node:test'
import assert from 'node:assert/strict'
import { athleteCardModel } from './athleteCardModel.mjs'
import AthleteCard from './AthleteCard.mjs'

const today = '2026-11-03'
const receipt = extra => ({ athleteId: 'synthetic-a', day: today, state: 'ready', complete: true, ...extra })
const points = (before = 81, after = 80.5) => Array.from({ length: 14 }, (_, i) => ({
  day: new Date(Date.parse(today) - (13 - i) * 86400000).toISOString().slice(0, 10), kg: i < 7 ? before : after }))
const fixture = () => ({ today, athlete: { id: 'synthetic-a', name: 'Syntetisk atlet' },
  session: receipt({ lastDay: '2026-11-02' }),
  nutrition: receipt({ from: '2026-10-28', through: today, loggedDays: 4 }),
  weight: receipt({ from: '2026-10-21', through: today, points: points() }),
  messages: receipt({ count: 2 }), signals: receipt({ painReported: false, deviationReported: false }) })
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] :
  [n, ...nodes(n.props?.children)]
const content = n => Array.isArray(n) ? n.map(content).join(' ') : n == null || typeof n === 'boolean' ? '' :
  typeof n === 'object' ? content(n.props?.children) : String(n)
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

test('complete synthetic facts produce all five compact summaries without mutation', () => {
  const facts = freeze(fixture()), before = structuredClone(facts), m = athleteCardModel(facts)
  assert.equal(m.lastSession.text, 'Seneste pas i går')
  assert.equal(m.nutrition.text, 'Kost logget 4/7 dage')
  assert.equal(m.weight.deltaKg, -0.5); assert.deepEqual(m.weight.samples, [7, 7])
  assert.equal(m.messages.count, 2); assert.equal(m.signal.kind, 'unread')
  assert.deepEqual(facts, before)
})

test('missing sources stay unknown; no inactivity or all-clear is inferred', () => {
  const m = athleteCardModel({ today, athlete: { id: 'synthetic-a' } })
  for (const field of ['lastSession', 'nutrition', 'weight', 'messages', 'signal']) assert.equal(m[field].state, 'unknown')
  assert.equal(m.name, 'Atlet')
})

for (const [label, mutate] of Object.entries({
  foreign: s => { s.athleteId = 'synthetic-b' }, stale: s => { s.day = '2026-11-02' },
  partial: s => { s.complete = false }, loading: s => { s.state = 'loading' },
  error: s => { s.state = 'error' }, unconfirmed: s => { delete s.complete },
})) test(`${label} sources cannot supply card facts or signals`, () => {
  const f = fixture()
  for (const key of ['session', 'nutrition', 'weight', 'messages', 'signals']) mutate(f[key])
  f.signals.painReported = true
  const m = athleteCardModel(f)
  for (const key of ['lastSession', 'nutrition', 'weight', 'messages']) assert.equal(m[key].state, label === 'error' ? 'error' : 'unknown')
  assert.equal(m.signal.kind, 'unknown'); assert.equal(m.messages.count, undefined)
})

test('confirmed empty facts remain distinct from missing data', () => {
  const f = fixture(); f.session.lastDay = null; f.nutrition.loggedDays = 0; f.messages.count = 0; f.weight.points = []
  const m = athleteCardModel(f)
  assert.equal(m.lastSession.state, 'empty'); assert.equal(m.nutrition.loggedDays, 0)
  assert.equal(m.messages.text, '0 ulæste beskeder'); assert.equal(m.signal.kind, 'none')
  assert.equal(m.weight.state, 'insufficient')
})

test('session dates are civil, reject malformed/future dates and cross DST safely', () => {
  for (const date of ['2026-02-30', '2026-11-04', '', '2026-11-03T00:00:00Z', undefined]) {
    const f = fixture(); f.session.lastDay = date
    assert.equal(athleteCardModel(f).lastSession.state, 'unknown')
  }
  const f = fixture(); f.session.lastDay = today
  assert.equal(athleteCardModel(f).lastSession.text, 'Seneste pas i dag')
  f.session.lastDay = '2026-10-24'
  assert.equal(athleteCardModel(f).lastSession.text, 'Seneste pas for 10 dage siden')
})

test('nutrition is logging coverage over exactly seven days, never a compliance claim', () => {
  for (const value of [-1, 8, 1.5, NaN, '4', null]) {
    const f = fixture(); f.nutrition.loggedDays = value
    assert.equal(athleteCardModel(f).nutrition.state, 'unknown')
  }
  for (const patch of [{ from: '2026-10-27' }, { through: '2026-11-02' }]) {
    const f = fixture(); Object.assign(f.nutrition, patch)
    assert.equal(athleteCardModel(f).nutrition.state, 'unknown')
  }
})

test('weight compares equally weighted daily values within two adjacent weeks', () => {
  const f = fixture(); f.weight.points = points(80, 81).filter((_, i) => i < 4 || i >= 7)
  f.weight.points.reverse()
  assert.equal(athleteCardModel(f).weight.deltaKg, 1)
  assert.match(athleteCardModel(f).weight.text, /\+1,0 kg/)
  f.weight.points = points(80, 80.01)
  assert.equal(athleteCardModel(f).weight.deltaKg, 0)
  assert.doesNotMatch(athleteCardModel(f).weight.text, /-0,0|\+0,0/)
  f.weight.points.splice(0, 4)
  assert.equal(athleteCardModel(f).weight.state, 'insufficient')
})

test('invalid, duplicate, future and out-of-window weights never yield a trend', () => {
  for (const bad of [null, { day: today, kg: 80 }, { day: '2026-10-20', kg: 80 },
    { day: '2026-11-04', kg: 80 }, { day: '2026-02-30', kg: 80 },
    ...[0, -1, NaN, Infinity, '80', null].map(kg => ({ day: '2026-10-21', kg }))]) {
    const f = fixture(); f.weight.points[0] = bad
    assert.equal(athleteCardModel(f).weight.state, 'unknown')
  }
  const f = fixture(); f.weight.from = '2026-10-22'
  assert.equal(athleteCardModel(f).weight.state, 'unknown')
})

test('unread count is a safe nonnegative integer, with singular wording', () => {
  for (const value of [-1, 0.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1, null]) {
    const f = fixture(); f.messages.count = value
    assert.equal(athleteCardModel(f).messages.state, 'unknown')
  }
  const f = fixture(); f.messages.count = 1
  assert.equal(athleteCardModel(f).messages.text, '1 ulæst besked')
})

test('only explicit active reports outrank unread; unknown report flags are not false', () => {
  const f = fixture(); f.signals.painReported = true; f.signals.deviationReported = true
  assert.equal(athleteCardModel(f).signal.kind, 'pain')
  f.signals.painReported = false
  assert.equal(athleteCardModel(f).signal.kind, 'deviation')
  delete f.signals.deviationReported
  assert.equal(athleteCardModel(f).signal.kind, 'unread')
  f.messages.count = 0
  assert.equal(athleteCardModel(f).signal.kind, 'unknown')
  f.signals.painReported = true
  assert.equal(athleteCardModel(f).signal.kind, 'pain')
})

test('invalid identity and today fail explicitly', () => {
  for (const today of [undefined, '2026-02-30', new Date(), '2026-1-03']) assert.throws(() => athleteCardModel({ ...fixture(), today }), TypeError)
  for (const athlete of [undefined, {}, { id: '' }, { id: ' ' }]) assert.throws(() => athleteCardModel({ ...fixture(), athlete }), TypeError)
})

test('OFF returns before reading hostile facts or callbacks', () => {
  const props = { get facts() { throw Error('OFF facts read') }, get onOpen() { throw Error('OFF callback read') } }
  assert.equal(AthleteCard(props), null)
  Object.defineProperty(props, 'enabled', { value: false })
  assert.equal(AthleteCard(props), null)
})

test('view uses semantic text and a single explicit action with no render-time callback', () => {
  const facts = fixture(), calls = []
  facts.athlete.name = '<script>Syntetisk</script>'
  const tree = AthleteCard({ enabled: true, facts, onOpen: id => calls.push(id) }), all = nodes(tree)
  assert.equal(tree.type, 'article'); assert.match(tree.props['aria-label'], /Syntetisk/)
  assert.equal(all.filter(n => n.type === 'dt').length, 4)
  assert.equal(all.find(n => n.type === 'time').props.dateTime, '2026-11-02')
  assert.match(content(tree), /<script>Syntetisk<\/script>/)
  assert.equal(all.some(n => n.props.dangerouslySetInnerHTML), false)
  assert.deepEqual(calls, [])
  const button = all.find(n => n.type === 'button')
  assert.equal(button.props.type, 'button'); assert.equal(button.props.disabled, false)
  assert.ok(button.props.style.minHeight >= 44)
  button.props.onClick(); assert.deepEqual(calls, ['synthetic-a'])
})

test('unconnected action is disabled; errors remain visible next to their field', () => {
  const facts = fixture(); facts.nutrition.state = 'error'
  const tree = AthleteCard({ enabled: true, facts }), button = nodes(tree).find(n => n.type === 'button')
  assert.equal(button.props.disabled, true); assert.equal(button.props.onClick, undefined)
  assert.match(content(tree), /Koststatus ukendt\s+· Kunne ikke indlæses/)
})
