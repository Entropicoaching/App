// KRITIK 552 blok 2 (M8): Bigaardens skilt paa kortet, foer (e085b2b) og efter (main) 542.
//   node outputs/kritik-552/kort-552.mjs
// Samme gemte "dag 2"-tilstand som elev-536/552 (Moellen 1-6 og Grusgraven 1-2 mestret, seks quests
// klaret, niveau 7), headless 360 og 390 med touch og 1280 med mus, uden net. Maaler Bigaardens
// skilt mod de andre skilte (knapperne i #kort-steder), "!"-erne (.bog-udraab) og kortets kant:
// overlap, mindste afstand, hoejde og skriftstoerrelse. Skriver kort-552.json.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require(path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const UD = path.dirname(fileURLToPath(import.meta.url))
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const T = Date.UTC(2026, 8, 28, 8, 0, 0)
const N = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
const forloeb = { moellen: 6, stenbrud: 2 }
const gemt = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 7, niveauPoint: 1, erfaring: 900, hoved: 4, haand: 2, hjerte: 3 }, sted: 'moellen', questFremdrift: Object.fromEntries(Object.entries(N).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (forloeb[id] ?? 0))])), questbog: { klaret: ['mel-til-bageren', 'broed-til-alle', 'aenderne', 'melposerne', 'dragen', 'aebleskiver'], hoved: 'bagerhue', hviler: {} } }
const browser = await chromium.launch()
const ud = {}
for (const ref of ['e085b2b', 'main']) {
  const SPIL = mkdtempSync(path.join(tmpdir(), 'kritik-552-kort-'))
  execSync(`git -C "${MAT}" archive ${ref} | tar -x -C "${SPIL.replace(/\\/g, '/')}"`, { shell: 'bash' })
  const hash = execSync(`git -C "${MAT}" rev-parse --short ${ref}`).toString().trim()
  ud[ref] = { hash }
  for (const bredde of [360, 390, 1280]) {
    const mobil = bredde < 500
    const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: 'light' })
    await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, T)
    let net = 0
    await ctx.route(/^https?:/, (r) => { net++; return r.abort() })
    const page = await ctx.newPage()
    const fejl = []
    page.on('pageerror', (e) => fejl.push(e.message))
    const url = pathToFileURL(path.join(SPIL, 'spil.html')).href
    await page.goto(url)
    await page.evaluate((x) => localStorage.setItem('ganita:spil', JSON.stringify(x)), gemt)
    await page.goto(url); await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x1: b.left, y1: b.top, x2: b.right, y2: b.bottom, h: Math.round(b.height), w: Math.round(b.width) } }
      const skilt = document.querySelector('.bog-sted-skilt')
      const kort = document.querySelector('.kort')
      const andre = [...document.querySelectorAll('#kort-steder button')].filter((b) => b.offsetParent).map((b) => ({ navn: b.innerText.replace(/\s+/g, ' ').trim(), ...r(b) }))
      const udraab = [...document.querySelectorAll('.bog-udraab')].map((e) => ({ quest: e.dataset.quest, ...r(e) }))
      if (!skilt) return { skilt: null, andre: andre.map((a) => a.navn) }
      const s = r(skilt)
      const afstand = (a, b) => Math.max(0, Math.max(a.x1 - b.x2, b.x1 - a.x2)) + Math.max(0, Math.max(a.y1 - b.y2, b.y1 - a.y2))
      const overlap = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
      const navnFont = (e) => parseFloat(getComputedStyle(e).fontSize)
      const k = kort ? r(kort) : null
      return {
        skilt: { h: s.h, w: s.w, tekst: skilt.innerText.trim(), font: navnFont(skilt.querySelector('.sted-navn') ?? skilt), ikon: !!skilt.querySelector('svg') },
        andreFont: [...document.querySelectorAll('#kort-steder button .sted-navn')].filter((e) => e.offsetParent).map(navnFont),
        andreHoejde: andre.map((a) => a.h),
        naermesteSkilt: andre.map((a) => ({ navn: a.navn, afstand: Math.round(afstand(s, a)), overlap: overlap(s, a) })).sort((a, b) => a.afstand - b.afstand)[0],
        udraab: udraab.map((u) => ({ quest: u.quest, afstand: Math.round(afstand(s, u)), overlap: overlap(s, u) })),
        indenforKortet: k ? s.x1 >= k.x1 && s.x2 <= k.x2 && s.y1 >= k.y1 && s.y2 <= k.y2 : null,
        // Trykfladen: hele Bigaarden er en knap. Rammer den en anden knap?
        trykflade: (() => { const kn = document.querySelector('.bog-sted-knap'); if (!kn) return null; const t = r(kn); return { h: t.h, w: t.w, overlapMed: andre.filter((a) => overlap(t, a)).map((a) => a.navn), naermeste: andre.map((a) => ({ navn: a.navn, afstand: Math.round(afstand(t, a)) })).sort((a, b) => a.afstand - b.afstand)[0] } })(),
      }
    })
    await page.locator('.kort').screenshot({ path: path.join(UD, `M8-${ref === 'main' ? 'efter' : 'foer'}-${bredde}-kort.png`) })
    ud[ref][bredde] = { ...m, net, fejl, vandret: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) }
    console.log(ref, bredde, JSON.stringify(ud[ref][bredde]))
    await ctx.close()
  }
}
await browser.close()
writeFileSync(path.join(UD, 'kort-552.json'), JSON.stringify(ud, null, 1) + '\n')
