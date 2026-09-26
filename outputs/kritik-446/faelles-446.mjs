// ORDRE 446: faelles opsaetning. Syntetisk Testatlet (e2e/fixtures.mjs, opdigtet)
// med ugen fra 419 (4 pas) og en historik, der kan vaere let (3 uger, som 419/439)
// eller tung (ca. 4400 saet, over appens graense paa 4000). Headless Chromium mod
// e2e-mocken, appen bygget mod mocken og serveret lokalt med public/sw.js som i
// produktion. Ingen prod, ingen atletdata, ingen rigtige navne eller tal.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { hentChromium, MOBILE_UA, PAS } from '../419/uge-faelles.mjs'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
export const ROOT = path.join(HERE, '..', '..')
export const UD = HERE
export const MOCK_PORT = Number(process.env.K446_MOCK_PORT || 8997)
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`
export { hentChromium, MOBILE_UA, PAS }

// Bygger appen mod mocken. src = kildetrae (main eller en udpakket commit),
// ud = mappe til dist. Byggene ligger uden for repoet (K446_BYG, standard i
// systemets temp), saa intet skrives uden for outputs/kritik-446.
export const BYG = process.env.K446_BYG || path.join(process.env.TEMP || '/tmp', 'kritik-446-byg')
export function byg(src, ud) {
  const r = spawnSync(process.execPath, [path.join(src, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', ud, '--emptyOutDir'], {
    cwd: src, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: MOCK_URL, VITE_SUPABASE_KEY: 'mock-anon-key-446' },
  })
  if (r.status !== 0) throw new Error(`build fejlede i ${src}`)
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.wasm': 'application/wasm' }
export function statiskServer(dist) {
  if (!existsSync(path.join(dist, 'index.html'))) throw new Error(`intet build i ${dist}`)
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const fil = path.join(dist, urlPath === '/' ? '/index.html' : urlPath)
    if (!fil.startsWith(dist)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(fil)
      res.writeHead(200, { 'content-type': MIME[path.extname(fil).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(readFileSync(path.join(dist, 'index.html')))
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })))
}

// "Aeldre telefon": Lighthouse' Slow 4G (150 ms, 1,6 Mbit/s ned, 750 kbit/s op)
// og 4x langsommere CPU. Saettes igen efter hver setOffline (den nulstiller).
export const NET = { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }
export const CPU = 4
export async function drosl(page, { net = NET, cpu = CPU } = {}) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  if (net) await cdp.send('Network.emulateNetworkConditions', net)
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  return {
    cdp,
    async offline(on) {
      // Hele konteksten (ogsaa service workeren) + siden selv; drosling igen bagefter.
      await page.context().setOffline(on)
      await cdp.send('Network.emulateNetworkConditions', on ? { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } : (net || { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }))
    },
  }
}

const uid = (n) => `e4460000-0000-4000-8000-${String(n).padStart(12, '0')}`
function mandagIUge(offsetUger = 0) {
  const d = new Date()
  const js = d.getDay()
  d.setDate(d.getDate() - (js === 0 ? 6 : js - 1) + offsetUger * 7)
  d.setHours(12, 0, 0, 0)
  return d
}
const datoStr = (d) => d.toISOString().slice(0, 10)

// Seed: `uger` forgangne uger + denne uge (ulogget). De tre seneste uger stiger
// 2,5 kg pr. uge op til ugens anbefaling (som 419/439: squat 97,5 x 5 i sidste
// uge, 100 x 5 i denne er en rekord). Aeldre uger ligger 10-17,5 kg under.
// `gammelTop`: en squat-top laengst tilbage (fx 110 x 5), der kun kan ses, naar
// hele historikken hentes.
export function bygSeed(buildSeed, fx, { uger = 3, gammelTop = null, gammelTopUge = null } = {}) {
  const seed = buildSeed()
  const t = seed.tables
  t.weeks = []; t.sessions = []; t.exercises = []; t.exercise_logs = []
  let n = 1
  const exerciseIds = []
  for (let u = -uger; u <= 0; u++) {
    const mandag = mandagIUge(u)
    const weekId = uid(n++)
    t.weeks.push({ id: weekId, athlete_id: fx.ATHLETE_ID, week_number: u + uger + 1, block_name: 'Styrke', start_date: datoStr(mandag) })
    PAS.forEach((p, pi) => {
      const sessId = uid(n++)
      t.sessions.push({ id: sessId, week_id: weekId, title: p.titel, session_order: pi + 1, weekday: p.ugedag, athlete_rating: u < 0 ? 4 : null, athlete_comment: null })
      p.oevelser.forEach((o, oi) => {
        const exId = uid(n++)
        const kgUge = o.kg == null ? null : (u >= -3 ? o.kg + u * 2.5 : o.kg - 10 - 2.5 * ((-u) % 4))
        t.exercises.push({ id: exId, session_id: sessId, name: o.navn, sets: o.saet, reps: o.reps, intensity: o.int, note: null, exercise_order: oi + 1, recommended_weight: kgUge })
        if (u === 0) { (exerciseIds[pi] ||= [])[oi] = exId; return }
        const dag = new Date(mandag); dag.setDate(dag.getDate() + p.ugedag)
        for (let s = 1; s <= o.saet; s++) {
          const reps = parseInt(o.reps, 10) || 8
          let vaegt = kgUge ?? (o.navn === 'Pull-ups' || o.navn === 'Planke' ? 0 : 20 + oi * 5)
          if (gammelTop && u === (gammelTopUge ?? -uger) && o.navn === 'Squat' && pi === 0) vaegt = gammelTop
          t.exercise_logs.push({ id: uid(n++), exercise_id: exId, athlete_id: fx.ATHLETE_ID, set_number: s, weight: vaegt, reps_completed: reps, note: null, rpe_actual: 7.5, rpe_planned: 7.5, skipped: false, logged_at: new Date(dag.getTime() + s * 180000).toISOString() })
        }
      })
    })
  }
  return { seed, exerciseIds }
}

export const tabel = async (navn) => (await (await fetch(`${MOCK_URL}/__e2e/table?name=${navn}`)).json())

export async function nyTelefon(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
  const page = await context.newPage()
  return { context, page }
}

export async function logIndAtlet(page, port, fx) {
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 60000 })
}

// Dagens pas er "brugbart": kortet viser et saet, vaegtfeltet er udfyldt og
// Godkendt kan trykkes.
export function brugbart(page, timeout = 90000) {
  return page.waitForFunction(() => {
    const g = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Godkendt')
    const v = document.querySelector('input[aria-label^="Vægt, sæt"]')
    return !!(g && !g.disabled && g.getBoundingClientRect().height > 0 && v && v.value && /Sæt \d+\/\d+/.test(document.body.innerText))
  }, null, { timeout, polling: 50 })
}
