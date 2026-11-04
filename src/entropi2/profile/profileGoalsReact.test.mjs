// Required real React checks. Deliberately no loader, fallback or silent skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileGoals } from './ProfileGoals.mjs'
import { ProfileGoalsView } from './ProfileGoalsView.mjs'
import { ProfilePage } from './ProfilePage.mjs'
import { athleteGoals, goalDraft } from './profileGoalsModel.mjs'

const athlete = { id: 'fixture-athlete', user_id: 'fixture-user', goal: 'bulk', weight_class: 83, competition_date: '2027-03-14' }
const state = extra => {
  const values = athleteGoals(athlete)
  return { phase: 'ready', values, draft: goalDraft(values), localFields: [], errors: {}, message: '', pending: false, ...extra }
}
const render = (component, props) => renderToStaticMarkup(h(component, props))

test('real React profile mounts goals once, retains export and does not read or write during SSR', () => {
  const html = render(ProfilePage, { enabled: true, ownerId: athlete.user_id, athlete, onClose() {},
    client: { from() { assert.fail('SSR database access') } } })
  assert.match(html, /Mine mål og stævne/); assert.match(html, /83 kg/); assert.match(html, /14.03.2027/)
  assert.match(html, /Kropsvægtmål/); assert.match(html, /Eksportér mine data/)
  assert.equal((html.match(/<dt[^>]*>Mit mål<\/dt>/g) ?? []).length, 1)
  assert.match(html, /Henter dine mål/)
  assert.equal(render(ProfileGoals, { enabled: false }), '')
  assert.equal(render(ProfileGoals, { enabled: true, ownerId: 'other', athlete }), '')
  assert.equal(ProfileGoals(new Proxy({ enabled: false }, { get(o, k) { assert.equal(k, 'enabled'); return o[k] } })), null)
})

test('real React renders the populated view, labelled mobile fields and folded editor', () => {
  const html = render(ProfileGoalsView, { state: state({ values: { ...athleteGoals(athlete), target_weight: 81.5 }, localFields: ['target_weight'] }) })
  assert.match(html, /Opbygning/); assert.match(html, /81,5 kg.*kun på denne enhed/)
  assert.match(html, /<details>/); assert.doesNotMatch(html, /<details[^>]* open/)
  for (const key of ['goal', 'weight_class', 'competition_date', 'target_weight']) {
    assert.ok(html.includes(`for="entropi2-profile-goal-${key}"`))
    assert.ok(html.includes(`id="entropi2-profile-goal-${key}"`))
  }
  assert.match(html, /min-height:52px/)
})

test('real React renders empty and saving states without invented targets', () => {
  const values = athleteGoals(null)
  const html = render(ProfileGoalsView, { state: state({ values, draft: goalDraft(values) }) })
  assert.doesNotMatch(html, /<dl|Intet mål angivet endnu|Intet stævne angivet endnu|Ikke angivet endnu/)
  const pending = render(ProfileGoalsView, { state: state({ phase: 'saving', pending: true }) })
  assert.match(pending, /aria-busy="true"/); assert.match(pending, /disabled/); assert.match(pending, /Gemmer…/)
})

test('real React renders failure, retry and invalid-field associations with the draft intact', () => {
  const html = render(ProfileGoalsView, { state: state({ phase: 'error', message: 'Målene blev ikke gemt. Prøv igen.',
    draft: { ...state().draft, target_weight: '-1' }, errors: { target_weight: 'Brug en vægt over 0.' } }) })
  assert.match(html, /role="alert"/); assert.match(html, /ikke gemt/); assert.match(html, /value="-1"/)
  assert.match(html, /aria-invalid="true"/); assert.match(html, /aria-describedby="entropi2-profile-goal-target_weight-error"/)
  assert.match(render(ProfileGoalsView, { state: state({ phase: 'load-error', message: 'Lokale mål kunne ikke læses.' }) }), /Prøv igen/)
})


test('real React announces local save and preserves coach free text as escaped text', () => {
  const html = render(ProfileGoalsView, { state: state({ coachGoal: '<script>coach</script>',
    message: 'Gemt på denne enhed; din coach ser det ikke endnu', localFields: ['goal'] }) })
  assert.match(html, /Gemt på denne enhed; din coach ser det ikke endnu/)
  assert.match(html, /Coachens mål: &lt;script&gt;coach&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>|Genindlæs appen/)
})
