// ORDRE 461 blok 1c: er vendepunkterne rigtige? Hvert vendepunkt fra browserpartierne
// (elev-browser-461.json) regnes igen med en dybere soegning end appens:
//   appen:  hurtigmotor, 4 halvtraek + slag til ende, loft 400.000 knuder
//   her:    samme motor, 6 halvtraek + slag til ende, loft 12.000.000 knuder, og
//           stillingen efter det spillede og efter det "bedre" traek regnet
//           saerskilt i 5 halvtraek, saa begge scorer er eksakte (ikke graenser).
// For hvert punkt:
//   rigtigt    det spillede traek taber mindst 0,2 i vinderchance mod det bedste i dybde 6
//   bedreGodt  appens "bedre" traek er hoejst 0,1 fra det bedste i dybde 6 og mindst
//              0,2 bedre end det spillede
//   brik       den brik teksten naevner, er den der gaar tabt i en laengere linje
//              (bedste svar i dybde 4, op til 8 halvtraek)
//   kompetence min egen regel ud fra den laengere linje (se minKompetence) mod appens
// Uenigheder skrives ud, saa de kan ses med oejnene; dommen staar i KRITIK-skaktime.md.
//   node outputs/kritik-461/vendepunkter-dyb-461.mjs
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { skakKopi } from './skak-kopi-461.mjs'

const HER = path.dirname(fileURLToPath(import.meta.url))
const kopi = skakKopi()
const req = createRequire(path.join(kopi.mappe, 'package.json'))
const { Chess } = await import(pathToFileURL(req.resolve('chess.js')).href)
const { MAT, Stilling, traekTilUci } = await kopi.importer('src/hurtigmotor.js')
const { findVendepunkter, traeningForVendepunkt, vinderchance, nettoTab, vendepunktTekst } = await kopi.importer('src/vendepunkter.js')
const { erGaffel, erSpid, erBinding, erAfdaekketAngreb } = await kopi.importer('src/taktikanalyse.js')

const DYB = 6, DYB_EFTER = 5, LOFT = 12_000_000
const POINT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const MATG = MAT - 1000

function efterScore(fen, uci) {
  const c = new Chess(fen)
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined })
  if (c.isCheckmate()) return { score: MAT, fuld: true }
  if (c.isDraw() || c.isStalemate()) return { score: 0, fuld: true }
  const s = new Stilling(c.fen())
  const liste = s.vurderAlleTraek(DYB_EFTER, { margin: 0, maksNoder: LOFT })
  return { score: -liste[0].score, fuld: s.noder < LOFT || s.noder === 0 }
}

// Laengere materialelinje end appens (8 halvtraek, dybde 4).
function linje(fen, uci) {
  const c = new Chess(fen)
  const farve = c.turn()
  const tabt = [], vundet = [], traek = []
  const noter = (m) => { if (m?.captured) (m.color === farve ? vundet : tabt).push({ brik: m.captured, felt: m.to, nr: traek.length }); traek.push(m.san) }
  noter(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined }))
  let rolige = 0
  for (let p = 0; p < 8 && !c.isGameOver(); p += 1) {
    if (p >= 2 && rolige >= 2) break
    const liste = new Stilling(c.fen()).vurderAlleTraek(4, { margin: 0, maksNoder: 2_000_000 })
    if (!liste.length) break
    const u = traekTilUci(liste[0].traek)
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || undefined })
    rolige = m.captured || m.promotion ? 0 : rolige + 1
    noter(m)
  }
  const netto = vundet.reduce((a, x) => a + POINT[x.brik], 0) - tabt.reduce((a, x) => a + POINT[x.brik], 0)
  const n = nettoTab(tabt.map((x) => x.brik), vundet.map((x) => x.brik))
  const dyrest = n.tabt.sort((a, b) => POINT[b] - POINT[a])[0] ?? null
  return { traek, netto, tabtBrik: dyrest, tabt, vundet }
}

function iFare(c, felt) {
  const b = c.get(felt); if (!b) return false
  const mod = b.color === 'w' ? 'b' : 'w'
  const a = c.attackers(felt, mod); if (!a.length) return false
  if (!c.attackers(felt, b.color).length) return true
  return a.some((f) => POINT[c.get(f).type] < POINT[b.type])
}

// Min regel: det en laerer ville pege paa. Staar den brik der gaar tabt, allerede i
// fare FOER traekket (og er det ikke den der flyttes), er lektien "red din brik",
// uanset hvordan den saa tages. Ellers gaflen, saa slaget, saa "hvad svarer".
function minKompetence(p, l, fen) {
  if (p.art === 'overset-mat') return p.matI === 1 ? 'mat-i-1' : 'mat-i-2'
  if (p.art === 'gik-i-mat') return 'stop-matten'
  const c = new Chess(fen)
  if (p.art === 'tabt-brik') {
    const foersteTab = l.tabt[0]
    const flyttetFra = p.uci.slice(0, 2), flyttetTil = p.uci.slice(2, 4)
    if (foersteTab && foersteTab.felt !== flyttetTil) {
      // Stod en brik af den type allerede i fare paa det felt, den blev taget paa?
      const b = c.get(foersteTab.felt)
      if (b && b.type === foersteTab.brik && iFare(c, foersteTab.felt) && foersteTab.felt !== flyttetFra) return 'forsvar'
    }
    const efter = new Chess(fen); efter.move({ from: flyttetFra, to: flyttetTil, promotion: p.uci.slice(4) || undefined })
    const svar = efter.moves({ verbose: true }).find((m) => m.san === l.traek[1])
    if (svar && erGaffel(efter.fen(), svar.from + svar.to + (svar.promotion ?? ''))) return efter.get(svar.from)?.type === 'n' ? 'gaffel-springer' : 'gaffel-andre'
    if (c.get(flyttetTil)) return 'byt-rigtigt'
    return 'hvad-svarer'
  }
  if (p.art === 'overset-gevinst') {
    const u = p.bedsteUci
    if (erGaffel(fen, u)) return c.get(u.slice(0, 2))?.type === 'n' ? 'gaffel-springer' : 'gaffel-andre'
    if (erSpid(fen, u)) return 'spid'
    if (erBinding(fen, u)) return 'binding'
    if (erAfdaekketAngreb(fen, u)) return 'afdaekket'
    const offer = u.slice(2, 4)
    if (c.get(offer)) return c.attackers(offer, c.turn() === 'w' ? 'b' : 'w').length === 0 ? 'ubeskyttet' : 'byt-rigtigt'
    return 'hvad-svarer'
  }
  return 'hvad-svarer'
}

const data = JSON.parse(readFileSync(path.join(HER, 'elev-browser-461.json'), 'utf8'))
const t0 = Date.now()
const raekker = []
for (const parti of data.partier) {
  const punkter = findVendepunkter(new Chess().fen(), parti.san, { kunFarve: 'w' })
  punkter.forEach((p, i) => {
    const vist = parti.vendepunkter.punkter[i]
    const s = new Stilling(p.fen)
    const liste = s.vurderAlleTraek(DYB, { margin: 0, maksNoder: LOFT })
    const fuld = s.noder < LOFT
    const dybBedst = { uci: traekTilUci(liste[0].traek), score: liste[0].score }
    const spillet = efterScore(p.fen, p.uci)
    const bedre = efterScore(p.fen, p.bedsteUci)
    const bedst = Math.max(dybBedst.score, spillet.score, bedre.score)
    const faldDyb = vinderchance(bedst) - vinderchance(spillet.score)
    const bedreFraBedst = vinderchance(bedst) - vinderchance(bedre.score)
    const l = linje(p.fen, p.uci)
    const lb = linje(p.fen, p.bedsteUci)
    const app = traeningForVendepunkt(p).id
    const min = minKompetence(p, l, p.fen)
    const c = new Chess(p.fen)
    const r = {
      parti: parti.nr, bredde: parti.bredde, niveau: parti.niveau, traekNr: p.traekNr,
      vist: vist?.overskrift ?? null, spillet: p.san, bedre: p.bedsteSan,
      dybBedst: c.move({ from: dybBedst.uci.slice(0, 2), to: dybBedst.uci.slice(2, 4), promotion: dybBedst.uci.slice(4) || undefined }).san,
      art: p.art, brik: p.brik, faldApp: p.fald, faldDyb: +faldDyb.toFixed(2), bedreFraBedst: +bedreFraBedst.toFixed(2),
      scoreSpillet: spillet.score, scoreBedre: bedre.score, scoreBedst: bedst, fuldDybde: fuld && spillet.fuld && bedre.fuld,
      rigtigt: faldDyb >= 0.2,
      bedreGodt: bedreFraBedst <= 0.1 && vinderchance(bedre.score) - vinderchance(spillet.score) >= 0.2,
      linje: l.traek.join(' '), linjeNetto: l.netto, linjeTabtBrik: l.tabtBrik,
      bedreLinje: lb.traek.join(' '), bedreLinjeNetto: lb.netto,
      // Teksten siger "du tabte", men det bedre traek vandt selv mindst en let officer:
      // eleven hoerer om tabet og ikke om den gevinst, der laa lige for.
      skjultGevinst: p.art === 'tabt-brik' && lb.netto >= 3,
      brikRigtig: p.art !== 'tabt-brik' ? null : (p.brik === l.tabtBrik || (l.tabtBrik && POINT[p.brik] === POINT[l.tabtBrik])),
      // "Her kunne du have vundet X": vinder det bedre traek mindst X (minus en bonde) i den laengere linje?
      gevinstRigtig: p.art !== 'overset-gevinst' ? null : lb.netto >= POINT[p.brik] - 1,
      kompetenceApp: app, kompetenceMin: min, kompetenceEnig: app === min,
      tekstStemmer: vist ? vist.overskrift.endsWith(vendepunktTekst(p, true).overskrift) : false,
    }
    // Samme chance to gange: forrige vendepunkt i partiet var traekket foer, og det bedre traek er det samme.
    const forrige = raekker.at(-1)
    r.dublet = Boolean(forrige && forrige.parti === r.parti && r.traekNr - forrige.traekNr === 1 && forrige.bedre === r.bedre)
    raekker.push(r)
    console.log(`${String(raekker.length).padStart(2)} p${r.parti} ${r.bredde} n${r.niveau} tr${r.traekNr} ${r.spillet} -> ${r.bedre} (dyb ${r.dybBedst}) ${r.art}${r.brik ? '/' + r.brik : ''} fald app ${r.faldApp} dyb ${r.faldDyb}, bedre-fra-bedst ${r.bedreFraBedst} | rigtigt ${r.rigtigt} bedreGodt ${r.bedreGodt} brik ${r.brikRigtig}${r.skjultGevinst ? ' SKJULT-GEVINST ' + r.bedreLinjeNetto : ''} | ${app} / ${min} ${r.kompetenceEnig ? '' : '<-- UENIG'} | ${r.linje}`)
  })
}
const n = raekker.length
const sum = {
  antal: n,
  rigtige: raekker.filter((r) => r.rigtigt).length,
  bedreGode: raekker.filter((r) => r.bedreGodt).length,
  tabtBrik: raekker.filter((r) => r.art === 'tabt-brik').length,
  brikRigtig: raekker.filter((r) => r.brikRigtig === true).length,
  kompetenceEnig: raekker.filter((r) => r.kompetenceEnig).length,
  tekstStemmer: raekker.filter((r) => r.tekstStemmer).length,
  skjultGevinst: raekker.filter((r) => r.skjultGevinst).length,
  oversetGevinst: raekker.filter((r) => r.art === 'overset-gevinst').length,
  gevinstRigtig: raekker.filter((r) => r.gevinstRigtig === true).length,
  dubletter: raekker.filter((r) => r.dublet).length,
  partierMedDublet: new Set(raekker.filter((r) => r.dublet).map((r) => r.parti)).size,
  fuldDybde: raekker.filter((r) => r.fuldDybde).length,
  arter: Object.fromEntries([...new Set(raekker.map((r) => r.art))].map((a) => [a, raekker.filter((r) => r.art === a).length])),
  sekunder: Math.round((Date.now() - t0) / 1000),
}
console.log(sum)
writeFileSync(path.join(HER, 'vendepunkter-dyb-461.json'), JSON.stringify({ skakMain: kopi.hash, dybde: DYB, dybdeEfter: DYB_EFTER, loft: LOFT, sum, raekker }, null, 1))
