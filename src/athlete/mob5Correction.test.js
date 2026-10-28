import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mob5Loader.mjs'
install(process.argv.includes('--crlf') ? '\r\n' : '\n')
const { coachCatalog, coachNotes, readCoachChoices, saveCoachChoices } = await import('./coachMobility.mjs')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const { FOCUS_LIFTS, FOCUS_NEEDS } = await import('./mobilityFocus.mjs')
const { CoachMobilityEditor, CoachMobilitySummary } = await import('./CoachMobility.jsx')
const { mount, nodes, text, button } = await import('./mob4Dom.mjs')
const athlete = { id: 'synthetic-a', coach_id: 'synthetic-c', notes: 'Fri tekst: ø æ å' }
function clientFor(row) {
  const calls = []
  let notes
  const q = { update(v) { notes = v.notes; calls.push(v); return q }, eq() { return q }, is() { return q },
    select() { return q }, async single() { return { data: { ...row, notes }, error: null } } }
  return { calls, from() { return q } }
}
test('K1: every main lift has three valid exercises and persists through actual save handler', async () => {
  const choices = {}
  for (const lift of FOCUS_LIFTS) {
    const catalog = coachCatalog(lift, WARMUP_BASE)
    assert.ok(catalog.length >= 3, lift)
    choices[lift] = { need: FOCUS_NEEDS[lift][0], ids: catalog.slice(0, 3).map(ex => ex.id) }
  }
  const client = clientFor(athlete)
  const result = await saveCoachChoices({ enabled: true, client, coachId: athlete.coach_id, athlete, choices, library: WARMUP_BASE })
  assert.equal(result.error, null)
  assert.deepEqual(readCoachChoices(true, athlete.id, result.athlete.notes, WARMUP_BASE).choices, choices)
  assert.equal(coachNotes(athlete.id, result.athlete.notes, {}, WARMUP_BASE), athlete.notes)
})
test('K1 DOM: deadlift selection, max three, save and athlete summary use actual imported components', async () => {
  const client = clientFor(athlete)
  let saved
  const app = mount(CoachMobilityEditor, { enabled: true, athlete, coachId: athlete.coach_id, client, onSaved: row => { saved = row } })
  let tree = app.render()
  nodes(tree, n => n.type === 'select')[2].props.onChange({ target: { value: 'Hofteposition' } })
  tree = app.render()
  const catalog = coachCatalog('Dødløft', WARMUP_BASE)
  assert.ok(catalog.length > 3)
  for (const ex of catalog.slice(0, 3)) { button(tree, ex.name).props.onClick(); tree = app.render() }
  assert.equal(button(tree, catalog[3].name).props.disabled, true)
  await button(tree, 'Gem mobilitetsvalg').props.onClick()
  const summary = mount(CoachMobilitySummary, { enabled: true, athleteId: athlete.id, notes: saved.notes }).render()
  assert.match(text(summary), /Valgt af din coach/)
  for (const ex of catalog.slice(0, 3)) assert.ok(text(summary).includes(ex.name))
})
test('K1: visible Danish error messages retain correct characters', async () => {
  assert.equal(readCoachChoices(true, athlete.id, '\n[HARA-MOBILITY-V1]\ninvalid', WARMUP_BASE).error, 'Coachens mobilitetsvalg kunne ikke læses.')
  assert.throws(() => coachNotes(athlete.id, '', { Squat: { need: 'bad', ids: [] } }, WARMUP_BASE), /Vælg gyldigt fokus og højst tre biblioteksøvelser pr. løft/)
  assert.equal((await saveCoachChoices({ enabled: false })).error, 'Mobilitetsvalg er slået fra.')
  assert.equal((await saveCoachChoices({ enabled: true })).error, 'Valget blev ikke gemt. Genindlæs profilen og prøv igen.')
})
test('counter: invalid deadlift ID or foreign lift never reaches transport', async () => {
  const client = { from() { assert.fail('invalid transport') } }
  for (const ids of [['unknown'], ['sq-mob-2'], ['dk-mob-3', 'dk-mob-3']]) {
    assert.ok((await saveCoachChoices({ enabled: true, client, coachId: athlete.coach_id, athlete,
      choices: { Dødløft: { need: 'Hofteposition', ids } }, library: WARMUP_BASE })).error)
  }
})
test('counter: nonboolean flags and foreign athlete cannot reveal coach selections', () => {
  const choices = { Squat: { need: 'Mere dybde', ids: ['sq-mob-2'] } }
  const notes = coachNotes(athlete.id, athlete.notes, choices, WARMUP_BASE)
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(CoachMobilitySummary({ enabled, athleteId: athlete.id, notes }), null)
    assert.equal(CoachMobilityEditor({ enabled, athlete, coachId: athlete.coach_id }), null)
  }
  assert.deepEqual(readCoachChoices(true, 'other', notes, WARMUP_BASE).choices, {})
})
