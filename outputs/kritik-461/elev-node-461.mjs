// ORDRE 461 blok 1a: en elev der lige har laert reglerne, mod niveau 1, 2 og 3.
// Mange partier i Node (appens egen vaelgNiveauTraek fra skak-main), saa vi faar
// tal og ikke kun et indtryk. Eleven er MIN simulering, ikke appens motor:
//   tilfaeldig  et lovligt traek, helt tilfaeldigt (en maskine; sammenligning)
//   ny          har lige laert reglerne: tager tit en brik (den dyreste), ser
//               mat i et en gang imellem, tjekker sjaeldent om brikken kan slaas
//   oevet       har gaaet Laer skak igennem: tager gratis brikker, redder tit en
//               truet brik, flytter sjaeldnere en brik hen hvor den kan slaas
// For computerens traek maales, om det ligner et menneske eller en tilfaeldig
// maskine: brikker givet vaek, gratis brikker ladt staa, mat i et overset,
// frem-og-tilbage-traek, formaalsloese aabningstraek og om en vundet stilling
// bliver til mat.
//   node outputs/kritik-461/elev-node-461.mjs [partier pr. kombination, standard 30]
// Skriver outputs/kritik-461/elev-node-461.json.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { skakKopi } from './skak-kopi-461.mjs'
import { V, elevTraek, erMatITraek, modsat, mulberry32 } from './elev-profiler-461.mjs'

const HER = path.dirname(fileURLToPath(import.meta.url))
const N = Number(process.argv[2] ?? 30)
const kopi = skakKopi()
const { Chess } = await import(pathToFileURL(createRequire(path.join(kopi.mappe, 'package.json')).resolve('chess.js')).href)
const { vaelgNiveauTraek } = await kopi.importer('src/computerniveauer.js')
const { vurderTraek, klassificerTraek } = await kopi.importer('src/partianalyse.js')

function materiale(chess, f) {
  let s = 0
  for (const r of chess.board()) for (const b of r) if (b) s += (b.color === f ? 1 : -1) * V[b.type]
  return s
}

// Et parti. Returnerer resultat set fra eleven og maalinger af computerens traek.
function parti(niveau, profil, elevFarve, frø) {
  const rng = mulberry32(frø)
  const crng = mulberry32(frø * 7919 + 13)
  const chess = new Chess()
  const comp = modsat(elevFarve)
  const m = { traek: 0, bog: 0, tabtBrik: 0, oversetGevinst: 0, oversetMat: 0, matI1Muligt: 0, matI1Spillet: 0,
    fremTilbage: 0, aabningTaarn: 0, aabningKonge: 0, aabningKantbonde: 0, aabningDronning: 0, aabningUdvikling: 0, aabningTraek: 0,
    elevTabtBrik: 0, elevTraek: 0 }
  const sidste = {} // brikkens forrige flytning for frem-og-tilbage
  let compFoerst9 = null, elevFoerst9 = null
  let ply = 0
  while (!chess.isGameOver() && ply < 200) {
    const fen = chess.fen()
    const tur = chess.turn()
    if (tur === comp) {
      const t = vaelgNiveauTraek(fen, niveau, { rng: crng })
      const alle = chess.moves({ verbose: true })
      const matI1 = alle.find((x) => erMatITraek(chess, x))
      const mv = chess.move({ from: t.from, to: t.to, promotion: t.promotion })
      m.traek += 1
      if (t.bog) m.bog += 1
      if (matI1) { m.matI1Muligt += 1; if (chess.isCheckmate()) m.matI1Spillet += 1 }
      if (!t.bog) {
        const art = klassificerTraek(vurderTraek(fen, mv.from + mv.to + (mv.promotion ?? '')))
        if (art === 'tabt-brik') m.tabtBrik += 1
        else if (art === 'overset-gevinst') m.oversetGevinst += 1
        else if (art === 'overset-mat') m.oversetMat += 1
      }
      const egne = Math.floor(ply / 2)
      if (egne < 10) {
        m.aabningTraek += 1
        if (mv.piece === 'r') m.aabningTaarn += 1
        if (mv.piece === 'k' && !mv.flags.includes('k') && !mv.flags.includes('q') && !/\+/.test(chess.history().at(-2) ?? '')) m.aabningKonge += 1
        if (mv.piece === 'p' && /^[ah]/.test(mv.from)) m.aabningKantbonde += 1
        if (mv.piece === 'q') m.aabningDronning += 1
        if ((mv.piece === 'n' || mv.piece === 'b') && /[18]$/.test(mv.from)) m.aabningUdvikling += 1
      }
      const forrige = sidste[mv.from]
      if (forrige && forrige.fra === mv.to && forrige.ply === ply - 2 && !mv.captured) m.fremTilbage += 1
      sidste[mv.to] = { fra: mv.from, ply }
    } else {
      const mv = elevTraek(chess, profil, rng)
      const uci = mv.from + mv.to + (mv.promotion ?? '')
      m.elevTraek += 1
      if (klassificerTraek(vurderTraek(fen, uci)) === 'tabt-brik') m.elevTabtBrik += 1
      chess.move(mv)
    }
    ply += 1
    const mc = materiale(chess, comp)
    if (compFoerst9 === null && mc >= 9) compFoerst9 = ply
    if (elevFoerst9 === null && mc <= -9) elevFoerst9 = ply
  }
  let resultat = 'uafgjort-200'
  if (chess.isCheckmate()) resultat = chess.turn() === elevFarve ? 'tabt' : 'vundet'
  else if (chess.isGameOver()) resultat = 'remis'
  return { niveau, profil, elevFarve, frø, resultat, ply, m, compFoerst9, elevFoerst9, slutMateriale: materiale(chess, elevFarve) }
}

const t0 = Date.now()
const partier = []
for (const niveau of [1, 2, 3]) {
  for (const profil of ['tilfaeldig', 'ny', 'oevet']) {
    for (let i = 0; i < N; i += 1) partier.push(parti(niveau, profil, i % 2 ? 'b' : 'w', 461000 + niveau * 1000 + i))
    const del = partier.filter((p) => p.niveau === niveau && p.profil === profil)
    const t = (r) => del.filter((p) => p.resultat === r).length
    console.log(`niveau ${niveau} mod ${profil.padEnd(10)}: vundet ${t('vundet')}, tabt ${t('tabt')}, remis ${t('remis')}, ikke afgjort efter 200 halvtraek ${t('uafgjort-200')}`)
  }
}

// Samlet pr. niveau og profil.
const sum = (liste, k) => liste.reduce((a, p) => a + p.m[k], 0)
const tabel = {}
for (const niveau of [1, 2, 3]) {
  for (const profil of ['tilfaeldig', 'ny', 'oevet']) {
    const del = partier.filter((p) => p.niveau === niveau && p.profil === profil)
    const t = (r) => del.filter((p) => p.resultat === r).length
    const ikkeBog = sum(del, 'traek') - sum(del, 'bog')
    const vundetStort = del.filter((p) => p.compFoerst9 !== null)
    const elevStort = del.filter((p) => p.elevFoerst9 !== null)
    tabel[`${niveau}-${profil}`] = {
      niveau, profil, partier: del.length,
      vundet: t('vundet'), tabt: t('tabt'), remis: t('remis'), ikkeAfgjort: t('uafgjort-200'),
      gnsHalvtraek: Math.round(del.reduce((a, p) => a + p.ply, 0) / del.length),
      comp: {
        traek: sum(del, 'traek'), ikkeBog,
        tabtBrikPct: +(100 * sum(del, 'tabtBrik') / ikkeBog).toFixed(1),
        oversetGevinstPct: +(100 * sum(del, 'oversetGevinst') / ikkeBog).toFixed(1),
        matI1Muligt: sum(del, 'matI1Muligt'), matI1Spillet: sum(del, 'matI1Spillet'),
        fremTilbagePct: +(100 * sum(del, 'fremTilbage') / sum(del, 'traek')).toFixed(1),
        aabning: {
          traek: sum(del, 'aabningTraek'),
          udviklingPct: +(100 * sum(del, 'aabningUdvikling') / sum(del, 'aabningTraek')).toFixed(1),
          taarnPct: +(100 * sum(del, 'aabningTaarn') / sum(del, 'aabningTraek')).toFixed(1),
          kongePct: +(100 * sum(del, 'aabningKonge') / sum(del, 'aabningTraek')).toFixed(1),
          kantbondePct: +(100 * sum(del, 'aabningKantbonde') / sum(del, 'aabningTraek')).toFixed(1),
          dronningPct: +(100 * sum(del, 'aabningDronning') / sum(del, 'aabningTraek')).toFixed(1),
        },
        foerMed9: vundetStort.length,
        foerMed9Mat: vundetStort.filter((p) => p.resultat === 'tabt').length,
        foerMed9GnsHalvtraekTilSlut: vundetStort.length ? Math.round(vundetStort.reduce((a, p) => a + (p.ply - p.compFoerst9), 0) / vundetStort.length) : null,
      },
      elev: {
        tabtBrikPct: +(100 * sum(del, 'elevTabtBrik') / sum(del, 'elevTraek')).toFixed(1),
        foerMed9: elevStort.length,
        foerMed9Mat: elevStort.filter((p) => p.resultat === 'vundet').length,
      },
    }
  }
}
for (const r of Object.values(tabel)) {
  console.log(`${r.niveau}/${r.profil.padEnd(10)} comp: tabt brik ${r.comp.tabtBrikPct}%, lod gratis staa ${r.comp.oversetGevinstPct}%, mat i 1 ${r.comp.matI1Spillet}/${r.comp.matI1Muligt}, frem-tilbage ${r.comp.fremTilbagePct}%, aabning udv ${r.comp.aabning.udviklingPct}% taarn ${r.comp.aabning.taarnPct}% konge ${r.comp.aabning.kongePct}% kant ${r.comp.aabning.kantbondePct}% D ${r.comp.aabning.dronningPct}%, +9: ${r.comp.foerMed9Mat}/${r.comp.foerMed9} mat | elev tabt brik ${r.elev.tabtBrikPct}%, elev +9: ${r.elev.foerMed9Mat}/${r.elev.foerMed9} mat`)
}
writeFileSync(path.join(HER, 'elev-node-461.json'), JSON.stringify({
  skakMain: kopi.hash, partierPrKombination: N, sekunder: Math.round((Date.now() - t0) / 1000), tabel,
  partier: partier.map(({ m, ...r }) => r),
}, null, 1))
console.log(`skak main ${kopi.hash}, ${partier.length} partier, ${Math.round((Date.now() - t0) / 1000)} s`)
