// ORDRE 373 — pixel-sammenligning af outputs/373/foer/*.png mod efter/*.png
// (pngjs + pixelmatch fra den delte codex-runtime, samme kilde som e2e/harness.mjs's
// playwright). Afvigelse = andel pixels pixelmatch melder forskellige (threshold 0).
// Skriver outputs/373/pixel.json og en tabel til stdout.
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const require = createRequire(import.meta.url)
const mods = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { PNG } = require(join(mods, 'pngjs'))
const pm = require(join(mods, 'pixelmatch'))
const pixelmatch = pm.default || pm

const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const rows = []
for (const f of readdirSync(join(DIR, 'foer')).filter(n => n.endsWith('.png')).sort()) {
  const a = PNG.sync.read(readFileSync(join(DIR, 'foer', f)))
  if (!existsSync(join(DIR, 'efter', f))) { rows.push({ skaerm: f, afvigelseProcent: null, note: 'mangler efter' }); continue }
  const b = PNG.sync.read(readFileSync(join(DIR, 'efter', f)))
  if (a.width !== b.width || a.height !== b.height) {
    rows.push({ skaerm: f, afvigelseProcent: 100, note: `størrelse ${a.width}x${a.height} -> ${b.width}x${b.height}` })
    continue
  }
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 })
  rows.push({ skaerm: f, størrelse: `${a.width}x${a.height}`, pixelsForskellige: diff, afvigelseProcent: +(100 * diff / (a.width * a.height)).toFixed(4) })
}
writeFileSync(join(DIR, 'pixel.json'), JSON.stringify(rows, null, 2) + '\n')
for (const r of rows) console.log(`${r.skaerm.padEnd(32)} ${String(r.afvigelseProcent).padStart(8)} %  ${r.note || r.størrelse}`)
