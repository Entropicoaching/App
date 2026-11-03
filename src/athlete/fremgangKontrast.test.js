// E2-FREMGANG-KONTRAST1: fremgangens analyse (rel1101) skal have læsbare overskrifter i både lyst og mørkt skema.
// Runde 11 (K-R10 fund 5): rettelsen gælder kun med Entropi 2 tændt, via entropi2.css-reglen
// [data-entropi2-athlete] [data-analyse-atlet1] :is(h1, h2, h3); index.css er uændret med flaget slukket.
// Renderer de faktiske fremgangsmoduler og læser den faktiske src/index.css og appens mørke bund i src/App.jsx.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, mount, nodes } from './analyseAtlet1Harness.mjs'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const ground = app.match(/minHeight: '100vh', background: '(#[0-9a-f]{6})'/)[1]
const textH = {
  light: css.match(/^:root \{[^}]*?--text-h: (#[0-9a-f]{6});/m)[1],
  dark: css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{[^}]*?--text-h: (#[0-9a-f]{6});/)[1],
}
const e2css = readFileSync(new URL('../entropi2/entropi2.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const e2Rule = e2css.replace(/\/\*[^]*?\*\//g, '').match(/([^{}]*)\{\s*color:\s*(#[0-9a-f]{6});\s*\}/i)
const e2Color = e2Rule[2]
const entries = ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs']
const week = { id: 'w', start_date: '2026-10-26', block_name: 'Grundstyrke', sessions: [{ exercises: [{ id: 'e', name: 'Squat', sets: 3 }] }] }
const props = { rel1101: true, fremgangLogs: [], fremgangLoading: false, currentWeek: week, allWeeks: [week], exerciseLogs: [] }

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// Overskrifternes faktiske farve: h1/h2 får var(--text-h) fra index.css, medmindre lys-reglen lader dem arve.
function headings(tree, scheme, withRule) {
  const out = []
  const walk = (node, inherited, inside) => {
    if (node == null || typeof node !== 'object') return
    const own = node.props.style?.color
    const here = own ?? inherited
    const scoped = inside || node.props['data-analyse-atlet1'] === true
    if (node.type === 'h1' || node.type === 'h2') {
      const color = own ?? (withRule && scoped ? e2Color : textH[scheme])
      out.push({ tag: node.type, scoped, color })
    }
    for (const child of node.props.children) walk(child, here, scoped)
  }
  walk(tree, null, false)
  return out
}

test('R11: index.css er uændret; fremgangens overskrifter rettes kun under Entropi 2-rammen i entropi2.css', () => {
  assert.equal(css.split('[data-analyse-atlet1]').length - 1, 0)
  assert.equal(css.indexOf('E2-FREMGANG-KONTRAST1'), -1)
  const selectors = e2Rule[1].split(/,\s*\n/).map(s => s.trim()).filter(Boolean)
  assert.ok(selectors.includes('[data-entropi2-athlete] [data-analyse-atlet1] :is(h1, h2, h3)'))
  assert.ok(!selectors.some(s => s.startsWith('[data-analyse-atlet1]')))
  assert.equal(textH.light, '#08060d')
  assert.equal(textH.dark, '#f3f4f6')
  assert.equal(ground, '#141410')
})

for (const name of entries) {
  test(name + ': analysens overskrifter har mindst 4,5:1 i lyst og mørkt skema med rel1101 tændt', async () => {
    const tree = mount((await load(name)).default, props).render()
    const section = nodes(tree, n => n.props['data-analyse-atlet1'] === true)
    assert.equal(section.length, 1)
    assert.equal(section[0].props.style.color, '#edeae2')
    const withRule = true // Entropi 2 tændt: analysen ligger i den markerede atletramme
    for (const scheme of ['light', 'dark']) {
      const heads = headings(tree, scheme, withRule).filter(x => x.scoped)
      assert.deepEqual(heads.map(x => x.tag), ['h1', 'h2', 'h2', 'h2'])
      for (const x of heads) assert.ok(contrast(x.color, ground) >= 4.5, `${scheme} ${x.tag} ${x.color} paa ${ground}`)
    }
    // Uden reglen er fejlen genskabt (ca. 1,1:1 i lyst skema), og mørkt skema er det samme med og uden.
    const before = headings(tree, 'light', false).filter(x => x.scoped)
    assert.ok(before.every(x => contrast(x.color, ground) < 1.2))
    // Flaget slukket: farverne er de oprindelige i begge skemaer.
    for (const scheme of ['light', 'dark']) assert.ok(headings(tree, scheme, false).every(x => x.color === textH[scheme]))
  })

  test(name + ': med rel1101 slukket renderes ingen analyse, så reglen rammer intet', async () => {
    const tree = mount((await load(name)).default, { ...props, rel1101: false }).render()
    assert.equal(nodes(tree, n => n.props['data-analyse-atlet1'] === true).length, 0)
  })
}
