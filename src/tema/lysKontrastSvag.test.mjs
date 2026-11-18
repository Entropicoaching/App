// Ordre 1651: coachens graa tekst (--e-svag, fx datoen paa blokbaandet) skal have kontrast mindst 4,5 i lys.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const lum = h => {
  const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('lys: graa tekst (daempet og svag) har kontrast mindst 4,5 paa creme, kort, flade3 og blokbaand', async () => {
  const css = await readFile(new URL('./tema.css', import.meta.url), 'utf8')
  const lys = css.slice(css.indexOf(':root[data-tema="lys"] {'))
  const flader = ['#f7f2e9', '#fffdf9', '#ece4d5', '#d9d5cd']
  for (const navn of ['e-daempet', 'e-svag']) {
    const farve = lys.match(new RegExp(`--${navn}: (#[0-9a-f]{6});`))[1]
    for (const flade of flader) assert.ok(kontrast(farve, flade) >= 4.5, `${navn} ${farve} paa ${flade}: ${kontrast(farve, flade).toFixed(2)}`)
  }
})
