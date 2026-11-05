// Actual copied adapter and model, synthetic React hooks and nutrition fixtures only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { mount, nodes, text } from './kostMaal/reactFixture.mjs'
const fixture = new URL('./kostMaal/reactFixture.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.endsWith('/kostMaalKobling.mjs'))
    return { url: 'data:text/javascript,' + encodeURIComponent(`export { createElement, useState } from '${fixture}'; export const useEffect = () => { throw Error('Unexpected effect') }`), shortCircuit: true }
  if (specifier === 'react' && (context.parentURL?.endsWith('/kostMaal/KostMaal.mjs') || context.parentURL?.endsWith('/kostplan/coach/PortalPlan.mjs') || context.parentURL?.endsWith('/kostplan/justering/KostJustering.mjs')))
    return { url: fixture, shortCircuit: true }
  return next(specifier, context)
} })
const { default: CoachKostMaal } = await import('./kostMaalKobling.mjs')
hooks.deregister()
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const today = '2026-11-02'
const athlete = { id: 'syn-a', kcal_target: 2400, protein_target: 160, bodyweight: 80 }
const ready = { athleteId: athlete.id, state: 'ready', rows: [
  { id: 'syn-weight', athlete_id: athlete.id, logged_at: today + 'T07:00:00Z', weight: 80 },
] }
const view = props => mount(CoachKostMaal, { enabled: true, athlete, weightStatus: ready, today, ...props }).render()

// K-R5: prove the connected adapter consumes the same receipt as the direct model.
function nutritionFixture() {
  return { session: { user: { id: 'syn-coach' } }, loading: false, loadError: false,
    readContext: { coachId: 'syn-coach', day: today, athleteIds: [athlete.id] },
    coachNutrition: { coachId: 'syn-coach', day: today, athleteIds: [athlete.id],
      from: '2026-10-27', through: today, state: 'ready', complete: true, targets: [],
      rows: Array.from({ length: 4 }, (_, i) => ({ id: `syn-meal-${i}`, athlete_id: athlete.id,
        date: ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30'][i], meal: 'Synthetic meal', kcal: 2400, protein: 150 })) } }
}

test('K-R5: connected kost tab shows four-day nutrition average and applies energy suggestion to draft only', () => {
  const p = nutritionFixture(), before = structuredClone(p)
  let draft = { kcal_target: '', protein_target: '170' }
  const out = view({ ...p, editing: 'setup', editData: draft, startEdit() {}, setEditing() {},
    setEditData: update => { draft = update(draft) }, saveEdit() { throw Error('Unexpected save') } })
  assert.match(text(out), /Seneste 7 dage: gns\. 2\.400 kcal \/ 150 g protein \(4 loggede dage\)/)
  assert.match(text(out), /Typisk indtag: 2\.400 kcal på 4 loggede dage/)
  const buttons = nodes(out, n => n.type === 'button' && n.props['aria-label'] === 'Brug forslag til energimål')
  assert.equal(buttons.length, 1)
  buttons[0].props.onClick()
  assert.deepEqual(draft, { kcal_target: 2400, protein_target: '170' })
  assert.deepEqual(p, before)
})

for (const [name, change] of Object.entries({
  loading: p => { p.loading = true }, loadError: p => { p.loadError = true },
  owner: p => { p.session.user.id = 'syn-foreign' },
  day: p => { p.readContext.day = '2026-11-01' },
  athlete: p => { p.readContext.athleteIds = ['syn-other'] },
  receiptOwner: p => { p.coachNutrition.coachId = 'syn-other' },
  incomplete: p => { p.coachNutrition.complete = false },
  receiptError: p => { p.coachNutrition.state = 'error' },
})) test(`K-R5: connected adapter preserves nutrition guard: ${name}`, () => {
  const p = nutritionFixture(); change(p)
  const out = text(view(p))
  assert.doesNotMatch(out, /Seneste 7 dage: gns\.|Typisk indtag:/)
  assert.doesNotMatch(out, /Energimålet kræver mindst 4 loggede dage/)
  assert.match(out, name === 'loading' ? /endnu ikke indlæst/
    : name === 'loadError' || name === 'receiptError' ? /kunne ikke hentes/
      : name === 'incomplete' ? /ufuldstændigt/ : /ikke tilgængeligt/)
})

test('K-R5: Dashboard forwards original receipt, context, session and read status to kost tab', () => {
  const source = read('../Dashboard.jsx')
  const tag = source.slice(source.indexOf('<CoachKostMaal '), source.indexOf('/>', source.indexOf('<CoachKostMaal ')))
  assert.match(tag, /coachNutrition=\{e2CoachNutrition\}/)
  assert.match(tag, /readContext=\{e2ReadContext\}/)
  assert.match(tag, /\bsession, loading, loadError,/)
})

test('K-R5: adapter forwards the original receipt and context by identity', () => {
  const p = nutritionFixture()
  const tree = CoachKostMaal({ enabled: true, athlete, weightStatus: ready, today, ...p })
  const matches = nodes(tree, node => node.type?.name === 'KostMaal')
  assert.equal(matches.length, 1)
  const element = matches[0]
  for (const key of ['session', 'loading', 'loadError', 'coachNutrition', 'readContext'])
    assert.equal(element.props[key], p[key], key)
})
