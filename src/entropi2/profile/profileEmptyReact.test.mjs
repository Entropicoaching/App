// Required real React regression checks. No adapter, fallback or silent skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Profile from './Profile.mjs'

const render = props => renderToStaticMarkup(h(Profile, { enabled: true, ...props }))

test('real React: empty optional profile fields leave no empty cards or unavailable logout', () => {
  for (const athlete of [undefined, null, {}, { name: ' ', goal: '', kcal_target: 0, protein_target: 'invalid' }]) {
    const html = render({ athlete })
    assert.match(html, /<h1[^>]*>Mig<\/h1>/)
    assert.doesNotMatch(html, /<dl|<dt|<dd|<button|Mine kostmål|ikke angivet|Intet mål|Log ud/)
  }
})

test('real React: a partial profile displays only known values and hides an empty nutrition card', () => {
  const name = render({ athlete: { name: 'Testatlet' } })
  assert.match(name, /<dt[^>]*>Navn<\/dt>.*Testatlet/)
  assert.doesNotMatch(name, /Mit mål|Mine kostmål/)
  for (const [athlete, visible, absent] of [
    [{ kcal_target: 2400 }, /2\.400 kcal/, /Protein/],
    [{ protein_target: '150.5' }, /150,5 g/, /Kalorier/],
  ]) {
    const html = render({ athlete })
    assert.match(html, /Mine kostmål/); assert.match(html, visible)
    assert.doesNotMatch(html, absent)
    assert.equal((html.match(/<dt[ >]/g) ?? []).length, 1)
  }
})

test('real React: existing flags, text escaping and child content survive field omission', () => {
  const html = render({ athlete: { goal: 'bulk', kcal_target: 2400 }, hideGoal: true, visKost: false,
    children: h('p', null, 'Eksisterende indhold') })
  assert.doesNotMatch(html, /<dl|Mine kostmål|Opbygning|2\.400/)
  assert.match(html, /Eksisterende indhold/)
  const untrusted = render({ athlete: { name: '<script>synthetic</script>' } })
  assert.match(untrusted, /&lt;script&gt;synthetic&lt;\/script&gt;/)
  assert.doesNotMatch(untrusted, /<script>/)
  assert.equal(renderToStaticMarkup(h(Profile, { enabled: false })), '')
})

test('real React: logout remains in the account menu unless a usable callback is supplied', () => {
  const onLogOut = () => assert.fail('render must not log out')
  for (const props of [{}, { onLogOut, preview: true }, { onLogOut, hideLogout: true }])
    assert.doesNotMatch(render(props), /<button|Log ud er ikke tilgængeligt/)
  assert.match(render({ onLogOut }), /<button[^>]*>Log ud<\/button>/)
  assert.match(render({ onLogOut, loggingOut: true }), /disabled=""[^>]*>Logger ud…/)
  assert.match(render({ onLogOut, logoutError: true }), /role="alert"[^>]*>Du kunne ikke logges ud\. Prøv igen\./)
})
