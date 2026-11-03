import test from 'node:test'
import assert from 'node:assert/strict'
import { dom, button } from './a11y-dom.mjs'
import { mountSession } from './sessionView.mjs'
import { sessionStyle } from './sessionStyle.mjs'
import { install } from '../mobility/mobility-loader.mjs'
import { fakeClock } from '../mobility/synthetic-dom.mjs'
const hooks = install()
const { mountMobility } = await import('../mobility/mobility-screen.mjs')
test.after(() => hooks.deregister())

function fixture() {
  const values = new Map()
  const exercise = { id: 'lift', name: 'Bench press', sets: 2, reps: 3, recommended_weight: 60 }
  const week = { id: 'week', start_date: '2026-10-26', week_number: 1,
    sessions: [{ id: 'session', title: 'Pas', weekday: 3, exercises: [exercise] }] }
  return { enabled: true, athleteId: 'synthetic', athlete: { id: 'synthetic' }, allWeeks: [week], currentWeek: week,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    exerciseLogs: [], logInputs: {}, now: new Date('2026-10-29T12:00Z'), parsePlannedRpe: () => null,
    setLogInputs() {} }
}
const clock = { Date: { now: () => 0 }, setInterval() { assert.fail('No rest timer expected') }, clearInterval() {} }
test('session: names, initial/next/completed heading focus, stable live status, close return, one save', async () => {
  const root = dom(), props = fixture(); let writes = 0
  props.onLogSet = async (ex, set_number) => { writes++; props.exerciseLogs.push({ exercise_id: ex.id, set_number }) }
  const view = mountSession(root, () => props, { clock })
  const start = button(root, 'Start dagens pas'); start.focus(); start.click()
  const heading = () => root.querySelector('[data-heading]')
  assert.equal(root.ownerDocument.activeElement, heading())
  const live = root.querySelector('[role="status"]')
  const statuses = root.querySelectorAll('[role="status"]'), progress = statuses.at(-1)
  for (const n of root.querySelectorAll('button, summary')) assert.ok(n.textContent.trim())
  for (const n of root.querySelectorAll('input')) assert.equal(n.parentElement.tagName, 'label')
  const weight = root.querySelector('[data-field="weight"]'); weight.focus(); weight.setSelectionRange(1, 1)
  view.update()
  assert.equal(root.ownerDocument.activeElement.getAttribute('data-field'), 'weight')
  assert.equal(root.ownerDocument.activeElement.selectionStart, 1)
  const summary = root.querySelector('summary'); summary.focus(); view.update()
  assert.equal(root.ownerDocument.activeElement.tagName, 'summary')
  for (let set = 1; set <= 2; set++) {
    await view.controller.approve(`lift_${set}`, { weight: '60', reps: '3', rpe: '' }, view.controller.state().selection.stamp)
    assert.equal(root.ownerDocument.activeElement, heading())
    assert.equal(root.querySelectorAll('[role="status"]').at(-1), progress)
  }
  assert.equal(writes, 2); assert.match(progress.textContent, /2 af 2/)
  assert.equal(progress.getAttribute('aria-live'), 'polite'); assert.equal(progress.getAttribute('aria-atomic'), 'true')
  assert.ok(live)
  button(root, 'Luk pas').click(); assert.equal(root.ownerDocument.activeElement, start)
  view.dispose(); assert.equal(root.children.length, 0)
})
test('session: invalid/error status is persistent, focus trap wraps, updates do not steal close focus', async () => {
  const root = dom(), props = fixture(), view = mountSession(root, () => props, { clock })
  button(root, 'Start dagens pas').click()
  const close = button(root, 'Luk pas'); close.focus(); view.update(); assert.equal(root.ownerDocument.activeElement, close)
  const alert = root.querySelector('[role="alert"]')
  await view.controller.approve('lift_1', { weight: '', reps: '' }, view.controller.state().selection.stamp)
  assert.equal(root.querySelector('[role="alert"]'), alert); assert.match(alert.textContent, /Skriv vægt/)
  const dialog = root.querySelector('dialog'), last = root.querySelectorAll('summary').at(-1)
  close.focus(); dialog.dispatch('keydown', { key: 'Tab', shiftKey: true }); assert.equal(root.ownerDocument.activeElement, last)
  dialog.dispatch('keydown', { key: 'Tab' }); assert.equal(root.ownerDocument.activeElement, close)
  view.dispose()
})
test('mobility: keyboard-native controls, step/return focus, quiet countdown and live completion, cleanup', () => {
  const root = dom(), c = fakeClock(), props = fixture()
  const dispose = mountMobility(root, { ...props, clock: c })
  assert.equal(root.ownerDocument.activeElement, undefined)
  button(root, 'Start mobilitet').click()
  assert.match(root.ownerDocument.activeElement.textContent, /1 af 3/)
  for (const n of root.querySelectorAll('button, summary')) assert.ok(n.textContent.trim())
  const live = root.querySelector('[role="status"]'), timer = root.querySelector('[role="timer"]')
  assert.equal(timer.getAttribute('aria-live'), 'off'); assert.equal(live.getAttribute('aria-live'), 'polite')
  button(root, 'Start sidetimer').click(); const started = live.textContent
  c.advance(1000); assert.equal(live.textContent, started)
  c.advance(600000); assert.match(live.textContent, /Skift side|færdig/)
  button(root, 'Næste øvelse').click(); assert.match(root.ownerDocument.activeElement.textContent, /2 af 3/)
  button(root, 'Næste øvelse').click()
  button(root, 'Afslut mobilitet').click(); assert.equal(root.ownerDocument.activeElement.textContent, 'Mobilitet')
  button(root, 'Start mobilitet').click(); button(root, 'Spring over').click()
  assert.equal(root.ownerDocument.activeElement.textContent, 'Mobilitet'); dispose(); assert.equal(c.count, 0)
})
test('OFF remains inert for mobility and session stays hidden with no dialog/writes', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF read') } })
  mountMobility(poison, { enabled: false, athlete: poison })()
  const root = dom(), props = { enabled: false }, view = mountSession(root, () => props, { clock })
  assert.equal(root.hidden, true); assert.equal(root.querySelector('dialog'), null); view.dispose()
})
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
  return rgb.reduce((sum, x, i) => sum+x*[.2126,.7152,.0722][i], 0)
}
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05) }
test('actual styles: explicit palette in either host scheme, all text pairs >=4.5, focus and 44px targets', () => {
  const root = dom(), stop = mountMobility(root, fixture())
  const css = root.querySelector('style').textContent
  for (const scheme of ['light', 'dark']) {
    const base = sessionStyle.match(/\.e2-session \{([^}]+)/)[1]
    const fg = base.match(/;color:(#[0-9a-f]{6})/)[1], bg = base.match(/background:(#[0-9a-f]{6})/)[1]
    const muted = sessionStyle.match(/\.muted \{color:(#[0-9a-f]{6})/)[1]
    const card = sessionStyle.match(/\.card \{background:(#[0-9a-f]{6})/)[1]
    const approve = sessionStyle.match(/\.approve \{([^}]+)/)[1]
    const pairs = [[fg,bg],[fg,card],[muted,bg],[muted,card], [approve.match(/color:(#[0-9a-f]{6})/)[1],approve.match(/background:(#[0-9a-f]{6})/)[1]], [root.style.color,root.style.background]]
    for (const n of root.querySelectorAll('button')) pairs.push([n.style.color,n.style.background])
    for (const [a,b] of pairs) assert.ok(contrast(a,b)>=4.5, `${scheme}: ${a}/${b}: ${contrast(a,b)}`)
    console.log(`${scheme}: minimum actual text contrast ${Math.min(...pairs.map(([a,b]) => contrast(a,b))).toFixed(2)}:1`)
  }
  assert.match(sessionStyle, /:focus-visible/); assert.match(css, /:focus-visible/)
  assert.match(sessionStyle, /min-height:44px/); assert.match(css, /summary \{min-height:44px;min-width:44px/)
  assert.match(sessionStyle, /minmax\(0,1fr\)/); assert.equal(root.style.overflowWrap, 'anywhere')
  stop()
})
