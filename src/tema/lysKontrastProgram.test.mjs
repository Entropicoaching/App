// Ordre 1649: ravgul tekst paa lys bund i Program (coachens "nu" paa blokbaandet) skal have kontrast mindst 4,5.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const lum = h => {
  const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('lys: ravgul tekst (amber og amber2) har kontrast over 4,5 paa creme, kort og blokbaand', async () => {
  const css = await readFile(new URL('./tema.css', import.meta.url), 'utf8')
  const lys = css.slice(css.indexOf(':root[data-tema="lys"] {'))
  const flader = ['#f7f2e9', '#fffdf9', '#d9d5cd']
  for (const navn of ['e-amber', 'e-amber2']) {
    const farve = lys.match(new RegExp(`--${navn}: (#[0-9a-f]{6});`))[1]
    for (const flade of flader) assert.ok(kontrast(farve, flade) >= 4.5, `${navn} ${farve} paa ${flade}: ${kontrast(farve, flade).toFixed(2)}`)
  }
})
