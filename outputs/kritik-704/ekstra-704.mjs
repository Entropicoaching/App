// KRITIK 704, ekstra: Giv op -> slutstrimmel (693) og Laer skak trin 2 loest -> senere trin, paa 360x560. Headless, ingen net.
import path from 'node:path'
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url)); const SKAK = 'C:/Users/Entropi/Desktop/skak'
const dir = mkdtempSync(path.join(tmpdir(), 'k704-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main`); execSync('tar -xf s.tar', { cwd: dir })
symlinkSync(path.join(SKAK, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
const b = await chromium.launch(); const out = { net: 0, fejl: [], trin: [] }
const ctx = await b.newContext({ viewport: { width: 360, height: 560 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const p = await ctx.newPage(); p.on('pageerror', (e) => out.fejl.push(e.message))
await p.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); out.net++; return r.abort() })
await p.goto(pathToFileURL(path.join(dir, 'skak.html')).href); await p.waitForSelector('#braet .felt')
const pos = (id) => p.evaluate((i) => { const e = document.getElementById(i); if (!e || !e.checkVisibility()) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), h: Math.round(r.height), paaSkaerm: r.top >= 0 && r.bottom <= innerHeight } }, id)
const braet = () => p.evaluate(() => { const r = document.getElementById('braet').getBoundingClientRect(); return { top: Math.round(r.top), bund: Math.round(r.bottom), pct: Math.round(100 * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height) } })
// Giv op
await p.locator('#fane-spil').tap(); await p.waitForTimeout(400); await p.locator('#knap-start-computer').tap(); await p.waitForTimeout(500)
await p.locator('#braet .felt[data-square="e2"]').tap(); await p.locator('#braet .felt[data-square="e4"]').tap(); await p.waitForTimeout(2500)
await p.locator('#strimmel-giv-op').tap(); await p.waitForTimeout(400)
await p.screenshot({ path: path.join(HER, 'S704-360x560-14a-giv-op-spoerg.png') })
out.modal = await p.evaluate(() => { const m = document.getElementById('spil-giv-op-modal'); const b = document.getElementById('knap-spil-giv-op-bekraeft').getBoundingClientRect(); return { synlig: !m.hidden, tekst: m.innerText.slice(0, 160), bekraeft: { top: Math.round(b.top), bund: Math.round(b.bottom), h: Math.round(b.height) } } })
console.log(JSON.stringify(out.modal))
await p.locator('#knap-spil-giv-op-bekraeft').tap(); await p.waitForTimeout(700)
out.giv = { skaerm: await p.evaluate(() => document.body.innerText.slice(0, 400)), slut: await pos('slut-strimmel'), nyt: await pos('slut-nyt-parti'), gennemse: await pos('slut-gennemse'), braet: await braet() }
await p.screenshot({ path: path.join(HER, 'S704-360x560-14-giv-op-slut.png') })
console.log(JSON.stringify(out.giv))
await ctx.close()
// Laer skak: loes trin 2 og gaa videre
const c2 = await b.newContext({ viewport: { width: 360, height: 560 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const q = await c2.newPage(); q.on('pageerror', (e) => out.fejl.push(e.message))
await q.route('**/*', (r) => { if (/^(file|data|blob):/.test(r.request().url())) return r.continue(); out.net++; return r.abort() })
await q.goto(pathToFileURL(path.join(dir, 'skak.html')).href); await q.waitForSelector('#braet .felt')
await q.locator('#fane-laer').tap(); await q.waitForTimeout(300); await q.locator('#segment-laer-niveau [data-value="ny"]').tap(); await q.waitForTimeout(400)
await q.locator('#braet .felt[data-square="e4"]').tap(); await q.waitForTimeout(400); await q.locator('#knap-laer-videre').tap(); await q.waitForTimeout(400)
const t = (s) => q.locator(`#braet .felt[data-square="${s}"]`).tap()
await t('e3'); for (const s of ['e4','f5','f6','e6']) { await t(s); await q.waitForTimeout(250) }
await q.waitForTimeout(500)
const r2 = { titel: await q.evaluate(() => document.getElementById('laer-titel')?.innerText), besked: await q.evaluate(() => document.getElementById('laer-besked')?.innerText.trim()), videre: await (async () => { const e = q.locator('#knap-laer-videre'); return await e.isVisible() })() }
console.log('trin2 efter stjerner', JSON.stringify(r2)); await q.screenshot({ path: path.join(HER, 'S704-360x560-15-laer-trin2-loest.png') })
if (r2.videre) { await q.locator('#knap-laer-videre').tap(); await q.waitForTimeout(500); await q.evaluate(() => scrollTo(0, 0))
  const r3 = { titel: await q.evaluate(() => document.getElementById('laer-titel')?.innerText), tekst: await q.evaluate(() => document.getElementById('laer-tekst')?.innerText), braet: await braet(), kort: await pos('laer-trin-oeverst') }
  console.log('trin3', JSON.stringify(r3)); out.trin.push(r3); await q.screenshot({ path: path.join(HER, 'S704-360x560-16-laer-trin3.png') }) }
out.trin2 = r2
await b.close(); writeFileSync(path.join(HER, 'ekstra-704.json'), JSON.stringify(out, null, 1)); console.log('net', out.net, 'fejl', out.fejl)
