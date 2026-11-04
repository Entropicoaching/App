import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { text, nodes } from './programFixture.mjs'

const files = ['Program.mjs', 'ProgramEntry.mjs'].map(file => new URL(file, import.meta.url).href)
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && files.includes(context.parentURL))
    return { url: new URL('./programFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Entry } = await import('./ProgramEntry.mjs')
const { default: Program } = await import('./Program.mjs')

test('OFF returns the exact supplied legacy element without reading program values', () => {
  const legacy = Object.freeze({ type: 'legacy-fixture' })
  for (const enabled of [undefined, false, null, 'true', 1]) {
    assert.equal(Entry({ enabled, children: legacy,
      get currentWeek() { throw Error('OFF read') }, get loading() { throw Error('OFF read') } }), legacy)
  }
})
test('ON mounts actual overview and preserves the exact existing logger tree in accessible disclosure', () => {
  const calls = [], legacy = { type: 'button', props: { onClick: () => calls.push('existing logger') }, children: ['Gem sæt'] }
  const currentWeek = { week_number: 1, sessions: [{ title: 'Pas', exercises: [{ name: 'Squat', sets: 3, reps: '5' }] }] }
  const tree = Entry({ enabled: true, currentWeek, children: legacy })
  const overview = tree.children[0]
  assert.equal(overview.type, Program)
  assert.match(text(overview.type(overview.props)), /Squat.*3 sæt/)
  const details = nodes(tree, 'details')[0], summary = nodes(tree, 'summary')[0]
  assert.equal(details.props.open, undefined)
  assert.ok(summary.props.style.minHeight >= 44)
  assert.match(text(summary), /Registrér sæt/)
  assert.equal(details.children[1], legacy)
  details.children[1].props.onClick()
  assert.deepEqual(calls, ['existing logger'])
})
