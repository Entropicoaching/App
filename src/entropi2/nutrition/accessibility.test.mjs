import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { Element, find, flush } from './synthetic-dom.mjs'

// A stricter owned DOM: removal disconnects descendants and drops their focus.
// Native details visibility and disabled controls are modelled, not browser layout.
function ownedHost() {
  const doc = { activeElement: null, attempts: [], createElement: tag => new OwnedElement(tag, doc) }
  class OwnedElement extends Element {
    contains(other) { return other === this || this.children.some(child => child.contains(other)) }
    get isConnected() { return this === doc.body || this.parentElement?.isConnected === true }
    remove() {
      if (this.contains(doc.activeElement)) doc.activeElement = doc.body
      super.remove()
    }
    replaceChildren(...nodes) {
      for (const child of [...this.children]) child.remove()
      this._text = ''; this.append(...nodes)
    }
    focus() {
      doc.attempts.push({ node: this, connected: this.isConnected, disabled: this.disabled, visible: visible(this) })
      if (this.isConnected && !this.disabled && visible(this)) doc.activeElement = this
    }
    setSelectionRange(start, end, direction) {
      this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction
    }
  }
  doc.body = doc.createElement('body'); doc.activeElement = doc.body
  const host = doc.createElement('div'); doc.body.append(host)
  return host
}
function visible(node) {
  if (!node || node.hidden || node.getAttribute('hidden') !== null) return false
  const parent = node.parentElement
  if (!parent) return true
  if (parent.tagName === 'DETAILS' && !parent.open && node !== parent.children[0]) return false
  return visible(parent)
}
const key = (host, value) => host.querySelectorAll('[data-focus]').find(n => n.getAttribute('data-focus') === value)
const id = 'synthetic-accessibility', date = '2026-11-05'
const meal = n => ({ meal: 'Syntetisk ret ' + n, kcal: 100 + n, protein: 10, carb: 15, fat: 2 })
const row = (n, day = date) => ({ ...meal(n), athlete_id: id, id: 'synthetic-row-' + n, date: day })
async function fixture(t, { contracts = {}, view = {}, favorites = [], rows = [row(1), row(2)] } = {}) {
  const writes = [], storageWrites = []
  const data = new Map([['entropi2:nutrition:favorites:v1:' + id, JSON.stringify(favorites)]])
  const controller = createNutritionController({ enabled: true, athlete: { id, kcal_target: 2000, protein_target: 120 }, date,
    foods: [{ id: 'synthetic-food', name: 'Syntetisk vare', kcal100: 100, protein100: 10, carb100: 15, fat100: 2 }],
    storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => { storageWrites.push(k); data.set(k, v) } },
    contracts: { load: async () => rows, save: async value => { writes.push(value); return false },
      update: async () => false, remove: async () => true, ...contracts } })
  const host = ownedHost()
  const cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00'),
    mountWeekPlan: () => () => {}, onCoach() {}, weightInput: '80', onWeightInput() {}, logWeight() {}, ...view })
  t.after(cleanup); await flush()
  return { host, cleanup, controller, writes, storageWrites }
}
function assertFocus(host, target) {
  assert.ok(target)
  assert.ok(host.ownerDocument.activeElement === target, 'expected focus on ' + target.getAttribute('data-focus'))
  assert.equal(target.isConnected, true)
  assert.equal(target.disabled, false)
  assert.equal(visible(target), true)
}

for (const open of [false, true]) test('a11y: meal summary retains focus and ' + (open ? 'open' : 'closed') + ' state after late weight props', async t => {
  const f = await fixture(t), fold = key(f.host, 'log-form'), old = fold.children[0]
  fold.open = open; old.focus()
  f.cleanup.updateWeight({ weightLogs: [], weightStatus: { athleteId: id, state: 'ready' } })
  const next = key(f.host, 'log-form')
  assert.notEqual(next.children[0], old); assert.equal(old.isConnected, false)
  assert.equal(next.open, open); assertFocus(f.host, next.children[0])
  assert.deepEqual(f.writes, []); assert.deepEqual(f.storageWrites, [])
})

test('a11y: late weight props retain portion button, selects and text drafts with caret', async t => {
  const f = await fixture(t)
  key(f.host, 'log-form').open = true
  const input = key(f.host, 'field-Måltid'); input.value = 'Syntetisk kladde'; await input.fire('input')
  input.setSelectionRange(3, 7, 'backward'); input.focus()
  f.cleanup.updateWeight({ weightLogs: [] })
  const next = key(f.host, 'field-Måltid')
  assertFocus(f.host, next); assert.equal(next.value, 'Syntetisk kladde')
  assert.deepEqual([next.selectionStart, next.selectionEnd, next.selectionDirection], [3, 7, 'backward'])
  for (const k of ['food-choice', 'unit-choice', 'field-Mængde', 'field-Vægt (kg)']) {
    key(f.host, k).focus(); f.cleanup.updateWeight({}); assertFocus(f.host, key(f.host, k))
  }
  find(f.host, 'button', 'Log portion').focus(); f.cleanup.updateWeight({ weightLogs: [] })
  assertFocus(f.host, find(f.host, 'button', 'Log portion'))
  assert.equal(key(f.host, 'log-form').open, true)
  assert.deepEqual(f.writes, []); assert.deepEqual(f.storageWrites, [])
})

test('a11y: every disclosure summary keeps its focus and nested open states across redraw', async t => {
  const f = await fixture(t, { favorites: [meal(3), meal(4), meal(5), meal(6)],
    rows: [row(1, '2026-11-02'), { ...row(1, '2026-11-02'), id: 'synthetic-repeat-2' },
      { ...row(1, '2026-11-02'), id: 'synthetic-repeat-3' }] })
  const count = f.host.querySelectorAll('summary').length
  assert.ok(count >= 7)
  for (let i = 0; i < count; i++) {
    for (const fold of f.host.querySelectorAll('details')) fold.open = true
    const old = f.host.querySelectorAll('summary')[i]; old.focus()
    f.cleanup.updateWeight({})
    assertFocus(f.host, f.host.querySelectorAll('summary')[i])
    assert.ok(f.host.querySelectorAll('details').every(n => n.open))
  }
})

test('a11y: another host with the same focus key cannot steal focus', async t => {
  const f = await fixture(t)
  const other = f.host.ownerDocument.createElement('input'); other.setAttribute('data-focus', 'field-Måltid')
  f.host.ownerDocument.body.append(other); other.focus()
  const count = f.host.ownerDocument.attempts.length
  f.cleanup.updateWeight({})
  assertFocus(f.host, other); assert.equal(f.host.ownerDocument.attempts.length, count)
})

test('a11y: closed controls and removed edit actions fall back to their visible summary', async t => {
  const f = await fixture(t)
  key(f.host, 'log-form').open = true; key(f.host, 'field-Måltid').focus()
  key(f.host, 'log-form').open = false; f.cleanup.updateWeight({})
  assertFocus(f.host, key(f.host, 'log-form').children[0])
  key(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret 1').fire('click')
  const cancel = find(f.host, 'button', 'Annuller rettelse'); cancel.focus(); await cancel.fire('click')
  assert.equal(cancel.isConnected, false)
  assertFocus(f.host, key(f.host, 'diary-summary'))
  assert.ok(f.host.ownerDocument.attempts.every(n => n.connected && !n.disabled && n.visible))
})

test('a11y: pending portion cannot restore focus to a disabled button', async t => {
  let finish
  const f = await fixture(t, { contracts: { save: () => new Promise(resolve => { finish = resolve }) } })
  key(f.host, 'log-form').open = true
  const button = find(f.host, 'button', 'Log portion'); button.focus()
  const pending = button.parentElement.fire('submit')
  assert.equal(find(f.host, 'button', 'Log portion').disabled, true)
  assertFocus(f.host, key(f.host, 'log-form').children[0])
  finish(false); await pending
  assertFocus(f.host, key(f.host, 'log-form').children[0])
})

for (const outside of [false, true]) test('a11y: late edit completion respects ' + (outside ? 'external focus' : 'a closed diary'), async t => {
  let finish
  const f = await fixture(t, { contracts: { update: () => new Promise(resolve => { finish = resolve }) } })
  key(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret 1').fire('click')
  const save = find(f.host, 'button', 'Gem ændring'); save.focus()
  const pending = save.parentElement.fire('submit')
  const other = f.host.ownerDocument.createElement('input')
  if (outside) { f.host.ownerDocument.body.append(other); other.focus() }
  else key(f.host, 'diary').open = false
  finish(true); await pending
  assertFocus(f.host, outside ? other : key(f.host, 'diary-summary'))
  assert.ok(f.host.ownerDocument.attempts.every(n => n.connected && !n.disabled && n.visible))
})

test('a11y: all interactive controls have unique focus keys in normal, edit and remove states', async t => {
  const f = await fixture(t, { favorites: [meal(3), meal(4), meal(5), meal(6)] })
  const check = () => {
    const controls = ['a', 'button', 'input', 'select', 'summary'].flatMap(tag => f.host.querySelectorAll(tag))
    const keys = controls.map(n => n.getAttribute('data-focus'))
    assert.ok(keys.every(Boolean), 'missing key: ' + controls.filter(n => !n.getAttribute('data-focus')).map(n => n.textContent))
    assert.equal(new Set(keys).size, keys.length)
  }
  check(); key(f.host, 'diary').open = true
  await find(f.host, 'button', 'Ret måltid: Syntetisk ret 1').fire('click'); check()
  await find(f.host, 'button', 'Fjern måltid: Syntetisk ret 1').fire('click'); check()
})

test('a11y: detached host and disposed view cannot receive restored focus; OFF leaves host untouched', async t => {
  const f = await fixture(t)
  key(f.host, 'log-form').children[0].focus(); f.host.remove()
  const count = f.host.ownerDocument.attempts.length
  f.cleanup.updateWeight({})
  assert.equal(f.host.ownerDocument.attempts.length, count)
  f.cleanup(); f.cleanup.updateWeight({}); assert.equal(f.host.children.length, 0)
  const host = ownedHost(); host.textContent = 'legacy'
  mountNutrition(host, null)(); assert.equal(host.textContent, 'legacy')
})

test('a11y: scoped input/select boundary and focus outline exceed 3:1 against field and card', () => {
  const css = readFileSync(new URL('./nutrition.css', import.meta.url), 'utf8')
  const color = token => css.match(new RegExp('--' + token + ':#([a-f0-9]{6})'))?.[1]
  const luminance = hex => hex.match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const inputRule = css.match(/^\.e2-nutrition input,\.e2-nutrition select\{([^}]+)\}/m)[1]
  assert.match(inputRule, /border:1px solid var\(--field-line\)/)
  assert.match(css, /\.e2-nutrition :focus-visible\{outline:3px solid var\(--gold\)/)
  assert.equal(color('line'), '414139', 'decorative boundaries stay unchanged')
  for (const background of ['bg', 'surface']) {
    assert.ok(contrast(color('field-line'), color(background)) >= 3)
    assert.ok(contrast(color('gold'), color(background)) >= 3)
  }
})
