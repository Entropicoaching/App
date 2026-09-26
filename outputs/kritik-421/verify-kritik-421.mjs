// ORDRE 421: verify:kritik-421 (afloeser verify:kritik-409, der blev roed da B1/B2 blev rettet).
// Ingen skak-mappe, intet netvaerk: kun de gemte maalinger mod skak/main 8aa76ba.
//   1. B1 kan ikke genskabes: de fire dyre svar fra 409 (sm07 Dg4+, sm03 Td3,
//      sm08 Tc6, sm02 Kg7) afvises i browseren med "det koster dig en brik",
//      pilen kommer foerst paa andet hint-tryk, og i HELE Stop matten-banken
//      (dybde-4-soegning) godtages intet svar der taber 2 eller mere mod det
//      bedste, og pilen (godeFoerste[0]) er altid et af de bedste.
//   2. B2 kan ikke genskabes: ALLE Laer skak-stillinger (fen, demoFen, spilFen)
//      regnet efter med en egen angrebs-regner (alle brikker): siden der ikke er
//      i traek staar aldrig i skak. Regneren fanger stadig de to 409-stillinger.
//      I browseren: dronning-trinnet har kun dronningen, trin 23 har kongen paa h8.
//   3. Blok 2 (naar den findes): KRITIK-bibliotek-2 og RAPPORT-421.
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}

// ---------- 1. B1 ----------
const DYRE_409 = { sm07: 'd1g4', sm03: 'd2d3', sm08: 'c7c6', sm02: 'h8g7' }
const sm = json('stopmatten-421.json')
if (sm) {
  ok(sm.sidefejl.length === 0, `B1: sidefejl ${sm.sidefejl.join(' | ')}`)
  for (const [id, uci] of Object.entries(DYRE_409)) {
    const t = sm.tilfaelde.find((x) => x.oevelse === id)
    if (!t) { fejl.push(`B1: ${id} ikke maalt`); continue }
    ok(!t.godeFoerste.includes(uci), `B1 GENSKABT: ${id} ${uci} godtages igen`)
    ok(t.dyre.includes(uci), `B1: ${id} ${uci} staar ikke som dyrt svar`)
    ok(!/^Løst!/.test(t.svar.besked) && /koster dig/.test(t.svar.besked), `B1 GENSKABT: ${id} ${uci} giver "${t.svar.besked}"`)
    ok(t.hint1.ring === 1 && t.hint1.pil === 0 && t.hint1.knap === 'Vis trækket', `B1/B5: ${id} foerste hint-tryk er ikke tip + ring`)
    ok(t.hint2 && t.hint2.pil > 0, `B1/B5: ${id} andet hint-tryk viser ingen pil`)
  }
}
const bank = json('bank-421.json')
if (bank) {
  ok(bank.dybde >= 4, `B1: bank-soegningen er kun dybde ${bank.dybde}`)
  ok(bank.B1.length >= 8, `B1: kun ${bank.B1.length} Stop matten-oevelser i banken`)
  for (const o of bank.B1) {
    const v = Object.fromEntries(o.stopper.map((s) => [s.uci, s.materiale]))
    for (const g of o.godeFoerste) {
      ok(g in v, `B1: ${o.id} godtager ${g}, som ikke stopper matten`)
      ok(v[g] >= o.bedst - 1, `B1 GENSKABT: ${o.id} godtager ${g} (${v[g]}) mod bedste ${o.bedst}`)
    }
    ok(v[o.godeFoerste[0]] === o.bedst, `B1 GENSKABT: ${o.id} pilen viser ${o.godeFoerste[0]} (${v[o.godeFoerste[0]]}), ikke det bedste (${o.bedst})`)
    if (DYRE_409[o.id]) ok(!o.godeFoerste.includes(DYRE_409[o.id]), `B1 GENSKABT: ${o.id} ${DYRE_409[o.id]} i godeFoerste`)
  }
}

// ---------- 2. B2 ----------
function braet(fen) {
  const b = {}
  fen.split(' ')[0].split('/').forEach((r, i) => {
    let f = 0
    for (const ch of r) {
      if (/\d/.test(ch)) f += Number(ch)
      else { b[String.fromCharCode(97 + f) + (8 - i)] = ch; f += 1 }
    }
  })
  return b
}
// Er <felt> angrebet af <af> ('w'/'b')? Alle brikker, egen regner (ikke chess.js).
function angrebet(fen, felt, af) {
  const b = braet(fen)
  const fx = felt.charCodeAt(0) - 97, ry = Number(felt[1])
  const paa = (f, r) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? b[String.fromCharCode(97 + f) + r] : undefined)
  const egen = (ch, t) => ch && ch === (af === 'w' ? t.toUpperCase() : t)
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (egen(paa(fx + df, ry + dr), 'k')) return true
    let f = fx + df, r = ry + dr
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      const ch = paa(f, r)
      if (ch) {
        if (egen(ch, 'q') || (egen(ch, 'r') && (!df || !dr)) || (egen(ch, 'b') && df && dr)) return true
        break
      }
      f += df; r += dr
    }
  }
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) if (egen(paa(fx + df, ry + dr), 'n')) return true
  const bondeRetning = af === 'w' ? -1 : 1 // en hvid bonde paa raekke r-1 slaar op til r
  for (const df of [-1, 1]) if (egen(paa(fx + df, ry + bondeRetning), 'p')) return true
  return false
}
const kongeFelt = (fen, farve) => Object.entries(braet(fen)).find(([, ch]) => ch === (farve === 'w' ? 'K' : 'k'))?.[0]
const ulovlig = (fen) => {
  const ikke = fen.split(' ')[1] === 'w' ? 'b' : 'w'
  const k = kongeFelt(fen, ikke)
  return k ? angrebet(fen, k, ikke === 'w' ? 'b' : 'w') : false
}
// Regneren fanger stadig 409-fejlene (ellers beviser en groen kørsel intet).
ok(ulovlig('7k/8/8/8/3Q4/8/8/4K3 w - - 0 1') && ulovlig('k7/8/8/8/8/8/1P6/R3K3 w Q - 0 1'), 'B2-kontrol: regneren fanger ikke de to 409-stillinger')
ok(ulovlig('4k3/8/3N4/8/8/8/8/4K3 w - - 0 1') && ulovlig('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1'), 'B2-kontrol: regneren fanger ikke springer/bonde-skak')
ok(!ulovlig('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'B2-kontrol: rokade-trinnet regnes som ulovligt')
if (bank) {
  ok(bank.B2.length >= 30, `B2: kun ${bank.B2.length} Laer skak-stillinger tjekket`)
  for (const s of bank.B2) {
    ok(!ulovlig(s.fen), `B2 GENSKABT: ${s.trin} ${s.felt} ${s.fen} - siden der ikke er i traek staar i skak`)
    ok(s.ikkeITraekISkak !== true && !String(s.ikkeITraekISkak).startsWith('fejl'), `B2: chess.js siger ${s.trin} ${s.felt} er ulovlig (${s.ikkeITraekISkak})`)
  }
}
const elev = json('elev-421.json')?.resultat
if (elev) {
  ok(elev.sidefejl.length === 0, `elev: sidefejl ${elev.sidefejl.join(' | ')}`)
  const tr = (navn) => elev.laer.find((t) => t.navn === navn)
  const dronning = tr('dronningen')
  ok(dronning && dronning.foer.brikker.join() === 'd4', `B2: dronning-trinnet har brikkerne ${dronning?.foer.brikker}`)
  ok(dronning && /færrest mulige/.test(dronning.forsoeg.at(-1).besked), 'B2: dronning-trinnet blev ikke gennemfoert som stjerne-trin')
  const aabne = tr('princip aabne linjer')
  ok(aabne && aabne.foer.brikker.includes('h8') && !aabne.foer.brikker.includes('a8') && aabne.foer.iSkak.length === 0, 'B2 GENSKABT: trin 23 har kongen paa a8 / i skak')
  ok(aabne && /c-linjen er helt åben/.test(aabne.forsoeg.at(-1).besked), 'B2: trin 23 blev ikke gennemfoert')
  ok(elev.laer.every((t) => t.forsoeg.every((f) => !/^Du er sort/.test(f.tekst ?? ''))), 'B7 GENSKABT: "Du er sort" efter elevens traek')
  ok(elev.laer.filter((t) => t.foer.brikker.length === 1 && /Kongen|Dronningen|Tårnet|Løberen|Springeren|Bonden/.test(t.foer.titel)).length >= 6, 'Laer skak: stjerne-trinnene blev ikke alle koert')
}

// ---------- 3. blok 2 ----------
const kritikSti = path.join(ROOT, 'docs/kritik-421/KRITIK-bibliotek-2.md')
const rapportSti = path.join(ROOT, 'docs/kritik-421/RAPPORT-421.md')
if (existsSync(kritikSti)) {
  const kritik = readFileSync(kritikSti, 'utf8')
  ok(/^klar til klassen: (ja|nej), fordi/im.test(kritik), 'KRITIK-bibliotek-2 mangler linjen "klar til klassen: ja/nej, fordi"')
  for (let i = 1; i <= 10; i++) ok(kritik.includes(`B${i}`), `KRITIK-bibliotek-2 mangler status for B${i}`)
  const time = json('time-421.json')
  if (time) ok(time.sidefejl.length === 0, `blok 2: sidefejl i timen ${time.sidefejl.join(' | ')}`)
}
if (existsSync(rapportSti)) {
  const rapport = readFileSync(rapportSti, 'utf8').replace(/\r/g, '')
  ok(rapport.split('\n')[0].trim() === 'Ordre 421', 'RAPPORT-421.md skal starte med "Ordre 421"')
  for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rapport.includes(a), `RAPPORT-421.md mangler "${a}"`)
}

if (fejl.length) {
  console.error(`verify:kritik-421 ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log(`verify:kritik-421 GROEN: B1 og B2 kan ikke genskabes (${bank.B1.length} Stop matten-oevelser paa dybde ${bank.dybde}, ${bank.B2.length} Laer skak-stillinger, 4 dyre svar afvist i browseren)${existsSync(rapportSti) ? ', blok 2-dokumenterne i orden' : ''}.`)
