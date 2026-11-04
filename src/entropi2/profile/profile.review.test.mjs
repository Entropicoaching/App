// Independent counterchecks of the public component contract, using actual imports.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: Profile } = await import('./Profile.mjs')
const flatten = n => Array.isArray(n) ? n.flatMap(flatten) : n && typeof n === 'object' ? [n, ...flatten(n.props.children)] : []

test('review: every enabled variant has one named native logout control and no automatic call', () => {
  for (const extra of [{}, { preview: true }, { loggingOut: true }, { logoutError: true }, { athlete: null }]) {
    let calls = 0
    const nodes = flatten(Profile({ enabled: true, onLogOut: () => calls++, ...extra }))
    assert.equal(calls, 0)
    const controls = nodes.filter(n => n.type === 'button')
    assert.equal(controls.length, 1)
    assert.equal(controls[0].props.type, 'button')
    assert.ok(controls[0].props.children.match(/Log ud|Logger ud/))
    assert.ok(controls[0].props.style.minHeight >= 44)
  }
})

test('review: only explicit true renders; OFF cannot evaluate an athlete getter', () => {
  for (const enabled of [null, 0, '', 'false', {}, []]) {
    assert.equal(Profile({ enabled, get athlete() { throw Error('OFF data access') } }), null)
  }
})

test('review: numeric strings remain targets, never consumed totals or another field', () => {
  const nodes = flatten(Profile({ enabled: true, athlete: Object.freeze({ name: 'Fixture', goal: 'Mål',
    kcal_target: '2100', protein_target: '125', kcal: 9999, protein: 9999, user_id: 'not-for-display' }) }))
  const values = nodes.filter(n => n.type === 'dd').map(n => n.props.children)
  assert.deepEqual(values, ['Fixture', 'Mål', '2.100 kcal', '125 g'])
})

test('review: production modules have no runtime services, writes, effects or HTML injection', () => {
  for (const name of ['Profile.mjs', 'profileModel.mjs', 'profileStyles.mjs']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|setInterval|setTimeout|useEffect|dangerouslySetInnerHTML)\b/)
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:supabase|auth|queue|offline)/i)
  }
})
