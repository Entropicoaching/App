// ORDRE 800: kontrol af klaret-oejeblikket uden ryd(). Kun maaling. node klaret-800.mjs <mappe med spil.html>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/matematik/node_modules/playwright')
const HER = path.dirname(fileURLToPath(import.meta.url))
const ROD = path.resolve(process.argv[2])
const U = pathToFileURL(path.join(ROD, 'spil.html')).href
const fr = (m) => ({ moellen: Array.from({ length: 8 }, (_, i) => i < m), stenbrud: Array(6).fill(false), marked: Array(6).fill(false), landsby: Array(6).fill(false), havn: Array(5).fill(false) })
const S = { figur: { navn: 'Tulle', udseendeId: 'terra', niveau: 2, niveauPoint: 0, erfaring: 30, hoved: 2, haand: 1, hjerte: 1 }, sted: 'moellen', questFremdrift: fr(1), questbog: { klaret: [], hoved: null, hviler: {} }, oevePoint: {}, laert: [] }
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript((t) => { Date.now = () => t; Math.random = () => 0 }, Date.UTC(2026, 8, 30, 8, 0, 0))
await ctx.route(/^https?:/, (r) => r.abort())
const p = await ctx.newPage()
await p.goto(U)
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('ganita:spil', JSON.stringify(s)); localStorage.setItem('ganita:hhh-set', '1') }, S)
await p.goto(U); await p.waitForTimeout(500)
// Brug spillets egne data: svar med facit fra quest-modulen.
const q = await import(pathToFileURL(path.join(ROD, 'src/spil-quest.js')).href)
const bog = await import(pathToFileURL(path.join(ROD, 'src/questbog.js')).href)
q.saetSpilSalt(Date.UTC(2026, 8, 30, 8, 0, 0) % 1000003)
const L = []
for (const k of Object.values(q.QUEST_BANK)) for (const x of k) for (let r = 0; r < 8; r++) L.push(...x.lavOpgaver(r))
for (const x of bog.BOG_QUESTS) for (let r = 0; r < 8; r++) { try { L.push(...bog.lavBogQuest(x.id).lavOpgaver(r)) } catch {} }
const n = (t) => String(t ?? '').replace(/\s+/g, '').slice(0, 60)
for (let i = 0; i < 12; i++) {
  if (await p.locator('.quest-klaret').isVisible().catch(() => false)) break
  const t = await p.locator('.quest-opgave-tekst').first().innerText().catch(() => '')
  if (!t) { await p.waitForTimeout(300); continue }
  const kn = (await p.locator('#quest-svar button').allInnerTexts()).map(n).join('|')
  const o = L.filter((x) => n(x.tekst) === n(t)); const oo = o.find((x) => x.svarmuligheder.map((s) => n(s.tekst)).join('|') === kn) ?? o[0]
  await p.locator(`#quest-svar button[data-i="${oo.svarmuligheder.findIndex((s) => s.korrekt)}"]`).click()
  await p.waitForTimeout(1400)
  const v = p.locator('#quest-videre'); if (await v.isVisible().catch(() => false)) { await v.click(); await p.waitForTimeout(300) }
}
await p.waitForTimeout(800)
console.log('klaret synlig', await p.locator('.quest-klaret').isVisible().catch(() => false))
console.log('svarknapper synlige', await p.locator('#quest-svar button').count(), 'Naeste opgave-knap', await p.locator('#klaret-fortsaet').isVisible().catch(() => false))
await p.screenshot({ path: path.join(HER, 'E800-390-klaret-uden-ryd.png') })
await p.screenshot({ path: path.join(HER, 'E800-390-klaret-uden-ryd-hel.png'), fullPage: true })
await b.close()
