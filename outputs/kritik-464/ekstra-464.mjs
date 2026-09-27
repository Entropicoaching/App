// ORDRE 464, blok 1: det Vaidya aendrede ud over ordren i 456, maalt af mig.
// Headless Chromium mod e2e-mocken, syntetisk Testatlet (130 uger, ca. 4300 saet)
// med en gammel squat-top 110 x 5 (e1RM 128) for 130 uger siden.
//
// I1-I3: rekord-indeks version 2. Telefonen har et indeks fra 450 (version 1),
//   bygget af en afskaaret historik: "bedst foer" squat e1RM 114 (toppen mangler).
//   Aeldre telefon (Slow 4G + 4x CPU). Atleten logger squat saet 1 (100 x 5,
//   e1RM 117) straks, Dagens pas er brugbart, dvs. mens indekset bygges forfra.
//   Forventet: intet fejres (117 < 128, og intet fejres, foer alle sider er hentet),
//   indekset bliver version 2 med squat 128, og et rigtigt rekordsaet bagefter
//   (115 x 5, e1RM 134) fejres. Genaabnet henter kun det nye.
//   Tre koersler: uden loft, "Max rows" 1000 (130 uger) og "Max rows" 100 (90 uger).
// D: dobbelttryk paa "Kopier seneste uge" paa en droslet 390-telefon med 60 og
//   120 ms mellem trykkene (456 maalte 250 ms).
//
// Koersel: node outputs/kritik-464/ekstra-464.mjs  -> ekstra-464.json + E-*.png
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { UD, MOCK_PORT, MOCK_URL, DIST, statiskServer, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart, drosl, tabel, rekordIndeksBygget, bedstFoerE1rm } from './faelles-464.mjs'

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const { server, port } = await statiskServer(DIST)
const res = { indeks: [], kopi: [], konsolFejl: [] }
const NOEGLE = `entropi_rekord_indeks:${fx.ATHLETE_USER.id}`
const erSide = (u) => /\/rest\/v1\/exercise_logs\?/.test(u) && /select=exercise_id/.test(u) && /offset=/.test(u)

async function fejringer(context) {
  const liste = []
  await context.exposeBinding('__k464', (_s, data) => liste.push({ ...data, t: Date.now() }))
  await context.addInitScript(() => {
    let sidste = null
    addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
      const e = document.querySelector('[data-rekord-fejring]')
      const k = e && e.getAttribute('data-rekord-fejring')
      if (k && k !== sidste) window.__k464({ key: k, tekst: e.textContent.trim() })
      sidste = k
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }))
  })
  return liste
}
const indeks = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }, NOEGLE)

try {
  // ---- I: rekord-indeks version 2 og sider ----
  for (const loft of [null, 1000, 100]) {
    // Loft 100: 90 uger (ca. 3000 saet). Med 130 uger klipper loftet ogsaa
    // weeks-kaldet (131 uger > 100, hentes ikke side for side), og atleten ser
    // "Uge 100 er klaret" i stedet for ugens pas (se koersel-loft100-130uger.txt).
    const uger = loft === 100 ? 90 : 130
    const r = { loft: loft || 'ingen', uger }
    res.indeks.push(r)
    const { seed } = bygSeed(fx.buildSeed, fx, { uger, gammelTop: 110, gammelTopUge: -uger })
    const mock = createMockSupabase(seed, { maxRows: loft })
    await mock.listen(MOCK_PORT)
    const { context, page } = await nyTelefon(browser)
    const fej = await fejringer(context)
    page.on('pageerror', e => res.konsolFejl.push(`I${r.loft}: ${String(e).slice(0, 200)}`))
    const sider = []
    page.on('response', (s) => { if (erSide(s.url())) sider.push(s.json().then(j => j.length, () => null)) })
    // Et 450-indeks (version 1) paa telefonen, bygget af en afskaaret historik.
    await page.goto(`http://127.0.0.1:${port}/`)
    const til = new Date(Date.now() - 2 * 86400000).toISOString()
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [NOEGLE, { v: 1, athleteId: fx.ATHLETE_ID, bygget: true, til, base: { squat: { e1rm: 114, vaegte: { 97.5: 5 } } }, uger: {} }])
    const d = await drosl(page)
    let t0 = Date.now()
    await logIndAtlet(page, port, fx)
    await brugbart(page)
    r.logIndTilBrugbartMs = Date.now() - t0
    const tBrugbart = Date.now()
    // Straks: squat saet 1 med den forudfyldte vaegt (Anbefalet 100).
    r.feltSaet1 = await page.locator('input[aria-label^="Vægt, sæt"]').inputValue()
    const foerKlik = await indeks(page)
    r.indeksVedKlik = foerKlik ? { v: foerKlik.v, bygget: !!foerKlik.bygget, squat: Math.round(foerKlik.base?.squat?.e1rm || 0) } : null
    r.siderVedKlik = sider.length
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await rekordIndeksBygget(page, 300000)
    r.indeksByggetEfterMs = Date.now() - tBrugbart
    await page.waitForTimeout(1500)
    const efter = await indeks(page)
    r.indeksEfter = { v: efter?.v, bygget: !!efter?.bygget, squat: await bedstFoerE1rm(page, 'squat') }
    const laengder = await Promise.all(sider)
    r.sider = laengder.length
    r.raekker = laengder.reduce((a, n) => a + (n || 0), 0)
    r.fejretUnderOpbygning = fej.map(f => f.tekst)
    await page.screenshot({ path: path.join(UD, `E-indeks-${r.loft}-1-efter-opbygning.png`) })
    // Et rigtigt rekordsaet: squat saet 2 paa 115 x 5 (e1RM 134 > 128).
    await page.waitForFunction(() => document.body.innerText.includes('Sæt 2/'), null, { timeout: 30000 })
    for (let i = 0; i < 40; i++) {
      const v = Number((await page.locator('input[aria-label^="Vægt, sæt"]').inputValue()).replace(',', '.'))
      if (v === 115) break
      await page.getByRole('button', { name: v < 115 ? '2,5 kg mere' : '2,5 kg mindre', exact: true }).click()
    }
    r.feltSaet2 = await page.locator('input[aria-label^="Vægt, sæt"]').inputValue()
    const n0 = fej.length
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.waitForTimeout(4000)
    r.fejretRigtigRekord = fej.slice(n0).map(f => f.tekst)
    await page.screenshot({ path: path.join(UD, `E-indeks-${r.loft}-2-rigtig-rekord.png`) })
    // Genaabnet: kun det nye hentes.
    const foerGen = sider.length
    t0 = Date.now()
    await page.reload()
    await brugbart(page)
    r.genaabnetBrugbartMs = Date.now() - t0
    await page.waitForTimeout(6000)
    const gen = await Promise.all(sider.slice(foerGen))
    r.genaabnetSider = gen.length
    r.genaabnetRaekker = gen.reduce((a, n) => a + (n || 0), 0)
    const x = await indeks(page)
    r.genaabnetIndeks = { v: x?.v, bygget: !!x?.bygget, squat: await bedstFoerE1rm(page, 'squat') }
    r.fejringerIalt = fej.map(f => f.tekst)
    r.logs = (await tabel('exercise_logs')).filter(l => l.logged_at > til && !l.skipped).map(l => `${l.weight}x${l.reps_completed}`)
    console.log(`indeks, loft ${r.loft}: brugbart ${r.logIndTilBrugbartMs} ms; ved klik v${r.indeksVedKlik?.v} bygget=${r.indeksVedKlik?.bygget} efter ${r.siderVedKlik} sider; bygget ${r.indeksByggetEfterMs} ms efter brugbart paa ${r.sider} sider/${r.raekker} raekker; v${r.indeksEfter.v} squat ${r.indeksEfter.squat}; fejret under opbygning ${JSON.stringify(r.fejretUnderOpbygning)}; 115x5: ${JSON.stringify(r.fejretRigtigRekord)}; genaabnet ${r.genaabnetBrugbartMs} ms, ${r.genaabnetSider} sider/${r.genaabnetRaekker} raekker, v${r.genaabnetIndeks.v} squat ${r.genaabnetIndeks.squat}`)
    await d.cdp.detach().catch(() => {})
    await context.close(); await mock.close()
  }

  // ---- D: dobbelttryk paa "Kopier seneste uge" (390, droslet) ----
  for (const ms of [60, 120]) {
    const r = { msMellem: ms }
    res.kopi.push(r)
    const { seed } = bygSeed(fx.buildSeed, fx, { uger: 3 })
    const mock = createMockSupabase(seed)
    await mock.listen(MOCK_PORT)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    page.on('pageerror', e => res.konsolFejl.push(`D${ms}: ${String(e).slice(0, 200)}`))
    await drosl(page)
    await page.goto(`http://127.0.0.1:${port}/`)
    await page.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
    await page.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Testatlet').first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(3000)
    await page.locator('[role="button"]', { hasText: 'Testatlet' }).last().click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /Program$/ }).first().click()
    const kopi = page.getByRole('button', { name: /Kopiér seneste uge/ })
    await kopi.waitFor({ timeout: 30000 })
    const ugerFoer = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID)
    const b = await kopi.boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(ms)
    r.knapVedAndetTryk = await page.evaluate(() => { const k = [...document.querySelectorAll('button')].find(x => /Kopi/.test(x.textContent)); return k ? { tekst: k.textContent.trim(), disabled: k.disabled } : null })
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    const tK = Date.now()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(x => /Kopiér seneste uge/.test(x.textContent) && !x.disabled), null, { timeout: 90000 }).catch(() => {})
    r.kopiMs = Date.now() - tK
    await page.waitForTimeout(3000)
    const nye = (await tabel('weeks')).filter(w => w.athlete_id === fx.ATHLETE_ID && !ugerFoer.some(u => u.id === w.id))
    r.nyeUger = nye.map(w => w.week_number)
    await page.screenshot({ path: path.join(UD, `E-kopi-${ms}ms.png`) })
    console.log(`kopi, dobbelttryk ${ms} ms: knap ved andet tryk ${JSON.stringify(r.knapVedAndetTryk)}, ${nye.length} nye uger ${JSON.stringify(r.nyeUger)}`)
    await context.close(); await mock.close()
  }
} catch (e) {
  res.fejl = String(e?.stack || e)
  console.error(e)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(UD, 'ekstra-464.json'), JSON.stringify(res, null, 2) + '\n')
  await browser.close(); server.close()
  void MOCK_URL
  process.exit(process.exitCode || 0)
}
