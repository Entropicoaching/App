// Actual copied components; synthetic hook runner, receipts and storage only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from '../kostplan/coach/portal.fixture.mjs'

const root = new URL('../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('../kostplan/coach/portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const { default: CoachKostMaal } = await import('../kostMaalKobling.mjs')
hooks.deregister()

function fixture() {
  return { enabled: true, athlete: { id: 'synthetic-a' }, today: '2026-11-02', weightLogs: [],
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'] },
    coachNutrition: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'],
      state: 'ready', complete: true, from: '2026-10-27', through: '2026-11-02', targets: [], rows: [] } }
}
const buttons = (tree, label) => nodes(tree).filter(n => n.type === 'button' && text(n) === label)

test('sparse complete data gives one goals action and one weighing state; help is explicit', () => {
  const p = fixture(), screen = mount(KostMaal, p), tree = screen.render()
  assert.equal(buttons(tree, 'Sæt kostmål').length, 1)
  assert.equal((text(tree).match(/Ingen vejninger endnu/g) ?? []).length, 1)
  assert.doesNotMatch(text(tree), /Ingen mål endnu|Ingen kropsvægt|Ugegennemsnit|Trend ·|mål mangler|mindst 4 kostdage/)
  assert.equal(nodes(tree).filter(n => n.type === 'dl').length, 0)
  buttons(tree, 'Hjælp til energimål')[0].props.onClick()
  assert.equal((text(screen.render()).match(/Log en gyldig vejning og mindst 4 kostdage/g) ?? []).length, 1)
  assert.doesNotMatch(text(screen.render({ athlete: { id: 'synthetic-b' } })), /mindst 4 kostdage/)
})

test('profile weight and logged weight stay distinct; old or sparse logs produce no unknown rows', () => {
  const p = fixture(); p.athlete.bodyweight = 90
  for (const [date, expectedAverage] of [['2026-09-01', false], [p.today, true]]) {
    const tree = mount(KostMaal, { ...p, weightLogs: [{ logged_at: date, weight: 80 }] }).render()
    assert.match(text(tree), /Kropsvægt i profilen 90 kg/)
    assert.match(text(tree), /Seneste vejning 80 kg/)
    assert.equal(/Ugegennemsnit/.test(text(tree)), expectedAverage)
    assert.doesNotMatch(text(tree), /Trend ·|Ingen vejninger|Flere vejninger nødvendige/)
  }
})

test('weight failure keeps goals and draft accessible, blocks dependent suggestions and forwards retry', () => {
  const p = fixture(); p.athlete.kcal_target = 2200
  let retries = 0
  const props = { ...p, weightStatus: { athleteId: p.athlete.id, state: 'error', retry: () => { retries++ } } }
  const storage = memoryStorage(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const screen = mount(CoachKostMaal, props)
    let tree = screen.render()
    assert.equal(nodes(tree).filter(n => n.props.role === 'alert').length, 1)
    assert.match(text(tree), /2\.200 kcal/)
    assert.doesNotMatch(text(tree), /Ingen vejninger|Seneste vejning|Typisk indtag|Ugegennemsnit|Trend ·/)
    buttons(tree, 'Hent vægt igen')[0].props.onClick(); assert.equal(retries, 1)
    const plan = nodes(tree).find(n => n.type === 'details' && text(n).trim() === 'Kostplan')
    assert.ok(plan); assert.equal(storage.calls.length, 0)
    plan.props.onToggle({ currentTarget: { open: true } }); tree = screen.render()
    assert.match(text(tree), /Lokal kladde · ikke delt med atleten/)
    assert.doesNotMatch(text(tree), /Ikke oplyst|Grundlag og tidligere erfaringer|Ingen kladde på skærmen|migration|Ugens kostjustering/)
    assert.equal(storage.calls.filter(c => c[0] === 'set').length, 0)
    tree = screen.render({ weightStatus: { athleteId: p.athlete.id, state: 'loading' } })
    assert.match(text(tree), /Indlæser vægtgrundlag/)
    assert.equal(buttons(tree, 'Hent vægt igen').length, 0)
    assert.doesNotMatch(text(tree), /Ingen vejninger/)
    tree = screen.render({ weightStatus: { athleteId: p.athlete.id, state: 'ready', rows: [] } })
    assert.equal((text(tree).match(/Ingen vejninger endnu/g) ?? []).length, 1)
    assert.doesNotMatch(text(tree), /Vægtgrundlaget kunne ikke hentes/)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('unavailable nutrition has one status and no derived energy or attainment', () => {
  for (const state of ['loading', 'error', 'partial']) {
    const p = fixture(); p.coachNutrition.state = state; p.coachNutrition.complete = false
    const tree = mount(KostMaal, p).render()
    const statuses = nodes(tree).filter(n => ['alert', 'status'].includes(n.props.role) && /Kostgrundlaget/.test(text(n)))
    assert.equal(statuses.length, 1)
    assert.equal(statuses[0].props.role, state === 'error' ? 'alert' : 'status')
    assert.doesNotMatch(text(tree), /Typisk indtag|Seneste 7 dage|mindst 4 kostdage/)
  }
})
