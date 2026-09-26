// ORDRE 439: atleten mærker fremgang. Een verificeringskommando pr. blok:
//   node outputs/439/verify-439.mjs --blok 1   rekorder: fejring på sættet + Fremgang med dato
//   node outputs/439/verify-439.mjs --blok 2   "din uge" når ugens sidste pas er klaret
//   node outputs/439/verify-439.mjs --blok 3   offline: rekord uden net fejres når sættet er
//                                              gemt lokalt, og tæller kun én gang
// Flag: --no-build (genbrug dist/).
// Headless Chromium 390x844 (touch, iPhone-UA) mod e2e-mocken med den
// syntetiske uge fra outputs/419/uge-faelles.mjs (opdigtet Testatlet, tre
// forgangne uger hvor squat stiger 2,5 kg pr. uge). Ingen prod, ingen atletdata.
import path from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ROOT, MOCK_PORT, MOBILE_UA, startStaticServer, byg, hentChromium, bygSeed } from '../419/uge-faelles.mjs'

const arg = (n) => process.argv.includes(n)
const blok = process.argv[process.argv.indexOf('--blok') + 1]
if (!['1', '2', '3'].includes(blok)) { console.error('brug: --blok 1|2|3'); process.exit(2) }
const UD = path.join(ROOT, 'outputs', '439')
mkdirSync(UD, { recursive: true })
if (!arg('--no-build')) { console.log('Bygger mod mocken ...'); byg() }

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { seed, exerciseIds } = bygSeed(fx.buildSeed, fx)
const mock = createMockSupabase(seed)
await mock.listen(MOCK_PORT)
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
const page = await context.newPage()
const konsolFejl = []
page.on('pageerror', e => konsolFejl.push(String(e)))
page.on('console', m => {
  if (m.type() !== 'error') return
  const t = m.text()
  // Uden net (blok 3) fejler browserens egne hentninger højlydt; det er ikke appens fejl.
  if (blok === '3' && /ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/.test(t)) return
  konsolFejl.push(t.slice(0, 300))
})
const shot = (navn, opt = {}) => page.screenshot({ path: path.join(UD, `${navn}.png`), ...opt })
const resultat = { blok, fund: {}, trin: [], konsolFejl }
const trin = (t) => { resultat.trin.push(t); console.log(`  [blok ${blok}] ${t}`) }

async function logInd() {
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1500)
}
const fane = async (navn) => { await page.locator('nav').getByText(navn, { exact: true }).click(); await page.waitForTimeout(900) }
const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })
const venterPaa = (navn, n) => page.waitForFunction(([navn, n]) => {
  const t = document.body.innerText
  return t.includes(`Sæt ${n}/`) && t.includes(navn)
}, [navn, n], { timeout: 15000 })
async function log(navn, n) {
  await venterPaa(navn, n)
  await page.waitForTimeout(300)
  await godkendt().click()
  await page.waitForTimeout(350)
}
const fejring = () => page.evaluate(() => {
  const e = document.querySelector('[data-rekord-fejring]')
  return e ? { key: e.getAttribute('data-rekord-fejring'), tekst: e.textContent.trim() } : null
})
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const iDag = (() => { const d = new Date(); return `${d.getDate()}. ${MDR[d.getMonth()]}` })()
const rekordRaekker = () => page.evaluate(() => [...document.querySelectorAll('[data-rekord]')].map(r => r.innerText.replace(/\s+/g, ' ').trim()))
const mockRaekker = async () => (await (await fetch(`${mockUrl}/__e2e/table?name=exercise_logs`)).json())

const sq = exerciseIds[0][0] // Dag 1, Squat (4 × 5, anbefalet 100 kg; forrige uge 97,5 kg)

async function blok1() {
  // Squat sæt 1: 100 × 5 → e1RM 117 kg; bedst før: 97,5 × 5 → 114 kg.
  await log('Squat', 1)
  await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 5000 })
  const f1 = await fejring()
  resultat.fund.saet1 = f1
  trin(`sæt 1 (100 kg × 5): "${f1.tekst}" på kortet`)
  assert.equal(f1.key, `${sq}_1`, 'fejringen skal høre til sæt 1')
  assert.match(f1.tekst, /Ny rekord: Squat e1RM 117 kg, \+3 kg$/, 'fejringens tekst')
  await page.locator('[data-rekord-fejring]').scrollIntoViewIfNeeded()
  await shot('01-rekord-paa-saettet')

  // Sæt 2: samme 100 × 5 → ingen ny rekord.
  await log('Squat', 2)
  await page.waitForTimeout(600)
  const f2 = await fejring()
  trin(`sæt 2 (100 kg × 5, samme som sæt 1): fejring ${f2 ? `stadig fra ${f2.key.endsWith('_1') ? 'sæt 1' : f2.key}` : 'ingen'}`)
  assert.ok(!f2 || f2.key === `${sq}_1`, 'sæt 2 må ikke fejres')

  // Sæt 3: 102,5 × 5 → e1RM 120, rekord; fortrydes → fejringen går væk og
  // sættet står ikke i Fremgang. Logges igen på 100 kg: ingen rekord.
  await venterPaa('Squat', 3)
  await page.getByRole('button', { name: '2,5 kg mere', exact: true }).click()
  await page.waitForTimeout(200)
  await godkendt().click()
  await page.waitForFunction((k) => document.querySelector('[data-rekord-fejring]')?.getAttribute('data-rekord-fejring') === k, `${sq}_3`, { timeout: 5000 })
  const f3 = await fejring()
  trin(`sæt 3 (102,5 kg × 5): "${f3.tekst}"`)
  assert.match(f3.tekst, /Ny rekord: Squat e1RM 120 kg, \+3 kg$/)
  await page.getByRole('button', { name: '↺ Fortryd sidste sæt' }).first().click()
  await venterPaa('Squat', 3)
  await page.waitForTimeout(500)
  const efterFortryd = await fejring()
  trin(`sæt 3 fortrudt: fejring ${efterFortryd ? efterFortryd.key : 'væk'}`)
  assert.ok(!efterFortryd || efterFortryd.key !== `${sq}_3`, 'fejringen skal væk, når sættet fortrydes')
  await page.getByRole('button', { name: '2,5 kg mindre', exact: true }).click()
  await page.waitForTimeout(200)
  await godkendt().click()
  await venterPaa('Squat', 4)
  await page.waitForTimeout(600)
  const f3b = await fejring()
  trin(`sæt 3 logget igen på 100 kg × 5: fejring ${f3b ? f3b.key : 'ingen'}`)
  assert.ok(!f3b, 'sæt 3 på 100 kg er ingen rekord')

  // Sæt 4: 105 kg, men sprunget over → ingen rekord.
  await page.getByRole('button', { name: '2,5 kg mere', exact: true }).click()
  await page.getByRole('button', { name: '2,5 kg mere', exact: true }).click()
  await page.getByRole('button', { name: 'Spring over', exact: true }).click()
  await venterPaa('Bænkpres', 1)
  await page.waitForTimeout(800)
  const f4 = await fejring()
  trin(`sæt 4 (105 kg, sprunget over): fejring ${f4 ? f4.key : 'ingen'}`)
  assert.ok(!f4, 'et sprunget sæt må aldrig fejres')

  // Fremgang: dagens rekord står én gang, med dato; den fortrudte gør ikke.
  await fane('Fremgang')
  await page.locator('[data-rekord-liste]').waitFor({ state: 'visible', timeout: 15000 })
  const raekker = await rekordRaekker()
  resultat.fund.fremgang = raekker
  const idag = raekker.filter(r => r.startsWith(iDag))
  trin(`Fremgang, "Dine rekorder" (${raekker.length} i alt): i dag = ${JSON.stringify(idag)}`)
  assert.equal(idag.length, 1, 'præcis én rekord i dag')
  assert.match(idag[0], /Squat e1RM 117 kg/)
  assert.ok(!raekker.some(r => /e1RM 120 kg/.test(r)), 'det fortrudte sæt må ikke stå som rekord')
  assert.ok(raekker.every(r => /^\d{1,2}\. [a-zæø]{3} /.test(r)), 'hver rekord har en dato')
  await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded()
  await shot('02-fremgang-rekorder')
  const rows = (await mockRaekker()).filter(r => r.exercise_id === sq)
  trin(`mocken: squat-sæt ${rows.map(r => `${r.set_number}:${r.skipped ? 'sprunget' : `${r.weight}×${r.reps_completed}`}`).sort().join(' ')}`)
}

let blok2 = async () => { throw new Error('blok 2 ikke skrevet endnu') }
let blok3 = async () => { throw new Error('blok 3 ikke skrevet endnu') }
try { const m = await import('./blok2.mjs'); blok2 = m.blok2 } catch { /* endnu ikke */ }
try { const m = await import('./blok3.mjs'); blok3 = m.blok3 } catch { /* endnu ikke */ }

const ctx = { page, context, shot, trin, resultat, fane, mockUrl, fx, exerciseIds, log, venterPaa, godkendt, fejring, rekordRaekker, mockRaekker, iDag, logInd }
try {
  if (blok !== '3') await logInd()
  if (blok === '1') await blok1()
  else if (blok === '2') await blok2(ctx)
  else await blok3(ctx)
  assert.equal(konsolFejl.length, 0, `konsolfejl: ${konsolFejl.join(' | ')}`)
  resultat.groen = true
  console.log(`GRØN: blok ${blok}`)
} catch (e) {
  resultat.groen = false
  resultat.fejl = String(e?.stack || e)
  await shot(`fejl-blok${blok}`).catch(() => {})
  console.error('RØD:', e.message)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(UD, `blok${blok}.json`), JSON.stringify(resultat, null, 2) + '\n')
  await browser.close(); server.close(); await mock.close()
}
