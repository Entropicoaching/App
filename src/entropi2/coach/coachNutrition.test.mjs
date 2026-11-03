import test from 'node:test'
import assert from 'node:assert/strict'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import { DEFAULT_ENTROPI2_COACH, coachHomeModel } from './coachModel.mjs'

const today = '2026-11-02'
const days = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-11-02']
function fixture() {
  return { session: { user: { id: 'owner-1' } },
    readContext: { coachId: 'owner-1', day: today, athleteIds: ['athlete-1'] },
    athletes: [{ id: 'athlete-1' }], loading: false, loadError: false,
    coachNutrition: { coachId: 'owner-1', day: today, athleteIds: ['athlete-1'],
      from: '2026-10-27', through: today, state: 'ready', complete: true,
      rows: days.map((date, i) => ({ id: `meal-${i}`, athlete_id: 'athlete-1', date,
        meal: 'Syntetisk måltid', kcal: 2000, protein: 100 })),
      targets: [{ athlete_id: 'athlete-1', kcal_target: 2400, protein_target: 150 }] } }
}
const model = (p, day = today) => coachHomeModel(p, day)
const line = p => model(p).nutrition.get('athlete-1')
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...(n.children || []).flatMap(nodes)]
const nutritionNodes = tree => nodes(tree).filter(n => n.props?.['data-coach-nutrition'])

test('four distinct days show daily averages and both targets', () => {
  const value = line(fixture())
  assert.equal(value.days, 4); assert.equal(value.kcal, 2000); assert.equal(value.protein, 100)
  assert.match(value.text, /2000 kcal \/ 100 g protein/)
  assert.equal(value.text, 'Kost · 4/7 dage · Gns. pr. logget dag: 2000 kcal / 100 g protein · Mål: 2400 kcal / 150 g protein · Protein nået 0 af 4 dage')
})
test('all meals sum before dividing by logged days', () => {
  const p = fixture(); p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra', kcal: 400, protein: 20 })
  assert.equal(line(p).kcal, 2100); assert.equal(line(p).protein, 105)
})
test('many meals on only three days stay silent', () => {
  const p = fixture(); p.coachNutrition.rows.pop()
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra' })
  assert.equal(line(p), undefined)
})
test('seven days use seven as denominator', () => {
  const p = fixture()
  for (const date of ['2026-10-30', '2026-10-31', '2026-11-01'])
    p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: date, date })
  assert.equal(line(p).days, 7); assert.equal(line(p).kcal, 2000)
})
test('missing target rows display Ingen mål endnu', () => {
  const p = fixture(); p.coachNutrition.targets = []; assert.match(line(p).text, /Ingen mål endnu$/)
})
for (const value of [undefined, null, '', 0, -1, 'bad', Infinity, false]) test(`missing or invalid goal ${String(value)}`, () => {
  const p = fixture(); p.coachNutrition.targets[0].protein_target = value
  assert.match(line(p).text, /Ingen mål endnu$/)
})
test('decimal strings follow existing app number parser', () => {
  const p = fixture(); p.coachNutrition.rows.forEach(r => { r.kcal = '2000,5'; r.protein = '100.5' })
  assert.equal(line(p).kcal, 2000.5); assert.match(line(p).text, /2001 kcal \/ 101 g/)
})
test('zero nutrient values are valid logged days', () => {
  const p = fixture(); p.coachNutrition.rows.forEach(r => { r.kcal = 0; r.protein = 0 })
  assert.equal(line(p).kcal, 0)
})
const invalid = {
  'absent source': p => { delete p.coachNutrition },
  'wrong owner': p => { p.coachNutrition.coachId = 'owner-2' },
  'wrong session': p => { p.session.user.id = 'owner-2' },
  'stale source': p => { p.coachNutrition.day = '2026-11-01' },
  'stale roster context': p => { p.readContext.day = '2026-11-01' },
  'incomplete receipt': p => { p.coachNutrition.complete = false },
  'missing receipt': p => { delete p.coachNutrition.complete },
  'partial source': p => { p.coachNutrition.state = 'partial' },
  'loading source': p => { p.coachNutrition.state = 'loading' },
  'failed source': p => { p.coachNutrition.state = 'error' },
  'loading roster': p => { p.loading = true },
  'failed roster': p => { p.loadError = true },
  'wrong start boundary': p => { p.coachNutrition.from = '2026-10-26' },
  'wrong end boundary': p => { p.coachNutrition.through = '2026-11-01' },
  'foreign scope id': p => { p.coachNutrition.athleteIds.push('athlete-2') },
  'missing scope id': p => { p.coachNutrition.athleteIds = [] },
  'duplicate scope id': p => { p.coachNutrition.athleteIds.push('athlete-1') },
  'duplicate context id': p => { p.readContext.athleteIds.push('athlete-1') },
  'foreign meal': p => { p.coachNutrition.rows[0].athlete_id = 'athlete-2' },
  'foreign target': p => { p.coachNutrition.targets[0].athlete_id = 'athlete-2' },
  'duplicate target': p => { p.coachNutrition.targets.push(p.coachNutrition.targets[0]) },
  'duplicate meal': p => { p.coachNutrition.rows.push(p.coachNutrition.rows[0]) },
  'missing meal id': p => { delete p.coachNutrition.rows[0].id },
  'invalid date': p => { p.coachNutrition.rows[0].date = '2026-02-30' },
  'timestamp instead of date': p => { p.coachNutrition.rows[0].date = '2026-10-27T23:00:00Z' },
  'outside older boundary': p => { p.coachNutrition.rows[0].date = '2026-10-26' },
  'future meal': p => { p.coachNutrition.rows[0].date = '2026-11-03' },
  'missing kcal': p => { p.coachNutrition.rows[0].kcal = null },
  'missing protein': p => { delete p.coachNutrition.rows[0].protein },
  'negative protein': p => { p.coachNutrition.rows[0].protein = -1 },
  'invalid kcal': p => { p.coachNutrition.rows[0].kcal = NaN },
  'blank meal': p => { p.coachNutrition.rows[0].meal = ' ' },
  'overflow': p => { p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'huge', kcal: Number.MAX_VALUE }); p.coachNutrition.rows[0].kcal = Number.MAX_VALUE },
  'missing rows': p => { delete p.coachNutrition.rows },
  'missing targets': p => { delete p.coachNutrition.targets },
}
for (const [label, mutate] of Object.entries(invalid)) test(`${label} hides the line in model and DOM`, () => {
  const p = fixture(); mutate(p)
  assert.equal(model(p).nutrition.size, 0)
  assert.equal(nutritionNodes(CoachView({ ...p, enabled: true, today })).length, 0)
})
test('confirmation metadata neither adds days nor nutrients', () => {
  const p = fixture(); p.coachNutrition.rows.pop()
  p.coachNutrition.rows.push({ id: 'receipt', athlete_id: 'athlete-1', date: today,
    meal: '[appData2-day-v1][]', kcal: 9999, protein: 9999 })
  assert.equal(line(p), undefined)
})
test('hidden athletes have no nutrition line', () => {
  for (const hide of [p => { p.athletes[0].hidden = true }, p => { p.hiddenAthleteIds = new Set(['athlete-1']) }]) {
    const p = fixture(); hide(p); assert.equal(model(p).nutrition.size, 0)
  }
})
test('multiple athletes stay separate including no-action athletes', () => {
  const p = fixture(); p.athletes.push({ id: 'athlete-2' }); p.readContext.athleteIds.push('athlete-2')
  p.coachNutrition.athleteIds.unshift('athlete-2')
  p.coachNutrition.rows.push(...p.coachNutrition.rows.map(r => ({ ...r, id: r.id + '-2', athlete_id: 'athlete-2', kcal: 1000 })))
  assert.equal(model(p).nutrition.get('athlete-2').kcal, 1000)
  assert.equal(line(p).kcal, 2000)
  assert.equal(model(p).actions.length, 0)
  assert.equal(nutritionNodes(CoachView({ ...p, enabled: true, today })).length, 2)
})
test('one line per athlete only in overview, no inbox duplication', () => {
  const p = fixture()
  assert.equal(nutritionNodes(CoachView({ ...p, enabled: true, today })).length, 1)
  assert.equal(nutritionNodes(CoachView({ ...p, enabled: true, today, tab: 'inbox' })).length, 0)
})
test('Danish day at UTC midnight boundary controls scope', () => {
  assert.equal(model(fixture(), '2026-11-01T23:30:00Z').nutrition.size, 1)
  assert.equal(model(fixture(), '2026-11-01T22:30:00Z').nutrition.size, 0)
})
test('seven calendar days across DST are inclusive', () => {
  const p = fixture(); const day = '2026-10-26'
  p.readContext.day = day; Object.assign(p.coachNutrition, { day, from: '2026-10-20', through: day })
  p.coachNutrition.rows.forEach((r, i) => { r.date = ['2026-10-20', '2026-10-24', '2026-10-25', day][i] })
  assert.equal(model(p, '2026-10-25T23:30:00Z').nutrition.size, 1)
})
test('OFF boundary does not read props, model or start hooks', () => {
  assert.equal(DEFAULT_ENTROPI2_COACH, false)
  const hostile = { get coachNutrition() { throw Error('OFF read') } }
  assert.equal(CoachScreen(hostile), null); assert.equal(CoachView(fixture()), null)
  assert.equal(CoachScreen({ ...fixture(), enabled: 'true' }), null)
})
test('inputs are not mutated and priority/completeness remain unchanged', () => {
  const p = fixture(), before = structuredClone(p), a = model(p)
  const b = model({ ...p, coachNutrition: undefined })
  assert.deepEqual(p, before)
  for (const key of ['actions', 'inbox', 'complete', 'state']) assert.deepEqual(a[key], b[key])
})

// Protein attainment uses validated daily meal sums, before display rounding.
test('all four logged days exactly at the protein goal count as reached', () => {
  const p = fixture(); p.coachNutrition.rows.forEach(r => { r.protein = 150 })
  assert.match(line(p).text, / · Protein nået 4 af 4 dage$/)
})

test('just under target does not count even when display rounds up', () => {
  const p = fixture(); p.coachNutrition.rows.forEach(r => { r.protein = 149.99 })
  assert.equal(line(p).protein, 149.99)
  assert.match(line(p).text, /150 g protein · Mål: .* · Protein nået 0 af 4 dage$/)
})

test('multiple meals count once per logged day and comma decimals compare exactly', () => {
  const p = fixture(); p.coachNutrition.targets[0].protein_target = '150,5'
  p.coachNutrition.rows.forEach((r, i) => { r.protein = ['100,25', '150,49', '150,5', '151'][i] })
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra-protein', protein: '50,25', kcal: 0 })
  assert.match(line(p).text, / · Protein nået 3 af 4 dage$/)
})

test('protein progress does not require a valid calorie target', () => {
  for (const kcal of [undefined, null, 0, -1, 'bad']) {
    const p = fixture(); p.coachNutrition.targets[0].kcal_target = kcal
    assert.match(line(p).text, /Ingen mål endnu · Protein nået 0 af 4 dage$/)
  }
})

test('confirmation on a logged day cannot contribute to protein attainment', () => {
  const p = fixture(); p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'same-day-metadata',
    meal: '  [appData2-day-v1][]', kcal: 9999, protein: 9999 })
  assert.equal(line(p).days, 4); assert.equal(line(p).protein, 100)
  assert.match(line(p).text, / · Protein nået 0 af 4 dage$/)
})

test('all seven days in the window count; inputs stay unchanged', () => {
  const p = fixture()
  for (const date of ['2026-10-30', '2026-10-31', '2026-11-01'])
    p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: date, date, protein: 150 })
  const before = structuredClone(p)
  assert.match(line(p).text, / · Protein nået 3 af 7 dage$/)
  assert.deepEqual(p, before)
})

test('protein days and targets stay within each athlete', () => {
  const p = fixture(); p.athletes.push({ id: 'athlete-2' }); p.readContext.athleteIds.push('athlete-2')
  p.coachNutrition.athleteIds.push('athlete-2')
  p.coachNutrition.rows.push(...p.coachNutrition.rows.map(r => ({ ...r, id: r.id + '-2', athlete_id: 'athlete-2', protein: 200 })))
  p.coachNutrition.targets.push({ athlete_id: 'athlete-2', protein_target: 200, kcal_target: 2400 })
  const nutrition = model(p).nutrition
  assert.match(nutrition.get('athlete-1').text, / · Protein nået 0 af 4 dage$/)
  assert.match(nutrition.get('athlete-2').text, / · Protein nået 4 af 4 dage$/)
})

// Regression: daily decimal sums can sit a few ulps below the exact goal.
for (const { label, meals, target, reached } of [
  { label: '10.1 + 20.2 + 30.3 exactly reaches 60.6', meals: [10.1, 20.2, 30.3], target: 60.6, reached: 4 },
  { label: '0.1 + 0.7 exactly reaches 0.8', meals: [0.1, 0.7], target: 0.8, reached: 4 },
  { label: 'comma text meals exactly reach comma text goal', meals: ['10,1', '20,2', '30,3'], target: '60,6', reached: 4 },
  { label: 'multiple decimal meals remain 0.01 under 60.6', meals: [10.1, 20.2, 30.29], target: 60.6, reached: 0 },
  { label: 'comma text meals remain 0.01 under 150', meals: ['49,99', '50', '50'], target: '150', reached: 0 },
]) test(`daily decimal protein sums: ${label}`, () => {
  const p = fixture()
  p.coachNutrition.targets[0].protein_target = target
  p.coachNutrition.rows = p.coachNutrition.rows.flatMap(row => meals.map((protein, i) => ({
    ...row, id: `${row.id}-decimal-${i}`, protein,
  })))
  const before = structuredClone(p), value = line(p)
  assert.equal(value.days, 4)
  assert.match(value.text, new RegExp(` · Protein nået ${reached} af 4 dage$`))
  assert.deepEqual(p, before)
})
