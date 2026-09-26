// ORDRE 441, blok 1: doedloeft- og baenkfigurerne fotograferet headless.
//   node outputs/kritik-441/figurer-441.mjs
// Loeftmodellens main hentes med `git archive` til en midlertidig mappe (kun
// laesning), siderne dist/doedloeft-figurer og dist/baenk-figurer vises via en
// lokal server i headless Chromium ved 390x844 (touch, 2x) og 1280x900, og hver
// figur fotograferes for sig: outputs/kritik-441/fig-<bredde>-<dl|bp>-<navn>.png.
// Maalingerne (bredder, sidelaens rulning, mindste tekst i px paa skaermen og
// modellens egne tal for de stillinger coachen kigger paa) skrives til
// outputs/kritik-441/figurer-441.json. Intet i loeftmodellen eller sitet roeres.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LM = 'C:\\Users\\Entropi\\Desktop\\entropi-loeftmodel-dhruva'
const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak' // kun for at laane playwright, som i 374 og 384
const { chromium } = createRequire(path.join(SKAK_ROD, 'package.json'))('playwright')

const commit = execFileSync('git', ['-C', LM, 'rev-parse', '--short', 'main'], { encoding: 'utf8' }).trim()
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik-441-'))
const tarFil = path.join(tmp, 'lm.tar')
execFileSync('git', ['-C', LM, 'archive', '-o', tarFil, 'main', 'dist/doedloeft-figurer', 'dist/baenk-figurer', 'outputs/doedloeft-429/tal.json', 'outputs/baenk-434/tal.json'])
execFileSync('tar', ['-xf', 'lm.tar'], { cwd: tmp })

const TYPER = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
const server = createServer((req, res) => {
  const p = path.join(tmp, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(tmp) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPER[path.extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

// Mindste font-size i en SVG (i viewBox-enheder) og viewBox-bredden.
function svgTekst(fil) {
  const s = readFileSync(fil, 'utf8')
  const vb = s.match(/viewBox="([\d.\s-]+)"/)
  const vbW = vb ? Number(vb[1].trim().split(/\s+/)[2]) : Number(s.match(/width="([\d.]+)"/)[1])
  const str = [...s.matchAll(/font-size="([\d.]+)"|font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1] ?? m[2]))
  return { vbW, minFont: str.length ? Math.min(...str) : null, antalTekst: (s.match(/<text/g) || []).length }
}

const SIDER = [
  { kort: 'dl', mappe: 'dist/doedloeft-figurer' },
  { kort: 'bp', mappe: 'dist/baenk-figurer' },
]
const BREDDER = [
  { w: 390, h: 844, dpr: 2, touch: true },
  { w: 1280, h: 900, dpr: 1, touch: false },
]

const browser = await chromium.launch({ headless: true })
const maal = { ordre: 441, loeftmodelMain: commit, bredder: {} }
for (const b of BREDDER) {
  const ctx = await browser.newContext({ viewport: { width: b.w, height: b.h }, deviceScaleFactor: b.dpr, hasTouch: b.touch, isMobile: b.touch })
  const page = await ctx.newPage()
  maal.bredder[b.w] = {}
  for (const side of SIDER) {
    await page.goto(`${BASE}/${side.mappe}/index.html`, { waitUntil: 'load' })
    // Lazy-billeder: rul hele siden igennem, saa alle er hentet.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)) }
      await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r })))
      window.scrollTo(0, 0)
    })
    const info = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      billeder: [...document.images].map((i) => ({ src: i.getAttribute('src'), vist: Math.round(i.getBoundingClientRect().width * 10) / 10, ok: i.naturalWidth > 0 })),
      mindsteHtmlTekst: Math.min(...[...document.querySelectorAll('p, li, figcaption, td, th')].map((e) => parseFloat(getComputedStyle(e).fontSize))),
    }))
    const figurer = []
    const imgs = await page.$$('img')
    for (let i = 0; i < imgs.length; i++) {
      const src = info.billeder[i].src
      const navn = src.replace(/\.svg$/, '').replace(/^(dl|baenk)-/, '')
      const fil = `fig-${b.w}-${side.kort}-${String(i + 1).padStart(2, '0')}-${navn}.png`
      // Figuren med sin figurtekst, som laeseren ser den.
      const fig = await imgs[i].evaluateHandle((e) => e.closest('figure') ?? e)
      await fig.screenshot({ path: path.join(HERE, fil) })
      const t = svgTekst(path.join(tmp, side.mappe, src))
      const skala = info.billeder[i].vist / t.vbW
      figurer.push({ src, fil, vistPx: info.billeder[i].vist, hentet: info.billeder[i].ok, mindsteSvgTekstPx: t.minFont == null ? null : Math.round(t.minFont * skala * 10) / 10 })
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(HERE, `side-${b.w}-${side.kort}.png`), fullPage: false })
    maal.bredder[b.w][side.kort] = { rullerSidelaens: info.scrollWidth > info.clientWidth, scrollWidth: info.scrollWidth, clientWidth: info.clientWidth, mindsteHtmlTekstPx: info.mindsteHtmlTekst, figurer }
  }
  await ctx.close()
}
await browser.close()
server.close()

// Modellens egne tal for det, coachen kigger paa.
const dl = JSON.parse(readFileSync(path.join(tmp, 'outputs/doedloeft-429/tal.json'), 'utf8'))
const bp = JSON.parse(readFileSync(path.join(tmp, 'outputs/baenk-434/tal.json'), 'utf8'))
const pick = (s) => ({ knae: s.knaeGrader, hofte: s.hofteGrader, skinneben: s.skinnebenGrader, torso: s.torsoGrader, stangHoejde: s.stangHoejdeCm, stangFraMidtfod: s.stangFraMidtfodCm, hofteHoejde: s.hofteHoejdeCm, skulderForanStang: s.skulderForanStangCm, tp: s.tyngdepunktFraMidtfodCm })
maal.doedloeft = {}
for (const stil of ['konventionel', 'sumo']) {
  maal.doedloeft[stil] = Object.fromEntries(Object.entries(dl[stil]).map(([k, v]) => [k, pick(v)]))
}
maal.doedloeft.stangvejCm = dl.stangvejCm
maal.doedloeft.sumoStance = dl.sumoStance
maal.doedloeft.krop = { femur: dl.krop.femur, tibia: dl.krop.tibia, torso: dl.krop.torso, overarm: dl.krop.upperArm, underarm: dl.krop.underArm }
maal.baenk = {
  krop: bp.krop,
  kombinationer: bp.kombinationer.map((k) => ({
    bue: k.bue, greb: k.greb, grebCm: k.grebCm, romCm: k.romCm,
    bryst: (({ stangOverSkulderCm, stangOverBaenkCm, albueGrader, overarmUdGrader, overarmUnderBrystGrader, underarmFraLodretSideGrader, underarmFraLodretForfraGrader, albueUnderSkulderCm }) =>
      ({ stangOverSkulderCm, stangOverBaenkCm, albueGrader, overarmUdGrader, overarmUnderBrystGrader, underarmFraLodretSideGrader, underarmFraLodretForfraGrader, albueUnderSkulderCm }))(k.stillinger.bryst),
    midt: (({ albueGrader, overarmUdGrader, underarmFraLodretForfraGrader }) => ({ albueGrader, overarmUdGrader, underarmFraLodretForfraGrader }))(k.stillinger.midt),
  })),
}
// Marcs klip: de paalidelige vinkler (hofte, torso) og knaeet pr. billede.
maal.doedloeft.klip = dl.klip.map((b) => ({
  navn: b.navn, billede: b.billede,
  ...Object.fromEntries(b.raekker.filter((r) => ['knaeGrader', 'hofteGrader', 'torsoGrader'].includes(r.felt)).map((r) => [r.felt, { maalt: r.maalt, model: r.model, paalidelig: r.paalidelig }])),
}))

// Coachens overslag (ikke modellen): hvad knaehoejde ville se ud med 159 grader
// knae (Escamilla 2001) i stedet for 140, med samme skinneben, samme 6 cm fra
// knaeleddet til stangen og skulderen stadig 5 cm foran stangen. Hoftens arm =
// 6 + laar * sin(laarets vinkel fra lodret); torsoen = asin((arm + 5) / torso).
// Moment skaleret groft med armen. Kontrol: med 140 grader skal det ramme modellens 34,0 cm og 48 grader.
{
  const k = dl.konventionel.knaehoejde, L = dl.krop
  const regn = (knae) => {
    const laar = (180 - knae - k.skinnebenGrader) * Math.PI / 180
    const arm = 6 + L.femur * Math.sin(laar)
    return {
      knae, hofteArmCm: +arm.toFixed(1),
      hofteHoejereCm: +(L.femur * (Math.cos(laar) - Math.cos((180 - k.knaeGrader - k.skinnebenGrader) * Math.PI / 180))).toFixed(1),
      torsoGrader: +(Math.asin((arm + k.skulderForanStangCm) / L.torso) * 180 / Math.PI).toFixed(1),
      hofteMomentNmGroft: Math.round(k.momentNm.hofte * arm / k.momentarmCm.hofte),
    }
  }
  maal.doedloeft.overslagKnaehoejde = { model: regn(k.knaeGrader), escamilla159: regn(159), modelArmCm: k.momentarmCm.hofte, modelTorso: k.torsoGrader }
}
// Lockout: hele kroppen er een ret linje, der haelder frem. Hvor langt staar
// skulderleddet foran anklen?
{
  const s = dl.konventionel.lockout, L = dl.krop
  maal.doedloeft.lockoutSkulderForanAnkelCm = +((L.tibia + L.femur + L.torso) * Math.sin(s.torsoGrader * Math.PI / 180)).toFixed(1)
}

// Baenk, maalt i SVG'erne: hvor stangen roerer i forhold til brystets hoejeste
// punkt (set fra siden), og hvor albuen staar i forhold til haanden (forfra).
{
  const mappe = path.join(tmp, 'dist/baenk-figurer')
  maal.baenk.svg = {}
  for (const navn of ['bryst', 'bue-lille', 'bue-middel', 'bue-stor', 'greb-smal', 'greb-middel', 'greb-bred', 'midt']) {
    const s = readFileSync(path.join(mappe, `baenk-${navn}.svg`), 'utf8')
    const krop = [...s.matchAll(/<rect x="[\d.]+" y="([\d.]+)"[^>]*fill="(#[0-9a-f]{6})"/g)].find((m) => Number(m[1]) > 86 && Number(m[1]) < 218 && m[2] !== '#141410')[2] // torsoen i vinduet forfra = figurens farve
    const skive = s.match(/<path d="M([\d.]+) ([\d.]+)a([\d.]+) [\d.]+ 0 1 0 [\d.]+ 0a[^"]*" fill="none" stroke="(?!rgba)[^"]+"/)
    const cmPrEnhed = 22.5 / Number(skive[3])
    const stang = { x: Number(skive[1]) + Number(skive[3]), y: Number(skive[2]) }
    let top = null
    for (const m of s.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)) {
      if (m[2] !== krop || /a/.test(m[1])) continue
      const pkt = [...m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])]).filter(([x]) => x < 250)
      for (const p of pkt) if (!top || p[1] < top[1]) top = p
    }
    // Vinduet forfra: venstre arm = overarm (skulder -> albue) og underarm (albue -> haand).
    const arme = [...s.matchAll(/<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)" fill="none" stroke="[^"]+" stroke-width="(5|4)"/g)].filter((m) => Number(m[2]) > 86 && Number(m[2]) < 218)
    const overarme = arme.filter((m) => m[5] === '5'), under = arme.find((m) => m[5] === '4')
    const skulderX = Number(overarme[0][1]), albueX = Number(overarme[0][3]), haandX = Number(under[3])
    const forfraCm = bp.krop.skulderbreddeCm / Math.abs(Number(overarme[1][1]) - skulderX) // skulderleddene staar 47,4 cm fra hinanden
    maal.baenk.svg[navn] = {
      stangFoerBrystTopCm: +((top[0] - stang.x) * cmPrEnhed).toFixed(1), // + = stangen roerer naermere hovedet end brystets top
      stangUnderBrystTopCm: +((stang.y - top[1]) * cmPrEnhed).toFixed(1),
      forfraAlbueUdenForHaandCm: +((haandX - albueX) * forfraCm).toFixed(1), // + = albuen staar uden for haanden
      forfraHaandUdenForSkulderCm: +((skulderX - haandX) * forfraCm).toFixed(1),
    }
  }
}

writeFileSync(path.join(HERE, 'figurer-441.json'), JSON.stringify(maal, null, 2) + '\n')
const n = Object.values(maal.bredder).flatMap((b) => Object.values(b)).reduce((a, s) => a + s.figurer.length, 0)
console.log(`kritik-441 figurer: loeftmodel main ${commit}, ${n} figurer fotograferet`)
for (const [w, b] of Object.entries(maal.bredder)) for (const [k, s] of Object.entries(b)) {
  console.log(`  ${w} px ${k}: ruller ${s.rullerSidelaens ? 'JA' : 'nej'}, mindste svg-tekst ${Math.min(...s.figurer.map((f) => f.mindsteSvgTekstPx).filter((x) => x != null))} px, html ${s.mindsteHtmlTekstPx} px, figur vist ${Math.min(...s.figurer.map((f) => f.vistPx))}-${Math.max(...s.figurer.map((f) => f.vistPx))} px`)
}
