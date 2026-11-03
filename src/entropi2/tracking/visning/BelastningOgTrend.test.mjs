import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { chartGeometry, isDay, trackingViewModel } from './trackingContract.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: View } = await import('./BelastningOgTrend.mjs')

const day = n => `2026-10-${String(n).padStart(2, '0')}`
function fixture() {
  return {
    version: 1, asOf: day(28),
    load: { state: 'ready', unit: 'sRPE-min', days: [
      { day: day(27), acute: 1200, chronic: 1000 }, { day: day(28), acute: 1250, chronic: 1050 }],
    signal: { level: 'attention', label: 'Stigende belastning', reason: 'Den akutte belastning er steget i de registrerede pas.' } },
    strength: { state: 'ready', exercises: [{ id: 'synthetic-squat', label: 'Testøvelse', trend: 'stable', plateau: true,
      reason: 'Fire sammenlignelige træninger uden fremgang.', days: [
        { day: day(27), e1rmKg: 100 }, { day: day(28), e1rmKg: 100 }] }] },
    nutrition: { state: 'ready', weeks: [7, 14, 21, 28].map(n => ({
      day: day(n), proteinG: n === 14 ? null : 140, proteinGoalG: n === 14 ? null : 160,
      kcal: n === 14 ? null : 2200, kcalGoal: n === 14 ? null : 2400, loggedDays: n === 14 ? 0 : 5,
    })) },
    weight: { state: 'ready', days: [{ day: day(27), kg: null, mean7Kg: 81, samples7: 4 },
      { day: day(28), kg: 80, mean7Kg: 80.8, samples7: 5 }] },
  }
}
function nodes(node) {
  return !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(nodes)]
}
function text(node) {
  if (node == null) return ''
  return typeof node === 'object' ? node.children.map(text).join(' ') : String(node)
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('OFF defaults to null, never touches data, and requires literal true', () => {
  const data = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(View(), null)
  for (const enabled of [false, undefined, null, 1, 'true']) assert.equal(View({ enabled, data }), null)
})

test('actual view renders four domains, upstream reasons, targets and coverage without mutation', () => {
  const data = freeze(fixture()), before = JSON.stringify(data)
  const tree = View({ enabled: true, data }), all = nodes(tree), content = text(tree)
  assert.equal(all.filter(n => n.type === 'h3').length, 4)
  for (const s of ['Belastning og trend', 'Stigende belastning', 'Den akutte belastning', 'Plateau: Ja',
    'Fire sammenlignelige', '140 g/dag', '160 g/dag', '2.200 kcal/dag', '2.400 kcal/dag',
    '2026-10-14: 0/7 dage', '2026-10-28: 5/7 måledage', '80,8 kg', 'Mangler']) assert.ok(content.includes(s), s)
  assert.equal(all.filter(n => n.type === 'svg').length, 5)
  assert.equal(all.filter(n => n.type === 'table').length, 5)
  assert.equal(JSON.stringify(data), before)
})

test('empty, unsupported, missing and independently invalid domains are honest', () => {
  const empty = text(View({ enabled: true }))
  assert.ok(empty.includes('Opgørelsesdato mangler'))
  assert.equal((empty.match(/endnu ingen data/g) || []).length, 4)
  for (const input of [{ version: 2, asOf: day(28) }, { version: 1, asOf: '2026-02-30' }]) {
    assert.equal(trackingViewModel(input).asOf, null)
  }
  const input = fixture(); input.load.days[0].acute = Infinity
  const model = trackingViewModel(input)
  assert.equal(model.load.state, 'invalid'); assert.equal(model.weight.state, 'ready')
  input.load = { state: 'missing' }; assert.equal(trackingViewModel(input).load.state, 'missing')
  for (const key of ['load', 'strength', 'nutrition', 'weight']) {
    const data = fixture(); data[key] = { state: 'ready' }
    assert.equal(trackingViewModel(data)[key].state, 'invalid')
  }
})

test('bad numbers, dates, order, duplicate dates, sparse rows and future rows fail closed', () => {
  for (const value of [-1, NaN, Infinity, '1200', undefined]) {
    const data = fixture(); data.load.days[0].acute = value
    assert.equal(trackingViewModel(data).load.state, 'invalid')
  }
  for (const invalid of ['2026-02-29', '2026-10-29', day(28), '2026-10-25', '2025-10-27']) {
    const data = fixture(); data.load.days[0].day = invalid
    assert.equal(trackingViewModel(data).load.state, 'invalid', invalid)
  }
  assert.equal(isDay('2024-02-29'), true)
  assert.equal(isDay('2026-10-1'), false)
  const data = fixture(); data.nutrition.weeks[1].day = day(15)
  assert.equal(trackingViewModel(data).nutrition.state, 'invalid')
})

test('coverage, plateau and signal semantics cannot be fabricated at the boundary', () => {
  const changes = [
    ['weight', d => { d.days[0].samples7 = 0 }],
    ['weight', d => { d.days[0].samples7 = 8 }],
    ['nutrition', d => { d.weeks[0].loggedDays = 0 }],
    ['nutrition', d => { d.weeks[0].loggedDays = 1.5 }],
    ['strength', d => { d.exercises[0].plateau = 'yes' }],
    ['strength', d => { d.exercises[0].reason = '' }],
    ['strength', d => { d.exercises[0].days = [] }],
    ['strength', d => { d.exercises.push(d.exercises[0]) }],
    ['load', d => { d.signal.reason = '' }],
    ['load', d => { d.signal.level = 'danger' }],
  ]
  for (const [key, change] of changes) {
    const data = fixture(); change(data[key]); assert.equal(trackingViewModel(data)[key].state, 'invalid')
  }
  const data = fixture(); data.strength.exercises[0].plateau = null
  data.strength.exercises[0].trend = 'unknown'
  assert.ok(text(View({ enabled: true, data })).includes('Ukendt trend. Plateau: Ukendt'))
})

test('SVG uses shared scale, real time, visible singleton, and separate paths across nulls', () => {
  const rows = [1, 2, 3].map((n, i) => ({ day: day(n), a: [0, null, 100][i], b: 50 }))
  const graph = chartGeometry(rows, ['a', 'b'])
  assert.equal(graph.min, 0); assert.equal(graph.max, 100)
  assert.equal(graph.paths[0], 'M16.00,80.00 M304.00,16.00')
  assert.equal(graph.paths[1], 'M16.00,48.00 L160.00,48.00 L304.00,48.00')
  const singleton = chartGeometry([{ day: day(1), a: 5 }], ['a'])
  assert.equal(singleton.paths[0], 'M160.00,48.00')
  const empty = chartGeometry([{ day: day(1), a: null }], ['a'])
  assert.equal(empty.min, null); assert.deepEqual(empty.paths, [''])
})

test('accessible structure exposes numeric alternatives and mobile sizing without raw HTML', () => {
  const tree = View({ enabled: true, data: fixture() }), all = nodes(tree)
  for (const svg of all.filter(n => n.type === 'svg')) {
    assert.equal(svg.props.role, 'img'); assert.ok(svg.props['aria-label'])
    assert.equal(svg.props.style.width, '100%')
  }
  assert.equal(all.filter(n => n.type === 'details').length, 5)
  assert.ok(all.filter(n => n.type === 'th').every(n => ['col', 'row'].includes(n.props.scope)))
  assert.ok(all.every(n => !('dangerouslySetInnerHTML' in n.props)))
  assert.ok(all.some(n => n.props.style?.gridTemplateColumns?.includes('min(100%, 290px)')))
  const data = fixture(); data.strength.exercises[0].label = '<script>test</script>'
  assert.ok(nodes(View({ enabled: true, data })).every(n => n.type !== 'script'))
})

test('ready empty series and missing observations never draw invented zeroes', () => {
  const data = fixture(); data.load.days = []; data.strength.exercises = []
  data.nutrition.weeks = []; data.weight.days = []
  const tree = View({ enabled: true, data })
  assert.equal(nodes(tree).filter(n => n.type === 'svg').length, 0)
  assert.ok(text(tree).includes('Ingen registrerede værdier'))
  assert.ok(text(tree).includes('Intet signal leveret'))
})
