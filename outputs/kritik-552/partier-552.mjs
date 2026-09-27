// KRITIK 552 blok 1: "Kendte partier" (Chaturanga 544) uden browser og uden net.
//   node outputs/kritik-552/partier-552.mjs
// src/kendtepartier.js fra C:\Users\Entropi\Desktop\skak @ main hentes med `git archive` (traeet
// staar paa en anden gren og roeres ikke). For hvert parti:
//  1. spillere, sted, aar og traek (partiet + loesningen) mod MIN reference nedenfor. Referencen er
//     skrevet efter hukommelsen (standardopgivelsen af de ti partier, som de staar i de kendte
//     samlinger); den er ikke hentet fra nettet. Hvor jeg ikke er sikker, staar det i `usikkert`.
//  2. hvert udsagn i historien, der kan regnes efter paa braettet (traeknummer, kongens vej, hvilke
//     brikker der satte mat, hvor mange maader g3 kan slaas paa ...).
//  3. hvor mange andre traek der ogsaa saetter mat med det samme eller giver mat i 2 med skak foerst
//     (disse kalder appen "Ikke den vej", naar de ikke er det sidste traek).
// Skriver outputs/kritik-552/partier-552.json.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k552-partier-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main src/kendtepartier.js`)
execSync('tar -xf s.tar', { cwd: dir })
const CHESS = pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href
const kildeFil = path.join(dir, 'src', 'kendtepartier.js')
writeFileSync(kildeFil, readFileSync(kildeFil, 'utf8').replace("from 'chess.js'", `from '${CHESS}'`))
const { KENDTE_PARTIER, kendtPartiOpgave } = await import(pathToFileURL(kildeFil).href)
const { Chess } = await import(CHESS)

// Min reference: hele partiet som det blev spillet (til og med sidste traek eller opgivelsen).
const REF = {
  'opera-1858': { hvid: 'Morphy', sort: ['Braunschweig', 'Isouard'], sted: 'Paris', aar: 1858,
    traek: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
    usikkert: 'Datoen (oktober eller 2. november 1858) svinger i kilderne; aaret og stedet goer ikke.' },
  'udoedelige-1851': { hvid: 'Anderssen', sort: ['Kieseritzky'], sted: 'London', aar: 1851,
    traek: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
    usikkert: 'Nogle gamle kilder har 18...Qxa1+ foer Bxg1; standardopgivelsen (den her) har 18...Bxg1 19.e5 Qxa1+.' },
  'stedsegroenne-1852': { hvid: 'Anderssen', sort: ['Dufresne'], sted: 'Berlin', aar: 1852,
    traek: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#' },
  'reti-tartakower-1910': { hvid: 'Réti', sort: ['Tartakower'], sted: 'Wien', aar: 1910,
    traek: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#',
    usikkert: 'Et fripartie (ikke et turneringsparti); nogle kilder skriver 1910, nogle "ca. 1910".' },
  'lasker-thomas-1912': { hvid: 'Edward Lasker', sort: ['Thomas'], sted: 'London', aar: 1912,
    traek: 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7 Qxh7+ Kxh7 Nxf6+ Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2#',
    usikkert: 'Partiet sluttede 18.Kd2#; 18.O-O-O# var ogsaa mat (appen godtager begge).' },
  'lasker-bauer-1889': { hvid: 'Emanuel Lasker', sort: ['Bauer'], sted: 'Amsterdam', aar: 1889,
    traek: 'f4 d5 e3 Nf6 b3 e6 Bb2 Be7 Bd3 b6 Nc3 Bb7 Nf3 Nbd7 O-O O-O Ne2 c5 Ng3 Qc7 Ne5 Nxe5 Bxe5 Qc6 Qe2 a6 Nh5 Nxh5 Bxh7+ Kxh7 Qxh5+ Kg8 Bxg7 Kxg7 Qg4+ Kh7 Rf3 e5 Rh3+ Qh6 Rxh6+ Kxh6 Qd7 Bf6 Qxb7 Kg7 Rf1 Rab8 Qd7 Rfd8 Qg4+ Kf8 fxe5 Bg7 e6 Rb7 Qg6 f6 Rxf6+ Bxf6 Qxf6+ Ke8 Qh8+ Ke7 Qg7+' },
  'steinitz-bardeleben-1895': { hvid: 'Steinitz', sort: ['Bardeleben'], sted: 'Hastings', aar: 1895,
    traek: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 d5 exd5 Nxd5 O-O Be6 Bg5 Be7 Bxd5 Bxd5 Nxd5 Qxd5 Bxe7 Nxe7 Re1 f6 Qe2 Qd7 Rac1 c6 d5 cxd5 Nd4 Kf7 Ne6 Rhc8 Qg4 g6 Ng5+ Ke8 Rxe7+ Kf8 Rf7+ Kg8 Rg7+ Kh8 Rxh7+' },
  'rotlewi-rubinstein-1907': { hvid: 'Rotlewi', sort: ['Rubinstein'], sted: 'Łódź', aar: 1907,
    traek: 'd4 d5 Nf3 e6 e3 c5 c4 Nc6 Nc3 Nf6 dxc5 Bxc5 a3 a6 b4 Bd6 Bb2 O-O Qd2 Qe7 Bd3 dxc4 Bxc4 b5 Bd3 Rd8 Qe2 Bb7 O-O Ne5 Nxe5 Bxe5 f4 Bc7 e4 Rac8 e5 Bb6+ Kh1 Ng4 Be4 Qh4 g3 Rxc3 gxh4 Rd2 Qxd2 Bxe4+ Qg2 Rh3',
    usikkert: 'Spillet 26. december 1907 efter den gregorianske kalender; nogle samlinger skriver 1907/08. Łódź hoerte dengang til det russiske kejserrige.' },
  'levitsky-marshall-1912': { hvid: 'Levitsky', sort: ['Marshall'], sted: 'Breslau', aar: 1912,
    traek: 'd4 e6 e4 d5 Nc3 c5 Nf3 Nc6 exd5 exd5 Be2 Nf6 O-O Be7 Bg5 O-O dxc5 Be6 Nd4 Bxc5 Nxe6 fxe6 Bg4 Qd6 Bh3 Rae8 Qd2 Bb4 Bxf6 Rxf6 Rad1 Qc5 Qe2 Bxc3 bxc3 Qxc3 Rxd5 Nd4 Qh5 Ref8 Re5 Rh6 Qg5 Rxh3 Rc5 Qg3',
    usikkert: 'Guldmoenterne er Marshalls egen fortaelling; den er ikke bekraeftet af andre (appen skriver "ifoelge historien").' },
  'larsen-spassky-1970': { hvid: 'Larsen', sort: ['Spasskij'], sted: 'Beograd', aar: 1970,
    traek: 'b3 e5 Bb2 Nc6 c4 Nf6 Nf3 e4 Nd4 Bc5 Nxc6 dxc6 e3 Bf5 Qc2 Qe7 Be2 O-O-O f4 Ng4 g3 h5 h3 h4 hxg4 hxg3 Rg1 Rh1 Rxh1 g2 Rf1 Qh4+ Kd1 gxf1=Q+' },
}

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }

function spil(traek) { const c = new Chess(); for (const s of traek) c.move(s); return c }
const VAERDI = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
function brikker(c, farve) { const u = []; for (const r of c.board()) for (const f of r) if (f && f.color === farve && f.type !== 'k') u.push(f.type); return u.sort().join('') }
function materiale(c) { let s = 0; for (const r of c.board()) for (const f of r) if (f) s += (f.color === 'w' ? 1 : -1) * VAERDI[f.type]; return s }
// Mat i 1 og mat i 2 med skak foerst (kun tvungne linjer), uden det spillede traek.
function matI1(c) { return c.moves().filter((m) => { c.move(m); const r = c.isCheckmate(); c.undo(); return r }) }
function matI2Skak(c) {
  const ud = []
  for (const m of c.moves().filter((s) => /\+/.test(s))) {
    c.move(m)
    const svar = c.moves()
    let alle = svar.length > 0
    for (const s of svar) { c.move(s); const ok = matI1(c).length > 0; c.undo(); if (!ok) { alle = false; break } }
    c.undo()
    if (alle) ud.push(m)
  }
  return ud
}

const ud = { skak: SHA, partier: [] }
for (const p of KENDTE_PARTIER) {
  const ref = REF[p.id]
  const R = { id: p.id, titel: p.titel, hvid: p.hvid, sort: p.sort, sted: p.sted, aar: p.aar }
  ud.partier.push(R)
  if (!ref) { paastaa(`${p.id}: jeg har ingen reference`, false); continue }
  R.usikkert = ref.usikkert ?? null
  const appTraek = [...p.traek.split(' '), ...p.loesning]
  const refTraek = ref.traek.split(' ')
  let foersteForskel = -1
  for (let i = 0; i < appTraek.length; i++) if (appTraek[i] !== refTraek[i]) { foersteForskel = i; break }
  R.traek = { app: appTraek.length, ref: refTraek.length, foersteForskel, elevTraek: Math.ceil(p.loesning.length / 2), startTraek: Math.floor(p.traek.split(' ').length / 2) + 1 }
  paastaa(`${p.id}: alle ${appTraek.length} halvtraek (parti + loesning) = min reference`, foersteForskel === -1 && appTraek.length <= refTraek.length, R.traek)
  paastaa(`${p.id}: spillere, sted og aar = min reference`, p.hvid.includes(ref.hvid) && ref.sort.every((s) => p.sort.includes(s)) && p.sted === ref.sted && p.aar === ref.aar, { hvid: p.hvid, sort: p.sort, sted: p.sted, aar: p.aar })
  paastaa(`${p.id}: historien naevner aar, sted og begge spillere`, p.historie.includes(String(p.aar)) && p.historie.includes(p.sted) && p.historie.includes(ref.hvid.split(' ').at(-1)) && ref.sort.every((s) => p.historie.includes(s) || p.sort.includes(s)))
  const o = kendtPartiOpgave(p)
  R.slutMat = o.mat
  R.slutterSomPartiet = appTraek.length === refTraek.length
  // Andre vindende traek undervejs (kun elevens traek).
  const c = spil(p.traek.split(' '))
  R.alternativer = []
  p.loesning.forEach((san, i) => {
    if (i % 2) { c.move(san); return }
    const sidste = i === p.loesning.length - 1
    const mat1 = matI1(c).filter((m) => m !== san)
    const mat2 = mat1.length ? [] : matI2Skak(c).filter((m) => m !== san)
    if (mat1.length || mat2.length) R.alternativer.push({ halvtraek: i, spillet: san, matI1: mat1, matI2: mat2, sidste, godtages: sidste && mat1.length > 0 })
    c.move(san)
  })
  R.historie = p.historie
}

// Udsagn i historierne, der kan regnes efter.
const P = Object.fromEntries(KENDTE_PARTIER.map((p) => [p.id, p]))
const hele = (id) => [...P[id].traek.split(' '), ...P[id].loesning]
{ // Operaen: mat med et taarn og en loeber (de to brikker han havde tilbage)
  const c = spil(hele('opera-1858'))
  paastaa('opera: Morphy havde kun et taarn og en loeber tilbage (plus bonder) og satte mat', c.isCheckmate() && brikker(c, 'w').replace(/p/g, '') === 'br', brikker(c, 'w'))
}
{ // Det udoedelige: ofrede begge taarne, en loeber og dronningen; mat med tre lette brikker
  const c = spil(hele('udoedelige-1851'))
  paastaa('udoedelige: mat med de tre lette brikker (loeber + to springere), ingen taarne eller dronning tilbage', c.isCheckmate() && brikker(c, 'w').replace(/p/g, '') === 'bnn', brikker(c, 'w'))
}
{ const c = spil(hele('stedsegroenne-1852'))
  const tilbage = brikker(c, 'w').replace(/p/g, '')
  paastaa('stedsegroenne: dronningeofret paa d7 og mat med de to loebere', c.isCheckmate() && P['stedsegroenne-1852'].loesning[0] === 'Qxd7+' && /bb/.test(tilbage), tilbage)
}
{ // Reti: "dobbeltskak fra loeber og taarn gav mat i 11. traek"
  const t = hele('reti-tartakower-1910')
  const c = spil(t.slice(0, 18)); c.move('Bg5+')
  const skakgivere = c.attackers ? c.attackers('c7'.replace('c7', c.board().flat().find((f) => f && f.type === 'k' && f.color === 'b').square), 'w') : null
  const slut = spil(t)
  paastaa('reti: 10.Bg5+ er dobbeltskak (loeber og taarn), og mat kommer i 11. traek', skakgivere && skakgivere.length === 2 && slut.isCheckmate() && Math.ceil(t.length / 2) === 11, { skakgivere, traek: Math.ceil(t.length / 2) })
}
{ // Kongejagten: fra g8 til g1
  const t = hele('lasker-thomas-1912')
  const c = spil(P['lasker-thomas-1912'].traek.split(' '))
  const vej = []
  const kongeSort = (x) => x.board().flat().find((f) => f && f.type === 'k' && f.color === 'b').square
  vej.push(kongeSort(c))
  for (const s of P['lasker-thomas-1912'].loesning) { c.move(s); const k = kongeSort(c); if (k !== vej.at(-1)) vej.push(k) }
  paastaa('kongejagten: den sorte konge gaar fra g8 til g1 og saettes mat', vej[0] === 'g8' && vej.at(-1) === 'g1' && c.isCheckmate(), vej.join('-'))
  const alt = spil(t.slice(0, -1)); paastaa('kongejagten: 18.O-O-O# er ogsaa mat', (() => { try { alt.move('O-O-O'); return alt.isCheckmate() } catch { return false } })())
}
{ // Levitsky-Marshall: dronningen paa g3 kan slaas paa tre maader
  const c = spil(hele('levitsky-marshall-1912'))
  const slag = c.moves({ verbose: true }).filter((m) => m.to === 'g3').map((m) => m.san)
  paastaa('guldmoenterne: dronningen paa g3 kan slaas paa tre maader', slag.length === 3, slag)
}
{ // Larsen: tabte paa 17 traek; Spasskijs taarnoffer paa h1
  const t = hele('larsen-spassky-1970')
  paastaa('larsen: partiet slutter i 17. traek med ...gxf1=D+, taarnofferet er 14...Th1', Math.ceil(t.length / 2) === 17 && t[27] === 'Rh1' && t.at(-1) === 'gxf1=Q+', { traek: Math.ceil(t.length / 2), offer: t[27] })
}
{ // Lasker-Bauer: begge loebere ofres paa h7 og g7
  const l = P['lasker-bauer-1889'].loesning
  paastaa('lasker-bauer: loeberne ofres paa h7 og g7', l[0] === 'Bxh7+' && l[4] === 'Bxg7', l.slice(0, 5))
}
{ // Rubinstein: dronningen staar og slaas (22...Txc3 23.gxh4), taarnoffer paa d2
  const t = P['rotlewi-rubinstein-1907'].traek.split(' ')
  paastaa('rubinstein: 22...Txc3 lader dronningen staa, 23.gxh4 slaar den, 23...Td2 er taarnofferet', t.at(-2) === 'Rxc3' && t.at(-1) === 'gxh4' && P['rotlewi-rubinstein-1907'].loesning[0] === 'Rd2')
}
{ // Steinitz: "taarnet paa e7, som sort ikke kan slaa uden at blive sat mat"
  const t = P['steinitz-bardeleben-1895'].traek.split(' ')
  const c = spil(t); c.move('Rxe7+')
  const slag = c.moves({ verbose: true }).filter((m) => m.to === 'e7').map((m) => m.san)
  // Med dronningen: 22...Dxe7 23.Txc8+ Txc8 24.Dxc8+ (standardanalysen): ingen mat, men sort taber materiale.
  const d = spil(t); d.move('Rxe7+'); d.move('Qxe7'); d.move('Rxc8+'); d.move('Rxc8'); d.move('Qxc8+')
  const foer = materiale(spil(t))
  ud.steinitz = { slagPaaE7: slag, qxe7: { mat: d.isCheckmate(), materialeFoer: foer, materialeEfter: materiale(d) } }
  paastaa('steinitz: taarnet paa e7 kan slaas med dronningen uden mat (sort taber en officer); kun Kxe7 giver mat', slag.includes('Qxe7') && !d.isCheckmate() && materiale(d) - foer >= 3, ud.steinitz)
}
ud.tjek = tjek
writeFileSync(path.join(HERE, 'partier-552.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\npartier-552: ${tjek.length - roede.length}/${tjek.length} ok (skak main ${SHA})`)
for (const p of ud.partier) if (p.alternativer?.length) console.log(p.id, JSON.stringify(p.alternativer))
process.exit(roede.length ? 1 : 0)
