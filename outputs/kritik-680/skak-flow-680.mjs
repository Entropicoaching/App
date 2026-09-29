// KRITIK 680, blok 2: et parti mod computeren (niveau 1) og en gaade som elev, 360 og 1280. Kun maaling.
//   node outputs/kritik-680/skak-flow-680.mjs <mappe med skak.html> <tag>
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const URL_SKAK = pathToFileURL(path.join(path.resolve(process.argv[2]), 'skak.html')).href
const TAG = process.argv[3] ?? 'main'
const res = { net: 0, fejl: [], m: {} }
const browser = await chromium.launch()
for (const { b, h, mobil } of [{ b: 360, h: 740, mobil: true }, { b: 1280, h: 800, mobil: false }]) {
  const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil })
  await ctx.route(/^https?:/, (r) => { res.net++; return r.abort() })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => res.fejl.push(`${b}: ${e.message}`))
  const m = (res.m[b] = {})
  const skud = (n) => page.screenshot({ path: path.join(HER, `S680-${TAG}-${b}-${n}.png`) })
  const tryk = async (fra, til) => { await page.locator(`[data-square="${fra}"]`).first().click(); await page.waitForTimeout(150); await page.locator(`[data-square="${til}"]`).first().click(); await page.waitForTimeout(1800) }
  const status = () => page.evaluate(() => document.querySelector('#status')?.innerText ?? null)
  await page.goto(URL_SKAK); await page.waitForTimeout(800)
  // Gaade: foerste, som eleven moeder den.
  await skud('2-gaade-foerst')
  m.gaadeStatus = await status()
  await page.locator('#knap-gaade-hint').scrollIntoViewIfNeeded().catch(() => {})
  // Spil mod computeren
  await page.locator('#fane-spil').click(); await page.waitForTimeout(500)
  const mod = page.getByRole('button', { name: /Mod computeren/ })
  m.startkort = (await mod.count()) > 0
  if (m.startkort) { await mod.first().click(); await page.waitForTimeout(600) }
  await skud('3-spil-valgt')
  m.status0 = await status()
  await tryk('e2', 'e4'); m.status1 = await status(); await skud('3-spil-efter-e4')
  await tryk('g1', 'f3'); m.status2 = await status()
  await tryk('f1', 'c4'); m.status3 = await status(); await skud('3-spil-efter-3-traek')
  m.antalBrikkerSynlige = await page.evaluate(() => document.querySelectorAll('#braet .brik-svg').length)
  m.traekliste = (await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/Trækliste.{0,200}/)?.[0] ?? null
  m.braet = await page.evaluate(() => { const r = document.querySelector('#braet').getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), b: Math.round(r.width), vinduH: innerHeight } })
  await skud('3-spil-hel-skaerm')
  await page.screenshot({ path: path.join(HER, `S680-${TAG}-${b}-3-spil-hel.png`), fullPage: true })
  await ctx.close()
}
await browser.close()
writeFileSync(path.join(HER, `skak-flow-680-${TAG}.json`), JSON.stringify(res, null, 1))
console.log(JSON.stringify(res, null, 1))
