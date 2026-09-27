// ORDRE 457: verify:kritik-457. Intet netvaerk og ingen loeftmodel-mappe; kun de
// gemte maalinger (lavet mod loeftmodellens main 0869560) og dokumenterne.
//   node outputs/kritik-457/verify-kritik-457.mjs 1   blok 1
//   node outputs/kritik-457/verify-kritik-457.mjs 2   blok 1 + blok 2 (standard)
//
// Blok 1: alle 20 figurer er fotograferet i begge bredder, siderne ruller ikke,
//   teksten kan laeses, og status for D1-D7 og B1-B5 regnet af figurer-457.json
//   er den, FIGURER-457 skriver (10 lukket, D1 og D3 delvise). Svarene paa
//   Yantras to spoergsmaal og dommen over D1/D3 som modelgraenser staar der.
// Blok 2: KRITIK-doedloeft-baenk-2 (fund oeverst, een dom pr. loeft) og
//   RAPPORT-457 (fem afsnit, foerste linje "Ordre 457", Hvad er naeste passer til
//   dommen: Setu ved ja, Yantra ved nej).
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-457')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-457/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const FUND = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'B1', 'B2', 'B3', 'B4', 'B5']
const NYE = ['N1', 'N2', 'N3', 'N4']

// --- blok 1: figurerne og status -----------------------------------------------------
const jp = path.join(HERE, 'figurer-457.json')
const j = existsSync(jp) ? JSON.parse(readFileSync(jp, 'utf8')) : (fejl.push('figurer-457.json mangler'), null)
const status = {}
if (j) {
  ok(j.loeftmodelMain === '0869560', `figurer-457: maalt mod loeftmodel ${j.loeftmodelMain}, ventet 0869560 (447 og 452 merget)`)
  const png = new Set(readdirSync(HERE).filter((f) => f.endsWith('.png')))
  for (const w of ['390', '1280']) {
    for (const [k, antal] of [['dl', 11], ['bp', 9]]) {
      const s = j.bredder?.[w]?.[k]
      if (!s) { fejl.push(`figurer-457: ${w} px ${k} mangler`); continue }
      ok(s.figurer.length === antal, `figurer-457: ${w} px ${k} har ${s.figurer.length} figurer, ventet ${antal}`)
      ok(s.figurer.every((f) => f.hentet), `figurer-457: ${w} px ${k}: et billede blev ikke hentet`)
      ok(s.figurer.every((f) => png.has(f.fil)), `figurer-457: ${w} px ${k}: skaermbillede mangler`)
      ok(!s.rullerSidelaens, `figurer-457: ${w} px ${k} ruller sidelaens (${s.scrollWidth} > ${s.clientWidth})`)
      ok(s.figurer.every((f) => f.mindsteSvgTekstPx == null || f.mindsteSvgTekstPx >= 12), `figurer-457: ${w} px ${k}: tekst under 12 px i en figur`)
      ok(s.mindsteHtmlTekstPx >= 14, `figurer-457: ${w} px ${k}: HTML-tekst under 14 px`)
    }
  }
  const d = j.doedloeft, b = j.baenk, t = d.svgTegn
  const kop = d.konventionel.opstilling
  const klip = Object.fromEntries(d.klip.map((x) => [x.navn, x]))
  const mm = b.kombinationer.find((k) => k.bue === 'middel' && k.greb === 'middel')
  const ms = b.kombinationer.find((k) => k.bue === 'middel' && k.greb === 'smal')
  const bl = b.kombinationer.find((k) => k.bue === 'lille' && k.greb === 'middel')
  const bs = b.kombinationer.find((k) => k.bue === 'stor' && k.greb === 'middel')
  // 441's kriterium for "aaben" og 457's graense for "lukket"; ellers "delvis".
  const tre = (aaben, lukket) => (aaben ? 'aaben' : lukket ? 'lukket' : 'delvis')
  const torsoGab = kop.torso - klip.start.torsoGrader.maalt
  status.D1 = tre(kop.skinneben < 10 && kop.hofte < 60 && kop.torso > 60, kop.skinneben >= 10 && torsoGab <= 5)
  status.D2 = tre(d.konventionel['forlader-gulvet'] != null && d.konventionel['forlader-gulvet'].knae - kop.knae < 8, !t.forladerGulvetFigur && j.bredder[390].dl.figurer.length === 11)
  status.D3 = tre(d.konventionel.knaehoejde.knae < 145 || d.sumo.knaehoejde.knae < 145, d.konventionel.knaehoejde.knae >= 155 && d.sumo.knaehoejde.knae >= 155)
  status.D4 = tre(d.konventionel.lockout.torso >= 3 && d.lockoutSkulderForanAnkelCm > 8, d.konventionel.lockout.torso < 1 && d.lockoutSkulderForanAnkelCm < 2)
  // D5: sumoens torso og vinduet forfra; den lavere lockout er standens geometri, naar vinduet viser den.
  status.D5 = tre(d.sumo.opstilling.torso > klip.start.torsoGrader.maalt + 5 || t.sumoMedVindue === 0, d.sumo.opstilling.torso <= klip.start.torsoGrader.maalt && t.sumoMedVindue === t.sumoIalt)
  status.D6 = tre(t.klipIkkeVist === 0, t.klipIkkeVist === 3)
  status.D7 = tre(t.modelHaandOmStang === 0, t.modelHaandOmStang === t.modelIalt)
  const berør = ['bryst', 'bue-middel', 'bue-stor', 'greb-smal', 'greb-bred'].map((n) => b.svg[n].stangFoerBrystTopCm)
  status.B1 = tre(berør.every((x) => x > 10), berør.every((x) => Math.abs(x) < 3) && Math.abs(b.svg['bue-lille'].stangFoerBrystTopCm) < 3)
  status.B2 = tre(Math.abs(mm.bryst.underarmFraLodretSideGrader) > 15 && b.svg.bryst.forfraAlbueUdenForHaandCm > 5,
    Math.abs(mm.bryst.underarmFraLodretSideGrader) <= 15 && b.svg.bryst.forfraAlbueUdenForHaandCm <= 2 && ms.bryst.albueGrader >= 50 && Math.abs(ms.bryst.underarmFraLodretSideGrader) <= 20)
  status.B3 = tre(mm.midt.overarmUdGrader > 75 && b.svg.midt.forfraAlbueUdenForHaandCm > 12, mm.midt.overarmUdGrader <= 45 && b.svg.midt.forfraAlbueUdenForHaandCm <= 5)
  status.B4 = tre(bs.bryst.stangOverBaenkCm - bl.bryst.stangOverBaenkCm < 5, bs.bryst.stangOverBaenkCm - bl.bryst.stangOverBaenkCm > 6 && ['bue-lille', 'bue-middel', 'bue-stor'].every((n) => Math.abs(b.svg[n].stangFoerBrystTopCm) < 3))
  status.B5 = tre(j.bredder[390].bp.figurer.some((f) => f.src.includes('udgang')), j.bredder[390].bp.figurer.length === 9)
  for (const f of FUND) if (!['D1', 'D3'].includes(f)) ok(status[f] === 'lukket', `${f}: regnet som ${status[f]}, ventet lukket`)
  ok(status.D1 === 'delvis' && status.D3 === 'delvis', `D1/D3: regnet som ${status.D1}/${status.D3}, ventet delvis/delvis`)

  // Overslagene, som svarene bygger paa.
  const m = d.marcTorsoOverslag
  ok(Math.abs(m.opstilling.kontrolArmCm - m.opstilling.modelArmCm) < 0.5 && Math.abs(m.knaehoejde.kontrolArmCm - m.knaehoejde.modelArmCm) < 0.5, 'overslag: hoftearmen rammer ikke modellens med modellens torso, saa overslaget kan ikke bruges')
  ok(m.opstilling.marcArmCm < m.opstilling.modelArmCm && m.knaehoejde.marcArmCm < m.knaehoejde.modelArmCm, 'overslag: med Marcs torso er hoftearmen ikke laengere kortere end modellens')
  ok(Math.abs(m.faldModel - m.faldMarcTorso) <= 0.05, `overslag: faldet fra gulv til knae er ${m.faldModel} i modellen og ${m.faldMarcTorso} med Marcs torso - ikke laengere robust`)
  const v = b.midtAlbueValg
  ok(Math.abs(v[0].albueArmIAltCm - b.midtModel.albueArmCm) < 0.5, 'albuevalg: med albuen under haanden rammer beregningen ikke modellens albuearm')
  ok(v.every((x) => x.albueArmIAltCm > 0.75 * v[0].albueArmIAltCm), 'albuevalg: albuens arm i alt aendrer sig mere end 25 % med flaret')
  ok(Math.abs(b.midtModel.underarmSideGrader) > 45, 'N1: underarmen midt i opturen haelder ikke laengere over 45 grader fra siden')
}
const fig = tekst('FIGURER-457.md')
if (fig) {
  ok(fig.includes('0869560'), 'FIGURER-457: loeftmodellens commit mangler')
  const tabel = fig.split('## Status for D1-D7 og B1-B5')[1]?.split('\n## ')[0] ?? ''
  for (const f of FUND) {
    const r = tabel.split('\n').find((l) => l.startsWith(`| ${f} `))
    if (!r) { fejl.push(`FIGURER-457: ${f} mangler i statustabellen`); continue }
    const skrevet = /\*\*delvis\*\*/.test(r) ? 'delvis' : /lukket/.test(r) ? 'lukket' : 'aaben'
    if (status[f]) ok(skrevet === status[f], `FIGURER-457: ${f} staar som ${skrevet}, men maalingen siger ${status[f]}`)
    ok(/fig-390-(dl|bp)-\d\d|figurer|ingen/.test(r), `FIGURER-457: ${f} har intet bevis i tabellen`)
  }
  for (const n of NYE) {
    const a = fig.split(/\n(?=\*\*N\d\. )/).find((x) => x.startsWith(`**${n}. `))
    ok(a && /Alvor: /.test(a.split('\n')[0]), `FIGURER-457: nyt fund ${n} mangler eller har ingen alvor`)
    ok(a && /Sted: /.test(a), `FIGURER-457: ${n} har intet sted`)
  }
  ok(/\*\*1\. Skal albuen lidt ud/.test(fig) && /\*\*2\. Er 12 cm skulder foran stangen/.test(fig), 'FIGURER-457: svarene paa Yantras to spoergsmaal mangler')
  ok(/## Er D1 og D3 acceptable som modelgrænser\?\n\nJa/.test(fig), 'FIGURER-457: dommen over D1 og D3 som modelgraenser mangler')
}

// --- blok 2: dom og rapport ----------------------------------------------------------
if (blok >= 2) {
  const k = tekst('KRITIK-doedloeft-baenk-2.md')
  let domme = []
  if (k) {
    const foerste = k.indexOf('D1'), dom = k.search(/klar til sitet:/i)
    ok(foerste >= 0 && dom > foerste, 'KRITIK-2: fundene staar ikke oeverst, foer dommen')
    for (const f of [...FUND, ...NYE]) ok(k.includes(f), `KRITIK-2: fund ${f} mangler`)
    domme = [...k.matchAll(/^- \*\*(.+?)\*\*: klar til sitet: (ja|nej), fordi .+$/gim)]
    const loeft = domme.map((m) => m[1].toLowerCase())
    for (const l of ['konventionel', 'sumo', 'bænk']) ok(loeft.some((x) => x.includes(l)), `KRITIK-2: ingen dom for "${l}"`)
    ok(domme.length === 3, `KRITIK-2: ${domme.length} domme, ventet een linje pr. loeft (3)`)
  }
  const r = tekst('RAPPORT-457.md')
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 457'), 'RAPPORT-457: foerste linje er ikke "Ordre 457"')
    for (const h of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(r.includes(h), `RAPPORT-457: afsnittet "${h}" mangler`)
    const naeste = r.split('## Hvad er næste')[1]?.split('\n## ')[0] ?? ''
    const alleJa = domme.length === 3 && domme.every((m) => m[2].toLowerCase() === 'ja')
    if (domme.length) {
      if (alleJa) ok(/Setu/.test(naeste) && /modelgrænse/i.test(naeste), 'RAPPORT-457: dommen er ja, men "Hvad er næste" siger ikke, hvad Setu skal skrive om modelgraenserne')
      else ok(/Yantra/.test(naeste), 'RAPPORT-457: dommen er nej for et loeft, men "Hvad er næste" har ingen fund til Yantra')
    }
  }
}

// Ingen atletnavne: kun "Marc" maa naevnes (loeftmodellens egen regel).
for (const f of ['FIGURER-457.md', 'KRITIK-doedloeft-baenk-2.md', 'RAPPORT-457.md']) {
  const p = path.join(DOCS, f)
  if (existsSync(p)) ok(!/\b(atlet|klient)\w*:\s*[A-ZÆØÅ][a-zæøå]+/.test(readFileSync(p, 'utf8')), `${f}: ligner et atletnavn`)
}

if (fejl.length) {
  console.error(`verify:kritik-457 (blok ${blok}): ${fejl.length} fejl`)
  for (const f of fejl) console.error(`  - ${f}`)
  process.exit(1)
}
const st = Object.entries(status).map(([f, s]) => `${f} ${s}`).join(', ')
console.log(`verify:kritik-457 (blok ${blok}): groen. 20 figurer x 2 bredder; ${st}${blok >= 2 ? '; 3 domme, rapport' : ''}.`)
