import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './vaerd5Loader.mjs'
import { mount, text, nodes } from './vaerd5Dom.mjs'
install()
const { default: ProgramTab } = await import('./ProgramTab.jsx')
const { fixture } = await import('./vaerd5Fixture.mjs')
const label = 'Din lokale rettelse af opvarmningen'
const render = f => mount(ProgramTab, f.props).render()

test('review: label replaces existing badge without changing the element tree', () => {
  const f = fixture(); f.save()
  const off = JSON.stringify(render(f))
  f.props.vaerdF6 = true
  const on = JSON.stringify(render(f))
  assert.equal(on.replace(label, 'dine sidste'), off)
  assert.equal(nodes(render(f), n => n.type === 'span' && text(n) === label).length, 1)
})
test('review: two exercises only mark the exercise with a saved correction', () => {
  const f = fixture({ vaerdF6: true }); f.save()
  f.week.sessions[0].exercises.push({ ...f.ex, id: 'ex2', name: 'Bench' })
  assert.equal(nodes(render(f), n => n.type === 'span' && text(n) === label).length, 1)
})
test('review: inactive week and weight below 20 do not expose warmup badge', () => {
  for (const extra of [{ viewingWeekIdx: 1 }, { }]) {
    const f = fixture({ vaerdF6: true, ...extra }); f.save()
    if (extra.viewingWeekIdx === undefined) f.ex.recommended_weight = 19
    else f.props.allWeeks.push({ ...f.week, id: 'w2', week_number: 2 })
    assert.ok(!text(render(f)).includes(label))
  }
})
test('review: render reads synthetic storage without changing sets or writing', () => {
  const f = fixture({ vaerdF6: true }); f.save()
  const before = JSON.stringify([Array.from(f.storage), f.model, f.ex])
  render(f); render(f)
  assert.equal(JSON.stringify([Array.from(f.storage), f.model, f.ex]), before)
  assert.deepEqual(f.writes, [])
})
test('review: flag stays default OFF and prop-only in both app modules', () => {
  for (const name of ['AthleteView.jsx', 'ProgramTab.jsx']) {
    const inAppLayout = new URL('./', import.meta.url).pathname.endsWith('/src/athlete/')
    const url = new URL(name === 'AthleteView.jsx' && inAppLayout ? '../AthleteView.jsx' : name, import.meta.url)
    const s = readFileSync(url, 'utf8')
    assert.match(s, /vaerdF6 = false/)
    assert.equal(s.match(/\bvaerdF6\b/g).length, 2)
  }
})
