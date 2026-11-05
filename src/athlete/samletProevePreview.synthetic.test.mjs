// Supplemental actual-module interaction tests; genuine React SSR remains in samletProeve.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './prog3Jsx.mjs'
import { mount, nodes, text } from './prog3Dom.mjs'
import { programQolFixture } from './programQolFixture.mjs'
import { scenario } from './samletProeveData.mjs'
const root = new URL('../', import.meta.url)
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.startsWith(root.href))
      return { url: new URL('./prog3Dom.mjs', import.meta.url).href, shortCircuit: true }
    if (context.parentURL?.startsWith(root.href) && /^\.\.\/supabase(?:\.js)?$/.test(specifier))
      return { url: new URL('./prog3Dom.mjs', import.meta.url).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith(root.href) && url.endsWith('.jsx')) return {
      format: 'module', shortCircuit: true,
      source: `import { h as __h } from ${JSON.stringify(new URL('./prog3Dom.mjs', import.meta.url).href)};\n${jsx(readFileSync(new URL(url), 'utf8'))}`,
    }
    return next(url, context)
  },
})
test.after(() => hooks.deregister())
const { default: Program } = await import('./ProgramTab.jsx')
const { default: Analysis } = await import('../entropi2/analysis/Analysis.mjs')
const buttons = tree => nodes(tree, n => n.type === 'button')
const writes = /\b(?:log|spring|udfyld|gem|fortryd|ja)\b|del ugen/i

for (const state of ['unlogged', 'partial', 'skipped', 'done']) {
  test(`Program preview hides writes and inputs, preserving plan and evidence: ${state}`, () => {
    const logs = state === 'unlogged' ? [] : [{ exercise_id: 'ex-1-0', set_number: 1,
      weight: 42, reps_completed: 5, rpe_actual: 8, skipped: state === 'skipped' }]
    const props = programQolFixture({ readOnly: true, progOpenSession: 'session-1-0',
      readinessLog: null, exerciseLogs: logs, opvarmStige: true,
      skipConfirmEx: 'ex-1-0', exWarmupExpanded: { 'ex-1-0': true } })
    if (state === 'partial') props.allWeeks[1].sessions[0].exercises[0].sets = 2
    const tree = mount(Program, props).render()
    assert.match(text(tree), /Squat/)
    assert.equal(nodes(tree, n => ['input', 'textarea', 'select'].includes(n.type)).length, 0)
    for (const button of buttons(tree)) assert.doesNotMatch(text(button), writes)
    if (state === 'skipped') assert.match(text(tree), /Sprunget over/)
    if (state === 'partial' || state === 'done') assert.match(text(tree), /42kg × 5/)
    assert.ok(buttons(tree).some(n => /Forrige uge/.test(text(n))), 'week navigation is retained')
  })
}

test('writable Program still logs, skips, opens readiness and saves feedback', () => {
  let calls = 0
  const props = programQolFixture({ progOpenSession: 'session-1-0', readinessLog: null,
    logSet: () => calls++, openReadiness: () => calls++ })
  const tree = mount(Program, props).render()
  for (const label of ['Log', 'Spring over', 'Auto-udfyld', 'Spring resten over'])
    assert.ok(buttons(tree).some(n => text(n) === label), label)
  buttons(tree).find(n => text(n) === 'Log').props.onClick()
  buttons(tree).find(n => /Log dagens parathed/.test(text(n))).props.onClick()
  assert.equal(calls, 2)
  const done = mount(Program, { ...props,
    exerciseLogs: [{ exercise_id: 'ex-1-0', set_number: 1, weight: 42, reps_completed: 5 }] }).render()
  assert.ok(buttons(done).some(n => text(n) === 'Gem feedback'))
})

test('timed prescription remains readable in preview; only writable Program offers the timer', () => {
  for (const readOnly of [true, false]) {
    const props = programQolFixture({ readOnly, progOpenSession: 'session-1-0' })
    Object.assign(props.currentWeek.sessions[0].exercises[0], { name: 'Planke', reps: '30 sek' })
    const tree = mount(Program, props).render()
    assert.match(text(tree), /Planke/)
    assert.match(text(tree), /30 sek/)
    assert.equal(buttons(tree).some(n => /Start timer/.test(text(n))), !readOnly)
  }
})

test('Analysis preview retains read data and program navigation while hiding share and write shortcuts', () => {
  const props = { entropi2: true, now: new Date('2026-11-04T12:00:00Z'),
    ...scenario('own', 'fremgang').seed, setTab: () => {} }
  props.fremgangLogs = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-11-03'].map((day, i) => ({
    exercise_id: 'synthetic-history-' + i, logged_at: day + 'T09:00:00Z', weight: 60 + i * 5, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Basis' } } },
  }))
  const own = mount(Analysis, props).render()
  assert.ok(buttons(own).some(n => /Del ugen/.test(text(n))), 'fixture must exercise share')
  assert.ok(buttons(own).some(n => /Log/.test(text(n))), 'fixture must exercise log shortcut')
  const preview = mount(Analysis, { ...props, readOnly: true }).render()
  assert.match(text(preview), /Din analyse/)
  for (const button of buttons(preview)) assert.doesNotMatch(text(button), writes)
  assert.ok(buttons(preview).some(n => text(n) === 'Åbn program'))
  assert.equal(mount(Analysis, { ...props, entropi2: false, readOnly: true }).render(), null)
})
