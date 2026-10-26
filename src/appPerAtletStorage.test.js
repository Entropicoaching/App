import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { reset, writes } from './appPerAtletFake.mjs'

registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier)) {
    return { url: new URL('./appPerAtletFake.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavAtletHandlinger } = await import('./dashboard/atletHandlinger.js')
const { saveOfflineSnapshot, loadOfflineSnapshot } = await import('./athlete/offlineSnapshot.js')

function store() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
function handlers(editData, selectedAthlete) {
  const observed = { athletes: [selectedAthlete, { id: 'synthetic-b', notes: 'B' }] }
  const noop = () => {}
  const actions = lavAtletHandlinger({
    editData, selectedAthlete, setSaving: noop, setEditing: noop, showFlash: noop,
    setSelectedAthlete: value => { observed.selected = value },
    setAthletes: change => { observed.athletes = change(observed.athletes) },
  })
  return { ...actions, observed }
}

test('gemmehandleren skriver kun den valgte atlet og de redigerede felter', async () => {
  const athlete = { id: 'synthetic-a', notes: 'Coachens note', kcal_target: 2200 }
  reset({ ...athlete, kcal_target: 2400 })
  const { saveEdit, observed } = handlers({ kcal_target: '2400' }, athlete)
  await saveEdit()
  assert.deepEqual(writes, [{ table: 'athletes', payload: { kcal_target: 2400 }, filters: [['id', 'synthetic-a']] }])
  assert.equal(observed.selected.notes, 'Coachens note')
  assert.equal(observed.athletes[1].notes, 'B')
})

test('modproeve: noter er fri tekst og erstattes ved almindelig redigering', async () => {
  const athlete = { id: 'synthetic-a', notes: 'Oprindelig note' }
  reset({ ...athlete, notes: 'Ny note' })
  const { saveEdit } = handlers({ notes: 'Ny note' }, athlete)
  await saveEdit()
  assert.deepEqual(writes[0].payload, { notes: 'Ny note' })
})

test('modproeve: lokalt snapshot synkroniserer ikke mellem coach og atlet', () => {
  const coach = store(), athlete = store()
  assert.equal(saveOfflineSnapshot('synthetic-a', { athlete: { id: 'synthetic-a', notes: 'A' } }, coach, 1), true)
  assert.equal(loadOfflineSnapshot('synthetic-a', athlete), null)
  assert.equal(loadOfflineSnapshot('synthetic-b', coach), null)
  assert.equal(loadOfflineSnapshot('synthetic-a', coach).athlete.notes, 'A')
})

test('modproeve: et lager der afviser skrivning kan ikke bekraefte et gemt valg', () => {
  const unavailable = { getItem() { return null }, setItem() { throw new Error('synthetic storage failure') } }
  assert.equal(saveOfflineSnapshot('synthetic-a', { athlete: { id: 'synthetic-a' } }, unavailable, 1), false)
})

const { DEFAULT_ENKEL_PROTOTYPE, previewNavigation, renderMore, renderControls } = await import('./athlete/enkelPrototype.mjs')

test('egen modproeve: standardflag er fra og navigation bevarer handleridentitet', () => {
  assert.equal(DEFAULT_ENKEL_PROTOTYPE, false)
  const legacy = () => {}
  assert.equal(previewNavigation(DEFAULT_ENKEL_PROTOTYPE, legacy, () => assert.fail('uventet routing')), legacy)
})

test('egen syntetisk DOM: eksisterende kost, mobilitet, staevne og volumen er tilgaengelige', () => {
  const h = (tag, props, ...children) => ({ tag, props, children: children.flat().filter(Boolean) })
  const destinations = []
  const go = destination => destinations.push(destination)
  const more = renderMore(h, { athlete: { competition_date: '2026-11-01' }, go })
  for (const label of ['Kost', 'Mobilitet', 'Stævne']) {
    const button = more.children.find(node => node.children.includes(label))
    assert.equal(button.tag, 'button')
    button.props.onClick()
  }
  const controls = renderControls(h, { route: 'styrke', go })
  const nav = controls.children.find(node => node.tag === 'nav')
  nav.children.find(node => node.children.includes('Volumen')).props.onClick()
  assert.deepEqual(destinations, ['kost', 'mobilisering', 'stævnedag', 'volumen'])
})

test('egen modproeve: snapshot-opdatering bevarer anden bruger og andre felter', () => {
  const storage = store()
  saveOfflineSnapshot('synthetic-a', { athlete: { id: 'synthetic-a' }, historik: ['A'] }, storage, 1)
  saveOfflineSnapshot('synthetic-b', { athlete: { id: 'synthetic-b' } }, storage, 2)
  saveOfflineSnapshot('synthetic-a', { logs: ['log'] }, storage, 3)
  assert.deepEqual(loadOfflineSnapshot('synthetic-b', storage).athlete, { id: 'synthetic-b' })
  assert.deepEqual(loadOfflineSnapshot('synthetic-a', storage).historik, ['A'])
})
