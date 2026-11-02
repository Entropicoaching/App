// Entropi 2-kobling runde 9, F2: mobiliteten starter aldrig gårsdagens pas efter dansk midnat.
// Faktisk mobilityModel, mountMobility og Mobility med pakkens syntetiske DOM og React-bindinger.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './mobility-loader.mjs'
import { dom, button } from './synthetic-dom.mjs'
import { bindHooks } from './synthetic-react.mjs'
const hooks = install()
const { mobilityModel } = await import('./mobility-model.mjs')
const { mountMobility } = await import('./mobility-screen.mjs')
const { default: Mobility } = await import('./Mobility.mjs')
const { calendarDay } = await import('./public-calendarDate.mjs')

const lift = (id, name) => ({ id, name, sets: 3 })
const session = (id, weekday, ex) => ({ id, weekday, session_order: weekday, exercises: [ex] })
const uge = { id: 'w1', start_date: '2026-11-02', week_number: 1,
  sessions: [session('man', 0, lift('squat', 'Squat')), session('tirs', 1, lift('bench', 'Bench'))] }
// 2. november kl. 23:59 og 3. november kl. 00:01 dansk tid.
const mandag = new Date('2026-11-02T22:59:00Z'), tirsdag = new Date('2026-11-02T23:01:00Z')
const props = (now, extra = {}) => ({ enabled: true, athlete: { id: 'a', coach_id: 'coach-a' }, allWeeks: [uge], currentWeek: uge,
  exerciseLogs: [], now, ...extra })

test('R9 F2: modellen skifter pas ved dagsskiftet', () => {
  assert.equal(mobilityModel(props(mandag)).lift, 'Squat')
  assert.equal(mobilityModel(props(tirsdag)).lift, 'Bænkpres')
})

test('R9 F2: Start afviser et pas fra en tidligere dag og beder om en ny dag; dagens pas kan startes', () => {
  // Som AthleteView: dagen, skærmen blev beregnet for, sammenlignes med den aktuelle dag ved Start.
  let nu = mandag, stale = 0
  const beregnet = calendarDay(mandag)
  const root = dom()
  const dispose = mountMobility(root, props(mandag, { isCurrentDay: () => calendarDay(nu) === beregnet, onStaleDay: () => { stale++ } }))
  assert.match(root.textContent, /Forbered din squat/)
  // Reproduktion: skærmen står åben over midnat; uden kontrollen ville Start åbne mandagens rutine.
  nu = tirsdag
  button(root, 'Start mobilitet').click()
  assert.equal(stale, 1)
  assert.doesNotMatch(root.textContent, /1 af /)
  dispose()
  // Adapteren beregner dagen igen: ny montering med tirsdagen viser og starter bænkpresset.
  const root2 = dom()
  const dispose2 = mountMobility(root2, props(tirsdag, { isCurrentDay: () => true, onStaleDay: () => { stale++ } }))
  assert.match(root2.textContent, /Forbered din bænkpres/)
  button(root2, 'Start mobilitet').click()
  assert.match(root2.textContent, /1 af /)
  assert.equal(stale, 1)
  dispose2()
  // Uden kontrollen (andre kaldere) er Start uændret.
  const root3 = dom()
  mountMobility(root3, props(mandag))
  button(root3, 'Start mobilitet').click()
  assert.match(root3.textContent, /1 af /)
})

test('R9 F2: Mobility monteres igen, når dagskontrollen eller tidspunktet skifter', () => {
  const root = dom()
  let effect, cleanup, deps
  bindHooks({ useRef: () => ({ current: root }), useEffect: (fn, d) => { effect = fn; deps = d } })
  try {
    const current = () => true, stale = () => {}
    Mobility(props(mandag, { isCurrentDay: current, onStaleDay: stale }))
    cleanup = effect()
    assert.ok(deps.includes(current) && deps.includes(stale))
    assert.ok(deps.some(d => d === mandag))
    cleanup?.()
  } finally { bindHooks(null) }
  const source = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /const e2MobilityCurrent = useMemo\(\(\) => \(\) => today\(\) === e2Day, \[e2Day\]\)/)
  assert.match(source, /onProgram=\{e2GoProgram\} isCurrentDay=\{e2MobilityCurrent\} onStaleDay=\{e2Dag\.refresh\} \/>/)
})
test.after(() => hooks.deregister())
