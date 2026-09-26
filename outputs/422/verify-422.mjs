// ORDRE 422: atletens uge, del 2. Een verificeringskommando pr. blok:
//   node outputs/422/verify-422.mjs --blok 1   I4 Fremgang (squat, baenk, doedloeft)
//   node outputs/422/verify-422.mjs --blok 2   I5 + ret-panel, pauselinje, vis/ret
// Flag: --no-build (genbrug dist/), --foer (kun billeder til outputs/422/foer,
// ingen krav; bruges paa koden foer rettelsen).
// Headless Chromium 390x844 (touch, iPhone-UA) mod e2e-mocken med den
// syntetiske uge fra outputs/419/uge-faelles.mjs. Ingen prod, ingen atletdata.
import path from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ROOT, MOCK_PORT, MOBILE_UA, startStaticServer, byg, hentChromium, bygSeed } from '../419/uge-faelles.mjs'

const arg = (n) => process.argv.includes(n)
const blok = process.argv[process.argv.indexOf('--blok') + 1]
if (!['1', '2'].includes(blok)) { console.error('brug: --blok 1|2'); process.exit(2) }
const FOER = arg('--foer')
const UD = path.join(ROOT, 'outputs', '422', FOER ? 'foer' : 'efter')
mkdirSync(UD, { recursive: true })
if (!arg('--no-build')) { console.log('Bygger mod mocken ...'); byg() }

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { seed } = bygSeed(fx.buildSeed, fx)
const mock = createMockSupabase(seed)
await mock.listen(MOCK_PORT)
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
const page = await context.newPage()
const konsolFejl = []
page.on('pageerror', e => konsolFejl.push(String(e)))
page.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text().slice(0, 300)) })
const shot = (navn, opt = {}) => page.screenshot({ path: path.join(UD, `${navn}.png`), ...opt })
const resultat = { blok, foer: FOER, fund: {}, konsolFejl }
const krav = (ok, besked) => { if (!FOER) assert.ok(ok, besked) }

async function logInd() {
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1200)
}
const fane = async (navn) => { await page.locator('nav').getByText(navn, { exact: true }).click(); await page.waitForTimeout(800) }

async function blok1() {
  await fane('Fremgang')
  await page.locator('svg polyline').first().waitFor({ state: 'visible', timeout: 15000 })
  for (const [knap, fil] of [['Squat', 'squat'], ['Bænk', 'baenk'], ['Dødløft', 'doedloeft']]) {
    await page.getByRole('button', { name: knap, exact: true }).first().click()
    await page.waitForTimeout(400)
    const m = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find(s => s.querySelector('polyline'))
      const sb = svg.getBoundingClientRect()
      const tekster = [...svg.querySelectorAll('text')].map(t => {
        const b = t.getBoundingClientRect()
        return { tekst: t.textContent, px: Math.round(b.height * 10) / 10, inde: b.left >= sb.left - 0.5 && b.right <= sb.right + 0.5 && b.top >= sb.top - 0.5 && b.bottom <= sb.bottom + 0.5 }
      })
      const linje = document.querySelector('[data-fremgang-linje]')
      return { linje: linje?.textContent || null, linjePx: linje ? parseFloat(getComputedStyle(linje).fontSize) : null, tekster }
    })
    resultat.fund[fil] = m
    await page.locator('svg polyline').first().scrollIntoViewIfNeeded()
    await shot(`fremgang-${fil}`)
    console.log(`  [${knap}] linje: ${m.linje} (${m.linjePx}px); etiketter: ${m.tekster.map(t => `${t.tekst}${t.inde ? '' : ' UDENFOR'} ~${t.px}px`).join(' | ')}`)
    krav(m.linje && /e1RM \d+ kg, ((\+|−)\d+ kg|uændret) siden uge \d+$/.test(m.linje), `${knap}: linjen over grafen mangler eller har forkert form: ${m.linje}`)
    krav(m.linjePx >= 14, `${knap}: linjen skal staa i normal stoerrelse, er ${m.linjePx}px`)
    krav(m.tekster.every(t => t.inde), `${knap}: en etiket staar uden for grafen`)
    krav(m.tekster.every(t => t.px >= 10), `${knap}: en etiket er under 10 px hoej`)
  }
  // Seeden loefter 2,5 kg mere hver uge; squat skal derfor vise en stigning.
  krav(/\+\d+ kg/.test(resultat.fund.squat?.linje || ''), 'squat skal vise en stigning')
}

let blok2 = async () => { throw new Error('blok 2 ikke skrevet endnu') }
try {
  const m = await import('./blok2.mjs').catch(() => null)
  if (m) blok2 = m.blok2
} catch { /* ingen blok 2 endnu */ }

try {
  await logInd()
  if (blok === '1') await blok1()
  else await blok2({ page, shot, krav, resultat, fane, mockUrl, fx, FOER })
  krav(konsolFejl.length === 0, `konsolfejl: ${konsolFejl.join(' | ')}`)
  resultat.groen = !FOER
  console.log(FOER ? `FOER: billeder i ${UD}` : `GRØN: blok ${blok}`)
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
