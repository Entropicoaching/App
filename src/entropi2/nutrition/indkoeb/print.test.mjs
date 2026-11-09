import test from 'node:test'
import assert from 'node:assert/strict'
import { groupForPrint, printShoppingList, PRINT_CSS } from './print.mjs'
import { sessionReactDocument } from '../../session/sessionQuickSetReactDom.mjs'

test('printlisten grupperes efter butiksafdeling i butikkens rækkefølge', () => {
  const groups = groupForPrint([
    { name: 'Skyr naturel', text: 'Skyr naturel: 1.000 g' },
    { name: 'Banan', text: 'Banan: 600 g' },
    { name: 'Kyllingebryst', text: 'Kyllingebryst: 900 g' },
    { name: 'Mormors frikadeller', text: 'Mormors frikadeller: 8 stk' },
    { name: 'Tom', text: '  ' },
  ])
  assert.deepEqual(groups.map(g => g.afdeling), ['Frugt og grønt', 'Mejeri', 'Kød og fisk', 'Øvrige'])
  assert.deepEqual(groups[1].lines, ['Skyr naturel: 1.000 g'])
})

test('print: rent ark med hvid baggrund, sort tekst og afkrydsningsfelter; fjernes efter print', () => {
  assert.match(PRINT_CSS, /@media print/)
  assert.match(PRINT_CSS, /background: #fff/)
  assert.match(PRINT_CSS, /color: #000/)
  assert.match(PRINT_CSS, /body > \*:not\(\.e2-print-sheet\) \{ display: none/)
  const doc = sessionReactDocument(), listeners = new Map()
  let printed = 0
  const app = doc.createElement('div'); app.id = 'root'; doc.body.append(app)
  const win = { document: doc, print() { printed++ },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  assert.equal(printShoppingList({ items: [] }, win), false)
  assert.equal(printed, 0)
  assert.equal(printShoppingList({ title: 'Ugens indkøbsliste', subtitle: 'Ugen fra 2026-11-09.',
    items: [{ name: 'Havregryn', text: 'Havregryn: 500 g' }, { name: 'Æble', text: 'Æble: 4 stk' }] }, win), true)
  assert.equal(printed, 1)
  const sheet = doc.body.querySelectorAll('.e2-print-sheet')[0]
  assert.ok(sheet)
  assert.equal(sheet.querySelectorAll('h1')[0].textContent, 'Ugens indkøbsliste')
  assert.deepEqual([...sheet.querySelectorAll('h2')].map(n => n.textContent), ['Frugt og grønt', 'Kolonial'])
  assert.equal(sheet.querySelectorAll('.boks').length, 2)
  assert.ok([...doc.body.querySelectorAll('style')].some(n => n.getAttribute('id') === 'e2-print-css'))
  listeners.get('afterprint')()
  assert.equal(doc.body.querySelectorAll('.e2-print-sheet').length, 0)
  assert.ok(app.isConnected)
})
