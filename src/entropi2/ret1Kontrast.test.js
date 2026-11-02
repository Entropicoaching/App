// E2-SAMLING-RET1: overskrifter i den nye analyse og coachens kostmål er lyse på mørk bund i begge skemaer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import Analysis from './analysis/Analysis.mjs'
import KostMaal from './kostMaal/KostMaal.mjs'

const css = readFileSync(new URL('./entropi2.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const colorRule = css.match(/([^{}]+)\{\s*color: (#[0-9a-f]{6});\s*\}/)

test('RET1: farvereglen dækker analysen og kostmålene, og farven har mindst 4,5:1 mod begge flader', () => {
  const selectors = colorRule[1].split(/,\n/).map(s => s.trim())
  assert.ok(selectors.includes('[data-entropi2-analysis] :is(h1, h2, h3)'))
  assert.ok(selectors.includes('[data-entropi2-kost-maal] :is(h1, h2, h3)'))
  // Analysens og kostmålenes flader (Analysis.mjs #141410/#1c1c18, kostmål #1c1c18).
  for (const bg of ['#141410', '#1c1c18']) assert.ok(contrast(colorRule[2], bg) >= 4.5, bg)
  // Appens globale lyse-skema-farve er det, reglen erstatter: under 4,5:1.
  assert.ok(contrast('#08060d', '#1c1c18') < 4.5)
})

test('RET1: de faktiske komponenter bærer netop de attributter, CSS rammer, og venstrestilles', () => {
  const analysis = renderToString(createElement(Analysis, { entropi2: true, fremgangLogs: [], now: new Date('2026-11-01T12:00:00Z') }))
  assert.match(analysis, /data-entropi2-analysis="true"/)
  assert.match(analysis, /<h1[^>]*>Din analyse<\/h1>/)
  const kost = renderToString(createElement(KostMaal, { enabled: true, athlete: { id: 'syn' }, weightLogs: [], today: '2026-11-02' }))
  assert.match(kost, /data-entropi2-kost-maal="true"/)
  assert.match(kost, /<h2[^>]*>Kostmål<\/h2>/)
  assert.match(css, /\[data-entropi2-analysis\],\n\[data-entropi2-kost-maal\] \{\n {2}text-align: left;\n\}/)
})

test('RET1: stilen hentes på coachens skærme, herunder kostfanen, når flaget er tændt', () => {
  const dashboard = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(dashboard, /useEffect\(\(\) => \{ if \(e2\) loadEntropi2Styles\(\) \}, \[e2\]\)/)
  assert.match(dashboard, /\{e2 && activeTab === 'kost' && \(/)
})
