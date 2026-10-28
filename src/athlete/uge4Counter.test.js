import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './uge4Jsx.mjs'
import { install } from './uge4Loader.mjs'
import { mount, nodes, text, createElement as h } from './uge4Dom.mjs'
install()
const { renderUgeLogget } = await import('./ugeLogget.mjs')
const { default: Card } = await import('./UgensStatusKort.jsx')
const { default: Baseline } = await import('./uge4Baseline.jsx')
const cell = tree => nodes(tree, n => n.props['data-uge-dag'])
const session = { id: 's', weekday: 0, exercises: [{ id: 'x', sets: 2 }] }
const render = (sessions, logs = [], extra = {}) => renderUgeLogget(h, {
  enabled: true, week: { id: 'synthetic', sessions }, exerciseLogs: logs, onOpenSession() {}, ...extra,
})

test('counter: duplicate, foreign and out of range logs cannot complete planned sets', () => {
  const logs = [{ exercise_id: 'x', set_number: 1 }, { exercise_id: 'x', set_number: 1 },
    { exercise_id: 'x', set_number: 3 }, { exercise_id: 'other-week', set_number: 2 }]
  assert.equal(cell(render([session], logs))[0].props['data-uge-dag'], 'delvist')
  assert.equal(cell(render([session], logs.slice(2)))[0].props['data-uge-dag'], 'mangler')
})

test('counter: empty sessions are not completed, flexible sessions are not assigned a day', () => {
  const empty = { ...session, exercises: [] }
  assert.equal(cell(render([empty]))[0].props['data-uge-dag'], 'mangler')
  const tree = render([{ ...session, weekday: null }, { ...session, weekday: 9 }])
  assert.deepEqual(cell(tree).map(n => n.props['data-uge-dag']), Array(7).fill('hvile'))
  assert.match(text(tree), /uden fast dag/)
  assert.equal(cell(render([])).length, 7)
})

test('counter: no date inference for undated/invalid dates and no callback means disabled', () => {
  for (const weekStart of [undefined, null, new Date('invalid')]) {
    const tree = render([session], [], { weekStart, onOpenSession: null })
    assert.equal(text(cell(tree)[0].props.children[1]), '')
    assert.equal(cell(tree)[0].props.disabled, true)
    cell(tree)[0].props.onClick()
  }
})

test('exact final: flag OFF matches pinned week card in each existing view', () => {
  const props = { week: { id: 'w', sessions: [session] }, exerciseLogs: [], allWeeks: [],
    onAabnForloeb() {}, forrigeUge: null, forloebLogs: null }
  const before = mount(Baseline, props), after = mount(Card, props)
  const dom = x => JSON.parse(JSON.stringify(x))
  assert.deepEqual(dom(after.render()), dom(before.render()))
  for (const label of ['Sidste uge', 'Hele forløbet', 'Denne uge']) {
    for (const card of [before, after]) {
      nodes(card.render(), n => n.type === 'button' && text(n) === label)[0].props.onClick()
    }
    assert.deepEqual(dom(after.render()), dom(before.render()))
  }
})

test('exact final: both home adapters and athlete flag wiring parse and preserve existing navigation', () => {
  const appFlat = new URL('App.jsx', import.meta.url)
  const app = readFileSync(existsSync(appFlat) ? appFlat : new URL('../App.jsx', import.meta.url), 'utf8')
  assert.match(app, /ugeLogget = false/)
  assert.equal([...app.matchAll(/componentProps=\{\{ \.\.\.rel3\.athlete, ugeLogget: ugeLogget === true/g)].length, 2)
  assert.doesNotThrow(() => jsx(app))
  for (const file of ['AthleteView.jsx', 'HjemTab.jsx', 'EnkelHjemTab.jsx']) {
    const flat = new URL(file, import.meta.url)
    const source = readFileSync(existsSync(flat) ? flat : new URL('../' + file, import.meta.url), 'utf8')
    assert.match(source, /ugeLogget = false/)
    assert.match(source, /ugeLogget=\{ugeLogget === true\}/)
    assert.doesNotThrow(() => jsx(source))
    if (file !== 'AthleteView.jsx') assert.match(source,
      /<UgensStatusKort\s+ugeLogget=\{ugeLogget === true\}\s+onOpenSession=\{\(id\) => \{ setTab\('program'\); openSession\(id\) \}\}/)
  }
})
