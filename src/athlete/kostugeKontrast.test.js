// E2-KOSTUGE-KONTRAST1: atletens kostuge og coachens lokale analyseværktøj skal have læsbare h2 i lyst og mørkt skema.
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
const lightRule = /@media \(prefers-color-scheme: light\) \{\s*section\[aria-label="Kostuge"\] h2,\s*section\[aria-label="Lokalt videoanalyseværktøj"\] h2 \{\s*color: inherit;\s*\}\s*\}/

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
    if (node.type === 'h2') out.push({ section: inSection, color: own ?? (scheme === 'light' && withRule && inSection ? inherited : textH[scheme]) })
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

test('index.css: lys-reglen findes præcis én gang, kun i lyst skema, før APP-375FIX, og mørkt skema er uændret', () => {
  assert.match(css, lightRule)
  for (const label of LABELS) assert.equal(css.split(`section[aria-label="${label}"]`).length - 1, 1)
  assert.equal(textH.light, '#08060d')
  assert.equal(textH.dark, '#f3f4f6')
  assert.equal(ground, '#141410')
  assert.ok(css.indexOf('E2-KOSTUGE-KONTRAST1') < css.indexOf('/* APP-375FIX:'))
})

for (const [name, make] of trees().map(([n], i) => [n, () => trees()[i][1]])) {
  test(name + ': h2 har mindst 4,5:1 i lyst og mørkt skema; uden reglen er fejlen genskabt', () => {
    const tree = make()
    const withRule = lightRule.test(css)
    if (name === 'Kostuge med ugedata') assert.match(JSON.stringify(tree), /"Kostuge · ","19.10.2026"/)
    for (const scheme of ['light', 'dark']) {
      const heads = headings(tree, scheme, withRule)
      assert.ok(heads.length >= 1)
      for (const x of heads) {
        assert.ok(x.section, 'h2 ligger i en af de to sektioner')
        assert.ok(contrast(x.color, ground) >= 4.5, `${scheme} ${x.color} paa ${ground}`)
      }
    }
    assert.ok(headings(tree, 'light', false).every(x => contrast(x.color, ground) < 1.2))
    assert.deepEqual(headings(tree, 'dark', false), headings(tree, 'dark', true))
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
