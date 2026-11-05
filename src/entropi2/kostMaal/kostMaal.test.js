import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { kostMaalModel, civilDay, loggedDay, positive, validTargetDraft, proteinSuggestion } from './model.mjs'
import { mount, nodes, one, text } from './reactFixture.mjs'

const local = new URL('./', import.meta.url).href
const publicRoot = existsSync(new URL('../../../copied-public/src/dashboard/atletHandlinger.js', import.meta.url))
  ? new URL('../../../copied-public/src/', import.meta.url) : new URL('../../', import.meta.url)
const syntheticCalls = [], responses = []
const client = { from(table) {
  const call = { table, operations: [] }; syntheticCalls.push(call)
  const chain = Object.fromEntries(['update', 'eq', 'select'].map(method => [method, (...args) => { call.operations.push([method, ...args]); return chain }]))
  chain.single = async () => responses.shift() ?? { data: null, error: { message: 'synthetic failure' } }
  return chain
} }
// This is the only intercepted application dependency. No real client is loaded.
globalThis.__kostMaalSyntheticClient = client
const clientSource = 'export const supabase = globalThis.__kostMaalSyntheticClient'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(local)) return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier === '../supabase' && context.parentURL === new URL('dashboard/atletHandlinger.js', publicRoot).href) return { url: 'data:text/javascript,' + encodeURIComponent(clientSource), shortCircuit: true }
  if (specifier.startsWith('.') && context.parentURL?.startsWith(publicRoot.href)) {
    const url = new URL(specifier, context.parentURL)
    if (!existsSync(url) && existsSync(fileURLToPath(url) + '.js')) return next(url.href + '.js', context)
  }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const { lavAtletHandlinger } = await import(new URL('dashboard/atletHandlinger.js', publicRoot))
const { lavNavigation } = await import(new URL('dashboard/navigation.js', publicRoot))
delete globalThis.__kostMaalSyntheticClient
const athlete = { id: 'synthetic-1', kcal_target: 2400, protein_target: 160, bodyweight: 80 }
const today = '2026-11-02'
const event = { preventDefault() {} }
const model = (weightLogs, extra = {}) => kostMaalModel({ athlete, today, weightLogs, ...extra })
const row = (logged_at, weight, extra = {}) => ({ logged_at, weight, ...extra })

test('OFF and non-boolean opt-in do not inspect data or call editor', () => {
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    const props = { enabled, get athlete() { throw Error('OFF read') }, get weightLogs() { throw Error('OFF read') } }
    assert.equal(KostMaal(props), null)
  }
})

test('goals are independent; missing and invalid values never display zero', () => {
  for (const value of [null, undefined, '', ' ', 0, '0', -1, NaN, Infinity, true, {}, '1oops', 0.01, 2.5, 2147483648]) {
    const m = model([], { athlete: { ...athlete, kcal_target: value } })
    assert.equal(m.kcal, null); assert.equal(m.protein, 160)
    const tree = mount(KostMaal, { enabled: true, athlete: { ...athlete, kcal_target: value }, today }).render()
    assert.match(text(tree), /160 g/); assert.doesNotMatch(text(tree), /Ingen mål endnu|Energi/); assert.doesNotMatch(text(tree), /Ikke sat|ukendt|0 kcal/)
  }
  assert.equal(positive('80,5'), 80.5)
  const extremes = Array.from({ length: 7 }, (_,i) => row(new Date(Date.parse(today + 'T00:00:00Z') - i * 86400000).toISOString().slice(0,10), Number.MAX_VALUE))
  assert.ok(Number.isFinite(model(extremes).average))
})

test('calendar dates, Copenhagen midnight and DST timestamps validate strictly', () => {
  assert.equal(civilDay('2026-02-30'), null)
  assert.equal(civilDay('2028-02-29'), '2028-02-29')
  for (const value of ['2026-02-30T12:00:00Z', '2026-11-02T24:00:00Z', '2026-11-02T12:00:00', 'no-date', null]) assert.equal(loggedDay(value), null)
  assert.equal(loggedDay('2026-11-01T23:30:00Z'), '2026-11-02')
  assert.equal(loggedDay('2026-10-25T00:30:00Z'), '2026-10-25')
  assert.equal(loggedDay('2026-10-25T01:30:00Z'), '2026-10-25')
})

test('7 day windows, latest valid weight and trend use independent weeks', () => {
  const m = model([row('2026-10-20', 88), row('2026-10-26', 86), row('2026-10-27', 82), row(today, 80), row('2026-10-19', 100)])
  assert.equal(m.average, 81); assert.equal(m.days, 2); assert.equal(m.previousDays, 2)
  assert.equal(m.trend, -6); assert.equal(m.latest.weight, 80); assert.equal(m.bodyweight, 80)
  assert.equal(model([row('2026-10-27', 82), row(today, 80)]).trend, null)
  assert.equal(model([row('2026-10-20', 80), row('2026-10-26', 80), row('2026-10-27', 82), row(today, 82)]).trend, 2)
})

test('daily deduplication, unsorted rows, foreign IDs and invalid/future rows', () => {
  const rows = [row(today, 80), row('2026-11-01', '81,5'), row(today, 200, { athlete_id: 'synthetic-2' }),
    row('2026-11-03', 999), row('2026-02-30', 999), row(today, 0), row(today, Infinity), null,
    row('2026-11-01T18:00:00+01:00', 82), row('2026-11-01T12:00:00+01:00', 90)]
  const before = JSON.stringify(rows)
  const m = model(rows)
  assert.equal(m.average, 81); assert.equal(m.days, 2); assert.equal(m.latest.weight, 80)
  assert.equal(JSON.stringify(rows), before)
  assert.equal(model([row(today, 79), row(today, 80)]).average, 80)
})

test('missing and stale weights give actionable instructions, never a fabricated trend', () => {
  for (const logs of [undefined, [], [row('2026-09-01', 80)], [row(today, 'bad')]]) {
    const m = model(logs, { athlete: { id: athlete.id } })
    assert.equal(m.average, null); assert.equal(m.trend, null)
    assert.match(m.actions.join(' '), /logge sin vægt i kg i dag/)
    assert.match(m.actions.join(' '), /mindst 2 forskellige dage/)
    assert.match(m.actions.join(' '), /kropsvægt i profilen/)
  }
  assert.equal(model([row(today, 80)], { today: '2026-02-30' }).average, null)
  assert.equal(model([row(today, 80)], { athlete: null }).latest, null)
})

test('draft validation matches integer target storage and supports clearing', () => {
  for (const value of ['', null, undefined, '2400', 160, '160.0']) assert.equal(validTargetDraft({ kcal_target: value }), true)
  for (const value of [0, -1, 0.5, '12x', true, Infinity, '2147483648', '2e3']) assert.equal(validTargetDraft({ kcal_target: value }), false)
})

function editor(overrides = {}) {
  let props = { enabled: true, athlete, today, editing: null, editData: {}, ...overrides }
  const view = mount(KostMaal, props)
  const render = () => view.render(props)
  const navigation = lavNavigation({ setEditing: value => { props.editing = value }, setEditData: value => { props.editData = value } })
  props = { ...props, startEdit: navigation.startEdit, setEditing: value => { props.editing = value },
    setEditData: update => { props.editData = update(props.editData) }, saveEdit: overrides.saveEdit ?? (async () => {}) }
  return { render, props }
}

test('actual controlled component opens existing setup, changes only target draft, cancels', () => {
  const e = editor()
  one(e.render(), 'button', 'Rediger').props.onClick()
  assert.equal(e.props.editing, 'setup')
  assert.deepEqual(e.props.editData, { kcal_target: 2400, protein_target: 160 })
  one(e.render(), 'input', 'kcal_target').props.onChange({ target: { value: '2500' } })
  assert.equal(e.props.editData.kcal_target, '2500'); assert.equal(athlete.kcal_target, 2400)
  one(e.render(), 'button', 'Annuller').props.onClick()
  assert.equal(e.props.editing, null)
  assert.equal(nodes(e.render(), n => n.type === 'form').length, 0)
})

test('invalid submission never calls saver; missing callbacks disable editing', async () => {
  let calls = 0
  const e = editor({ editing: 'setup', editData: { kcal_target: '0' }, saveEdit: () => { calls++ } })
  await one(e.render(), 'form').props.onSubmit(event)
  assert.equal(calls, 0); assert.match(text(e.render()), /hele tal over 0/)
  const tree = mount(KostMaal, { enabled: true, athlete, today }).render()
  assert.equal(one(tree, 'button', 'Rediger').props.disabled, true)
})

test('pending saves block duplicate submits, retain failed drafts and never claim success', async () => {
  let calls = 0, finish
  const e = editor({ editing: 'setup', editData: { kcal_target: '2500' }, saveEdit: (...args) => {
    assert.deepEqual(args, []); calls++; return new Promise(resolve => { finish = resolve })
  } })
  const stale = one(e.render(), 'form').props.onSubmit
  const task = stale(event); await stale(event)
  assert.equal(calls, 1); assert.equal(one(e.render(), 'button', 'Gemmer…').props.disabled, true)
  finish(false); await task
  assert.match(text(e.render()), /ikke gemt/); assert.equal(e.props.editData.kcal_target, '2500')
  e.props.saveEdit = async () => { throw Error('synthetic') }
  await one(e.render(), 'form').props.onSubmit(event)
  assert.match(text(e.render()), /ikke gemt/)
  e.props.saveEdit = async () => undefined
  await one(e.render(), 'form').props.onSubmit(event)
  assert.doesNotMatch(text(e.render()), /Målene er gemt/)
})

test('actual copied saveEdit persists only target fields via synthetic existing client', async () => {
  syntheticCalls.length = 0
  const e = editor(); one(e.render(), 'button', 'Rediger').props.onClick()
  one(e.render(), 'input', 'kcal_target').props.onChange({ target: { value: '2500' } })
  one(e.render(), 'input', 'protein_target').props.onChange({ target: { value: '' } })
  const saved = { ...athlete, kcal_target: 2500, protein_target: null }
  responses.push({ data: saved, error: null })
  let selected, roster = [athlete]
  e.props.saveEdit = lavAtletHandlinger({ editData: e.props.editData, selectedAthlete: athlete,
    setSaving: value => { e.props.saving = value }, setSelectedAthlete: value => { selected = value },
    setAthletes: update => { roster = update(roster) }, setEditing: e.props.setEditing,
    showFlash: () => { throw Error('unexpected validation failure') } }).saveEdit
  await one(e.render(), 'form').props.onSubmit(event)
  assert.deepEqual(syntheticCalls, [{ table: 'athletes', operations: [
    ['update', { kcal_target: 2500, protein_target: null }], ['eq', 'id', athlete.id], ['select'],
  ] }])
  assert.deepEqual(selected, saved); assert.deepEqual(roster, [saved]); assert.equal(e.props.editing, null)
})

test('375 px structural affordances: wrapping fields, full width inputs, labelled controls, 44 px buttons', () => {
  const e = editor({ editing: 'setup' }), tree = e.render()
  assert.equal(tree.props.style.minWidth, 0)
  const fields = nodes(tree, n => n.type === 'input')
  assert.equal(fields.length, 2)
  assert.ok(fields.every(f => f.props.style.width === '100%' && f.props.style.minWidth === 0 && f.props.style.minHeight >= 44))
  assert.equal(nodes(tree, n => n.type === 'label').length, 2)
  assert.ok(nodes(tree, n => n.type === 'button').every(b => b.props.style.minHeight >= 44))
  assert.ok(nodes(tree, n => n.props.style?.flexWrap === 'wrap').length >= 2)
})


test('protein suggestion uses positive week average before profile weight without mutation', () => {
  assert.equal(proteinSuggestion(), null)
  for (const value of [undefined, null, '', ' ', 0, '0', -1, NaN, Infinity, 'tekst', '80kg', {}, true]) {
    assert.equal(proteinSuggestion({ average: value, bodyweight: value }), null)
    assert.equal(proteinSuggestion({ average: value, bodyweight: 82.5 }).weight, 82.5)
  }
  assert.deepEqual(proteinSuggestion({ bodyweight: '82,5' }), { weight: 82.5, min: 130, max: 180, midpoint: 155 })
  const basis = Object.freeze({ average: 80, bodyweight: 100 })
  assert.deepEqual(proteinSuggestion(basis), { weight: 80, min: 130, max: 175, midpoint: 155 })
  assert.equal(proteinSuggestion(model([row(today, 82.5)])).weight, 82.5)
  assert.equal(proteinSuggestion(model([row('2026-09-01', 100)] )).weight, 80)
})

test('protein suggestion rounds half steps upward and handles small and large weights safely', () => {
  assert.equal(proteinSuggestion({ bodyweight: 82.8125 }).min, 135) // 132.5 g
  assert.equal(proteinSuggestion({ bodyweight: 12.5 }).max, 30) // 27.5 g
  assert.deepEqual(proteinSuggestion({ bodyweight: 2 }), { weight: 2, min: 5, max: 5, midpoint: 5 })
  assert.deepEqual(proteinSuggestion({ bodyweight: 500 }), { weight: 500, min: 800, max: 1100, midpoint: 950 })
  for (const bodyweight of [Number.MIN_VALUE, 0.1, 1, Number.MAX_VALUE, 1e12]) assert.equal(proteinSuggestion({ bodyweight }), null)
})

test('suggestion renders below weight basis, falls back to profile and is absent without usable weight', () => {
  const e = editor({ weightLogs: [row(today, 82.5)] })
  const content = text(e.render())
  assert.ok(content.indexOf('Forslag:') > content.indexOf('Vægtgrundlag'))
  assert.match(content, /Forslag: 130 til 180 g protein \(1,6 til 2,2 g pr\. kg ud fra 82,5 kg\)/)
  assert.equal(nodes(e.render(), n => n.type === 'button' && text(n) === 'Brug forslag').length, 0)
  assert.match(text(editor().render()), /Forslag: 130 til 175 g protein/)
  const missing = editor({ athlete: { id: athlete.id }, editing: 'setup' })
  assert.doesNotMatch(text(missing.render()), /Forslag:|Brug forslag/)
  const suggestion = nodes(e.render(), n => n.type === 'p' && text(n).startsWith('Forslag:'))[0]
  assert.doesNotMatch(text(suggestion), /[\u2013\u2014-]/)
})

test('use suggestion changes only protein draft and requires explicit save through existing handler', async () => {
  syntheticCalls.length = 0
  const e = editor({ weightLogs: [row(today, 82.5)] })
  one(e.render(), 'button', 'Rediger').props.onClick()
  e.props.editData = { ...e.props.editData, kcal_target: '2500' }
  const before = { ...athlete }
  const use = one(e.render(), 'button', 'Brug forslag')
  assert.equal(use.props.type, 'button')
  use.props.onClick()
  assert.deepEqual(e.props.editData, { kcal_target: '2500', protein_target: 155 })
  assert.equal(one(e.render(), 'input', 'protein_target').props.value, 155)
  assert.deepEqual(athlete, before)
  assert.deepEqual(syntheticCalls, [])
  const saved = { ...athlete, kcal_target: 2500, protein_target: 155 }
  responses.push({ data: saved, error: null })
  e.props.saveEdit = lavAtletHandlinger({ editData: e.props.editData, selectedAthlete: athlete,
    setSaving: value => { e.props.saving = value }, setSelectedAthlete: () => {}, setAthletes: () => {},
    setEditing: e.props.setEditing, showFlash: () => { throw Error('unexpected') } }).saveEdit
  await one(e.render(), 'form').props.onSubmit(event)
  assert.deepEqual(syntheticCalls, [{ table: 'athletes', operations: [
    ['update', { kcal_target: 2500, protein_target: 155 }], ['eq', 'id', athlete.id], ['select'],
  ] }])
})

test('use suggestion respects saving, missing connection and synchronous pending save guard', async () => {
  const locked = editor({ editing: 'setup', saving: true })
  const b = one(locked.render(), 'button', 'Brug forslag')
  assert.equal(b.props.disabled, true); b.props.onClick(); assert.deepEqual(locked.props.editData, {})
  let changed = 0
  const disconnected = mount(KostMaal, { enabled: true, athlete, today, editing: 'setup', setEditData: () => changed++ }).render()
  const d = one(disconnected, 'button', 'Brug forslag')
  assert.equal(d.props.disabled, true); d.props.onClick(); assert.equal(changed, 0)
  let finish
  const e = editor({ editing: 'setup', editData: { protein_target: 160 }, saveEdit: () => new Promise(resolve => { finish = resolve }) })
  const tree = e.render(), staleClick = one(tree, 'button', 'Brug forslag').props.onClick
  const task = one(tree, 'form').props.onSubmit(event)
  staleClick(); assert.equal(e.props.editData.protein_target, 160)
  assert.equal(one(e.render(), 'button', 'Brug forslag').props.disabled, true)
  finish(false); await task
  one(e.render(), 'button', 'Brug forslag').props.onClick()
  assert.equal(e.props.editData.protein_target, 155)
  assert.doesNotMatch(text(e.render()), /ikke gemt/)
  one(e.render(), 'button', 'Annuller').props.onClick()
  assert.equal(e.props.editing, null)
  assert.equal(nodes(e.render(), n => n.type === 'button' && text(n) === 'Brug forslag').length, 0)
})
