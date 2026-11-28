// ORDRE 2497: maaler coachens videosvar i tryk og felter (mock, syntetiske atleter, klip tegnet i seeden). Kun maaling.
// Koersel: E2E_VITE_PORT=5497 E2E_MOCK_PORT=8997 VITE_SUPABASE_URL=http://127.0.0.1:8997 node e2e/coach-videosvar-maal-2497.mjs [lys|moerk] [390|1280]
import { createMockSupabase } from './mock-supabase.mjs'
import { buildSeed, COACH_USER, ATHLETE_USER, ATHLETE_ID, MEASURED_VIDEO_ID, MEASURED_VIDEO_CLIENT_ID } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'

const ekstra = (n, athleteId, lift = 'squat') => ({ id: `97000000-0000-4000-8000-00000000000${n}`, client_analysis_id: `97100000-0000-4000-8000-00000000000${n}`, athlete_id: athleteId, lift })
export function seed({ nu = new Date() } = {}) {
  const s = buildSeed({ withMeasuredVideo: true, now: nu }); const t = s.tables
  const basis = t.video_analyses.find(v => v.id === MEASURED_VIDEO_ID)
  const nyAtlet = (i) => ({ id: `97200000-0000-4000-8000-00000000000${i}`, user_id: null, name: `Syntetisk ${i}`, coach_id: COACH_USER.id, status: 'active', hidden: false, snooze_until: null, onboarding_completed_at: nu.toISOString(), email: `syn${i}@e2e.test` })
  const klip = (e, minutter, navn) => ({ ...structuredClone(basis), id: e.id, client_analysis_id: e.client_analysis_id, athlete_id: e.athlete_id, athlete_name: navn, lift: e.lift, created_at: new Date(nu.getTime() - minutter * 60000).toISOString(), analyzed_at: new Date(nu.getTime() - minutter * 60000).toISOString(), video_path: `${e.athlete_id}/${e.client_analysis_id}.mp4` })
  for (const i of [1, 2, 3]) { const a = nyAtlet(i); t.athletes.push(a); t.video_analyses.push(klip(ekstra(i, a.id, ['squat', 'bench', 'deadlift'][i - 1]), 30 * i, a.name)) }
  // Testatlet faar et andet klip af samme oevelse (squat), ældre end det første.
  t.video_analyses.push(klip(ekstra(4, ATHLETE_ID), 400, 'Testatlet'))
  return s
}
const tema = (p, n) => p.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), n)
async function main() {
  const navn = process.argv[2] || 'lys'; const bredde = Number(process.argv[3] || 390); const hoejde = bredde === 390 ? 844 : 800
  const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
  const vite = await startVite(); const browser = await launchBrowser()
  try {
    const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde }, colorScheme: navn === 'lys' ? 'light' : 'dark', hasTouch: bredde === 390, isMobile: bredde === 390 }); const p = await ctx.newPage()
    const fejl = []; p.on('pageerror', e => fejl.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fejl.push(m.text()) })
    await p.goto(APP_URL); await p.locator('#athlete-auth-email').fill(COACH_USER.email); await p.locator('#athlete-auth-password').fill(COACH_USER.password)
    await p.getByRole('button', { name: 'Log ind' }).click(); await p.locator('[data-coach-idag]').waitFor({ timeout: 20000 }); await tema(p, navn)
    const log = []; let tryk = 0, felter = 0
    const trin = async (t) => log.push([t, tryk, felter])
    const lister = () => p.evaluate(() => ({ knapper: [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 60)).filter(x => /video|klip|feedback|svar/i.test(x)), dialog: [...document.querySelectorAll('[role=dialog] button')].map(b => (b.disabled ? '[x]' : '') + b.textContent.trim().slice(0, 50)) }))
    const SVAR = { 'Det fungerer': 'god dybde', 'Atletens fokus': 'bryst op', 'Næste gang': 'pres gulvet' }
    const rest = () => p.getByRole('button', { name: /Video venter på feedback/ }).count()
    const klik = async (l, t) => { await l.click({ timeout: 15000 }); tryk++; await trin(t) }
    await p.getByRole('button', { name: /Video venter på feedback/ }).first().waitFor({ timeout: 15000 }).catch(() => {})
    const taeller = []; const start0 = await rest()
    for (let runde = 1; runde <= 6; runde++) {
      const foer = await rest(); if (foer === 0) break
      const t0 = { tryk, felter }
      await klik(p.getByRole('button', { name: /Video venter på feedback/ }).first(), `r${runde} aabn opgave`)
      const d = p.getByRole('dialog'); await d.waitFor({ timeout: 10000 })
      const titel = (await d.innerText()).split('\n').slice(0, 5).join(' | ')
      for (const [l, v] of Object.entries(SVAR)) { await d.getByLabel(l, { exact: true }).first().fill(v); felter++ }
      const send = d.getByRole('button', { name: /Gem, godkend og del feedback/ })
      await p.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some(b => /Gem, godkend og del/.test(b.textContent) && !b.disabled), null, { timeout: 10000 })
      await klik(send, `r${runde} send`)
      await p.waitForTimeout(1200)
      const efter = { dialogEfter: await p.getByRole('dialog').count(), opgaver: await rest(), tekst: (await p.evaluate(() => document.body.innerText)).split('\n').filter(l => /sendt|delt|gemt|næste|Video/i.test(l)).slice(0, 6) }
      taeller.push({ runde, titel, tryk: tryk - t0.tryk, felter: felter - t0.felter, ...efter })
      if (efter.dialogEfter) { await klik(p.getByRole('dialog').getByRole('button', { name: 'Luk' }), `r${runde} luk`); await p.waitForTimeout(800); taeller.at(-1).tryk = tryk - t0.tryk; taeller.at(-1).koeVedLuk = await p.evaluate(() => [...document.querySelectorAll('button,span')].map(e => e.textContent.trim()).filter(t => /Næste opgave|tilbage efter|Sidste opgave|Køen er ryddet|^d+ tilbage/.test(t)).slice(0, 4)); taeller.at(-1).sidePaaLuk = await p.evaluate(() => document.body.innerText.includes('TILBAGE TIL ATLETER') ? 'atletprofil' : 'andet'); if (taeller.at(-1).sidePaaLuk === 'atletprofil') await klik(p.getByRole('button', { name: /^Forside$/i }).or(p.getByText(/^Forside$/i)).first(), `r${runde} forside`); await p.waitForTimeout(800); taeller.at(-1).tryk = tryk - t0.tryk; taeller.at(-1).opgaverEfterLuk = await rest(); taeller.at(-1).rest = await p.evaluate(() => (document.querySelector('[data-coach-idag]')?.innerText || 'ingen idag').slice(0, 300)); }
    }
    const rows = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/table?name=video_analyses`)).json()
    const delt = rows.filter(r => r.status === 'shared').length
    console.log(JSON.stringify({ navn, bredde, start0, tryk, felter, delt, af: rows.length, taeller, overloeb: await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), fejl }, null, 1))
    await p.screenshot({ path: 'outputs/_seneste/e2e/videosvar-2497-' + navn + bredde + '.png', fullPage: true })
  } finally { await browser.close().catch(() => {}); await vite.stop().catch(() => {}); await mock.close().catch(() => {}) }
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\/]/).pop())) main().catch(e => { console.error('FEJL', e.message); process.exitCode = 1 })
