import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { searchKeys, focusSearchList, cancelRecommended, restoreRecommendedFocus, activateOnKey } from './focusCopies.mjs'
const read = n => readFileSync(new URL(n, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const form = read('ExFormRow.jsx')
const program = read('ProgramTab.jsx')
function searchFixture() {
  const doc = { activeElement: null }
  const pending = { current: false }
  const state = { open: true, mounted: true, next: true, options: true, focusEvents: 0 }
  const input = { tagName: 'INPUT', focus() {
    if (doc.activeElement !== this) { state.focusEvents++; setOpen(true) }
    doc.activeElement = this
  } }
  const first = { focus() { doc.activeElement = this } }
  const other = { focus() { doc.activeElement = this } }
  const root = { querySelector: s => s === 'input' ? input : state.mounted && state.options ? first : null }
  const list = { ownerDocument: doc, closest: () => root, querySelector: () => state.options ? first : null }
  function setOpen(value) { state.next = value }
  function commit() {
    const removed = state.mounted && !state.next
    if (removed && doc.activeElement === first) doc.activeElement = 'body'
    state.open = state.next; state.mounted = state.open
    if (state.mounted) focusSearchList(list, pending)
  }
  const event = (key, target = input) => ({ key, target, currentTarget: root, prevented: false, stopped: false,
    preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } })
  return { doc, pending, state, input, first, other, setOpen, commit, event, list }
}
test('Funktionskopien er bytebundet til hele den lille rene kandidathjaelper', () => {
  assert.deepEqual(readFileSync(new URL('focusCopies.mjs', import.meta.url)), readFileSync(new URL('coachAccessibility.mjs', import.meta.url)))
})
test('F2 Escape og Pil ned genaabner uden aendret tekst eller ny onFocus', () => {
  const f = searchFixture(); f.first.focus()
  const esc = f.event('Escape', f.first)
  searchKeys(esc, f.setOpen, f.pending); f.commit()
  assert.equal(f.doc.activeElement, f.input); assert.equal(f.state.open, false)
  assert.equal(esc.prevented && esc.stopped, true)
  const count = f.state.focusEvents
  const down = f.event('ArrowDown')
  searchKeys(down, f.setOpen, f.pending)
  assert.equal(f.state.mounted, false); assert.equal(f.pending.current, true)
  f.commit()
  assert.equal(f.state.open, true); assert.equal(f.doc.activeElement, f.first)
  assert.equal(f.state.focusEvents, count); assert.equal(down.prevented, true)
})
test('F2 gentagne Escape og Pil ned samt allerede aaben liste', () => {
  const f = searchFixture(); f.input.focus()
  for (let i = 0; i < 3; i++) {
    searchKeys(f.event('ArrowDown'), f.setOpen, f.pending); f.commit()
    assert.equal(f.doc.activeElement, f.first)
    searchKeys(f.event('Escape', f.first), f.setOpen, f.pending); f.commit()
    assert.equal(f.doc.activeElement, f.input); assert.equal(f.state.open, false)
  }
})
test('F2 ingen valg og fokus flyttet foer commit stjaeler ikke fokus', () => {
  const f = searchFixture(); f.input.focus(); f.state.mounted = false; f.state.options = false
  searchKeys(f.event('ArrowDown'), f.setOpen, f.pending); f.commit()
  assert.equal(f.doc.activeElement, f.input); assert.equal(f.pending.current, false)
  f.state.options = true; f.state.mounted = false
  searchKeys(f.event('ArrowDown'), f.setOpen, f.pending); f.other.focus(); f.commit()
  assert.equal(f.doc.activeElement, f.other)
  focusSearchList(null, f.pending)
})
test('F2 urelaterede taster og Pil ned paa et valg aendrer intet', () => {
  const f = searchFixture(); f.first.focus()
  for (const e of [f.event('Tab'), f.event('ArrowUp'), f.event('ArrowDown', f.first)]) {
    searchKeys(e, f.setOpen, f.pending); assert.equal(e.prevented, false)
  }
  assert.equal(f.doc.activeElement, f.first); assert.equal(f.pending.current, false)
})
function weightFixture(id, variant) {
  const doc = { activeElement: 'body' }, pending = { current: null }
  let editing = null
  const opener = { id, variant, focus() { doc.activeElement = this }, click() { editing = id; doc.activeElement = input } }
  const input = { id: `input-${id}` }
  function setEditing(value) { editing = value }
  function commit() {
    if (editing === null && doc.activeElement === input) doc.activeElement = 'body'
    restoreRecommendedFocus(null, pending, id)
    restoreRecommendedFocus({ focus() { throw Error('Forkert oevelse') } }, pending, 'other-id')
    if (editing === null) restoreRecommendedFocus(opener, pending, id)
  }
  return { doc, pending, opener, input, setEditing, commit }
}
test('F1 Enter og mellemrum, Escape og Annuller returnerer til praecis aabner', () => {
  for (const variant of ['recommended', 'last-log', 'add']) for (const key of ['Enter', ' ']) for (const closing of ['Escape', 'Annuller']) {
    const f = weightFixture(`${variant}-${key}-${closing}`, variant)
    const e = { key, target: f.opener, currentTarget: f.opener, preventDefault() {}, stopPropagation() {} }
    activateOnKey(e); assert.equal(f.doc.activeElement, f.input)
    cancelRecommended(f.setEditing, f.pending, f.opener.id)
    assert.equal(f.doc.activeElement, f.input)
    f.commit(); assert.equal(f.doc.activeElement, f.opener); assert.equal(f.pending.current, null)
    f.doc.activeElement = 'elsewhere'
    restoreRecommendedFocus(f.opener, f.pending, f.opener.id)
    assert.equal(f.doc.activeElement, 'elsewhere')
  }
})
test('Binding af alle tre aabnere, Escape, Annuller og montering ved LF og CRLF', () => {
  for (const ending of ['\n', '\r\n']) {
    const p = program.replace(/\n/g, ending), f = form.replace(/\n/g, ending)
    assert.ok(p.includes('const recommendedReturn = useRef(null)'))
    assert.equal(p.split('ref={node => restoreRecommendedFocus(node, recommendedReturn, ex.id)}').length - 1, 3)
    assert.ok(p.includes("if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRecommended(setEditingRecommended, recommendedReturn, ex.id) }"))
    assert.ok(p.includes('onClick={() => cancelRecommended(setEditingRecommended, recommendedReturn, ex.id)}'))
    assert.ok(f.includes('const searchFocus = useRef(false)'))
    assert.ok(f.includes('searchKeys(e, setExerciseSearchOpen, searchFocus)'))
    assert.ok(f.includes('ref={node => focusSearchList(node, searchFocus)}'))
  }
})
// Own small baseline function copy. Original module remains inert.
function baselineSearchKeys(event, setOpen) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.querySelector('input')?.focus()
    setOpen(false)
  } else if (event.key === 'ArrowDown' && event.target.tagName === 'INPUT') {
    const first = event.currentTarget.querySelector('[role="button"]')
    if (first) {
      event.preventDefault()
      first.focus()
    }
  }
}
test('Modproeve F2 samme forventning fejler paa pinnet lille basiskopi', () => {
  const source = existsSync(new URL('input-432-coachAccessibility.mjs', import.meta.url)) ? read('input-432-coachAccessibility.mjs') : null
  const expected = baselineSearchKeys.toString().replace(/\r\n/g, '\n').replace('function baselineSearchKeys', 'export function searchKeys')
  if (source !== null) assert.ok(source.includes(expected))
  const f = searchFixture(); f.first.focus()
  baselineSearchKeys(f.event('Escape', f.first), f.setOpen); f.commit()
  baselineSearchKeys(f.event('ArrowDown'), f.setOpen); f.commit()
  assert.throws(() => assert.equal(f.doc.activeElement, f.first))
  assert.equal(f.state.open, false)
})
test('Modproeve F1 oprindeligt tilstandsskift mister fokus ved afmontering', () => {
  if (existsSync(new URL('input-427-ProgramTab.jsx', import.meta.url))) assert.ok(read('input-427-ProgramTab.jsx').includes("if (e.key === 'Escape') setEditingRecommended(null)"))
  const f = weightFixture('baseline', 'recommended'); f.opener.click()
  f.setEditing(null); f.commit()
  assert.equal(f.doc.activeElement, 'body')
  assert.throws(() => assert.equal(f.doc.activeElement, f.opener))
})
