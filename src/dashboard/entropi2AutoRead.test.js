// Entropi 2-kobling runde 3, fund 2: med flaget tændt markerer beskedfanen ikke læst ved indlæsning.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './coachFourWeeksLoader.mjs'
install()
const { useDashboardEffekter } = await import('./useDashboardEffekter.js')
const fake = await import('./coachFourWeeksFake.mjs')

// Det præcise argument, Dashboard giver hooken, læses fra kilden og evalueres med e2 og den gamle callback.
const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
const expression = source.match(/isMobile, loadError, loading, markMessagesRead: (.+?), openAwaitingAnalysisVideo,/)?.[1]
const argument = new Function('e2', 'markMessagesRead', 'return ' + expression)

function useMessageEffectProbe(e2) {
  fake.effects.length = 0
  const loaded = [], marked = []
  const markMessagesRead = (...args) => marked.push(args)
  useDashboardEffekter({ activeTab: 'beskeder', selectedAthlete: { id: 'syn-a' }, coachMsgTrack: 'teknik', athletes: [],
    fetchMessages: id => loaded.push(id), markMessagesRead: argument(e2, markMessagesRead) })
  const effect = fake.effects.find(e => e.fn.toString().includes('markMessagesRead(selectedAthlete.id, coachMsgTrack)'))
  assert.ok(effect, 'den faktiske beskedeffekt findes')
  effect.fn()
  return { loaded, marked }
}

test('F2: Dashboard giver hooken et betinget markMessagesRead-argument', () => {
  assert.ok(expression, 'argumentet findes i Dashboard.jsx')
  const original = () => {}
  assert.equal(argument(false, original), original, 'slukket: præcis den gamle callback')
  assert.notEqual(argument(true, original), original)
})

test('F2: flaget slukket henter og markerer læst som før', () => {
  const { loaded, marked } = useMessageEffectProbe(false)
  assert.deepEqual(loaded, ['syn-a'])
  assert.deepEqual(marked, [['syn-a', 'teknik']])
})

test('F2: flaget tændt henter beskeder, men kalder aldrig markMessagesRead ved indlæsning', () => {
  const { loaded, marked } = useMessageEffectProbe(true)
  assert.deepEqual(loaded, ['syn-a'])
  assert.deepEqual(marked, [])
})
