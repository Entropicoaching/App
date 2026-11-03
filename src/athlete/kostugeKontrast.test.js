// E2-KOSTUGE-KONTRAST1: atletens kostuge og coachens lokale analyseværktøj skal have læsbare h2 i lyst og mørkt skema.
// Runde 11 (K-R10 fund 5): rettelsen gælder kun med Entropi 2 tændt. Den ligger i entropi2.css (indlæses kun
// med flaget) under rodmarkørerne [data-entropi2-athlete] og [data-entropi2-coach-root]; index.css er uændret,
// så skærmene er præcis som før, når flaget er slukket.
// Renderer de faktiske KostUge.jsx og AnalyseLokaltVaerktoej.jsx (oversat med den eksisterende vaerd3Jsx-adapter)
// og læser den faktiske src/index.css og appens mørke bund i src/App.jsx.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './vaerd3Jsx.mjs'

const kostUrl = new URL('./KostUge.jsx', import.meta.url).href
const lokalUrl = new URL('../dashboard/AnalyseLokaltVaerktoej.jsx', import.meta.url).href
const targets = new Set([kostUrl, lokalUrl])
const stub = 'data:text/javascript,' + encodeURIComponent(
  'export function h(type, props, _unused, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }\n' +
  'export function useReducer(reducer, initial) { return [initial, () => {}] }')
const fundStub = 'data:text/javascript,' + encodeURIComponent('export default function FundReview() { return null }')
registerHooks({
  resolve(specifier, context, next) {
    if (!targets.has(context.parentURL)) return next(specifier, context)
    if (specifier === 'react' || specifier === stub) return { url: stub, shortCircuit: true }
    if (specifier === './FundReview') return { url: fundStub, shortCircuit: true }
    const url = new URL(specifier, context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
    const found = ['.js', '.mjs'].map(ext => new URL(url.href + ext)).find(existsSync)
    if (!found) throw new Error('Ukendt afhængighed: ' + specifier)
    return { url: found.href, shortCircuit: true }
  },
  load(url, context, next) {
    if (!targets.has(url)) return next(url, context)
    const source = readFileSync(new URL(url), 'utf8')
    return { format: 'module', source: `import { h as __h } from '${stub}';\n${jsx(source)}`, shortCircuit: true }
  },
})
const { default: KostUge } = await import(kostUrl)
const { default: AnalyseLokaltVaerktoej } = await import(lokalUrl)

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const ground = app.match(/minHeight: '100vh', background: '(#[0-9a-f]{6})'/)[1]
const appColor = '#edeae2'
const textH = {
  light: css.match(/^:root \{[^}]*?--text-h: (#[0-9a-f]{6});/m)[1],
  dark: css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{[^}]*?--text-h: (#[0-9a-f]{6});/)[1],
}
const LABELS = ['Kostuge', 'Lokalt videoanalyseværktøj']
const e2css = readFileSync(new URL('../entropi2/entropi2.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SCOPED = ['[data-entropi2-athlete] section[aria-label="Kostuge"] :is(h1, h2, h3)',
  '[data-entropi2-coach-root] section[aria-label="Lokalt videoanalyseværktøj"] :is(h1, h2, h3)']
const e2Rule = e2css.replace(/\/\*[^]*?\*\//g, '').match(/([^{}]*)\{\s*color:\s*(#[0-9a-f]{6});\s*\}/i)
const e2Color = e2Rule[2]

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// h2 får var(--text-h) fra index.css, medmindre lys-reglen lader dem arve sektionens farve.
// Sektionen arver appens lyse tekstfarve (målt headless: #edeae2 på #141410), når den ikke selv sætter en.
function headings(tree, scheme, withRule) {
  const out = []
  const walk = (node, inherited, section) => {
    if (node == null || typeof node !== 'object') return
    const own = node.props.style?.color
    const here = own ?? inherited
    const inSection = node.type === 'section' && LABELS.includes(node.props['aria-label']) ? node.props['aria-label'] : section
    if (node.type === 'h2') out.push({ section: inSection, color: own ?? (withRule && inSection ? e2Color : textH[scheme]) })
    for (const child of node.props.children) walk(child, here, inSection)
  }
  walk(tree, appColor, null)
  return out
}
const input = () => ({
  asOfDate: '2026-10-22', coveredDates: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'],
  logs: [{ date: '2026-10-19', kcal: 100, protein: null }, { date: '2026-10-20', kcal: null, protein: 20 }, { date: '2026-10-21', kcal: null, protein: 30 }],
  targetHistory: [{ effectiveFrom: '2026-10-19', kcal: 2000, protein: 100 }],
})
const trees = () => [
  ['Kostuge uden ugedata', KostUge({ selectedDate: '2026-10-21', input: null })],
  ['Kostuge med ugedata', KostUge({ selectedDate: '2026-10-21', input: input() })],
  ['Lokalt analyseværktøj', AnalyseLokaltVaerktoej()],
]

test('R11: index.css er uændret (ingen regel for de to sektioner); rettelsen ligger kun i entropi2.css under rodmarkørerne', () => {
  for (const label of LABELS) assert.equal(css.split(`section[aria-label="${label}"]`).length - 1, 0)
  assert.equal(css.indexOf('E2-KOSTUGE-KONTRAST1'), -1)
  const selectors = e2Rule[1].split(/,\s*\n/).map(s => s.trim()).filter(Boolean)
  for (const scoped of SCOPED) assert.ok(selectors.includes(scoped), scoped)
  for (const label of LABELS) assert.ok(!selectors.some(s => s.startsWith(`section[aria-label="${label}"]`)), label)
  assert.equal(textH.light, '#08060d')
  assert.equal(textH.dark, '#f3f4f6')
  assert.equal(ground, '#141410')
})

for (const [name, make] of trees().map(([n], i) => [n, () => trees()[i][1]])) {
  test(name + ': h2 har mindst 4,5:1 i lyst og mørkt skema; uden reglen er fejlen genskabt', () => {
    const tree = make()
    const withRule = true // Entropi 2 tændt: komponenten ligger i den markerede rod
    if (name === 'Kostuge med ugedata') assert.match(JSON.stringify(tree), /"Kostuge · ","19.10.2026"/)
    for (const scheme of ['light', 'dark']) {
      const heads = headings(tree, scheme, withRule)
      assert.ok(heads.length >= 1)
      for (const x of heads) {
        assert.ok(x.section, 'h2 ligger i en af de to sektioner')
        assert.ok(contrast(x.color, ground) >= 4.5, `${scheme} ${x.color} paa ${ground}`)
      }
    }
    // Flaget slukket: farverne er de oprindelige (som live i dag), i begge skemaer.
    for (const scheme of ['light', 'dark']) assert.ok(headings(tree, scheme, false).every(x => x.color === textH[scheme]))
    assert.ok(headings(tree, 'light', false).every(x => contrast(x.color, ground) < 1.2))
  })
}

test('sektionerne sætter ingen anden tekstfarve end appens lyse, så arv giver den lyse farve', () => {
  for (const [, tree] of trees()) {
    const sections = []
    const walk = node => { if (node && typeof node === 'object') { if (node.type === 'section' && LABELS.includes(node.props['aria-label'])) sections.push(node); node.props.children.forEach(walk) } }
    walk(tree)
    assert.equal(sections.length, 1)
    assert.ok([undefined, appColor].includes(sections[0].props.style?.color))
  }
})
