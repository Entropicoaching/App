// KRITIK 648, blok 2: Vaidyas NYT-I-APPEN.html (ordre 644), kun laest. file:// fra skrivebordet,
// headless Chromium (playwrights) 390 touch og 1280 mus, lys og moerk, alt net blokeret.
// Maaler: ord, skaerme, billeder vist, sidelaens rul, tankestreger, punkter; og hvert citat fra appen
// (".app"-teksterne) slaas op i appens kode paa entropi-app main 391144e (git grep i dette trae,
// som har 391144e). Skriver nyt-648.json og N648-*.png. Filen hashes, saa verify kan se, at den er den samme.
//   node outputs/kritik-648/nyt-648.mjs
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HER, '..', '..')
const FIL = 'C:/Users/Entropi/Desktop/NYT-I-APPEN.html'
const APP = '391144e'
const res = { fil: FIL, sha256: createHash('sha256').update(readFileSync(FIL)).digest('hex'), app: APP, koersler: [], citater: [], net: 0, fejl: [] }

const b = await chromium.launch()
for (const bredde of [390, 1280]) for (const farve of ['light', 'dark']) {
  const mobil = bredde < 500
  const ctx = await b.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, colorScheme: farve })
  await ctx.route(/^https?:/, (r) => { res.net++; return r.abort() })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => res.fejl.push(e.message))
  await p.goto(pathToFileURL(FIL).href)
  await p.waitForTimeout(400)
  const m = await p.evaluate(() => {
    const tekst = document.querySelector('main').innerText
    const ord = tekst.split(/\s+/).filter((x) => /[\p{L}\d]/u.test(x)).length
    const imgs = [...document.images].map((i) => ({ ok: i.complete && i.naturalWidth > 0, b: Math.round(i.getBoundingClientRect().width), alt: i.alt }))
    return {
      ord, tekst,
      skaerme: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
      sidelaens: document.documentElement.scrollWidth - innerWidth,
      billeder: imgs,
      punkter: [...document.querySelectorAll('li.punkt h2')].map((h) => h.innerText.replace(/\s+/g, ' ').trim()),
      app: [...document.querySelectorAll('.app')].map((s) => s.innerText.trim()),
      foerste: document.querySelector('.ingress')?.innerText.trim(),
      sidste: document.querySelector('.slut')?.innerText.trim(),
      broed: getComputedStyle(document.body).fontSize,
      bg: getComputedStyle(document.body).backgroundColor,
      tankestreg: /[\u2013\u2014]/.test(tekst),
    }
  })
  res.koersler.push({ bredde, farve, ...m })
  if (farve === 'light') {
    await p.screenshot({ path: path.join(HER, `N648-${bredde}-hel.png`), fullPage: true })
    if (mobil) {
      await p.screenshot({ path: path.join(HER, 'N648-390-top.png') })
      const fig = await p.$$('figure')
      for (const i of [0, 4]) await fig[i].screenshot({ path: path.join(HER, `N648-390-billede-${i + 1}.png`) })
    }
  } else await p.screenshot({ path: path.join(HER, `N648-${bredde}-moerk-top.png`) })
  await ctx.close()
}
await b.close()

// Citaterne fra appen: staar de ordret i koden paa 391144e?
const grep = (s) => { try { return execSync(`git grep -n -F -e "${s.replace(/"/g, '\\"')}" ${APP} -- src public`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).slice(0, 3) } catch { return [] } }
for (const c of res.koersler[0].app) {
  // "Squat e1RM 117 kg, +9 kg siden uge 37" er et eksempel; koden bygger den (fremgangLinje).
  const soeg = /e1RM \d+ kg, \+\d+ kg siden uge/.test(c) ? 'e1RM ${sidste.e1rm} kg, ${aendring} siden uge' : /^\d+\. [a-z]{3}$/.test(c) ? "'sep'" : c.replace(/^☁ /, '')
  res.citater.push({ citat: c, soegt: soeg, fundet: grep(soeg) })
}
writeFileSync(path.join(HER, 'nyt-648.json'), JSON.stringify(res, null, 2))
for (const k of res.koersler) console.log(k.bredde, k.farve, k.ord, 'ord', k.skaerme, 'skaerme', k.sidelaens, 'px sidelaens', k.billeder.filter((x) => x.ok).length, '/', k.billeder.length, 'billeder', k.broed, k.bg)
for (const c of res.citater) console.log(c.fundet.length ? 'OK  ' : 'FEJL', c.citat, '->', c.fundet[0] || '')
console.log('net', res.net, 'fejl', res.fejl.length)
