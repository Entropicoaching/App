// Deliberately uses installed React, with no synthetic loader or fallback.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileMenu, ProfilePage } from './ProfilePage.mjs'
import { ExportPanelView } from '../eksport/ExportPanel.mjs'
import { createAthleteExportFiles } from '../eksport/athleteExport.mjs'
const render = (component, props) => renderToStaticMarkup(h(component, props))
const input = { athleteId: 'fixture-athlete' }
for (const key of ['exerciseLogs', 'mealLogs', 'weightLogs']) input[key] = { athleteId: input.athleteId, state: 'ready', complete: true, rows: [] }
const files = [...createAthleteExportFiles(input, 'json'), ...createAthleteExportFiles(input, 'csv')]
test('real React renders profile, goals, folded export and a topbar menu', () => {
  const html = render(ProfilePage, { enabled: true, ownerId: 'fixture-user', athlete: {
    id: input.athleteId, user_id: 'fixture-user', name: 'Testatlet', goal: 'Stærkere', kcal_target: 2400 },
    onClose() {}, client: { from() { assert.fail('render must not read') } } })
  assert.match(html, /Testatlet/); assert.match(html, /Stærkere/); assert.match(html, /2.400 kcal/)
  assert.match(html, /<details/); assert.match(html, /Eksportér mine data/); assert.match(html, /Tilbage/)
  assert.match(render(ProfileMenu, { enabled: true }), /Profil og dataeksport/)
})
test('real React keeps OFF and foreign profiles inert', () => {
  assert.equal(ProfilePage({ enabled: false, get athlete() { assert.fail('OFF') } }), null)
  assert.equal(render(ProfilePage, { enabled: false }), '')
  assert.equal(render(ProfileMenu, { enabled: false }), '')
  assert.equal(render(ProfilePage, { enabled: true, ownerId: 'other', athlete: { user_id: 'fixture-user' } }), '')
})
test('real React distinguishes empty, loading and error and offers one action per local file', () => {
  const html = render(ExportPanelView, { state: { status: 'ready', empty: true, files } })
  assert.match(html, /ingen gemte data/); assert.equal((html.match(/Hent /g) || []).length, 4)
  assert.match(render(ExportPanelView, { state: { status: 'loading' } }), /disabled/)
  assert.match(render(ExportPanelView, { state: { status: 'error' } }), /role="alert"/)
})
test('native menu action closes its disclosure and opens only after a click', () => {
  let opens = 0
  const tree = ProfileMenu({ enabled: true, onOpen: () => opens++ })
  assert.equal(opens, 0)
  const details = { open: true }
  tree.props.children[1].props.onClick({ currentTarget: { closest: () => details } })
  assert.equal(opens, 1); assert.equal(details.open, false)
})
