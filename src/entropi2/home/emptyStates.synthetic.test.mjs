import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount } from '../../athlete/trainingFullscreenFake.mjs'
import { weekPlanModel } from './ugeplan/weekPlanModel.mjs'

// Shallow synthetic hook host: actual Home, wrapper, model and navigation imports.
// Effects are disabled only in the session wrapper, which otherwise mounts a DOM renderer.
const hostURL = new URL('../../athlete/trainingFullscreenFake.mjs', import.meta.url).href
const homeHooks = 'data:text/javascript,' + encodeURIComponent(`export * from ${JSON.stringify(hostURL)}; export const useMemo = fn => fn();`)
const wrapperURL = new URL('./HomeSession.mjs', import.meta.url).href
const wrapperHooks = 'data:text/javascript,' + encodeURIComponent(
  `export * from ${JSON.stringify(hostURL)}; export const useEffect = () => {};`)
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true,
    url: context.parentURL === wrapperURL ? wrapperHooks : homeHooks }
  return next(specifier, context)
} })
const { default: Home } = await import('./AthleteHome.mjs')
const { default: HomeSession } = await import('./HomeSession.mjs')
const now = new Date('2026-11-03T12:00:00Z')
const athlete = { id: 'synthetic-a', name: 'Testfornavn Testefternavn' }
const week = { id: 'synthetic-w', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-s', title: '', weekday: null, exercises: [
    { id: 'synthetic-e1', name: '  ', sets: 1, note: 'Syntetisk bevaret note' },
    { id: 'synthetic-e2', name: 'Syntetisk løft', sets: 2 },
  ] }] }
const props = extra => ({ enabled: true, athlete, now, allWeeks: [week], currentWeek: week,
  exerciseLogs: [], onStartSession() {}, ...extra })
const show = (t, extra) => { const view = mount(Home, props(extra)); t.after(() => view.unmount()); return view }

test('empty/error/holiday headings are calm; genuine errors and offline restrictions stay visible', t => {
  for (const extra of [{ allWeeks: [], currentWeek: undefined }, { onHoliday: true }, { programError: true },
    { offlineSnapshotAt: 'synthetic-snapshot' }, { exerciseLogs: undefined }]) {
    const view = show(t, extra)
    assert.equal(view.nodes(n => n.type === 'h1')[0].children[0], 'Dit overblik, Testfornavn')
    assert.equal(view.nodes(n => n.type === 'button' && n.children.includes('Start dagens pas')).length, 0)
  }
  assert.match(show(t, { programError: true }).text(), /kunne ikke hentes.*Tjek din forbindelse/)
  assert.ok(show(t, { programError: true, onRetryProgram() {} }).nodes(n => n.type === 'button' && n.children.includes('Hent igen')).length)
  assert.match(show(t, { offlineSnapshotAt: 'synthetic' }).text(), /Opdatér programmet.*før du registrerer/)
})

test('unnamed exercises and unknown dates disappear; known count, title fallback and notes remain', t => {
  const view = show(t)
  assert.match(view.text(), /Klar til dit pas, Testfornavn.*Træning.*0 af 3 sæt klaret/)
  assert.doesNotMatch(view.text(), /Dag ikke fastlagt|Øvelse uden navn|Sætstatus hentes|Testefternavn/)
  assert.equal(view.nodes(n => n.type === 'li').length, 1)
  assert.match(view.text(), /Syntetisk bevaret note/)
})

test('coach cards require text; newest displayable message and contact navigation are preserved', t => {
  for (const messages of [[], null, [{ sender_role: 'coach', content: '  ' }], [{ sender_role: 'athlete', content: 'synthetic' }]]) {
    const view = show(t, { messages })
    assert.equal(view.nodes(n => n.props['aria-label'] === 'Fra din coach').length, 0)
    assert.match(view.text(), /Din coach/)
  }
  const routes = [], view = show(t, { setTab: route => routes.push(route),
    messages: [{ sender_role: 'coach', content: 'Syntetisk besked' }, { sender_role: 'coach', content: '\n' }] })
  assert.match(view.text(), /Fra din coach.*Syntetisk besked/)
  view.nodes(n => n.type === 'button' && n.children.includes('Din coach'))[0].props.onClick()
  assert.deepEqual(routes, ['beskeder'])
})

test('read-only preview has no start button or wiring text; broken writer and stale week retain help', t => {
  const preview = mount(HomeSession, props({ onLogSet: undefined, setLogInputs: undefined }))
  const child = preview.nodes(n => n.type === Home)[0]
  assert.equal(child.props.sessionReadOnly, true)
  const view = show(t, child.props)
  assert.doesNotMatch(view.text(), /Start dagens pas|Start næste pas|Passet kunne ikke åbnes|Passtart er ikke/)
  const partial = mount(HomeSession, props({ onLogSet() {}, setLogInputs: undefined }))
  assert.equal(partial.nodes(n => n.type === Home)[0].props.sessionReadOnly, false)
  const unavailable = show(t, { onStartSession: undefined })
  const start = unavailable.nodes(n => n.type === 'button' && n.children.some(text => /^Start (dagens|næste) pas$/.test(text)))[0]
  assert.ok(start, 'self view keeps its start action when the writer is temporarily unavailable')
  assert.equal(start.props.disabled, true)
  assert.match(show(t, { onStartSession: undefined }).text(), /Passet kunne ikke åbnes.*genindlæse/)
  const next = { ...week, id: 'synthetic-next', start_date: '2026-11-09', week_number: 2 }
  assert.match(show(t, { now: new Date('2026-11-10T12:00:00Z'), allWeeks: [week, next] }).text(), /En ny uge er startet/)
})

test('unknown week fields stay unknown internally and never become completed badges', () => {
  const input = { enabled: true, athleteId: athlete.id, week, now, exerciseLogs: [] }
  const undated = weekPlanModel(input).rows[0]
  assert.equal(undated.day, null); assert.equal(undated.label, null)
  const unknown = weekPlanModel({ ...input, exerciseLogs: undefined }).rows[0]
  assert.equal(unknown.status, 'unknown'); assert.equal(unknown.label, null)
})

test('OFF has no prop/storage access or live interval; optional nutrition keeps its date gate', t => {
  const forbidden = () => assert.fail('OFF access')
  const view = mount(Home, { enabled: false, get athlete() { return forbidden() },
    storage: { getItem: forbidden, setItem: forbidden } })
  assert.equal(view.tree, null); view.unmount()
  for (const nutritionToday of [undefined, { date: '2026-11-02', kcal: 10 }])
    assert.doesNotMatch(show(t, { nutritionToday }).text(), /kcal/)
})
