// Synthetic element tree and hook scheduler, not React DOM or browser evidence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { nodes, text, mount, enableEffects, flushEffects } from '../../../athlete/prog5Dom.mjs'
import { coachHomeModel } from '../coachModel.mjs'
import { coachRadarModel } from './model.mjs'
import { fixture, day, mockClient } from './fixtures.mjs'

const runtime = new URL('../../../athlete/prog5Dom.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(runtime)};
  export const useMemo = fn => fn(); export const useCallback = fn => fn;
  export const Fragment = Symbol.for('radar.synthetic.fragment');`)
registerHooks({ resolve(specifier, context, next) {
  return specifier === 'react' ? { url: react, shortCircuit: true } : next(specifier, context)
} })
const { default: CoachRadar, CoachRadarView } = await import('./CoachRadar.mjs')
const { CoachView } = await import('../CoachScreen.mjs')
const all = tree => nodes(tree, () => true)
const athleteButtons = tree => all(tree).filter(node => node.props['data-coach-radar-athlete'])
const model = f => coachRadarModel({ enabled: true, ...f, context: coachHomeModel(f.source, day) })
const props = f => ({ enabled: true, source: f.source, context: coachHomeModel(f.source, day) })

test('1, 12 and 40 synthetic athletes: one reason each, exact order, reachable remainder and existing profile route', () => {
  for (const count of [1, 12, 40]) {
    const f = fixture(count), calls = []
    f.source.athletes[0].name = 'Syntetisk meget langt konstrueret atletnavn '.repeat(4)
    f.source.coachMorningData.messages.rows = f.ids.map(id => ({ athlete_id: id, sender_role: 'athlete', category: 'besked', created_at: `${day}T10:00:00Z` }))
    const result = model(f), tree = CoachRadarView({ enabled: true, model: result, openProfile: (...args) => calls.push(args) })
    const buttons = athleteButtons(tree), more = all(tree).find(n => n.props['data-coach-radar-more'])
    assert.equal(buttons.length, count)
    assert.deepEqual(buttons.map(b => b.props['data-coach-radar-athlete']), result.rows.map(r => r.athlete.id))
    assert.equal(Boolean(more), count > 5)
    if (more) { assert.notEqual(more.props.open, true); assert.equal(athleteButtons(more).length, count - 5) }
    assert.equal(buttons[0].props.style.width, '100%')
    assert.equal(buttons[0].props.style.overflowWrap, 'anywhere')
    assert.equal(buttons[0].props.style.boxSizing, 'border-box')
    for (const [i, button] of buttons.entries()) {
      assert.ok(button.props.style.minHeight >= 44)
      assert.match(text(button), /1 samtale venter på svar/)
      button.props.onClick(); assert.deepEqual(calls.at(-1), [result.rows[i].athlete, 'hub', 'list'])
    }
    for (const summary of all(tree).filter(n => n.type === 'summary')) assert.ok(summary.props.style.minHeight >= 44)
    assert.doesNotMatch(text(tree), /[–—]/)
    assert.equal(all(tree).some(n => n.props.dangerouslySetInnerHTML || n.type === 'a'), false)
  }
})
test('OFF is inert; only one card is mounted on the coach home when explicitly enabled', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(CoachRadar({ enabled, get source() { throw Error('OFF source') } }), null)
    assert.equal(CoachRadarView({ enabled, get model() { throw Error('OFF model') } }), null)
  }
  const f = fixture(), input = { ...f.source, enabled: true, today: day }
  assert.equal(all(CoachView(input)).filter(n => n.type === CoachRadar).length, 0)
  assert.equal(all(CoachView({ ...input, coachRadarEnabled: true })).filter(n => n.type === CoachRadar).length, 1)
  assert.equal(all(CoachView({ ...input, coachRadarEnabled: true, tab: 'inbox' })).filter(n => n.type === CoachRadar).length, 0)
})
test('empty, missing, loading, failed and disabled navigation states remain honest', () => {
  for (const state of ['ready', 'partial', 'unavailable', 'loading']) {
    let retries = 0
    const tree = CoachRadarView({ enabled: true, model: { state, rows: [] }, onRefresh: () => { retries++ } })
    assert.equal(text(tree).includes('Ingen af radarens signaler'), state === 'ready')
    if (state !== 'ready') {
      const retry = all(tree).find(n => n.type === 'button')
      assert.equal(retry.props.disabled, state === 'loading')
      if (!retry.props.disabled) { retry.props.onClick(); assert.equal(retries, 1) }
    }
  }
  const f = fixture(); f.snapshot.logs.rows = []
  const tree = CoachRadarView({ enabled: true, model: model(f) })
  assert.equal(athleteButtons(tree)[0].props.disabled, true)
  assert.equal(athleteButtons(tree)[0].props.onClick, undefined)
  assert.match(text(tree), /kan ikke åbnes/)
})
test('actual component effects drop superseded responses on owner changes and refresh; no eager reads while OFF', async () => {
  enableEffects()
  const pending = [], fake = mockClient(Object.fromEntries(['exercise_logs', 'readiness_logs'].map(table => [table, () => new Promise(resolve => pending.push({ table, resolve }))])))
  const f = fixture(); f.source.notesClient = fake.client
  f.source.openProfile = () => {}
  const app = mount(CoachRadar, props(f))
  app.render(); await flushEffects(); assert.equal(pending.length, 2)
  const next = fixture(); next.source.session.user.id = next.source.readContext.coachId = 'synthetic-other-coach'
  next.source.notesClient = fake.client; next.source.openProfile = () => {}
  let tree = app.render(props(next)); await flushEffects(); assert.equal(pending.length, 4)
  assert.equal(athleteButtons(tree).length, 0)
  pending[0].resolve({ data: [] }); pending[1].resolve({ data: [] }); await flushEffects()
  tree = app.render(); assert.equal(athleteButtons(tree).length, 0, 'old owner response must not appear')
  pending[2].resolve({ data: [] }); pending[3].resolve({ data: [] }); await flushEffects()
  tree = app.render(); assert.match(text(tree), /Ingen træningslog i 5 dage/)
  // Reusing the same owner/day/roster with a new read receipt also invalidates data.
  next.source = { ...next.source, readContext: { ...next.source.readContext } }
  tree = app.render(props(next)); assert.equal(athleteButtons(tree).length, 0)
  await flushEffects(); assert.equal(pending.length, 6)
  pending[4].resolve({ error: true }); pending[5].resolve({ error: true }); await flushEffects()
  tree = app.render(); assert.match(text(tree), /Nogle data mangler/)
  assert.equal(athleteButtons(tree).length, 0)
  const retry = all(tree).find(n => n.type === 'button' && text(n) === 'Opdater radar')
  retry.props.onClick(); app.render(); await flushEffects(); assert.equal(pending.length, 8)
  pending[6].resolve({ data: [{ id: 'recent', athlete_id: next.ids[0], logged_at: `${day}T10:00:00Z`, skipped: false }] })
  pending[7].resolve({ data: [] }); await flushEffects()
  assert.equal(pending.length, 9, 'nonempty logs require a terminal empty page')
  pending[8].resolve({ data: [] }); await flushEffects()
  tree = app.render(); assert.equal(athleteButtons(tree).length, 0)
  assert.match(text(tree), /Ingen af radarens signaler/)
  const off = mount(CoachRadar, { enabled: false, source: next.source, context: coachHomeModel(next.source, day) })
  assert.equal(off.render(), null); await flushEffects(); assert.equal(pending.length, 9)
})
