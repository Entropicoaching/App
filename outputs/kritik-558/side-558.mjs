// Kritik 558, blok 1: fejlgenkendelsen paa selve siden (dist/maal-billede, entropi-loeftmodel-dhruva
// main) efter Yantras 545, 549 og 554, headless uden net paa 360 og 390 med touch og 1280 med mus.
//   node outputs/kritik-558/side-558.mjs
// Som side-548.mjs: TEGNEDE, SYNTETISKE figurer fotograferet med mit pinhole-kamera og Marcs eget
// gulv- og knaebillede fra 462 (Yantras 498/510-klik og mine 494-klik; kun udsnit af boksen). Kroppen
// er sidens hoejdefelt (178 cm, 85 kg) for de tegnede figurer og 183/120 for Marcs klip. Skriver
// side-558.json og S-*.png. Mine fem side-548-tjek, som Yantra fandt roede efter 549, er skrevet om til
// den nye tekst (L1 kontrol, L3, L6, L7, L9), og nye tjek er lagt til:
//
//   L6  "Ligner ikke ..." ved sticking point, i bunden, i sko og paa baenken: ordene, linjer og hoejde
//   L9  fladt fodtoej, feltet paa 2: hint ("Ligner maaske ..."), ikke dom; fejlfiguren i sko: hint
//   L7  kameraet 50 cm forskudt: "Kameraet staar skraat eller ikke ud for stangen"
//   SU  sumo: knappen, modellens sumo fra 3 m, 3 og 5 grader skraat, 25 cm forskudt, uden fjernt nav
//   BU  baenken med 2,5 og 7,5 cm stoerre bue (vip, 554)
//   M   Marcs gulv- og knaebillede
import path from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DHRUVA = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SHA = execSync(`git -C ${DHRUVA} rev-parse --short ${process.argv[2] || 'main'}`).toString().trim()
const LM = path.join(tmpdir(), `kritik-558-loeftmodel-${SHA}`)
if (!existsSync(path.join(LM, 'dist', 'maal-billede', 'index.html'))) throw new Error(`Koer foerst fejl-558.mjs (${LM} mangler)`)
const imp = (f) => import(pathToFileURL(path.join(LM, f)).href)
const { maal, skalaFraKrop, knaeFaseTjek } = await imp('src/maalBillede.js')
const { modelFase } = await imp('src/maalBilledeModel.js')
const { indstilling } = await imp('src/minKrop.js')
const { genkendFejl } = await imp('src/maalBilledeFejl.js')
const FM = await imp('src/fejlgenkendelseMaaling.js')
const LV = await imp('src/loeftVirkelighed.js')
const { MARC_GULV } = await imp('scripts/ordre-507-skaermbilleder.mjs')
const { MARC_KNAE } = await imp('scripts/ordre-510-skaermbilleder.mjs')
const SIDE = pathToFileURL(`${LM}/dist/maal-billede/index.html`).href
const IDS = ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']
const MINE_GULV = { stang: { x: 441, y: 828 }, midtfod: { x: 430, y: 948 }, ankel: { x: 400, y: 905 }, knae: { x: 447, y: 668 }, hofte: { x: 343, y: 583 }, skulder: { x: 470, y: 460 } }

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }

// --- pinhole ---------------------------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a) => { const n = Math.sqrt(dot(a, a)); return { x: a.x / n, y: a.y / n, z: a.z / n } }
function kamera(cx, h, { skraa = 0, forskudt = 0 } = {}) {
  const s = (skraa * Math.PI) / 180
  const C = { x: cx + 300 * Math.sin(s) - forskudt, y: h, z: -300 * Math.cos(s) }
  const T = { x: cx - forskudt * (skraa ? 0 : 1), y: h, z: 0 }
  const f = norm(sub(T, C)), r = norm(cross({ x: 0, y: 1, z: 0 }, f)), u = cross(f, r)
  return (P) => { const d = sub(P, C), z = dot(d, f); return { x: (1000 * dot(d, r)) / z, y: (-1000 * dot(d, u)) / z } }
}
const DYBDE = { squat: { stang: -70, midtfod: -15, ankel: -16, knae: -18, hofte: -18, skulder: -20 }, doedloeft: { stang: -75, midtfod: -12, ankel: -14, knae: -13, hofte: -18, skulder: -20 }, baenk: { stang: -75, midtfod: -15, ankel: -14, knae: -13, hofte: -18, skulder: -20 } }
const i3D = (P, loeft) => { const d = DYBDE[loeft], Q = {}; for (const id of IDS) Q[id] = { x: P[id].x, y: P[id].y, z: d[id] }; Q.stangFjern = { x: P.stang.x, y: P.stang.y, z: -d.stang }; return Q }
// Q: punkterne i rummet (med det fjerne nav); P: til kameraets sigte (stangens x).
function fotoQ(Q, h, { nav = true, skraa = 0, forskudt = 0, x0 = 450 } = {}) {
  const k = kamera(Q.stang.x, h, { skraa, forskudt })
  const R = { ...Q, skalaA: { x: Q.stang.x, y: Q.stang.y + 22.5, z: Q.stang.z } }
  const raa = Object.fromEntries(Object.entries(R).map(([id, p]) => [id, k(p)]))
  const ud = Object.fromEntries(Object.entries(raa).map(([id, p]) => [id, { x: x0 + (p.x - raa.midtfod.x), y: 1080 + (p.y - raa.midtfod.y) }]))
  if (!nav) delete ud.stangFjern
  return ud
}
const foto = (P, loeft, h, o = {}) => fotoQ(i3D(P, loeft), h, o)
const klikKun = (b) => Object.fromEntries(Object.entries(b).filter(([id]) => id !== 'skalaA'))
const ind = (l, h, v) => indstilling(l, { hoejde: h, vaegt: v }, { gennemsnit: true })

const K178 = { h: 178, v: 85, pct: {} }
const Isq = ind('squat', 178, 85)
const SB = modelFase('squat-bund', Isq).punkter, SM = modelFase('squat-midt', Isq).punkter
const KB178 = FM.kropsBilleder(K178)
const S2 = FM.squatBilleder(Isq, undefined, { haele: 2 })
const Idl = ind('doedloeft', 178, 85)
const G = modelFase('dl-gulv', Idl).punkter
const SUMO = LV.dlBilleder(K178, 'sumo', 'sumo')
const sumoKnae0 = SUMO.normal['dl-knae'].find((x) => /knæhøjde 0/.test(x.navn))
const sumoGulv0 = SUMO.normal['dl-gulv'][0]
const bryst = (b) => LV.baenkBilleder(K178, b).normal['baenk-bryst'].find((x) => x.navn === 'modellens bryst')

const browser = await chromium.launch({ headless: true })
async function tegn(P, tekst) {
  const page = await browser.newPage()
  const url = await page.evaluate(([P, tekst]) => {
    const k = document.createElement('canvas'); k.width = 1100; k.height = 1200
    const x = k.getContext('2d')
    x.fillStyle = '#30343a'; x.fillRect(0, 0, 1100, 1200); x.fillStyle = '#4a4238'; x.fillRect(0, P.midtfod.y, 1100, 1200 - P.midtfod.y)
    x.lineCap = 'round'; x.strokeStyle = '#d8c8b0'; x.lineWidth = 12
    const l = (...ids) => { x.beginPath(); ids.forEach((id, i) => { const p = P[id]; i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y) }); x.stroke() }
    l('ankel', 'knae', 'hofte', 'skulder'); x.lineWidth = 8; l('skulder', 'stang')
    const r = Math.hypot(P.skalaA.x - P.stang.x, P.skalaA.y - P.stang.y)
    for (const id of ['stangFjern', 'stang']) { if (!P[id]) continue; x.strokeStyle = id === 'stang' ? '#8a2a22' : '#5c1f1a'; x.lineWidth = 14; x.beginPath(); x.arc(P[id].x, P[id].y, r - 8, 0, 7); x.stroke() }
    x.fillStyle = '#fff'; x.font = '600 34px system-ui'; x.fillText('SYNTETISK', 24, 52); x.font = '22px system-ui'; x.fillText(tekst, 24, 84)
    return k.toDataURL('image/png')
  }, [P, tekst])
  await page.close()
  return url
}
async function aabn(bredde) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const net = [], fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); net.push(u); return r.abort() })
  await page.goto(SIDE)
  await page.waitForSelector('[data-klar]')
  return { ctx, page, net, fejl }
}
const vent = (S) => S.page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 300))))
async function maalFase(S, billede, navn, fase, klik, krop, { haele = 0, sumo = false } = {}) {
  await S.page.evaluate(([k]) => window.maalBillede.saetKrop(k), [krop])
  await S.page.evaluate(([b, n]) => window.maalBillede.laesBillede(b, n), [billede, navn])
  await S.page.waitForFunction(() => window.maalBillede.tilstand().billede)
  await S.page.click(`[data-fase="${fase}"]`)
  await S.page.evaluate(([h]) => window.maalBillede.saetHaele(h), [haele])
  if (fase.startsWith('dl-')) await S.page.evaluate(([s]) => window.maalBillede.saetSumo(s), [sumo])
  await S.page.evaluate(([p]) => window.maalBillede.saetPunkter(p), [klik])
  await vent(S)
}
const LAES = () => {
  const b = document.querySelector('[data-ligner]')
  const r = b.getBoundingClientRect()
  const stille = b.querySelector('[data-lignerstille]')
  const hint = document.querySelector('[data-skraahint]')
  const sumo = document.querySelector('[data-sumo]')
  const sr = sumo ? sumo.getBoundingClientRect() : null
  const ls = stille ? stille.getBoundingClientRect() : null
  const lh = stille ? parseFloat(getComputedStyle(stille).lineHeight) || 1.4 * parseFloat(getComputedStyle(stille).fontSize) : null
  const tab = document.querySelector('[data-resultat]') || document.querySelector('[data-maaling]')
  const tr = tab ? tab.getBoundingClientRect() : null
  return {
    status: b.dataset.status || null, fejl: b.dataset.fejl || null, vist: !b.hidden && r.height > 0,
    saetning: b.querySelector('[data-lignersaetning]')?.textContent.trim() || null,
    graense: b.querySelector('[data-lignergraense]')?.textContent.trim() || null,
    linje: stille && !stille.hidden ? stille.textContent.trim() : null,
    linjePx: stille ? parseFloat(getComputedStyle(stille).fontSize) : null,
    linjeHoejde: ls ? Math.round(ls.height) : null, linjeLinjer: ls && lh ? Math.round(ls.height / lh) : null,
    boksHoejde: Math.round(r.height), boksTop: Math.round(r.top + scrollY), tabelTop: tr ? Math.round(tr.top + scrollY) : null, skaerm: innerHeight,
    hint: hint && !hint.hidden ? hint.textContent.trim() : null, hintGrader: hint?.dataset.grader || null,
    sumoKnap: sumo ? { vist: sr.height > 0, h: Math.round(sr.height), w: Math.round(sr.width), trykket: sumo.getAttribute('aria-pressed') } : null,
    hoejre: Math.round(r.right), side: document.documentElement.scrollWidth, klient: document.documentElement.clientWidth,
    lager: Object.keys(localStorage),
  }
}
const ud = { ref: SHA, sider: {} }
const Kside = { hoejde: '178', vaegt: '85' }, K183 = { hoejde: '183', vaegt: '120' }
const MARC = pathToFileURL(`${LM}/outputs/videomaal/marc-doedloeft-270-start.png`).href
const MARCK = pathToFileURL(`${LM}/outputs/videomaal/marc-doedloeft-270-knaehoejde.png`).href

for (const bredde of [360, 390, 1280]) {
  const S = await aabn(bredde)
  const r = (ud.sider[bredde] = {})
  const mobil = bredde !== 1280
  const skud = async (navn, sel = '[data-ligner]') => { await S.page.locator(sel).scrollIntoViewIfNeeded().catch(() => {}); await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-${navn}.png`) }) }
  const koer = async (noegle, P3, tekst, fase, { loeft, h, haele = 0, sumo = false, nav = true, skraa = 0, forskudt = 0, Q = null, x0 = 450, krop = Kside, skaerm = null } = {}) => {
    const b = Q ? fotoQ(Q, h, { nav, skraa, forskudt, x0 }) : foto(P3, loeft, h, { nav, skraa, forskudt, x0 })
    await maalFase(S, await tegn(b, tekst), `${noegle}.png`, fase, klikKun(b), krop, { haele, sumo })
    r[noegle] = await S.page.evaluate(LAES)
    if (mobil && skaerm) await skud(skaerm)
  }
  // L6: den nye linje. Modellens egen sticking point og bund, fladt og i sko; baenken; doedloeftet ved gulvet.
  await koer('sq-midt', SM, 'squat sticking point, modellen', 'squat-midt', { loeft: 'squat', h: 80, skaerm: 'l6-sticking' })
  await koer('sq-bund', SB, 'squat bund, modellen', 'squat-bund', { loeft: 'squat', h: 80 })
  await koer('sq-bund-sko2', S2.normal['squat-bund'][0].P, 'squat bund, 2 cm hael, modellen', 'squat-bund', { loeft: 'squat', h: 80, haele: 2 })
  await koer('l6-kk-sko2', S2.fejl['sq-kun-knae-bund'][0].P, 'squat bund, 2 cm hael, KUN KNAEENE (fejlfiguren)', 'squat-bund', { loeft: 'squat', h: 80, haele: 2, skaerm: 'l6-sko' })
  await koer('dl-0', G, 'doedloeft ved gulvet, modellen', 'dl-gulv', { loeft: 'doedloeft', h: 75 })
  // L9: fladt fodtoej i billedet, feltet paa 2 (hint); fejlfiguren "hoften tilbage" i 2 cm hael, feltet paa 2.
  await koer('l9', SB, 'squat bund, fladt fodtoej, modellen; feltet siger 2 cm', 'squat-bund', { loeft: 'squat', h: 80, haele: 2, skaerm: 'l9-hint' })
  await koer('l9-fejl', S2.fejl['sq-hofte-tilbage-bund'][0].P, 'squat bund, 2 cm hael, HOFTEN TILBAGE (fejlfiguren)', 'squat-bund', { loeft: 'squat', h: 80, haele: 2 })
  await koer('ht-flad', KB178.fejl['sq-hofte-tilbage-bund'][0].P, 'squat bund, HOFTEN TILBAGE (fejlfiguren), fladt', 'squat-bund', { loeft: 'squat', h: 80 })
  // L7
  await koer('l7', SB, 'squat bund, kameraet 50 cm forskudt, ikke drejet', 'squat-bund', { loeft: 'squat', h: 80, forskudt: 50 })
  if (mobil) { await S.page.locator('[data-skraahint]').scrollIntoViewIfNeeded().catch(() => {}); await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-l7-hint.png`) }) }
  // Sumo: modellens sumo (Yantras dybder) med mit kamera.
  await koer('su-knae', null, 'sumo ved knaehoejde, modellen, 3 m', 'dl-knae', { h: 75, Q: sumoKnae0.Q, sumo: true, skaerm: 'su-knae' })
  await koer('su-knae-uden-knap', null, 'sumo ved knaehoejde, modellen, knappen ikke trykket', 'dl-knae', { h: 75, Q: sumoKnae0.Q, sumo: false })
  await koer('su-gulv', null, 'sumo ved gulvet, modellen, 3 m', 'dl-gulv', { h: 75, Q: sumoGulv0.Q, sumo: true })
  await koer('su-frem', null, 'sumo, STANGEN GLIDER FREM (fejlfiguren)', 'dl-knae', { h: 75, Q: SUMO.fejl['dl-stang-frem'][0].Q, sumo: true })
  for (const g of [3, 5]) await koer(`su-skraa${g}`, null, `sumo ved knaehoejde, kameraet ${g} grader skraat`, 'dl-knae', { h: 75, Q: sumoKnae0.Q, sumo: true, skraa: g, skaerm: g === 5 ? 'su-skraa5' : null })
  await koer('su-forskudt25', null, 'sumo ved knaehoejde, kameraet 25 cm forskudt', 'dl-knae', { h: 75, Q: sumoKnae0.Q, sumo: true, forskudt: 25 })
  await koer('su-udenNav', null, 'sumo ved knaehoejde, uden det fjerne nav', 'dl-knae', { h: 75, Q: sumoKnae0.Q, sumo: true, nav: false })
  // Baenken med stoerre bue (vip).
  await koer('bu-0', null, 'baenk, modellens bryst', 'baenk-bryst', { h: 60, Q: bryst(0).Q, x0: 750 })
  await koer('bu-25', null, 'baenk, 2,5 cm stoerre bue (vip)', 'baenk-bryst', { h: 60, Q: bryst(2.5).Q, x0: 750 })
  await koer('bu-75', null, 'baenk, 7,5 cm stoerre bue (vip)', 'baenk-bryst', { h: 60, Q: bryst(7.5).Q, x0: 750, skaerm: 'bu-75' })
  // Marcs klip.
  for (const [n, k] of [['marc-gulv-yantra', MARC_GULV], ['marc-gulv-bhishak', MINE_GULV]]) { await maalFase(S, MARC, 'marc-start.png', 'dl-gulv', k, K183); r[n] = await S.page.evaluate(LAES) }
  await maalFase(S, MARCK, 'marc-knae.png', 'dl-knae', MARC_KNAE, K183); r['marc-knae'] = await S.page.evaluate(LAES)
  r.net = S.net; r.jsFejl = S.fejl
  await S.ctx.close()
}
await browser.close()

const B = [360, 390, 1280], sd = ud.sider
const alle = (f) => B.every((w) => f(sd[w], w))
const ord = (t) => (t ? t.split(/\s+/).length : 0)
paastaa('L6: modellens sticking point: "Ligner ikke ... Det udelukker ikke fejlen ... Andre fejl tjekker siden ikke."', alle((s) => s['sq-midt'].status === 'ingen' && /^Ligner ikke .*Det udelukker ikke fejlen.*Andre fejl tjekker siden ikke\.$/.test(s['sq-midt'].linje || '')), sd[390]['sq-midt'].linje)
paastaa('L6: linjen i ord og linjer paa 360/390/1280 (ord, linjer, px)', true, B.map((w) => [w, ord(sd[w]['sq-midt'].linje), sd[w]['sq-midt'].linjeLinjer, sd[w]['sq-midt'].linjeHoejde]))
paastaa('L6: fejlfiguren "kun knaeene" i 2 cm hael, feltet paa 2: linjen siger "kan næsten ikke ses i sko med hæl"', alle((s) => s['l6-kk-sko2'].status === 'ingen' && /kan næsten ikke ses i sko med hæl/.test(s['l6-kk-sko2'].linje || '')), sd[390]['l6-kk-sko2'].linje)
paastaa('L1 kontrol: modellens egen stilling ved gulvet giver "Ligner ikke "hoften stiger først" ..."', alle((s) => s['dl-0'].status === 'ingen' && /^Ligner ikke "hoften stiger først"/.test(s['dl-0'].linje || '')), sd[390]['dl-0'].linje)
paastaa('L3 lukket: saetningen for "hoften tilbage" og graensen; "letter hælen" kun i graensen for "kun knæene"', alle((s) => s['ht-flad'].fejl === 'sq-hofte-tilbage-bund' && !/letter hælen/.test(s['ht-flad'].saetning || '')), sd[390]['ht-flad'].saetning)
paastaa('L9: fladt fodtoej og feltet paa 2: hint "Ligner måske ... kun et hint", ikke dom', alle((s) => s.l9.status === 'hint' && /^Ligner måske "hoften skudt for langt tilbage"/.test(s.l9.linje || s.l9.saetning || '')), [sd[390].l9.status, sd[390].l9.linje, sd[390].l9.saetning])
paastaa('L9: fejlfiguren "hoften tilbage" i 2 cm hael, feltet paa 2: ogsaa kun hint', alle((s) => s['l9-fejl'].status === 'hint'), B.map((w) => sd[w]['l9-fejl'].status))
paastaa('L7: kameraet 50 cm forskudt: "Kameraet står skråt eller ikke ud for stangen"', alle((s) => /Kameraet står skråt eller ikke ud for stangen/.test(s.l7.hint || '')), sd[390].l7.hint)
paastaa('SU: knappen Sumo er synlig og mindst 44 px hoej paa telefonen', [360, 390].every((w) => sd[w]['su-knae'].sumoKnap?.vist && sd[w]['su-knae'].sumoKnap.h >= 44 && sd[w]['su-knae'].sumoKnap.trykket === 'true'), B.map((w) => sd[w]['su-knae'].sumoKnap))
paastaa('SU: modellens sumo ved knaehoejde (mit kamera, 3 m) med knappen: "Ligner ikke ... i modellens sumo"', alle((s) => s['su-knae'].status === 'ingen' && /i modellens sumo/.test(s['su-knae'].linje || '')), sd[390]['su-knae'].linje)
paastaa('SU: sumoens fejlfigur "stangen glider frem": "Ligner" med sumoens saetning', alle((s) => s['su-frem'].fejl === 'dl-stang-frem' && /sumo/.test(s['su-frem'].saetning || '')), sd[390]['su-frem'].saetning)
paastaa('SU: 3 grader skraat tjekkes, 5 grader ikke ("højst ca. 4° skråt")', alle((s) => s['su-skraa3'].status !== 'usikker-kamera' && s['su-skraa5'].status === 'usikker-kamera' && /4° skråt/.test(s['su-skraa5'].linje || '')), [sd[390]['su-skraa3'].status, sd[390]['su-skraa5'].linje])
paastaa('SU: 25 cm forskudt og uden det fjerne nav: ikke tjekket med grunden', alle((s) => s['su-forskudt25'].status === 'usikker-kamera' && /kræver det fjerne nav/.test(s['su-udenNav'].linje || '')), [sd[390]['su-forskudt25'].linje, sd[390]['su-udenNav'].linje])
paastaa('BU: baenken med 7,5 cm stoerre bue: "ikke tjekket" med buen i grunden; 2,5 cm tjekkes', alle((s) => s['bu-75'].status === 'usikker-fase' && /buen er større end modellens/.test(s['bu-75'].linje || '') && s['bu-25'].status === 'ingen'), [sd[390]['bu-0'].status, sd[390]['bu-25'].status, sd[390]['bu-75'].linje])
paastaa('M: Marcs gulvbillede: "kan ikke tjekkes ... kræver det fjerne nav" med begge klik', alle((s) => /kræver det fjerne nav/.test(s['marc-gulv-yantra'].linje || '') && /kræver det fjerne nav/.test(s['marc-gulv-bhishak'].linje || '')), sd[390]['marc-gulv-yantra'].linje)
paastaa('M: Marcs knaebillede: linjen', alle((s) => !!s['marc-knae'].linje || s['marc-knae'].status === 'ligner'), [sd[390]['marc-knae'].status, sd[390]['marc-knae'].linje])
const tilf = (s) => Object.entries(s).filter(([k]) => !/net|jsFejl/.test(k))
paastaa('Boksen inden for skaermen, ingen vandret rulning', alle((s, w) => tilf(s).every(([, x]) => x.side <= w && (!x.vist || x.hoejre <= w))))
paastaa('Intet net, ingen JS-fejl, intet gemt', alle((s) => s.net.length === 0 && s.jsFejl.length === 0 && tilf(s).every(([, x]) => x.lager.length === 0)), B.map((w) => [sd[w].net, sd[w].jsFejl]))
ud.tjek = tjek
writeFileSync(path.join(HERE, 'side-558.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne (dhruva ${SHA})`)
if (nej) process.exitCode = 1
