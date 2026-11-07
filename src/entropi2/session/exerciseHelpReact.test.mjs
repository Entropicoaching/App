import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import HomeSession from '../home/HomeSession.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'
import { oevelsesForklaringer } from './oevelsesForklaringer.mjs'

// Real copied React/ReactDOM and actual product modules. Only host DOM, timer
// handles and input rows are synthetic. No loader, replacement logic or skips.
async function mounted(t, { names = ['Bænkpres med håndvægte'], sets = [2], enabled = true, home = false } = {}) {
  const f = quickSetFixture(), doc = sessionReactDocument(), host = doc.createElement('div'), timers = new Set()
  const createElement = doc.createElement
  doc.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.children.filter(n => n.tagName === 'OPTION') })
    return node
  }
  doc.body.append(host)
  const exercises = names.map((name, index) => ({ ...f.exercise, id: `help-occurrence-${index}`, name,
    exercise_order: index, sets: sets[index] ?? 1, note: `Coachens aftale ${index}` }))
  f.p.currentWeek.sessions[0].exercises = exercises
  f.p.currentWeek.start_date = '2026-11-02'
  f.p.currentWeek.week_number = 1
  f.p.athlete = { id: f.p.athleteId }
  f.p.now = new Date('2026-11-03T12:00:00Z')
  f.p.enabled = enabled
  f.p.readHomeRecordHistory = async () => ({ status: 'ready', complete: true, athleteId: f.p.athleteId, rows: [] })
  const planBefore = JSON.stringify(f.p.allWeeks)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const original = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let rerender
  function App() {
    const [, update] = useState(0)
    rerender = () => update(n => n + 1)
    return h(home ? HomeSession : SessionScreen, { ...f.p,
      setLogInputs(fn) { f.p.logInputs = fn(f.p.logInputs); rerender() } })
  }
  t.after(async () => {
    try {
      await act(async () => root.unmount())
      assert.equal(timers.size, 0)
      assert.equal(host.children.length, 0)
      assert.equal(JSON.stringify(f.p.allWeeks), planBefore, 'exercise IDs, order, prescriptions and notes are unchanged')
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
      }
    }
  })
  await act(async () => root.render(h(App)))
  const button = label => {
    const node = host.querySelectorAll('button').find(n => n.textContent === label)
    assert.ok(node, label); assert.equal(node.disabled, false); return node
  }
  const press = async label => { await act(async () => button(label).click()) }
  const refresh = async () => { await act(async () => rerender()) }
  const start = async () => {
    if (!home) return press('Start dagens pas')
    const target = button('Start dagens pas')
    await act(async () => {
      host.dispatch('click', { type: 'click', target, button: 0, bubbles: true, stopPropagation() {} })
      await import('./sessionView.mjs')
      await new Promise(resolve => setImmediate(resolve))
    })
    assert.ok(host.querySelector('dialog')?.open)
  }
  const help = () => host.querySelector('[data-exercise-help]')
  // Native <details> activation is a host default action. The pinned DOM has no
  // browser defaults, so deliver its resulting open/toggle to the actual nodes.
  const openHelp = async () => {
    assert.ok(help())
    await act(async () => {
      const fold = help(); fold.querySelector('summary').focus(); fold.open = true; fold.dispatch('toggle')
    })
  }
  const submit = async () => {
    await act(async () => {
      host.querySelector('form').dispatch('submit')
      await new Promise(resolve => setImmediate(resolve))
      rerender()
    })
  }
  return { ...f, doc, host, exercises, timers, press, refresh, start, help, openHelp, submit }
}

test('mounted SessionScreen shows existing Danish content collapsed and dismiss returns focus without writes', async t => {
  const f = await mounted(t)
  assert.equal(f.help(), null)
  await f.start()
  const fold = f.help(), item = oevelsesForklaringer.find(item => item.name === f.exercises[0].name)
  assert.equal(fold.open, false)
  assert.equal(fold.querySelector('summary').textContent, `Teknikhjælp: ${item.name}`)
  assert.equal(fold.querySelector('p').textContent, item.udfoerelse)
  const lists = fold.querySelectorAll('ul')
  assert.deepEqual(lists[0].querySelectorAll('li').map(n => n.textContent), item.fokuspunkter)
  assert.deepEqual(lists[1].querySelectorAll('li').map(n => n.textContent), item.almindeligeFejl)
  assert.equal(fold.querySelector('button').getAttribute('type'), 'button')
  assert.equal(f.host.querySelectorAll('dialog').length, 1)
  assert.match(f.host.textContent, /Coachens fokus: Coachens aftale 0/)
  const inputs = JSON.stringify(f.p.logInputs)
  await f.openHelp()
  await f.press('Luk teknikhjælp')
  assert.equal(fold.open, false)
  assert.equal(f.doc.activeElement, fold.querySelector('summary'))
  assert.equal(f.calls.length, 0)
  assert.equal(JSON.stringify(f.p.logInputs), inputs)
  assert.match(f.host.textContent, /Sæt 1 af 2/)
})

test('Escape and native cancel close help first, retain session and restore local focus', async t => {
  const f = await mounted(t)
  await f.start(); await f.openHelp()
  const dialog = f.host.querySelector('dialog')
  f.help().querySelector('button').focus()
  let prevented = 0
  await act(async () => dialog.dispatch('keydown', { key: 'Escape', preventDefault() { prevented++ } }))
  assert.equal(prevented, 1)
  assert.equal(f.help().open, false)
  assert.equal(dialog.open, true)
  assert.equal(f.doc.activeElement, f.help().querySelector('summary'))
  await f.openHelp()
  await act(async () => dialog.dispatch('cancel', { preventDefault() { prevented++ } }))
  assert.equal(prevented, 2)
  assert.equal(f.help().open, false)
  assert.equal(dialog.open, true)
  await act(async () => dialog.dispatch('cancel'))
  assert.equal(f.host.querySelector('dialog'), null)
  assert.equal(f.doc.activeElement.textContent, 'Åbn dagens pas')
  await f.press('Åbn dagens pas')
  assert.equal(f.help().open, false)
  assert.equal(f.calls.length, 0)
})

test('same-set refresh preserves open help and local focus; closed help stays closed on refresh', async t => {
  const f = await mounted(t)
  await f.start(); await f.openHelp()
  f.help().querySelector('button').focus()
  await f.refresh()
  assert.equal(f.help().open, true)
  assert.equal(f.doc.activeElement, f.help().querySelector('button'))
  await f.press('Luk teknikhjælp'); await f.refresh()
  assert.equal(f.help().open, false)
  assert.equal(f.doc.activeElement, f.help().querySelector('summary'))
  await f.press('+2,5')
  assert.equal(f.help().open, false)
  assert.equal(f.host.querySelector('[data-field="weight"]').value, '82.5')
  assert.equal(f.calls.length, 0)
})

test('Escape preserves existing history dismissal when focus is on closed help; open layers prefer focus', async t => {
  const f = await mounted(t)
  f.p.exerciseLogsError = true
  await f.refresh(); await f.start()
  const history = f.host.querySelector('[data-detail="exercise-history-current"]')
  const dialog = f.host.querySelector('dialog')
  assert.ok(history)
  history.open = true; history.dispatch('toggle')
  f.help().querySelector('summary').focus()
  await act(async () => dialog.dispatch('cancel'))
  assert.equal(history.open, false, 'closed help does not bypass the existing history dismissal')
  assert.equal(dialog.open, true)
  assert.equal(f.doc.activeElement, history.querySelector('summary'))
  await f.openHelp()
  history.open = true; history.dispatch('toggle'); history.querySelector('summary').focus()
  await act(async () => dialog.dispatch('keydown', { key: 'Escape' }))
  assert.equal(history.open, false)
  assert.equal(f.help().open, true)
  f.help().querySelector('button').focus()
  await act(async () => dialog.dispatch('keydown', { key: 'Escape' }))
  assert.equal(f.help().open, false)
  assert.equal(dialog.open, true)
  assert.equal(f.calls.length, 0)
})

test('next set, repeated names with distinct IDs, unknown variant and exercise switching remain independent', async t => {
  const name = 'Bænkpres med håndvægte'
  const f = await mounted(t, { names: [name, name, `${name} med pause`, 'Stående lægløft'], sets: [2, 1, 1, 1] })
  await f.start(); await f.openHelp()
  await f.submit()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].ex.id, 'help-occurrence-0')
  assert.equal(f.calls[0].set_number, 1)
  assert.match(f.host.textContent, /Sæt 2 af 2/)
  assert.equal(f.help().open, false, 'help never auto-opens for the next set')
  assert.equal(f.doc.activeElement, f.host.querySelector('[data-heading]'))
  await f.openHelp(); await f.submit()
  assert.equal(f.calls[1].ex.id, 'help-occurrence-0')
  assert.equal(f.calls[1].set_number, 2)
  assert.equal(f.help().open, false, 'same name in another occurrence starts collapsed')
  assert.match(f.host.textContent, /Coachens fokus: Coachens aftale 1/)
  await f.openHelp(); await f.submit()
  assert.equal(f.calls[2].ex.id, 'help-occurrence-1')
  assert.equal(f.calls[2].set_number, 1)
  assert.equal(f.help(), null)
  assert.equal(f.host.querySelector('[data-heading]').textContent, `${name} med pause`)
  assert.match(f.host.textContent, /Coachens fokus: Coachens aftale 2/)
  await f.submit()
  assert.equal(f.calls[3].ex.id, 'help-occurrence-2')
  assert.equal(f.help().open, false)
  assert.equal(f.host.querySelector('[data-heading]').textContent, 'Stående lægløft')
  await f.openHelp(); await f.submit()
  assert.equal(f.calls[4].ex.id, 'help-occurrence-3')
  assert.equal(f.help(), null, 'no active exercise help on the completion summary')
})

test('unknown custom and ambiguous names keep their display and controls without help', async t => {
  const f = await mounted(t, { names: ['Bænkpres', 'Bænkpres med stang – egen variant', 'Mit løft æøå'], sets: [1, 1, 1] })
  for (const name of f.exercises.map(ex => ex.name)) {
    if (!f.host.querySelector('dialog')) await f.start()
    assert.equal(f.help(), null)
    assert.equal(f.host.querySelector('[data-heading]').textContent, name)
    assert.ok(f.host.querySelector('form'))
    await f.submit()
  }
  assert.deepEqual(f.calls.map(call => call.ex.name), f.exercises.map(ex => ex.name))
})

test('OFF while open removes help and dialog; re-enable and unmount do not retain an open disclosure', async t => {
  const f = await mounted(t)
  await f.start(); await f.openHelp()
  f.p.enabled = false; await f.refresh()
  assert.equal(f.help(), null)
  assert.equal(f.host.querySelector('dialog'), null)
  assert.equal(f.timers.size, 0)
  f.p.enabled = true; await f.refresh(); await f.start()
  assert.equal(f.help().open, false)
  assert.equal(f.calls.length, 0)
})

test('initial OFF does not mount help or start a session', async t => {
  const f = await mounted(t, { enabled: false })
  assert.equal(f.help(), null)
  assert.equal(f.host.querySelector('section').hidden, true)
  assert.equal(f.host.querySelector('button').disabled, true)
  await act(async () => f.host.querySelector('button').click())
  assert.equal(f.host.querySelector('dialog'), null)
  assert.equal(f.calls.length, 0)
})

test('actual HomeSession React entry lazy-mounts the same help through the production bridge', async t => {
  const f = await mounted(t, { home: true })
  assert.equal(f.help(), null)
  await f.start()
  assert.equal(f.help().open, false)
  await f.openHelp(); await f.press('Luk teknikhjælp')
  assert.equal(f.doc.activeElement, f.help().querySelector('summary'))
  assert.equal(f.calls.length, 0)
  f.p.enabled = false; await f.refresh()
  assert.equal(f.host.children.length, 0)
})
