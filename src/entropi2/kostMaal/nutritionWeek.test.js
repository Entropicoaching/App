import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { nutritionWeek } from './nutritionWeek.mjs'
import { coachNutritionLines } from '../coach/coachNutrition.mjs'
import { mount, nodes, one, text } from './reactFixture.mjs'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const today = '2026-11-02'
const athlete = { id: 'synthetic-1', kcal_target: 2400, protein_target: 160, bodyweight: 80 }
function fixture(count = 3) {
  return { enabled: true, athlete: { ...athlete }, today,
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id] },
    coachNutrition: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id],
      from: '2026-10-27', through: today, state: 'ready', complete: true, targets: [],
      rows: Array.from({ length: count }, (_, i) => ({ id: `meal-${i}`, athlete_id: athlete.id,
        date: new Date(Date.parse(today + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10),
        meal: 'Synthetic meal', kcal: 2430, protein: 152 })) } }
}
const render = props => mount(KostMaal, props).render()
const coach = p => coachNutritionLines(p, p.today, [p.athlete], true).get(p.athlete.id)

test('missing data and fewer than three distinct logged days stay hidden', () => {
  assert.equal(nutritionWeek(), null)
  for (const count of [0, 1, 2]) {
    const p = fixture(count)
    if (count) p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra' })
    assert.equal(nutritionWeek(p), null)
    assert.doesNotMatch(text(render(p)), /Seneste 7 dage: gns\./)
  }
  const p = fixture(); delete p.coachNutrition
  assert.equal(nutritionWeek(p), null)
})

test('exactly three days render a neutral whole-number line next to existing goals', () => {
  const p = fixture(), before = structuredClone(p), tree = render(p), content = text(tree)
  assert.equal(nutritionWeek(p).text, 'Seneste 7 dage: gns. 2.430 kcal / 152 g protein (3 loggede dage)')
  const line = one(tree, 'p', nutritionWeek(p).text)
  assert.equal(line.props.style, undefined); assert.equal(line.props.role, undefined)
  assert.ok(content.indexOf('Seneste 7 dage:') > content.indexOf('Protein'))
  assert.ok(content.indexOf('Seneste 7 dage:') < content.indexOf('Rediger'))
  assert.match(content, /Forslag:/)
  assert.deepEqual(p, before)
  assert.equal(coach(p), undefined) // intentional threshold difference
})

test('daily sums divide by logged days, never number of meals or seven', () => {
  const p = fixture(4)
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra', kcal: 400, protein: 20 })
  const result = nutritionWeek(p)
  assert.equal(result.days, 4); assert.equal(result.kcal, 2530); assert.equal(result.protein, 157)
  for (const key of ['days', 'kcal', 'protein']) assert.equal(result[key], coach(p)[key])
})

test('appData2 metadata contributes neither a day nor nutrients', () => {
  const p = fixture(2)
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'metadata', date: '2026-10-27',
    meal: '  [appData2-day-v1][]', kcal: NaN, protein: undefined })
  assert.equal(nutritionWeek(p), null)
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'third-day', date: '2026-10-28' })
  assert.equal(nutritionWeek(p).days, 3); assert.equal(nutritionWeek(p).kcal, 2430)
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[2], id: 'same-day-metadata', date: today })
  assert.equal(nutritionWeek(p).protein, 152)
})

test('day seven is inclusive; day eight and future invalidate the batch as in coachNutrition', () => {
  const p = fixture(7)
  assert.equal(nutritionWeek(p).days, 7)
  assert.equal(nutritionWeek(p).kcal, coach(p).kcal)
  for (const date of ['2026-10-26', '2026-11-03']) {
    const q = fixture(4); q.coachNutrition.rows[0].date = date
    assert.equal(nutritionWeek(q), null); assert.equal(coach(q), undefined)
  }
})

test('zero, comma decimals and numeric syntax use the existing nutrition parser', () => {
  for (const [kcal, protein, expectedKcal, expectedProtein] of [
    ['2430,5', '152,5', 2430.5, 152.5], [0, 0, 0, 0], ['+2e3', '.5', 2000, 0.5],
  ]) {
    const p = fixture(4); p.coachNutrition.rows.forEach(r => Object.assign(r, { kcal, protein }))
    const result = nutritionWeek(p)
    assert.equal(result.kcal, expectedKcal); assert.equal(result.protein, expectedProtein)
    assert.equal(result.kcal, coach(p).kcal); assert.equal(result.protein, coach(p).protein)
  }
  const p = fixture(); p.coachNutrition.rows.forEach(r => { r.kcal = '2430,5'; r.protein = '152,5' })
  assert.match(nutritionWeek(p).text, /2\.431 kcal \/ 153 g protein/)
})

const invalidRows = [null, { id: '' }, { athlete_id: 'foreign' }, { date: '2026-02-30' },
  { date: '2026-11-01T23:30:00Z' }, { meal: '' }, { meal: '  ' }, { meal: null },
  { kcal: NaN }, { kcal: Infinity }, { kcal: null }, { kcal: '12oops' },
  { protein: undefined }, { protein: -1 }, { protein: true }, { protein: {} }]
for (const [i, change] of invalidRows.entries()) test(`invalid row ${i} silences the entire batch like coachNutrition`, () => {
  const p = fixture(4)
  p.coachNutrition.rows[0] = change === null ? null : { ...p.coachNutrition.rows[0], ...change }
  assert.equal(nutritionWeek(p), null); assert.equal(coach(p), undefined)
})

test('duplicates and numeric overflow never produce a misleading average', () => {
  const p = fixture(4); p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0] })
  assert.equal(nutritionWeek(p), null); assert.equal(coach(p), undefined)
  for (const sameDay of [false, true]) {
    const q = fixture(4)
    q.coachNutrition.rows.forEach(r => { r.kcal = Number.MAX_VALUE; if (sameDay) r.date = today })
    assert.equal(nutritionWeek(q), null); assert.equal(coach(q), undefined)
  }
})

const invalidReceipts = [
  p => { delete p.session }, p => { delete p.readContext }, p => { p.today = '2026-02-30' },
  p => { p.coachNutrition.coachId = 'foreign' }, p => { p.readContext.day = '2026-11-01' },
  p => { p.coachNutrition.day = '2026-11-01' }, p => { p.coachNutrition.from = '2026-10-26' },
  p => { p.coachNutrition.through = '2026-11-01' }, p => { p.coachNutrition.complete = false },
  p => { p.coachNutrition.state = 'partial' }, p => { p.coachNutrition.rows = null },
  p => { p.coachNutrition.athleteIds = [] }, p => { p.readContext.athleteIds.push(athlete.id) },
  p => { p.coachNutrition.athleteIds.push(athlete.id) }, p => { p.coachNutrition.targets = null },
  p => { p.coachNutrition.targets = [{ athlete_id: 'foreign' }] },
  p => { p.coachNutrition.targets = [{ athlete_id: athlete.id }, { athlete_id: athlete.id }] },
]
for (const [i, invalidate] of invalidReceipts.entries()) test(`invalid receipt ${i} stays silent`, () => {
  const p = fixture(4); invalidate(p)
  assert.equal(nutritionWeek(p), null); assert.equal(coach(p), undefined)
})

test('loading, failed roster and athlete switching cannot show stale data', () => {
  for (const change of [{ loading: true }, { loadError: true }, { athlete: { id: 'foreign' } }])
    assert.equal(nutritionWeek({ ...fixture(), ...change }), null)
  const p = fixture(), view = mount(KostMaal, p)
  assert.match(text(view.render()), /Seneste 7 dage: gns\./)
  assert.doesNotMatch(text(view.render({ athlete: { id: 'foreign' } })), /Seneste 7 dage: gns\./)
})

test('other in-scope athletes never contribute to the selected athlete average', () => {
  const p = fixture(4)
  p.readContext.athleteIds.push('synthetic-2'); p.coachNutrition.athleteIds.push('synthetic-2')
  p.coachNutrition.rows.push(...p.coachNutrition.rows.map(r => ({ ...r, id: r.id + '-2', athlete_id: 'synthetic-2', kcal: 1 })))
  assert.equal(nutritionWeek(p).kcal, 2430)
  p.athlete = { id: 'synthetic-2' }; assert.equal(nutritionWeek(p).kcal, 1)
})

test('calendar week spans DST without timestamp normalization of meal dates', () => {
  const p = fixture(7); p.today = '2026-10-26'; p.readContext.day = p.today
  Object.assign(p.coachNutrition, { day: p.today, from: '2026-10-20', through: p.today })
  p.coachNutrition.rows.forEach((r, i) => { r.date = `2026-10-${20 + i}` })
  assert.equal(nutritionWeek(p).days, 7); assert.equal(nutritionWeek(p).kcal, coach(p).kcal)
})

test('OFF and non-boolean opt-in inspect only enabled even with hostile new data', () => {
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    const props = new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') throw Error('OFF data read')
      return target.enabled
    } })
    assert.equal(KostMaal(props), null)
  }
})

test('week line does not change controlled target edits or call saver', () => {
  let calls = 0, props = { ...fixture(), editing: 'setup', editData: { kcal_target: '2500', protein_target: '160' },
    startEdit() {}, setEditing() {}, saveEdit() { calls++ } }
  props.setEditData = update => { props.editData = update(props.editData) }
  const before = structuredClone(props.athlete), tree = render(props)
  one(tree, 'button', 'Brug forslag').props.onClick()
  assert.deepEqual(props.editData, { kcal_target: '2500', protein_target: 155 })
  assert.deepEqual(props.athlete, before); assert.equal(calls, 0)
  assert.equal(nodes(tree, n => n.type === 'input').length, 2)
})

test('source check is newline agnostic and keeps the OFF boundary before the hooked editor', () => {
  const source = readFileSync(new URL('./KostMaal.mjs', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
  assert.ok(source.indexOf('if (props.enabled !== true) return null') < source.indexOf('return h(EnabledKostMaal'))
})
