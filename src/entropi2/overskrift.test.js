// E2-OVERSKRIFT1: overskrifter på Entropi 2-skærmene skal være lyse på mørk bund, også i lyst farveskema.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replaceAll('\r\n', '\n')

function luminance(hex) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

test('E2-OVERSKRIFT1: stilen dækker pas, samtale, mobilitet, kost, coach og fremgang med mindst 4,5:1', () => {
  const css = read('./entropi2.css').replace(/\/\*[^]*?\*\//g, '')
  const rule = css.match(/([^{}]*)\{\s*color:\s*(#[0-9a-f]{6});\s*\}/i)
  assert.ok(rule, 'én farveregel for overskrifterne')
  const selectors = rule[1].split(/,\s*\n/).map(s => s.trim()).filter(Boolean)
  for (const scope of ['[data-entropi2-home-session]', '[data-entropi2-kost]', '[data-entropi2-mobility]', '[data-entropi2-coach]',
    'section[aria-label="Samlet samtale"]', 'section[aria-label="Beskeder og video"]', '.e2-session', '[data-entropi2-athlete] [data-analyse-atlet1]'])
    assert.ok(selectors.includes(`${scope} :is(h1, h2, h3)`), scope)
  // Fremgang rammes kun med flaget tændt: selektoren kræver atletrammens Entropi 2-markering.
  assert.ok(!selectors.some(s => s.startsWith('[data-analyse-atlet1]')))
  // Bunden på skærmene er #141410 (rgb(20, 20, 16)).
  assert.ok(contrast(rule[2], '#141410') >= 4.5)
})

test('E2-OVERSKRIFT1: atletsiden indlæser stilen, når flaget er tændt, og markerer kun rammen med e2Atlet', () => {
  assert.match(read('./athleteEntry.mjs'), /^export \{ loadEntropi2Styles \} from '\.\/styles\.mjs'$/m)
  const view = read('../AthleteView.jsx')
  assert.equal(view.split('  useEffect(() => { if (e2) loadEntropi2Styles() }, [e2])\n').length, 2)
  assert.equal(view.split("{...(e2Atlet ? { 'data-entropi2-athlete': '' } : {})}").length, 2)
  assert.equal(view.split('data-entropi2-athlete').length, 2)
})
