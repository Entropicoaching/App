// KRITIK 680, blok 2: skakken efter Chaturangas 670, 674 og 678, som elev paa 12 aar (360 og 390 touch) og som Marc paa 1280 mus.
// Headless Chromium (matematik-traeets playwright), file://, uden net. Kun maaling og skaermbilleder; intet roeres.
//   node outputs/kritik-680/skak-680.mjs <mappe med skak.html> <tag>   -> skak-680-<tag>.json og S680-<tag>-*.png
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const ROD = path.resolve(process.argv[2])
const TAG = process.argv[3] ?? 'main'
const URL_SKAK = pathToFileURL(path.join(ROD, 'skak.html')).href
const BREDDER = [{ b: 360, h: 740, mobil: true }, { b: 390, h: 844, mobil: true }, { b: 1280, h: 800, mobil: false }]
const FANER = ['bibliotek', 'laer', 'taktik', 'spil', 'gaader', 'opstil']
let net = 0
const res = { ver: TAG, net: 0, fejl: [], m: {} }

const MAAL = () => {
  const synligEl = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false } return true }
  let ord = 0, tal = 0
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim()
    if (!t || !synligEl(n.parentElement)) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    if (![...rg.getClientRects()].some((r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) continue
    ord += t.split(' ').filter((x) => /[\p{L}\d]/u.test(x)).length
    tal += (t.match(/\d+/g) || []).length
  }
  const knapper = [...document.querySelectorAll('button, a[href], summary, input:not([type=hidden]), select, [role=tab]')].filter((e) => { const r = e.getBoundingClientRect(); return synligEl(e) && r.width > 1 && r.bottom > 0 && r.top < innerHeight }).length
  const braet = document.querySelector('#braet')?.getBoundingClientRect()
  const under44 = [...document.querySelectorAll('button, [role=tab]')].filter((e) => { const r = e.getBoundingClientRect(); return synligEl(e) && r.width > 1 && r.bottom > 0 && r.top < innerHeight && (r.height < 40 || r.width < 40) }).map((e) => `${(e.innerText || e.getAttribute('aria-label') || e.id).replace(/\s+/g, ' ').slice(0, 22)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  return { ord, tal, knapper, hoejdeSkaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), vandret: document.documentElement.scrollWidth > innerWidth, braet: braet ? { top: Math.round(braet.top), bund: Math.round(braet.bottom), b: Math.round(braet.width) } : null, mindreEnd40: under44.slice(0, 8), skrift: getComputedStyle(document.body).fontSize }
}

const browser = await chromium.launch()
for (const { b, h, mobil } of BREDDER) {
  const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light' })
  await ctx.route(/^https?:/, (r) => { net++; return r.abort() })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => res.fejl.push(`${b}: ${e.message}`))
  const m = (res.m[b] = {})
  const skud = (navn, hel = false) => page.screenshot({ path: path.join(HER, `S680-${TAG}-${b}-${navn}.png`), fullPage: hel })
  await page.goto(URL_SKAK)
  await page.waitForTimeout(900)
  m.start = await page.evaluate(MAAL)
  m.startFane = await page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]')?.innerText ?? null)
  await skud('0-start')
  for (const f of FANER) {
    await page.locator(`#fane-${f}`).click()
    await page.waitForTimeout(500)
    await page.evaluate(() => scrollTo(0, 0))
    m[f] = await page.evaluate(MAAL)
    m[f].tekst = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 900)
    await skud(`1-${f}`)
    if (f === 'spil' || f === 'laer' || f === 'gaader') await skud(`1-${f}-hel`, true)
  }
  await ctx.close()
}
res.net = net
await browser.close()
writeFileSync(path.join(HER, `skak-680-${TAG}.json`), JSON.stringify(res, null, 1))
console.log(JSON.stringify({ net, fejl: res.fejl }, null, 1))
for (const b of Object.keys(res.m)) for (const [k, v] of Object.entries(res.m[b])) if (v && v.ord != null) console.log(b, k, `ord ${v.ord} tal ${v.tal} knapper ${v.knapper} hoejde ${v.hoejdeSkaerme} vandret ${v.vandret} braet ${JSON.stringify(v.braet)} <40: ${v.mindreEnd40.join('; ')}`)
