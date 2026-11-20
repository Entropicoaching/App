// Ordre 2019: svarfeltet rulles kun ind i synet, når profilen åbnes fra forsidens besked-række.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === new URL('../../dashboard/navigation.js', import.meta.url).href &&
    ['../weekDates', '../coachPriority'].includes(specifier)) return next(specifier + '.js', context)
  return next(specifier, context)
} })
const { lavNavigation } = await import('../../dashboard/navigation.js')
const { rulSvarfeltNaarKlar, venterSvarfeltRul, nulstilSvarfeltRul, bedOmSvarfeltRul } = await import('./svarfeltRul.mjs')

function navigation() {
  const fast = { viewRef: { current: 'profile' }, listScrollYRef: { current: 0 }, messageThreadAthleteRef: { current: null },
    analyseTabFactory: () => Promise.resolve({}), athletes: [], calendarWeeks: {} }
  return lavNavigation(new Proxy(fast, { get: (mål, key) => key in mål ? mål[key] : () => {} }))
}
const athlete = { id: 'a-1', name: 'Syntetisk atlet' }

function samtale(state) {
  let lytter = null
  return { subscribe(fn) { lytter = fn; fn(state.nu); return () => { lytter = null } }, send: next => { state.nu = next; lytter?.(next) } }
}
const klar = { available: true, loaded: true, loading: false }
function dokument() {
  const kald = []
  return { kald, querySelector: sel => sel === 'section[aria-label="Skriv en besked"]' ? { scrollIntoView: arg => kald.push(arg) } : null }
}

test('besked-rækken beder om rulning, og kun den', () => {
  nulstilSvarfeltRul()
  const nav = navigation()
  nav.openProfile(athlete, 'beskeder', 'list')
  assert.equal(venterSvarfeltRul('a-1'), false)
  nav.openCoachPriorityItem({ kind: 'video', key: 'video-1', athlete, video: { id: 'v1', lift: 'squat' } }, 'list')
  assert.equal(venterSvarfeltRul('a-1'), false)
  nav.openCoachPriorityItem({ kind: 'signal', key: 'signal-1', athlete }, 'list')
  assert.equal(venterSvarfeltRul('a-1'), false)
  nav.openCoachPriorityItem({ kind: 'message', key: 'msg-1', athlete, track: 'besked' }, 'list')
  assert.equal(venterSvarfeltRul('a-1'), true)
  assert.equal(venterSvarfeltRul('a-2'), false)
  // En ny åbning på anden vis fjerner anmodningen igen.
  nav.openProfile(athlete, 'beskeder', 'list')
  assert.equal(venterSvarfeltRul('a-1'), false)
})

test('hjælperen ruller først når tråden er tegnet, én gang, uden fokus', () => {
  nulstilSvarfeltRul()
  navigation().openCoachPriorityItem({ kind: 'message', key: 'msg-1', athlete, track: 'besked' }, 'list')
  const doc = dokument(), state = { nu: { available: true, loaded: false, loading: true } }
  const controller = samtale(state)
  rulSvarfeltNaarKlar({ controller, athleteId: 'a-1', doc })
  assert.equal(doc.kald.length, 0)
  controller.send(klar)
  assert.deepEqual(doc.kald, [{ block: 'end', behavior: 'instant' }])
  controller.send(klar)
  assert.equal(doc.kald.length, 1)
  assert.equal(venterSvarfeltRul('a-1'), false)
})

test('uden anmodning eller for en anden atlet sker der intet', () => {
  nulstilSvarfeltRul()
  const doc = dokument()
  rulSvarfeltNaarKlar({ controller: samtale({ nu: klar }), athleteId: 'a-1', doc })
  navigation().openCoachPriorityItem({ kind: 'message', key: 'msg-1', athlete, track: 'besked' }, 'list')
  rulSvarfeltNaarKlar({ controller: samtale({ nu: klar }), athleteId: 'a-2', doc })
  assert.equal(doc.kald.length, 0)
  nulstilSvarfeltRul()
})

test('en anmodning, der ikke bruges, bortfalder efter ti sekunder', () => {
  nulstilSvarfeltRul()
  bedOmSvarfeltRul('a-1', 1000)
  assert.equal(venterSvarfeltRul('a-1', 5000), true)
  assert.equal(venterSvarfeltRul('a-1', 11001), false)
})
