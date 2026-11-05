import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic:visual', date = '2026-11-05'
const row = extra => ({ id: 'synthetic:meal', athlete_id: id, date,
  meal: 'Syntetisk ret', kcal: 100, protein: 10, carb: 20, fat: 2, ...extra })
const focus = (host, key) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === key)
async function mount(t, { rows = [row()], contracts = {}, view = {}, foods = [], storage } = {}) {
  const writes = [], storageWrites = []
  const controller = createNutritionController({ enabled: true,
    athlete: { id, kcal_target: 2000.123, protein_target: 120.22 }, date, foods,
    storage: storage || { getItem: () => null, setItem: (...args) => storageWrites.push(args) },
    contracts: { load: async () => rows,
      update: async value => { writes.push(value); return true },
      remove: async value => { writes.push(value); return true }, ...contracts } })
  const host = syntheticHost()
  const cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00'), ...view })
  t.after(cleanup); await flush()
  return { host, controller, cleanup, writes, storageWrites }
}

test('visual: long diary is collapsed after intake and goals; disclosure and focus survive redraw without writes', async t => {
  const rows = Array.from({ length: 35 }, (_, i) => row({ id: 'synthetic:' + i }))
  const f = await mount(t, { rows })
  let diary = focus(f.host, 'diary')
  const main = f.host.querySelectorAll('main')[0], goals = find(f.host, 'h2', 'Registreret indtag').parentElement
  assert.equal(diary.tagName, 'DETAILS')
  assert.equal(diary.open, false)
  assert.equal(diary.children[0].tagName, 'SUMMARY')
  assert.equal(diary.children[0].textContent, 'Dagens dagbog')
  assert.equal(diary.querySelectorAll('strong').length, 35)
  assert.ok(main.children.indexOf(goals) < main.children.indexOf(diary))
  assert.equal(goals.parentElement, main)
  assert.ok(find(goals, 'p', 'Tilbage i dag: Energi nået · Protein nået'))
  assert.ok(find(diary, 'h3', 'Protein pr. måltid'))
  assert.ok(find(diary, 'h2', 'Gem eget måltid'))
  diary.open = true
  focus(f.host, 'diary-summary').focus()
  f.cleanup.updateWeight({})
  diary = focus(f.host, 'diary')
  assert.equal(diary.open, true)
  assert.equal(f.host.ownerDocument.activeElement, focus(f.host, 'diary-summary'))
  focus(f.host, 'meal-part-0').checked = true
  await focus(f.host, 'meal-part-0').fire('change')
  assert.equal(focus(f.host, 'diary').open, true)
  diary = focus(f.host, 'diary'); diary.open = false
  await find(f.host, 'button', 'Se historik').fire('click')
  assert.equal(focus(f.host, 'diary').open, false)
  assert.deepEqual(f.writes, [])
  assert.deepEqual(f.storageWrites, [])
})

test('visual: blank and non-string meals have a name in diary, protein, accessible actions and history', async t => {
  const rows = ['', '  \t ', null, undefined, 42].map((meal, i) => row({ id: 'synthetic:' + i, meal }))
  const f = await mount(t, { rows })
  const diary = focus(f.host, 'diary')
  assert.deepEqual(diary.querySelectorAll('strong').map(n => n.textContent), Array(5).fill('Måltid uden navn'))
  assert.deepEqual(find(diary, 'h3', 'Protein pr. måltid').parentElement.querySelectorAll('li').map(n => n.textContent),
    Array(5).fill('Måltid uden navn: 10 g protein'))
  for (const input of diary.querySelectorAll('input').filter(n => n.type === 'checkbox')) {
    assert.match(input.getAttribute('aria-label'), /^Vælg del \d+: Måltid uden navn$/)
  }
  assert.equal(diary.querySelectorAll('button').filter(n => n.textContent === 'Ret måltid: Måltid uden navn').length, 5)
  assert.equal(diary.querySelectorAll('button').filter(n => n.textContent === 'Fjern måltid: Måltid uden navn').length, 5)
  await find(f.host, 'button', 'Fjern måltid: Måltid uden navn').fire('click')
  assert.ok(find(f.host, 'p', 'Vil du fjerne måltidet Måltid uden navn?'))
  await find(f.host, 'button', 'Behold måltid').fire('click')
  await find(f.host, 'button', 'Se historik').fire('click')
  const history = find(f.host, 'h2', 'Historik · seneste 30 dage').parentElement
  assert.deepEqual(history.querySelectorAll('li').map(n => n.textContent), Array(5).fill('Måltid uden navn'))
  assert.equal(find(f.host, 'h2', 'Registreret indtag'), undefined)
  assert.deepEqual(f.writes, [])
})

test('visual: Danish rounded row and total text preserves exact input, progress and update payload', async t => {
  const rows = [row({ kcal: '1000,125', protein: '0,1' }), row({ id: 'synthetic:other', kcal: 0.2, protein: 0.2 })]
  const original = structuredClone(rows)
  const f = await mount(t, { rows })
  assert.ok(find(f.host, 'small', '1.000,1 kcal · 0,1 g protein'))
  assert.ok(find(f.host, 'p', 'Energi: 1.000,3 kcal'))
  assert.ok(find(f.host, 'p', 'Protein: 0,3 g'))
  for (const target of ['Energi: 2.000,1 kcal', 'Protein: 120,2 g']) {
    assert.equal(f.host.querySelectorAll('p').filter(n => n.textContent === target).length, 1)
  }
  assert.doesNotMatch(f.host.textContent, /aftalt mål/)
  assert.doesNotMatch(f.host.textContent, /0\.30000000000000004|1000,125|2000\.123/)
  assert.equal(f.controller.snapshot().totals.protein, 0.1 + 0.2)
  const progress = f.host.querySelectorAll('progress').find(n => n.max === 120.22)
  assert.equal(progress.value, 0.1 + 0.2)
  focus(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret').fire('click')
  assert.equal(focus(f.host, 'edit-Energi (kcal)').value, '1000,125')
  const form = focus(f.host, 'save-edit').parentElement
  await form.fire('submit')
  assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0].kcal, 1000.125)
  assert.equal(f.writes[0].protein, 0.1)
  assert.deepEqual(rows, original)
  assert.equal(focus(f.host, 'diary').open, true)
})

test('visual: meal, portion, weight, edit and own-meal submissions share primary emphasis; cancel remains secondary', async t => {
  const f = await mount(t, { rows: [row(), row({ id: 'synthetic:second' })],
    foods: [{ name: 'Syntetisk vare', kcal: 100, protein: 10, carb: 20, fat: 2 }],
    view: { weightInput: '80', onWeightInput() {}, logWeight() {} } })
  focus(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret').fire('click')
  for (const text of ['Gem måltid', 'Log portion', 'Gem vægt', 'Gem ændring', 'Gem i Favoritter']) {
    const b = find(f.host, 'button', text)
    assert.ok(b, text)
    assert.equal(b.type, 'submit')
    assert.ok(b.className.split(' ').includes('cta-primary'), text)
  }
  assert.equal(find(f.host, 'button', 'Gem i Favoritter').disabled, true)
  assert.equal(find(f.host, 'button', 'Annuller rettelse').className, 'cta')
  assert.deepEqual(f.writes, [])
})

test('visual: save failure stays visible outside closed diary; load failure offers retry without an empty fold', async t => {
  let fails = false
  const f = await mount(t, { contracts: { load: async () => { if (fails) throw Error('synthetic'); return [row()] }, update: async () => false } })
  focus(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret').fire('click')
  await focus(f.host, 'save-edit').parentElement.fire('submit')
  focus(f.host, 'diary').open = false
  f.cleanup.updateWeight({})
  const alert = find(f.host, 'p', 'Ændringen blev ikke gemt. Prøv igen.')
  assert.equal(alert.getAttribute('role'), 'alert')
  assert.equal(alert.parentElement.tagName, 'MAIN')
  assert.equal(focus(f.host, 'diary').open, false)
  assert.ok(find(f.host, 'button', 'Gem ændring'))
  fails = true; await f.controller.load()
  assert.equal(focus(f.host, 'diary'), undefined)
  assert.ok(find(f.host, 'button', 'Hent kostloggen igen'))
  fails = false; await find(f.host, 'button', 'Hent kostloggen igen').fire('click')
  assert.equal(focus(f.host, 'diary').open, false)
})

test('visual: primary palette retains readable contrast and CSS stays inside nutrition namespace', () => {
  const css = readFileSync(new URL('./nutrition.css', import.meta.url), 'utf8')
  const luminance = hex => {
    const rgb = hex.match(/\w\w/g).map(s => parseInt(s, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const gold = css.match(/--gold:#([\da-f]{6})/)[1], bg = css.match(/--bg:#([\da-f]{6})/)[1]
  assert.ok((luminance(gold) + 0.05) / (luminance(bg) + 0.05) >= 4.5)
  for (const match of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    if (match[1].startsWith('@')) continue
    for (const selector of match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',')) assert.ok(selector.trim().startsWith('.e2-nutrition'), selector)
  }
})

test('visual: favorite read errors remain visible while the diary and own-meal form are collapsed', async t => {
  const f = await mount(t, { rows: [row(), row({ id: 'synthetic:second' })],
    storage: { getItem() { throw Error('synthetic read'); }, setItem() { throw Error('unexpected write'); } } })
  assert.equal(focus(f.host, 'diary').open, false)
  const alerts = f.host.querySelectorAll('p').filter(n => n.textContent === 'Favoritter kunne ikke læses.')
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].getAttribute('role'), 'alert')
  assert.equal(alerts[0].parentElement.tagName, 'MAIN')
})
