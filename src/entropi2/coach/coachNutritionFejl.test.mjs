import test from 'node:test'
import assert from 'node:assert/strict'
import { CoachView } from './CoachScreen.mjs'

// K-R3-ENTROPI-SAMLET fund 3: en fejlet kostlaesning maa ikke ligne fravaer af kostdata.
const today = '2026-11-03'
const props = coachNutrition => ({ enabled: true, tab: 'home', today: new Date(`${today}T10:00:00Z`),
  session: { user: { id: 'owner-1' } }, readContext: { coachId: 'owner-1', day: today, athleteIds: ['athlete-1'] },
  athletes: [{ id: 'athlete-1', name: 'Syntetisk atlet' }], loading: false, loadError: false, coachNutrition })
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) :
  !n || typeof n !== 'object' ? [] : [n, ...nodes(n.props?.children ?? n.children)]
const text = n => nodes(n).filter(x => typeof x === 'string').join(' ')
const strings = n => JSON.stringify(n, (k, v) => typeof v === 'function' ? undefined : v)

test('kostfejl vises aabent med fejltekst og knap til at hente igen', () => {
  let reloads = 0
  const view = CoachView(props({ coachId: 'owner-1', day: today, athleteIds: ['athlete-1'], state: 'error',
    complete: false, reload: () => { reloads++ } }))
  const all = nodes(view)
  const fold = all.find(n => n.props?.['data-coach-nutrition-state'] === 'error')
  assert.ok(fold, 'kostfolden findes ved fejl')
  assert.equal(fold.props.open, true)
  assert.match(strings(view), /Kostdata kunne ikke hentes/)
  const retry = all.find(n => n.type === 'button' && /Hent kost igen/.test(strings(n)))
  assert.ok(retry); retry.props.onClick(); assert.equal(reloads, 1)
})

test('ufuldstaendig kost vises som ufuldstaendig, ikke som tom', () => {
  const view = CoachView(props({ coachId: 'owner-1', day: today, athleteIds: ['athlete-1'], state: 'partial', complete: false }))
  assert.match(strings(view), /Kostdata er ufuldstændige/)
})

test('igangvaerende kostlaesning viser hverken fejl eller kostfold', () => {
  const view = CoachView(props(undefined))
  assert.doesNotMatch(strings(view), /Kostdata kunne ikke hentes|Kostdata er ufuldstændige/)
  assert.equal(nodes(view).some(n => n.props?.['data-coach-fold'] === 'kost'), false)
})
