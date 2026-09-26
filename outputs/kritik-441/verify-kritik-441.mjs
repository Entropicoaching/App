// ORDRE 441: verify:kritik-441. Intet netvaerk og ingen loeftmodel-mappe; kun de
// gemte maalinger (lavet mod loeftmodellens main f1e84b3) og dokumenterne.
//   node outputs/kritik-441/verify-kritik-441.mjs 1   blok 1
//   node outputs/kritik-441/verify-kritik-441.mjs 2   blok 1 + blok 2 (standard)
//
// Blok 1: alle 23 figurer er fotograferet i begge bredder, siderne ruller ikke,
//   teksten kan laeses, og de maalinger fundene D1-D7 og B1-B5 bygger paa, staar
//   stadig i figurer-441.json. FIGURER-441 naevner hvert fund med skaermbillede.
// Blok 2: KRITIK-doedloeft-baenk (fund oeverst, een dom pr. loeft) og RAPPORT-441
//   (fem afsnit, foerste linje "Ordre 441", fundene til Yantra i punktform).
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-441')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-441/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const FUND = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'B1', 'B2', 'B3', 'B4', 'B5']

// --- blok 1: figurerne -------------------------------------------------------------
const jp = path.join(HERE, 'figurer-441.json')
const j = existsSync(jp) ? JSON.parse(readFileSync(jp, 'utf8')) : (fejl.push('figurer-441.json mangler'), null)
if (j) {
  ok(j.loeftmodelMain === 'f1e84b3', `figurer-441: maalt mod loeftmodel ${j.loeftmodelMain}, ventet f1e84b3 (429 og 434 merget)`)
  const png = new Set(readdirSync(HERE).filter((f) => f.endsWith('.png')))
  for (const w of ['390', '1280']) {
    for (const [k, antal] of [['dl', 13], ['bp', 10]]) {
      const s = j.bredder?.[w]?.[k]
      if (!s) { fejl.push(`figurer-441: ${w} px ${k} mangler`); continue }
      ok(s.figurer.length === antal, `figurer-441: ${w} px ${k} har ${s.figurer.length} figurer, ventet ${antal}`)
      ok(s.figurer.every((f) => f.hentet), `figurer-441: ${w} px ${k}: et billede blev ikke hentet`)
      ok(s.figurer.every((f) => png.has(f.fil)), `figurer-441: ${w} px ${k}: skaermbillede mangler (${s.figurer.filter((f) => !png.has(f.fil)).map((f) => f.fil).join(', ')})`)
      ok(!s.rullerSidelaens, `figurer-441: ${w} px ${k} ruller sidelaens (${s.scrollWidth} > ${s.clientWidth})`)
      ok(s.figurer.every((f) => f.mindsteSvgTekstPx == null || f.mindsteSvgTekstPx >= 12), `figurer-441: ${w} px ${k}: tekst under 12 px i en figur`)
      ok(s.mindsteHtmlTekstPx >= 14, `figurer-441: ${w} px ${k}: HTML-tekst under 14 px`)
    }
  }
  const d = j.doedloeft, b = j.baenk
  const kop = d.konventionel.opstilling
  // D1: opstillingen er stivbenet: skinneben under 10 grader, hofte 30 grader under Marcs klip.
  ok(kop.skinneben < 10 && kop.hofte < 60 && kop.torso > 60, 'D1: den konventionelle opstilling har aendret sig - laes figuren igen')
  const klipStart = d.klip.find((x) => x.navn === 'start')
  ok(klipStart.hofteGrader.paalidelig && klipStart.hofteGrader.maalt - kop.hofte > 25, 'D1: Marcs hofte ved gulvet er ikke laengere 25+ grader over modellens')
  // D2: opstilling og afsaet er naesten ens.
  ok(d.konventionel['forlader-gulvet'].knae - kop.knae < 8, 'D2: opstilling og "forlader gulvet" er ikke laengere naesten ens')
  // D3: knaeet ved knaehoejde og overslaget.
  const o = d.overslagKnaehoejde
  ok(d.konventionel.knaehoejde.knae < 145 && d.sumo.knaehoejde.knae < 145, 'D3: knaeet ved knaehoejde er ikke laengere under 145 grader')
  ok(Math.abs(o.model.hofteArmCm - o.modelArmCm) < 0.5 && Math.abs(o.model.torsoGrader - o.modelTorso) < 0.5, 'D3: overslaget rammer ikke modellen ved 140 grader, saa det kan ikke bruges')
  ok(o.escamilla159.hofteArmCm < 0.7 * o.modelArmCm, 'D3: med 159 grader falder hoftens arm ikke laengere med mere end 30 %')
  // D4: lockout haelder.
  ok(d.konventionel.lockout.torso >= 3 && d.lockoutSkulderForanAnkelCm > 8, 'D4: lockout haelder ikke laengere som en planke')
  // D5: sumo mere vandret end Marcs konventionelle.
  ok(d.sumo.opstilling.torso > klipStart.torsoGrader.maalt, 'D5: sumoens torso er ikke laengere mere vandret end Marcs konventionelle')
  ok(d.sumo.lockout.stangHoejde < d.konventionel.lockout.stangHoejde - 5, 'D5: sumoens lockout er ikke laengere lavere end den konventionelle')
  // B1: stangen roerer foran brystets top.
  ok(['bryst', 'bue-middel', 'bue-stor', 'greb-smal', 'greb-bred'].every((n) => b.svg[n].stangFoerBrystTopCm > 10), 'B1: stangen roerer ikke laengere 10+ cm foran brystets top')
  // B2: underarmen ved brystet.
  const mm = b.kombinationer.find((k) => k.bue === 'middel' && k.greb === 'middel')
  const ms = b.kombinationer.find((k) => k.bue === 'middel' && k.greb === 'smal')
  ok(Math.abs(mm.bryst.underarmFraLodretSideGrader) > 15 && b.svg.bryst.forfraAlbueUdenForHaandCm > 5, 'B2: underarmen ved brystet er ikke laengere skraa')
  ok(ms.bryst.albueGrader < 40 && Math.abs(ms.bryst.underarmFraLodretSideGrader) > 40, 'B2: smalt greb er ikke laengere foldet sammen')
  // B3: kyllingevinger midt i opturen.
  ok(mm.midt.overarmUdGrader > 75 && b.svg.midt.forfraAlbueUdenForHaandCm > 12, 'B3: albuen midt i opturen staar ikke laengere langt ude')
}
const fig = tekst('FIGURER-441.md')
if (fig) {
  for (const f of FUND) ok(new RegExp(`\\*\\*${f}\\. `).test(fig), `FIGURER-441: fund ${f} mangler`)
  const afsnit = fig.split(/\n(?=\*\*[DB]\d\. )/)
  for (const f of FUND) {
    const a = afsnit.find((x) => x.startsWith(`**${f}. `))
    if (a) ok(/Alvor: (vigtigt|irriterer|kosmetisk)/.test(a.split('\n')[0]), `FIGURER-441: ${f} har ingen alvor`)
  }
  // Hvert fund undtagen de rent kosmetiske peger paa et skaermbillede.
  for (const f of FUND.filter((x) => !['D7', 'B5'].includes(x))) {
    const a = afsnit.find((x) => x.startsWith(`**${f}. `))
    if (a) ok(/fig-390-(dl|bp)-\d\d/.test(a), `FIGURER-441: ${f} peger ikke paa et skaermbillede`)
  }
  ok(fig.includes('f1e84b3'), 'FIGURER-441: loeftmodellens commit mangler')
}

// --- blok 2: dom og rapport ----------------------------------------------------------
if (blok >= 2) {
  const k = tekst('KRITIK-doedloeft-baenk.md')
  if (k) {
    const foerste = k.indexOf('D1'), dom = k.search(/klar til sitet:/i)
    ok(foerste >= 0 && dom > foerste, 'KRITIK: fundene staar ikke oeverst, foer dommen')
    for (const f of FUND) ok(k.includes(f), `KRITIK: fund ${f} mangler`)
    const domme = [...k.matchAll(/^- \*\*(.+?)\*\*: klar til sitet: (ja|nej), fordi .+$/gim)]
    const loeft = domme.map((m) => m[1].toLowerCase())
    for (const l of ['konventionel', 'sumo', 'bænk']) ok(loeft.some((x) => x.includes(l)), `KRITIK: ingen dom for "${l}"`)
    ok(domme.length === 3, `KRITIK: ${domme.length} domme, ventet een linje pr. loeft (3)`)
  }
  const r = tekst('RAPPORT-441.md')
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 441'), 'RAPPORT-441: foerste linje er ikke "Ordre 441"')
    for (const h of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(r.includes(h), `RAPPORT-441: afsnittet "${h}" mangler`)
    const naeste = r.split('## Hvad er næste')[1]?.split('\n## ')[0] ?? ''
    const punkter = naeste.split('\n').filter((l) => /^- /.test(l))
    ok(punkter.length >= FUND.length, `RAPPORT-441: "Hvad er næste" har ${punkter.length} punkter, ventet mindst et pr. fund`)
    for (const f of FUND) ok(punkter.some((l) => l.includes(f)), `RAPPORT-441: fund ${f} er ikke et punkt til Yantra`)
    ok(/Yantra/.test(naeste), 'RAPPORT-441: "Hvad er næste" naevner ikke Yantra')
  }
}

// Ingen atletnavne: kun "Marc" maa naevnes (loeftmodellens egen regel).
for (const f of ['FIGURER-441.md', 'KRITIK-doedloeft-baenk.md', 'RAPPORT-441.md']) {
  const p = path.join(DOCS, f)
  if (existsSync(p)) ok(!/\b(atlet|klient)\w*:\s*[A-ZÆØÅ][a-zæøå]+/.test(readFileSync(p, 'utf8')), `${f}: ligner et atletnavn`)
}

if (fejl.length) {
  console.error(`verify:kritik-441 (blok ${blok}): ${fejl.length} fejl`)
  for (const f of fejl) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`verify:kritik-441 (blok ${blok}): groen. ${blok >= 2 ? '23 figurer x 2 bredder, 12 fund, 3 domme, rapport' : '23 figurer x 2 bredder, 12 fund'}.`)
