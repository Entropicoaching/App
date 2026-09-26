// ORDRE 419: faelles opsaetning til "en uge som atlet paa telefonen".
// Syntetisk atlet (e2e/fixtures.mjs' Testatlet, opdigtet) med en realistisk
// uge: 4 pas (squat, baenk, doedloeft, tilbehoer) plus tre forgangne uger med
// logget historik, saa "Sidste gang", Fremgang og Volumen har noget at vise.
// Headless Chromium 390x844 mod e2e-mocken, dist/ bygget mod mocken og
// serveret lokalt (samme moenster som outputs/414/offline-bevis.mjs).
// Ingen prod, ingen rigtige navne eller tal.
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
export const ROOT = path.join(HERE, '..', '..')
const DIST = path.join(ROOT, 'dist')
export const MOCK_PORT = Number(process.env.UGE_MOCK_PORT || 8997)
const MOCK_KEY = 'mock-anon-key-uge-419'
export const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.wasm': 'application/wasm' }

export function startStaticServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    let filePath = path.join(DIST, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(readFileSync(path.join(DIST, 'index.html')))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

export function byg() {
  const build = spawnSync('npm run build', { cwd: ROOT, stdio: 'ignore', shell: true, env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_KEY: MOCK_KEY } })
  if (build.status !== 0) throw new Error('build fejlede')
}

export function hentChromium() {
  const require = createRequire(import.meta.url)
  return require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')).chromium
}

const uid = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function mandagIUge(offsetUger = 0) {
  const d = new Date()
  const js = d.getDay()
  d.setDate(d.getDate() - (js === 0 ? 6 : js - 1) + offsetUger * 7)
  d.setHours(12, 0, 0, 0)
  return d
}
const datoStr = (d) => d.toISOString().slice(0, 10)

// Ugens fire pas. recommended_weight paa hovedloeftene; tilbehoer uden
// anbefaling (som i Marcs programmer, hvor tilbehoer tit bare er "RPE 8").
export const PAS = [
  { titel: 'Dag 1 — Squat', ugedag: 0, oevelser: [
    { navn: 'Squat', saet: 4, reps: '5', int: 'RPE 7', kg: 100 },
    { navn: 'Bænkpres', saet: 3, reps: '8', int: 'RPE 7', kg: 70 },
    { navn: 'Bulgarsk split squat', saet: 3, reps: '8-10', int: 'RPE 8', kg: null },
  ] },
  { titel: 'Dag 2 — Bænk', ugedag: 1, oevelser: [
    { navn: 'Bænkpres', saet: 4, reps: '4-6', int: 'RPE 8', kg: 80 },
    { navn: 'Rows', saet: 3, reps: '10', int: 'RPE 8', kg: null },
    { navn: 'Triceps pushdown', saet: 3, reps: '12-15', int: 'RPE 9', kg: null },
  ] },
  { titel: 'Dag 3 — Dødløft', ugedag: 3, oevelser: [
    { navn: 'Dødløft', saet: 3, reps: '3', int: 'RPE 8', kg: 140 },
    { navn: 'Pause squat', saet: 3, reps: '4', int: 'RPE 7', kg: 85 },
    { navn: 'Planke', saet: 2, reps: '45s', int: null, kg: null },
  ] },
  { titel: 'Dag 4 — Volumen', ugedag: 5, oevelser: [
    { navn: 'Squat', saet: 3, reps: '6', int: 'RPE 7', kg: 95 },
    { navn: 'Bænkpres', saet: 4, reps: '6', int: 'RPE 7', kg: 72.5 },
    { navn: 'Pull-ups', saet: 3, reps: '6-8', int: 'RPE 8', kg: null },
  ] },
]

// Byg seeden: tre forgangne uger (fuldt logget, lidt lettere hver uge
// tilbage) + denne uge (ulogget). exerciseIds[pasIdx][oevIdx] = id i denne uge.
export function bygSeed(buildSeed, fx) {
  const seed = buildSeed()
  seed.tables.weeks = []
  seed.tables.sessions = []
  seed.tables.exercises = []
  seed.tables.exercise_logs = []
  let n = 1
  const exerciseIds = []
  for (let u = -3; u <= 0; u++) {
    const mandag = mandagIUge(u)
    const weekId = uid(n++)
    seed.tables.weeks.push({ id: weekId, athlete_id: fx.ATHLETE_ID, week_number: u + 4, block_name: 'Styrke', start_date: datoStr(mandag) })
    PAS.forEach((p, pi) => {
      const sessId = uid(n++)
      seed.tables.sessions.push({ id: sessId, week_id: weekId, title: p.titel, session_order: pi + 1, weekday: p.ugedag, athlete_rating: null, athlete_comment: null })
      p.oevelser.forEach((o, oi) => {
        const exId = uid(n++)
        const kgUge = o.kg == null ? null : o.kg + u * 2.5
        seed.tables.exercises.push({ id: exId, session_id: sessId, name: o.navn, sets: o.saet, reps: o.reps, intensity: o.int, note: null, exercise_order: oi + 1, recommended_weight: kgUge })
        if (u === 0) { (exerciseIds[pi] ||= [])[oi] = exId; return }
        const dag = new Date(mandag); dag.setDate(dag.getDate() + p.ugedag)
        for (let s = 1; s <= o.saet; s++) {
          const repsTal = parseInt(o.reps, 10) || 8
          const vaegt = kgUge ?? (o.navn === 'Pull-ups' || o.navn === 'Planke' ? 0 : 20 + oi * 5)
          seed.tables.exercise_logs.push({ id: uid(n++), exercise_id: exId, athlete_id: fx.ATHLETE_ID, set_number: s, weight: vaegt, reps_completed: repsTal, note: null, rpe_actual: 7.5, rpe_planned: 7.5, skipped: false, logged_at: new Date(dag.getTime() + s * 180000).toISOString() })
        }
      })
    })
  }
  return { seed, exerciseIds }
}
