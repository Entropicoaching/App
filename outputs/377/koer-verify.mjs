// ORDRE 377 — sikkerhedslinen (kopi af outputs/373/koer-verify.mjs): `npm run build` + `npm run lint` + alle
// verify:*-scripts fra package.json (ingen af dem kræver net eller
// hemmeligheder, se docs/DASHBOARD-KORT.md), bestået/fejlet pr. script,
// plus bundtstørrelser fra dist/assets. Skrives til outputs/377/<fase>.json.
// Kørsel: node outputs/377/koer-verify.mjs foer|efter
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const FASE = process.argv[2]
if (!['foer', 'efter'].includes(FASE)) { console.error('brug: foer|efter'); process.exit(2) }
const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', '..')
const scripts = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts)

function run(name) {
  const t0 = Date.now()
  const r = spawnSync('npm', ['run', name], { cwd: ROOT, shell: true, encoding: 'utf8', timeout: 600000 })
  const ok = r.status === 0
  const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | ').slice(0, 300)
  console.log(`${ok ? 'BESTÅET' : 'FEJLET '} ${name} (${Math.round((Date.now() - t0) / 1000)} s)`)
  return { ok, status: r.status, ...(ok ? {} : { tail }) }
}

// --kun <script>: kør ét script igen og flet det ind i en eksisterende
// <fase>.json. Det første udfald bevares under `foersteKoersel`, så en
// omkørsel aldrig skjuler, at første kørsel fejlede.
const kun = process.argv.indexOf('--kun') > -1 ? process.argv[process.argv.indexOf('--kun') + 1] : null
if (kun) {
  const file = join(ROOT, 'outputs', '377', `${FASE}.json`)
  const prev = JSON.parse(readFileSync(file, 'utf8'))
  const first = prev.scripts[kun]
  prev.scripts[kun] = { ...run(kun), omkoert: true, foersteKoersel: first }
  writeFileSync(file, JSON.stringify(prev, null, 2) + '\n')
  process.exit(prev.scripts[kun].ok ? 0 : 1)
}

const result = { fase: FASE, scripts: {} }
result.scripts.build = run('build')
const assets = join(ROOT, 'dist', 'assets')
result.bundle = readdirSync(assets).filter(f => f.endsWith('.js')).map(f => {
  const buf = readFileSync(join(assets, f))
  return { fil: f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '.js'), kB: +(statSync(join(assets, f)).size / 1000).toFixed(2), gzipKB: +(gzipSync(buf).length / 1000).toFixed(2) }
}).sort((a, b) => a.fil.localeCompare(b.fil))
result.scripts.lint = run('lint')
for (const name of scripts.filter(n => n.startsWith('verify:'))) result.scripts[name] = run(name)

writeFileSync(join(ROOT, 'outputs', '377', `${FASE}.json`), JSON.stringify(result, null, 2) + '\n')
const failed = Object.entries(result.scripts).filter(([, v]) => !v.ok).map(([k]) => k)
console.log(`\n${Object.keys(result.scripts).length - failed.length}/${Object.keys(result.scripts).length} bestået${failed.length ? ` · fejlet: ${failed.join(', ')}` : ''}`)
