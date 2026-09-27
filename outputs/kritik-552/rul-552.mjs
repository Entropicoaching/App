// KRITIK 552 blok 1: hvad ser eleven, naar hun trykker paa et kendt parti i listen? (K13)
// Headless, 360/390 touch og 1280 mus, uden net. Maaler #braet, #gaade-titel og listen lige efter
// trykket (100 ms og 1,2 s), uden at scriptet selv ruller efter trykket. Skriver rul-552.json og
// K-*-4-efter-tryk.png (det eleven ser). Samme for "Oev gafler" i "Oev et tema" (K-*-5-efter-tema.png).
import path from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k552-rul-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main skak.html`)
execSync('tar -xf s.tar', { cwd: dir })
const URL_ = pathToFileURL(path.join(dir, 'skak.html')).href
const browser = await chromium.launch({ headless: true })
const ud = { skak: SHA }
const maal = (page) => page.evaluate(() => { const r = (id) => { const e = document.getElementById(id); if (!e || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bund: Math.round(b.bottom) } }; return { scrollY: Math.round(scrollY), vinduH: innerHeight, braet: r('braet'), titel: r('gaade-titel'), status: r('status'), liste: r('kendte-partier-liste'), historie: r('kendt-parti-historie') } })
for (const bredde of [360, 390, 1280]) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? (bredde === 360 ? 780 : 844) : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  const page = await ctx.newPage()
  const net = []
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  await page.goto(URL_); await page.waitForSelector('#braet .felt'); await page.waitForTimeout(500)
  const tryk = (sel) => (mobil ? page.locator(sel).first().tap() : page.locator(sel).first().click())
  await tryk('#fane-gaader'); await page.waitForTimeout(300)
  await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 20000 })
  await page.locator('#fold-kendte-partier > summary').scrollIntoViewIfNeeded()
  await tryk('#fold-kendte-partier > summary'); await page.waitForTimeout(300)
  const knap = '#kendte-partier-liste .kendt-parti-knap[data-parti="opera-1858"]'
  await page.locator(knap).scrollIntoViewIfNeeded()
  const foer = await maal(page)
  await tryk(knap)
  await page.waitForTimeout(100)
  const efter100 = await maal(page)
  await page.waitForTimeout(1100)
  const efter1200 = await maal(page)
  await page.screenshot({ path: path.join(HERE, `K-${bredde}-4-efter-tryk.png`) })
  const i = (b, v) => !!b && b.top < v && b.bund > 0
  // Samme for "Oev et tema": tryk paa "Oev gafler".
  await page.locator('#fold-gaade-temaer > summary').scrollIntoViewIfNeeded()
  if (!(await page.locator('#fold-gaade-temaer').evaluate((d) => d.open))) await tryk('#fold-gaade-temaer > summary')
  await page.waitForTimeout(300)
  await page.locator('#gaade-temaer .gaade-tema-knap[data-tema="fork"]').scrollIntoViewIfNeeded()
  await tryk('#gaade-temaer .gaade-tema-knap[data-tema="fork"]'); await page.waitForTimeout(1200)
  const tema = await maal(page)
  await page.screenshot({ path: path.join(HERE, `K-${bredde}-5-efter-tema.png`) })
  const temaDel = { braetISyne: i(tema.braet, tema.vinduH), statusISyne: i(tema.status, tema.vinduH), afstandTilBraet: tema.braet ? -tema.braet.top : null, skaerme: tema.braet ? Math.round((-tema.braet.top / tema.vinduH) * 10) / 10 : null }
  ud[bredde] = { tema: temaDel, foer, efter100, efter1200, braetISyne: i(efter1200.braet, efter1200.vinduH), titelISyne: i(efter1200.titel, efter1200.vinduH), statusISyne: i(efter1200.status, efter1200.vinduH), afstandTilBraet: efter1200.braet ? -efter1200.braet.top : null, skaerme: efter1200.braet ? Math.round((-efter1200.braet.top / efter1200.vinduH) * 10) / 10 : null, net: net.length }
  console.log(bredde, JSON.stringify(ud[bredde]))
  await ctx.close()
}
await browser.close()
writeFileSync(path.join(HERE, 'rul-552.json'), JSON.stringify(ud, null, 1))
