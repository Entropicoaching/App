// KRITIK 692: skakken (skak main 70c9435, hentet med git archive) set som en 11-aarig paa 360x560, 390x844 (touch) og 1280x800 (mus).
// Headless, uden net. Fire forloeb: parti mod computeren, makker-parti med ur, en gaade, en lektion i Laer skak.
//   node outputs/kritik-692/skak-692.mjs  -> skak-692.json og S692-*.png her.
import path from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const dir = mkdtempSync(path.join(tmpdir(), 'k692-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main`)
execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
const ref = execSync(`git -C "${SKAK}" rev-parse --short main`).toString().trim()
const noegle = (fen) => fen.split(' ').slice(0, 2).join(' ')
const { Chess } = await import(pathToFileURL(path.join(SKAK, 'node_modules/chess.js/dist/esm/chess.js')).href)
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js')
const { afkodGaadebankStor } = await imp('src/gaadedata.js')
const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(['gaader.json', 'gaader-lette.json'].flatMap((f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8'))))
const iBank = new Map(); for (const g of bank) if (!iBank.has(noegle(g.fen))) iBank.set(noegle(g.fen), g)
const SKAERME = [
  { navn: '360x560', bredde: 360, hoejde: 560, mobil: true },
  { navn: '390x844', bredde: 390, hoejde: 844, mobil: true },
  { navn: '1280x800', bredde: 1280, hoejde: 800, mobil: false },
]
const res = { ref, v: {}, fejl: [], net: 0 }
// Hvad ser eleven: braettet (synligt af hoejde), og hvilke knapper ligger paa foerste skaerm / hvor langt nede er de.
const SYN = (ids) => {
  const q = (id) => { const e = document.getElementById(id); if (!e || !e.checkVisibility()) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), h: Math.round(r.height), b: Math.round(r.width), paaSkaerm: r.top >= 0 && r.bottom <= innerHeight, delvis: r.bottom > 0 && r.top < innerHeight } }
  const b = document.getElementById('braet').getBoundingClientRect()
  const o = { vindue: [innerWidth, innerHeight], scrollY: Math.round(scrollY), braet: { top: Math.round(b.top), bund: Math.round(b.bottom), synligtPct: Math.round(100 * Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) / b.height) }, vandret: document.documentElement.scrollWidth > document.documentElement.clientWidth }
  for (const id of ids) o[id] = q(id)
  o.smaa = [...document.querySelectorAll('button, a[href], summary, select, input:not([type=hidden])')].filter((e) => e.checkVisibility()).map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.bottom > 0 && r.top < innerHeight && (r.height < 44 || r.width < 44)).map(({ e, r }) => `${(e.getAttribute('aria-label') || e.innerText || e.id).replace(/\s+/g, ' ').trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  o.ord = document.body.innerText.split(/\s+/).length
  return o
}
const browser = await chromium.launch()
for (const S of SKAERME) {
  const R = {}
  const nyside = async () => {
    const ctx = await browser.newContext({ viewport: { width: S.bredde, height: S.hoejde }, isMobile: S.mobil, hasTouch: S.mobil, deviceScaleFactor: S.mobil ? 2 : 1 })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => res.fejl.push(`${S.navn}: ${e.message}`))
    await page.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); res.net++; return r.abort() })
    await page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
    await page.waitForSelector('#braet .felt')
    await page.waitForTimeout(500)
    return { ctx, page }
  }
  let page
  const tryk = async (sel, rul = true) => { const l = page.locator(sel).first(); if (rul) await l.scrollIntoViewIfNeeded({ timeout: 5000 }); if (S.mobil) await l.tap({ timeout: 5000 }); else await l.click({ timeout: 5000 }) }
  const felt = async (f) => { const l = page.locator(`#braet .felt[data-square="${f}"]`); if (S.mobil) await l.tap() ; else await l.click() }
  const skud = (n) => page.screenshot({ path: path.join(HER, `S692-${S.navn}-${n}.png`) })
  const log = (k, v) => { R[k] = v; console.log(S.navn, k, JSON.stringify(v).slice(0, 500)) }
  const pos = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.checkVisibility()) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), h: Math.round(r.height), paaSkaermVedTop: r.bottom <= innerHeight } }, sel)
  // ---------- 0: foerste skaerm
  let c = await nyside(); page = c.page
  log('foerste', { aktivFane: await page.evaluate(() => document.querySelector('.fane[aria-selected=true], .fane.aktiv')?.textContent.trim()), ...(await page.evaluate(SYN, [])) })
  await skud('0-foerste')
  await c.ctx.close()
  // ---------- 1: parti mod computeren
  c = await nyside(); page = c.page
  await tryk('#fane-spil', false); await page.waitForTimeout(400)
  await page.evaluate(() => scrollTo(0, 0))
  log('c-start', await page.evaluate(SYN, ['spil-startkort', 'knap-start-computer']))
  await skud('1-computer-start')
  if (S.mobil) await tryk('#knap-start-computer', false); else await tryk('#segment-spil-modus [data-value=computer]', false)
  await page.waitForTimeout(700)
  log('c-foer-traek', { ...(await page.evaluate(SYN, ['knap-spil-hint', 'knap-spil-forfra', 'knap-spil-giv-op'])), niveauSeg: await pos('#segment-niveau'), farveSeg: await pos('#segment-spiller-farve') })
  await skud('2-computer-foer-traek')
  await felt('e2'); await page.waitForTimeout(250)
  await skud('3-computer-valgt-e2')
  await felt('e4'); await page.waitForTimeout(3500)
  log('c-efter-traek', { fen: await page.inputValue('#fen-tekst'), ...(await page.evaluate(SYN, ['knap-spil-hint', 'knap-spil-giv-op'])) })
  await skud('4-computer-efter-traek')
  await c.ctx.close()
  // ---------- 2: makker med ur
  c = await nyside(); page = c.page
  await tryk('#fane-spil', false); await page.waitForTimeout(400)
  await page.evaluate(() => scrollTo(0, 0))
  if (S.mobil) await tryk('#knap-start-makker', false)
  await page.waitForTimeout(400)
  log('m-foer-ur', { ...(await page.evaluate(SYN, [])), urValg: await pos('#segment-skakur') })
  await skud('5-makker-foer-ur')
  await tryk('#segment-skakur [data-value="5+0"]'); await page.waitForTimeout(300)
  await skud('6-makker-ur-valgt-scrollet')
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200)
  log('m-ur-valgt', { ...(await page.evaluate(SYN, ['ur-strimmel', 'ur-strimmel-hvid', 'skakur'])), besked: await page.evaluate(() => document.getElementById('skakur-besked')?.innerText.trim() || '') })
  await skud('7-makker-ur-valgt-top')
  await felt('e2'); await felt('e4'); await page.waitForTimeout(400)
  await felt('e7'); await felt('e5'); await page.waitForTimeout(400)
  log('m-efter-2-traek', { fen: await page.inputValue('#fen-tekst'), ...(await page.evaluate(SYN, ['ur-strimmel'])), tider: await page.evaluate(() => [...document.querySelectorAll('#ur-strimmel .skakur-tid')].map((e) => e.textContent)) })
  await skud('8-makker-efter-2-traek')
  await page.waitForTimeout(3000)
  log('m-ur-3s', await page.evaluate(() => [...document.querySelectorAll('#ur-strimmel .skakur-tid')].map((e) => e.textContent)))
  await c.ctx.close()
  // ---------- 3: en gaade
  c = await nyside(); page = c.page
  await tryk('#fane-gaader', false)
  await page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 30000 })
  await page.waitForTimeout(300)
  await page.evaluate(() => scrollTo(0, 0))
  log('g-start', { ...(await page.evaluate(SYN, ['gaade-tur-tekst', 'knap-gaade-hint'])), titel: await page.evaluate(() => document.getElementById('gaade-tur-tekst')?.innerText.trim()), hint: await pos('#knap-gaade-hint') })
  await skud('9-gaade-start')
  const fen0 = await page.inputValue('#fen-tekst')
  const g0 = iBank.get(noegle(fen0))
  R.gaadeIBank = !!g0
  if (g0) {
    const c0 = new Chess(fen0)
    const forkert = c0.moves({ verbose: true }).find((m) => m.from + m.to !== g0.solutionUci[0].slice(0, 4) && !m.promotion)
    await felt(forkert.from); await felt(forkert.to); await page.waitForTimeout(1200)
    await page.evaluate(() => scrollTo(0, 0))
    log('g-forkert', { ...(await page.evaluate(SYN, ['knap-gaade-fortryd', 'knap-gaade-hint'])), status: await page.evaluate(() => [...document.querySelectorAll('#panel-gaader [aria-live], #gaade-tur-tekst')].filter((e) => e.checkVisibility()).map((e) => e.innerText.trim().slice(0, 120))) })
    await skud('9b-gaade-forkert')
    if (await page.locator('#knap-gaade-fortryd').isVisible()) { await tryk('#knap-gaade-fortryd'); await page.waitForTimeout(600); await page.evaluate(() => scrollTo(0, 0)) }
  }
  await tryk('#knap-gaade-hint')
  await page.waitForTimeout(300)
  await page.evaluate(() => scrollTo(0, 0))
  log('g-hint', { ...(await page.evaluate(SYN, [])), tekst: await page.evaluate(() => document.getElementById('gaade-tur-tekst')?.innerText.trim()) })
  await skud('10-gaade-hint')
  if (g0) {
    const uci = g0.solutionUci[0]
    await felt(uci.slice(0, 2)); await felt(uci.slice(2, 4)); await page.waitForTimeout(1200)
    await page.evaluate(() => scrollTo(0, 0))
    log('g-rigtigt', { ...(await page.evaluate(SYN, [])), status: await page.evaluate(() => [...document.querySelectorAll('#panel-gaader [aria-live], #gaade-tur-tekst')].filter((e) => e.checkVisibility()).map((e) => e.innerText.trim().slice(0, 120))) })
    await skud('10b-gaade-rigtigt')
  }
  await c.ctx.close()
  // ---------- 4: lektion i Laer skak
  c = await nyside(); page = c.page
  await tryk('#fane-laer', false); await page.waitForTimeout(400)
  await page.evaluate(() => scrollTo(0, 0))
  log('l-start', await page.evaluate(SYN, ['segment-laer-niveau']))
  await skud('11-laer-start')
  await tryk('#segment-laer-niveau [data-value="ny"]', false); await page.waitForTimeout(500)
  await page.evaluate(() => scrollTo(0, 0))
  log('l-trin1', { ...(await page.evaluate(SYN, ['laer-titel', 'laer-tekst', 'knap-laer-videre'])), titel: await page.evaluate(() => document.getElementById('laer-titel')?.innerText), tekst: await page.evaluate(() => document.getElementById('laer-tekst')?.innerText.slice(0, 200)), videre: await pos('#knap-laer-videre') })
  await skud('12-laer-trin1')
  await felt('e4'); await page.waitForTimeout(600)
  log('l-efter-e4', { ...(await page.evaluate(SYN, ['knap-laer-videre', 'laer-besked'])), besked: await page.evaluate(() => document.getElementById('laer-besked')?.innerText.trim() || ''), videre: await pos('#knap-laer-videre') })
  await skud('12b-laer-efter-e4')
  const trin = []
  for (let i = 0; i < 6; i += 1) {
    const v = page.locator('#knap-laer-videre')
    if (!(await v.isVisible())) break
    if (await v.isDisabled()) { trin.push({ i, blokeret: true, besked: await page.evaluate(() => document.getElementById('laer-besked')?.innerText.trim() || '') }); break }
    await tryk('#knap-laer-videre', false); await page.waitForTimeout(400)
    trin.push({ i, titel: await page.evaluate(() => document.getElementById('laer-titel')?.innerText), videre: await pos('#knap-laer-videre'), braetSynligt: (await page.evaluate(SYN, [])).braet.synligtPct })
  }
  log('l-trin', trin)
  await skud('13-laer-senere-trin')
  await c.ctx.close()
  res.v[S.navn] = R
}
await browser.close()
writeFileSync(path.join(HER, 'skak-692.json'), JSON.stringify(res, null, 2))
console.log('net', res.net, 'fejl', res.fejl.length, res.fejl.slice(0, 3))
