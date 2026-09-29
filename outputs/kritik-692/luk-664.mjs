// KRITIK 692: er skak-fundene fra 664 (S15-S20) lukket paa skak main? Samme syntetiske lager og skaerme som skak-664.mjs.
//   node outputs/kritik-692/luk-664.mjs -> luk-664.json og L692-*.png her.
import path from 'node:path'
import { writeFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const dir = mkdtempSync(path.join(tmpdir(), 'k692-luk-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main`)
execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const { ugeNummer } = await imp('src/kompetencer.js')
const GS = await imp('src/gaadestorm.js')
const MANDAG = new Date('2026-09-28T10:00:00'); const DATO = '2026-09-28'; const UGE = ugeNummer(MANDAG)
const lager = { 'skak-gaade-storm-rekord-v1': { loeste: 20, kombo: 9, dato: '2026-09-14' }, 'skak-gaade-storm-tema-v1': 'blandet',
  [GS.STORM_PERIODE_NOEGLE]: { dag: { dato: DATO, loeste: 10 }, uge: { uge: UGE, loeste: 10 } },
  [GS.STORM_TEMA_PERIODE_NOEGLE]: { gaffel: { dag: { dato: DATO, loeste: 4 }, uge: { uge: UGE, loeste: 4 } } },
  [GS.STORM_TEMA_REKORD_NOEGLE]: { gaffel: 4 }, [GS.STORM_TEMA_HISTORIK_NOEGLE]: { gaffel: [2, 4] }, [GS.STORM_HISTORIK_NOEGLE]: [3, 6, 5, 2, 6] }
const SK = [{ navn: '360x740', bredde: 360, hoejde: 740, mobil: true }, { navn: '390x844', bredde: 390, hoejde: 844, mobil: true }, { navn: '1280x800', bredde: 1280, hoejde: 800, mobil: false }]
const res = { v: {}, fejl: [], net: 0 }
const browser = await chromium.launch()
for (const S of SK) {
  const ctx = await browser.newContext({ viewport: { width: S.bredde, height: S.hoejde }, isMobile: S.mobil, hasTouch: S.mobil, deviceScaleFactor: S.mobil ? 2 : 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => res.fejl.push(`${S.navn}: ${e.message}`))
  await page.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); res.net++; return r.abort() })
  await page.clock.install({ time: MANDAG })
  await page.addInitScript((l) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1'); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }, lager)
  await page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
  await page.waitForSelector('#braet .felt')
  const tryk = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (S.mobil) await l.tap(); else await l.click() }
  const R = {}
  await tryk('#fane-gaader')
  await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 30000 })
  await page.waitForTimeout(300)
  await tryk('#segment-storm-tema [data-value="gaffel"]'); await page.waitForTimeout(200)
  R.startKort = await page.evaluate(() => document.getElementById('storm-start-kort').innerText.replace(/\s+/g, ' ').trim())
  R.temaLinje = await page.evaluate(() => document.getElementById('storm-tema-perioder')?.innerText.replace(/\s+/g, ' ').trim())
  R.historik = await page.evaluate(() => { const b = document.querySelector('.storm-historik-boks, [id*=historik]'); return b ? { id: b.id, tekst: b.innerText.replace(/\s+/g, ' ').trim() } : null })
  R.gaffelOrd = await page.evaluate(() => [...new Set((document.body.innerText.match(/Gaff?l[a-z]*/gi) || []))])
  await page.evaluate(() => document.getElementById('storm-start-kort').scrollIntoView({ block: 'start' })); await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(HER, `L692-${S.navn}-1-startkort.png`) })
  // faner: tryk midt mellem raekkerne (kun mobil)
  await page.evaluate(() => scrollTo(0, 0))
  R.faner = await page.evaluate(() => { const k = [...document.querySelectorAll('.fane')].filter((e) => e.checkVisibility()).map((e) => e.getBoundingClientRect()); const t = [...new Set(k.map((r) => Math.round(r.top)))].sort((a, b) => a - b); const r1 = k.filter((r) => Math.round(r.top) === t[0]); const r2 = k.filter((r) => Math.round(r.top) === t[1]); return { h: Math.round(k[0].height), raekker: t.length, mellem: r2.length ? Math.round((r2[0].top - r1[0].bottom) * 10) / 10 : null, midtY: r2.length ? (r1[0].bottom + r2[0].top) / 2 : null, x: r1.map((r) => (r.left + r.right) / 2) } })
  if (S.mobil && R.faner.midtY) R.faner.trykMellem = await page.evaluate(([xs, y]) => xs.map((x) => { const e = document.elementFromPoint(x, y); return e?.closest('.fane')?.id ?? (e?.id || e?.tagName) }), [R.faner.x, R.faner.midtY])
  await tryk('#fane-spil'); await page.waitForTimeout(400); await page.evaluate(() => scrollTo(0, 0))
  R.spilBraet = await page.evaluate(() => { const q = document.getElementById('braet').getBoundingClientRect(); return { top: Math.round(q.top), bund: Math.round(q.bottom), h: innerHeight, over: Math.round(innerHeight - q.bottom) } })
  await page.screenshot({ path: path.join(HER, `L692-${S.navn}-2-spil.png`) })
  res.v[S.navn] = R
  console.log(S.navn, JSON.stringify(R).slice(0, 1200))
  await ctx.close()
}
await browser.close()
writeFileSync(path.join(HER, 'luk-664.json'), JSON.stringify(res, null, 2))
console.log('net', res.net, 'fejl', res.fejl.length)
