import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { nutritionWeek, nutritionGoalWeek } from './nutritionWeek.mjs'
import { mount, nodes, text } from './reactFixture.mjs'

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
hooks.deregister()

function fixture(count = 4) {
  return { enabled: true, today: '2026-11-02',
    athlete: { id: 'synthetic-a', kcal_target: 2400, protein_target: 150 },
    weightLogs: [{ logged_at: '2026-11-02', weight: 80 }],
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'] },
    coachNutrition: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'],
      state: 'ready', complete: true, from: '2026-10-27', through: '2026-11-02', targets: [],
      rows: Array.from({ length: count }, (_, i) => ({ id: `synthetic-meal-${i}`,
        athlete_id: 'synthetic-a', date: ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30'][i],
        meal: 'Synthetic meal', kcal: 2400, protein: 150 })) } }
}

const render = p => mount(KostMaal, p).render()
const energyButtons = tree => nodes(tree, n => n.props['aria-label'] === 'Brug forslag til energimål')
for (const [name, change, expected] of [
  ['loading', p => { p.loading = true }, /endnu ikke indlæst/],
  ['missing context', p => { delete p.readContext }, /endnu ikke indlæst/],
  ['missing receipt', p => { delete p.coachNutrition }, /endnu ikke indlæst/],
  ['receipt loading', p => { p.coachNutrition.state = 'loading' }, /endnu ikke indlæst/],
  ['error', p => { p.coachNutrition.state = 'error'; p.coachNutrition.complete = false }, /kunne ikke hentes/],
  ['roster error', p => { p.loadError = true }, /kunne ikke hentes/],
  ['partial', p => { p.coachNutrition.state = 'partial'; p.coachNutrition.complete = false }, /ufuldstændigt/],
  ['incomplete', p => { p.coachNutrition.complete = false }, /ufuldstændigt/],
  ['stale', p => { p.readContext.day = '2026-11-01' }, /ikke tilgængeligt/],
  ['foreign owner', p => { p.session.user.id = 'synthetic-other' }, /ikke tilgængeligt/],
  ['invalid date', p => { p.coachNutrition.rows[0].date = '2026-02-30' }, /ikke tilgængeligt/],
  ['duplicate row', p => { p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0] }) }, /ikke tilgængeligt/],
]) test(`receipt state: ${name} explains unavailable energy, even without a weighing`, () => {
  for (const weightLogs of [[], fixture().weightLogs]) {
    const p = fixture(); p.weightLogs = weightLogs; change(p)
    const before = structuredClone(p), tree = render({ ...p, editing: 'setup' }), out = text(tree)
    assert.match(out, expected)
    assert.doesNotMatch(out, /mindst 4 loggede dage|Typisk indtag:|Seneste 7 dage: gns\.|Seneste 7 dage med nuværende mål:/)
    assert.equal(energyButtons(tree).length, 0)
    assert.deepEqual(p, before)
  }
})

test('complete receipts alone explain genuinely insufficient valid logged days', () => {
  for (const count of [0, 1, 2, 3]) {
    const p = fixture(count)
    assert.match(text(render(p)), /mindst 4 loggede dage/)
  }
})

test('invalid content skips whole meal, not other days, averages or goal counts', () => {
  for (const change of [{ meal: '' }, { meal: null }, { kcal: NaN }, { protein: -1 }]) {
    const p = fixture()
    p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'synthetic-invalid', ...change })
    const before = structuredClone(p), tree = render({ ...p, editing: 'setup' })
    assert.equal(nutritionWeek(p).kcal, 2400)
    assert.equal(nutritionWeek(p).protein, 150)
    assert.equal(nutritionGoalWeek(p).kcal, 4)
    assert.equal(nutritionGoalWeek(p).protein, 4)
    assert.match(text(tree), /Typisk indtag: 2\.400 kcal på 4 loggede dage/)
    assert.equal(energyButtons(tree).length, 1)
    const notes = nodes(tree, n => n.props.role === 'status' && /udeladt/.test(text(n)))
    assert.equal(notes.length, 1)
    assert.equal(text(notes[0]), '1 ugyldigt måltid er udeladt fra kostgrundlaget.')
    assert.deepEqual(p, before)
  }
})

test('invalid-only days do not count and warning remains below display thresholds', () => {
  const p = fixture(2)
  p.coachNutrition.rows.forEach(row => { row.protein = 'invalid' })
  assert.equal(nutritionWeek(p), null)
  assert.equal(nutritionGoalWeek(p).days, 0)
  const tree = render(p)
  assert.match(text(tree), /2 ugyldige måltider er udeladt/)
  assert.match(text(tree), /mindst 4 loggede dage/)
  assert.doesNotMatch(text(tree), /Seneste 7 dage: gns\./)
})

test('bad content for another allowed athlete never hides selected athlete data or adds a warning', () => {
  const p = fixture()
  p.readContext.athleteIds.push('synthetic-b'); p.coachNutrition.athleteIds.push('synthetic-b')
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'synthetic-other-meal',
    athlete_id: 'synthetic-b', kcal: 'invalid' })
  assert.equal(nutritionWeek(p).kcal, 2400)
  assert.equal(nutritionGoalWeek(p).kcal, 4)
  assert.doesNotMatch(text(render(p)), /udeladt/)
  p.athlete = { id: 'synthetic-b' }
  assert.equal(nutritionGoalWeek(p).days, 0)
  assert.match(text(render(p)), /1 ugyldigt måltid er udeladt/)
})

test('metadata is silently excluded, while valid zero and comma values still count', () => {
  const p = fixture(2)
  p.coachNutrition.rows[0].kcal = 0; p.coachNutrition.rows[0].protein = '0,5'
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'synthetic-metadata',
    date: '2026-10-27', meal: ' [appData2-day-v1][]', kcal: NaN })
  assert.equal(nutritionGoalWeek(p).days, 2)
  assert.doesNotMatch(text(render(p)), /udeladt/)
})

test('ready to error to loading to ready removes stale average and energy action', () => {
  const p = { ...fixture(), editing: 'setup' }, view = mount(KostMaal, p)
  assert.equal(energyButtons(view.render()).length, 1)
  for (const state of ['error', 'partial', 'loading']) {
    const tree = view.render({ coachNutrition: { ...p.coachNutrition, state, complete: false } })
    assert.equal(energyButtons(tree).length, 0)
    assert.doesNotMatch(text(tree), /Typisk indtag:|Seneste 7 dage: gns\.|mindst 4 loggede dage/)
  }
  assert.equal(energyButtons(view.render(p)).length, 1)
})
