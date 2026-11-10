import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, textContent } from '../onboarding/firstVisitTestHost.mjs'
import { timestampContent } from '../conversation/conversationModel.mjs'

// Supplementary synthetic hooks; actual Home and child modules, no React claim.
const host = new URL('../onboarding/firstVisitTestHost.mjs', import.meta.url).href
const hooks = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(host)}; export const useMemo = fn => fn();
  import { useState } from ${JSON.stringify(host)};
  export const useId = () => useState(() => 'synthetic-timed-home')[0];`)
const parents = new Set(['./AthleteHome.mjs', './HomeCheckIn.mjs', './QuickLogs.mjs',
  './ugeplan/WeekPlan.mjs', '../tracking/ugeatlet/AthleteWeek.mjs', '../onboarding/AthleteIntroduction.mjs', '../checkin/WeeklyCheckIn.mjs']
  .map(path => new URL(path, import.meta.url).href))
const loader = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react' && parents.has(context.parentURL)
    ? { shortCircuit: true, url: hooks } : next(specifier, context)
} })
test.after(() => loader.deregister())
const { default: Home } = await import('./AthleteHome.mjs')

test('actual Home strips timed metadata and retains the message navigation without writes', t => {
  for (const ending of ['', ' \r\n']) {
    const content = timestampContent({ id: 'synthetic-video' }, 0, 'En note med <tekst>.').replaceAll('\n', '\r\n') + ending
    const message = Object.freeze({ sender_role: 'coach', category: 'teknik', content })
    const routes = [], writes = []
    const storage = { getItem: () => null, setItem: (...args) => writes.push(args), removeItem: (...args) => writes.push(args) }
    const view = createHost(Home, { enabled: true, athlete: { id: 'synthetic-athlete' }, messages: [message],
      now: new Date('2026-11-03T12:00:00Z'), storage, setTab: route => routes.push(route), u5Today: false })
    t.after(() => view.unmount())
    assert.match(textContent(view.tree), /Video ved 0 s\r\nEn note med <tekst>\./)
    assert.doesNotMatch(textContent(view.tree), /Video-id:|synthetic-video/)
    descendants(view.tree).find(n => n.type === 'button' && textContent(n) === 'Se besked og video').props.onClick()
    assert.deepEqual(routes, ['beskeder'])
    assert.deepEqual(writes, [])
    assert.equal(message.content, content)
  }
})

test('actual Home OFF never inspects messages or storage', t => {
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  const view = createHost(Home, { enabled: false, messages: poison, storage: poison })
  t.after(() => view.unmount())
  assert.equal(textContent(view.tree), '')
})
