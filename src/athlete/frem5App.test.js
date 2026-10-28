import { fileURL, install } from './frem5Loader.mjs'
install()
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { default: FremgangTab } = await import('./FremgangTab.jsx')
const { default: EnkelFremgangTab } = await import('./EnkelFremgangTab.jsx')
const { default: FremgangFokus } = await import('./fremgangFokus.mjs')
import { mount, nodes, text, button } from './frem5Dom.mjs'
const { fixture } = await import('./frem5Fixture.mjs')
import { jsx } from './frem5Jsx.mjs'
const cards = tree => nodes(tree, n => n.props['data-blok-styrke'] != null)
function props() {
  const f = fixture(new Date())
  return { ...f, fremgangLogs: [f.row(), f.row(4), f.row(5)], exerciseLogs: [f.row(5)], weightLogs: [], fremgangLoading: false }
}
for (const [name, Component] of [['Fremgang', FremgangTab], ['Enkel', EnkelFremgangTab], ['Fokus', FremgangFokus]]) {
  test(name + ': actual component imports, default OFF and three opt-in lift charts', () => {
    const p = props(), app = mount(Component, p)
    assert.equal(cards(app.render()).length, 0)
    const dom = app.render({ ...p, blokStyrke: true })
    assert.equal(cards(dom).length, 1)
    assert.equal(nodes(cards(dom)[0], n => n.props['data-blok-styrke-loeft'] != null).length, 3)
    assert.equal(nodes(cards(dom)[0], n => n.type === 'svg').length, 1)
    assert.match(text(cards(dom)[0]), /epley/i)
    const loading = app.render({ ...p, blokStyrke: true, fremgangLoading: true })
    assert.equal(cards(loading)[0].props['data-blok-styrke'], 'loading')
  })
}
test('Enkel: records route stays separate; strength route displays new card', () => {
  const p = { ...props(), blokStyrke: true }
  const app = mount(EnkelFremgangTab, p)
  assert.equal(cards(app.render({ ...p, enkelDel: 'rekorder' })).length, 0)
  assert.equal(cards(app.render({ ...p, enkelDel: 'styrke' })).length, 1)
})
test('Fokus: real detail-toggle handler never duplicates card; records route excludes it', () => {
  const p = { ...props(), blokStyrke: true, enkelOn: true, enkelDel: 'styrke' }
  const app = mount(FremgangFokus, p)
  const dom = app.render()
  button(dom, 'Se alle detaljer').props.onClick()
  const expanded = app.render()
  assert.equal(cards(expanded).length, 1)
  assert.equal(nodes(expanded, n => n.props['aria-label'] === 'Alle fremgangsdetaljer').length, 1)
  assert.equal(cards(app.render({ ...p, enkelDel: 'rekorder' })).length, 0)
})
test('wiring has strict opt-in through both athlete entry routes, with valid JSX for LF and CRLF', () => {
  for (const name of ['App.jsx', 'AthleteView.jsx', 'FremgangTab.jsx', 'EnkelFremgangTab.jsx']) {
    const source = readFileSync(fileURL(name), 'utf8')
    for (const ending of ['\n', '\r\n']) assert.doesNotThrow(() => jsx(source.replace(/\r?\n/g, ending)))
    assert.match(source, /blokStyrke = false/)
  }
  const app = readFileSync(fileURL('App.jsx'), 'utf8')
  assert.equal((app.match(/blokStyrke: blokStyrke === true/g) || []).length, 2)
  const athlete = readFileSync(fileURL('AthleteView.jsx'), 'utf8')
  assert.equal((athlete.match(/\{ blokStyrke: blokStyrke === true/g) || []).length, 4)
})
