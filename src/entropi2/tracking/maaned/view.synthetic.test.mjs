import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, populated } from './fixtures.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: CoachMonth } = await import('./CoachMonth.mjs')
const nodes = node => typeof node === 'object' && node !== null ? [node, ...node.children.flatMap(nodes)] : []
const text = node => typeof node === 'object' && node !== null ? node.children.map(text).join(' ') : String(node)
const render = snapshot => CoachMonth({ enabled: true, snapshot })

test('synthetic actual view: OFF avoids snapshot getters', () => {
  assert.equal(CoachMonth({ get snapshot() { throw Error('OFF read') } }), null)
})
test('synthetic actual view: loading, error/retry, empty and populated are distinct', () => {
  assert.equal(render({ status: 'loading' }).props['aria-busy'], true)
  const fail = CoachMonth({ enabled: true, snapshot: { status: 'ready', complete: false }, onRetry() {} })
  assert.ok(nodes(fail).some(n => n.props.role === 'alert'))
  assert.ok(nodes(fail).some(n => n.type === 'button' && typeof n.props.onClick === 'function'))
  assert.ok(!text(fail).includes('Ingen registreringer'))
  assert.match(text(render(fixture())), /Ingen registreringer i perioden/)
  assert.match(text(render(populated())), /Styrkefald: Squat/)
})
test('synthetic actual view: all domains, evidence and mobile disclosure; no private fields', () => {
  const s = populated(); Object.defineProperty(s, 'cycle', { get() { throw Error('private read') } })
  const view = render(s), words = text(view), all = nodes(view)
  for (const phrase of ['Styrke pr. hovedløft', 'Gennemførte pas', 'Volumen og intensitet',
    'Kost- og vægttrend', 'Dagsform', 'Tracking og datakvalitet', 'Vis flagets datagrundlag',
    '2026-10-08', '2026-11-04', 'Ingen automatiske programændringer']) assert.ok(words.includes(phrase), phrase)
  assert.ok(all.filter(n => n.type === 'summary').every(n => n.props.style.minHeight >= 44))
  assert.ok(!all.some(n => n.type === 'details' && n.props.open))
  assert.ok(!/NaN|Infinity|undefined|cycle|cyklus/.test(words))
  assert.equal(all.filter(n => n.type === 'h3' && text(n).includes('Styrkefald:')).length, 1)
})
