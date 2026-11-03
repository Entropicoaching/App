import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { energySuggestion } from './energySuggestion.mjs'
import { kostMaalModel, proteinSuggestion, validTargetDraft } from './model.mjs'
import { nutritionWeek } from './nutritionWeek.mjs'
import { mount, nodes, one, text } from './reactFixture.mjs'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const today = '2026-11-02'
function fixture(count = 4) {
  const athlete = { id: 'synthetic-athlete', bodyweight: 90, kcal_target: 2200, protein_target: 160 }
  return { enabled: true, athlete, today, weightLogs: [
    { logged_at: '2026-11-01', weight: 80 }, { logged_at: today, weight: '82,5' }],
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id] },
    coachNutrition: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id],
      from: '2026-10-27', through: today, state: 'ready', complete: true, targets: [],
      rows: Array.from({ length: count }, (_, i) => ({ id: `meal-${i}`, athlete_id: athlete.id,
        date: new Date(Date.parse(today + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10),
        meal: 'Synthetic meal', kcal: '2450,4', protein: 150 })) } }
}
const energy = p => energySuggestion(kostMaalModel(p), nutritionWeek(p))
const energyButtons = tree => nodes(tree, n => n.type === 'button' && n.props['aria-label'] === 'Brug forslag til energimål')
function editor(extra = {}) {
  let saves = 0, writes = 0
  const props = { ...fixture(), editing: 'setup', editData: { kcal_target: '2200', protein_target: '160', extra: 'retained' },
    startEdit() {}, setEditing(value) { props.editing = value }, saveEdit() { saves++ }, ...extra }
  props.setEditData = update => { writes++; props.editData = update(props.editData) }
  const view = mount(KostMaal, props)
  return { props, render: () => view.render(props), counts: () => ({ saves, writes }) }
}

for (const count of [0, 3, 4, 7]) test(`energy threshold at ${count} distinct logged days`, () => {
  const p = fixture(count), before = structuredClone(p), result = energy(p)
  assert.equal(result.kcal, count >= 4 ? 2450 : null)
  const tree = mount(KostMaal, { ...p, editing: 'setup' }).render()
  assert.equal(energyButtons(tree).length, count >= 4 ? 1 : 0)
  if (count >= 4) assert.match(text(tree), new RegExp(`Typisk indtag: 2\\.450 kcal på ${count} loggede dage`))
  else assert.match(text(tree), /mindst 4 loggede dage/)
  assert.deepEqual(p, before)
})

test('energy uses latest weight rather than mean or profile; intake divides by logged days', () => {
  const p = fixture()
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'extra-meal', kcal: 400 })
  assert.equal(energy(p).kcal, 2550)
  assert.match(energy(p).text, /Seneste vejning: 82,5 kg/)
  assert.notEqual(kostMaalModel(p).average, 82.5)
  assert.ok(validTargetDraft({ kcal_target: energy(p).kcal }))
  assert.deepEqual(proteinSuggestion(kostMaalModel(p)), { weight: 81.25, min: 130, max: 180, midpoint: 155 })
})

test('multiple meals and metadata never manufacture four logged days', () => {
  const p = fixture(3)
  p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'second-meal' },
    { ...p.coachNutrition.rows[0], id: 'metadata', date: '2026-10-27', meal: '[appData2-day-v1][]', kcal: NaN })
  assert.equal(energy(p).kcal, null)
})

test('no latest weighing means explanation even with profile weight', () => {
  for (const weightLogs of [[], [{ logged_at: today, weight: NaN }], [{ logged_at: today, weight: -1 }]]) {
    const p = { ...fixture(), weightLogs }
    assert.equal(energy(p).kcal, null)
    assert.match(energy(p).text, /gyldig vejning/)
    assert.equal(energyButtons(mount(KostMaal, p).render()).length, 0)
  }
})

test('invalid or nonpositive intake cannot produce an energy draft', () => {
  for (const kcal of [NaN, Infinity, -1, 0, '', 'tekst', '2450,4kcal', null, true, 2147483648]) {
    const p = fixture(); p.coachNutrition.rows.forEach(row => { row.kcal = kcal })
    assert.equal(energy(p).kcal, null, String(kcal))
    assert.equal(energyButtons(mount(KostMaal, { ...p, editing: 'setup' }).render()).length, 0)
  }
  assert.equal(energySuggestion({ latest: { weight: NaN } }, { days: 4, kcal: 2450 }).kcal, null)
  assert.equal(energySuggestion({ latest: { weight: 80 } }, { days: NaN, kcal: 2450 }).kcal, null)
})

test('bad receipt, foreign athlete, loading and failed data do not offer stale energy', () => {
  for (const change of [p => { p.loading = true }, p => { p.loadError = true },
    p => { p.athlete = { id: 'foreign' } }, p => { p.coachNutrition.complete = false },
    p => { p.coachNutrition.rows[0].kcal = NaN }, p => { p.readContext.day = '2026-11-01' }]) {
    const p = fixture(); change(p); assert.equal(energy(p).kcal, null)
  }
})

test('energy button changes only energy draft, leaves protein and athlete intact, saves nothing', () => {
  const e = editor(), before = structuredClone(e.props.athlete), tree = e.render()
  const buttons = energyButtons(tree); assert.equal(buttons.length, 1)
  assert.equal(buttons[0].props.type, 'button'); buttons[0].props.onClick()
  assert.deepEqual(e.props.editData, { kcal_target: 2450, protein_target: '160', extra: 'retained' })
  assert.equal(one(e.render(), 'input', 'kcal_target').props.value, 2450)
  assert.deepEqual(e.counts(), { saves: 0, writes: 1 }); assert.deepEqual(e.props.athlete, before)
  const protein = nodes(e.render(), n => n.type === 'button' && text(n) === 'Brug forslag' && !n.props['aria-label'])[0]
  protein.props.onClick()
  assert.equal(e.props.editData.protein_target, 155); assert.equal(e.props.editData.kcal_target, 2450)
  e.props.setEditing(null); assert.equal(energyButtons(e.render()).length, 0)
})

test('energy respects saving, disconnected editor, read view and pending synchronous save', async () => {
  for (const extra of [{ saving: true }, { saveEdit: undefined }]) {
    const e = editor(extra), b = energyButtons(e.render())[0]
    assert.equal(b.props.disabled, true); b.props.onClick(); assert.equal(e.counts().writes, 0)
  }
  const read = editor({ editing: null }); assert.equal(energyButtons(read.render()).length, 0)
  let finish
  const e = editor({ saveEdit: () => new Promise(resolve => { finish = resolve }) }), tree = e.render()
  const stale = energyButtons(tree)[0].props.onClick
  const task = one(tree, 'form').props.onSubmit({ preventDefault() {} })
  stale(); assert.equal(e.counts().writes, 0)
  assert.equal(energyButtons(e.render())[0].props.disabled, true)
  finish(false); await task
  energyButtons(e.render())[0].props.onClick(); assert.equal(e.props.editData.kcal_target, 2450)
  assert.doesNotMatch(text(e.render()), /ikke gemt/)
})

test('OFF with complete intake still touches no data', () => {
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(KostMaal(new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') throw Error('OFF read')
      return target.enabled
    } })), null)
  }
})
