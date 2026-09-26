// ORDRE 387 — pixel-sammenligning af outputs/387/<A>/*.png mod <B>/*.png (kopi af outputs/377/sammenlign.mjs, som er en kopi af
// outputs/373/sammenlign.mjs; pngjs + pixelmatch fra den delte codex-runtime, samme kilde som e2e/harness.mjs's
// playwright). Afvigelse = andel pixels pixelmatch melder forskellige (threshold 0).
// Skriver outputs/387/pixel-<A>-<B>.json og en tabel til stdout.
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
// Valgfrit: to andre mapper, fx `foer foer2` til determinisme-tjekket.
const [A, B] = [process.argv[2] || 'foer', process.argv[3] || 'efter']
const rows = []
for (const f of readdirSync(join(DIR, A)).filter(n => n.endsWith('.png')).sort()) {
  const a = PNG.sync.read(readFileSync(join(DIR, A, f)))
  if (!existsSync(join(DIR, B, f))) { rows.push({ skaerm: f, afvigelseProcent: null, note: `mangler i ${B}` }); continue }
  const b = PNG.sync.read(readFileSync(join(DIR, B, f)))
  if (a.width !== b.width || a.height !== b.height) {
    rows.push({ skaerm: f, afvigelseProcent: 100, note: `størrelse ${a.width}x${a.height} -> ${b.width}x${b.height}` })
    continue
  }
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 })
  rows.push({ skaerm: f, størrelse: `${a.width}x${a.height}`, pixelsForskellige: diff, afvigelseProcent: +(100 * diff / (a.width * a.height)).toFixed(4) })
}
writeFileSync(join(DIR, A === 'foer' && B === 'efter' ? 'pixel.json' : `pixel-${A}-${B}.json`), JSON.stringify(rows, null, 2) + '\n')
for (const r of rows) console.log(`${r.skaerm.padEnd(32)} ${String(r.afvigelseProcent).padStart(8)} %  ${r.note || r.størrelse}`)
