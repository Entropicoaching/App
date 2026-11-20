// 1969: kostgrenen (Set, Kost i dag) og ugevideoen samlet på én gren, 390 px lys og mørk mod mocken.
// Atleten ser planmåltider i Kost i dag og "Se ugevideo" på Hjem samme dag; coachen ser "Set af atleten" og lægger ugevideo.
// Pasets top på Hjem måles uden og med ugevideokortet. Kun syntetisk "Atlet W".
// Kør: node e2e/samlet-kost-ugevideo-1969.spec.mjs
// Uden begge tabeller (som i produktion i dag): E2E_HIDE_TABLES=kostplan_v1_seen,coach_week_videos node e2e/samlet-kost-ugevideo-1969.spec.mjs
import { join } from 'node:path'
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { seed, runAtlet, runCoach } from './kost-set-paa-main.spec.mjs'
import { runUgevideo } from './ugevideo-1953.spec.mjs'

const MOBILE = { width: 390, height: 844 }
const tema = (page, navn) => page.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), navn)

async function hjemPasTop(page, navn) {
  await page.goto(APP_URL)
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch { /* ignoreret */ } })
  await page.reload()
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  const pas = page.getByText('Dagens pas', { exact: true }).first()
  await pas.waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(800)
  await tema(page, navn)
  const kortAntal = await page.getByRole('region', { name: 'Ugevideo fra din coach' }).count()
  const box = await pas.boundingBox()
  return { top: Math.round(box.y), kort: kortAntal }
}

async function main() {
  const s = seed()
  const udenTabeller = (process.env.E2E_HIDE_TABLES || '').split(',').includes('coach_week_videos')
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  let fejl = null
  const kvit = []
  try {
    for (const navn of udenTabeller ? ['moerk'] : ['lys', 'moerk']) {
      const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) })
      await mock.listen(MOCK_PORT)
      const errors = []
      const side = async () => { const p = await browser.newPage({ viewport: MOBILE }); p.on('pageerror', err => errors.push(err.message)); return p }
      try {
        const foer = await hjemPasTop(await side(), navn) // Hjem uden ugevideo = som main
        const atlet = await side()
        const a = await runAtlet(atlet, mock, s.today, navn, OUT_DIR, { tabel: !udenTabeller })
        const coach = await side()
        const c = await runCoach(coach, navn)
        if (!/Sendt \d+\. \w+/.test(c)) throw new Error('Coachen ser ikke Sendt <dato>: ' + c)
        if (!udenTabeller && !/Set af atleten \d+\. \w+/.test(c)) throw new Error('Coachen ser ikke Set af atleten <dato>: ' + c)
        if (udenTabeller && /Set af atleten/.test(c)) throw new Error('Uden tabel må der ikke stå Set: ' + c)
        let efter = foer
        let video = null
        if (!udenTabeller) {
          video = await runUgevideo(await side(), mock)
          mock.table('coach_week_videos').forEach(r => { r.athlete_seen_at = null })
          const p = await side()
          efter = await hjemPasTop(p, navn) // ugevideokortet står på Hjem, ikke set
          if (efter.kort !== 1) throw new Error('Hjem skulle vise ét ugevideokort, fandt ' + efter.kort)
          const hoejde = efter.top - foer.top
          if (efter.top > 600) throw new Error(`Pasets top ${efter.top} px er under 600 px ved 390x844`)
          if (navn === 'lys') await p.screenshot({ path: join(OUT_DIR, '1969-atlet-hjem-med-ugevideo-lys.png'), fullPage: false })
          efter.tillaeg = hoejde
        } else if (foer.kort !== 0) throw new Error('Uden tabel må Hjem ikke vise ugevideokort')
        if (errors.length) throw new Error('browserfejl: ' + errors.join('; '))
        kvit.push({ tema: navn, tabeller: !udenTabeller, pasTopUdenVideo: foer.top, pasTopMedVideo: efter.top, tillaeg: efter.tillaeg ?? 0, seen: a.seen, video })
      } finally { await mock.close?.() }
    }
  } catch (e) { fejl = e } finally { await browser.close(); await vite.stop() }
  console.log(JSON.stringify(kvit, null, 1))
  if (fejl) throw fejl
}

if (import.meta.url === `file:///${process.argv[1].split(String.fromCharCode(92)).join("/")}`) main().catch(err => { console.error(err); process.exitCode = 1 })
