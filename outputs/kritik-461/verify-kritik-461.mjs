// ORDRE 461: verify:kritik-461. Intet netvaerk og ingen skak-mappe; kun de gemte
// maalinger (lavet mod skak-main 1791bc0) og dokumenterne.
//   node outputs/kritik-461/verify-kritik-461.mjs 1   blok 1 (eleven)
//   node outputs/kritik-461/verify-kritik-461.mjs 2   blok 1 + blok 2 (standard; npm run verify:kritik-461)
//
// Blok 1: 30 partier pr. niveau og elev i Node, mindst 6 browserpartier paa 390 og
//   1280 mod niveau 1-3, mindst 20 vendepunkter laest og regnet igen i dybde 6,
//   appen og vendepunkter.js siger det samme, makkerpartiet paa begge bredder, og
//   ELEV-461 skriver de tal, JSON'en siger (vinderprocenter, "X af N rigtige" osv.).
// Blok 2: skaktimen med 11 elever er groen i sine egne tjek, KRITIK-skaktime har
//   fundene oeverst og een linje "klar til en skaktime: ja/nej, fordi", dommen
//   passer til fundenes alvor, og RAPPORT-461 har de fem afsnit med alle fund til
//   Chaturanga under "Hvad er naeste".
// Exit 1 ved fejl.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HER = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HER, '..', '..', 'docs', 'kritik-461')
const MAIN = '1791bc0'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HER, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-461/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const png = new Set(readdirSync(HER).filter((f) => f.endsWith('.png')))
const afsnit = (t, navn) => {
  const i = t.indexOf(`## ${navn}`)
  if (i < 0) return null
  const j = t.indexOf('\n## ', i + 3)
  return t.slice(i, j < 0 ? undefined : j)
}

// ---------- blok 1 ----------
const node = json('elev-node-461.json')
const br = json('elev-browser-461.json')
const dyb = json('vendepunkter-dyb-461.json')
const start = json('spil-start-461.json')
const elev = tekst('ELEV-461.md')
if (node) {
  ok(node.skakMain === MAIN, `elev-node: maalt mod skak ${node.skakMain}, ventet ${MAIN}`)
  const r = Object.values(node.tabel)
  ok(r.length === 9 && r.every((x) => x.partier >= 30), 'elev-node: 3 niveauer x 3 elever x mindst 30 partier')
  if (elev) {
    for (const k of ['1-ny', '2-ny', '3-ny', '1-oevet', '2-oevet', '3-oevet']) {
      const x = node.tabel[k]
      ok(elev.includes(`${x.vundet} af ${x.partier}`), `ELEV-461: naevner ikke "${x.vundet} af ${x.partier}" (${k} vundet)`)
    }
    const n1 = node.tabel['1-ny']
    ok(elev.includes(`${n1.elev.foerMed9} af ${n1.partier}`) && elev.includes(`${n1.ikkeAfgjort} af ${n1.partier}`), 'ELEV-461: naevner ikke hvor tit den nye elev kom +9 foran / ikke blev faerdig mod niveau 1')
  }
}
if (br) {
  ok(br.skakMain === MAIN, `elev-browser: maalt mod skak ${br.skakMain}`)
  const p = br.partier ?? []
  ok(p.length >= 6, `elev-browser: ${p.length} partier, ventet mindst 6`)
  for (const b of [390, 1280]) for (const n of [1, 2, 3]) ok(p.some((x) => x.bredde === b && x.niveau === n), `elev-browser: intet parti paa ${b} px mod niveau ${n}`)
  const vp = p.reduce((a, x) => a + x.vendepunkter.punkter.length, 0)
  ok(vp >= 20, `elev-browser: ${vp} vendepunkter, ventet mindst 20`)
  ok(p.every((x) => x.nodeSigerSamme), 'elev-browser: appens vendepunkter afviger fra vendepunkter.js i Node')
  ok(p.every((x) => !x.tabtSpor), 'elev-browser: scriptet mistede sporet af et parti')
  ok(p.every((x) => png.has(`b1-${x.bredde}-parti${x.nr}-niveau${x.niveau}-resultat.png`)), 'elev-browser: skaermbillede af et resultat mangler')
  ok((br.makker ?? []).length === 2 && br.makker.every((m) => png.has(`b1-${m.bredde}-makker.png`)), 'elev-browser: makkerpartiet mangler paa en bredde')
  ok((br.traenKnap ?? []).length === 2, 'elev-browser: Traen-knappen er ikke proevet paa begge bredder')
  ok(br.sidefejl.length === 0 && br.netvaerk.length === 0, 'elev-browser: sidefejl eller netvaerk')
  if (dyb) {
    ok(dyb.skakMain === MAIN && dyb.dybde === 6, 'vendepunkter-dyb: ikke dybde 6 mod skak-main')
    ok(dyb.sum.antal === vp, `vendepunkter-dyb: ${dyb.sum.antal} regnet igen, men ${vp} laest i browseren`)
    if (elev) {
      const s = dyb.sum
      ok(elev.includes(`${s.rigtige} af ${s.antal} vendepunkter er rigtige`), `ELEV-461: skal skrive "${s.rigtige} af ${s.antal} vendepunkter er rigtige"`)
      ok(elev.includes(`${s.bedreGode} af ${s.antal}`), `ELEV-461: skal naevne "${s.bedreGode} af ${s.antal}" (bedre traek)`)
      ok(elev.includes(`${s.kompetenceEnig} af ${s.antal}`), `ELEV-461: skal naevne "${s.kompetenceEnig} af ${s.antal}" (kompetence)`)
      ok(elev.includes(`${s.skjultGevinst} af ${s.tabtBrik}`), `ELEV-461: skal naevne "${s.skjultGevinst} af ${s.tabtBrik}" (skjult gevinst)`)
      // Tabellen: een raekke pr. vendepunkt.
      const raekker = elev.split('\n').filter((l) => /^\| *\d+ *\|/.test(l)).length
      ok(raekker === s.antal, `ELEV-461: tabellen har ${raekker} raekker, ventet ${s.antal}`)
    }
  }
}
if (start) ok(Object.keys(start.bredder).length === 2, 'spil-start: mangler en bredde')
if (elev) ok(/^## Fund\n/m.test(elev) && /\bE1\b/.test(elev.slice(0, elev.indexOf('## ', elev.indexOf('## Fund') + 3))), 'ELEV-461: fundene (E1 ...) skal staa oeverst under "## Fund"')

// ---------- blok 2 ----------
if (blok >= 2) {
  const st = json('skaktime-461.json')
  if (st) {
    ok(st.skakMain === MAIN, 'skaktime: ikke maalt mod skak-main')
    ok(st.fejl.length === 0, `skaktime: ${st.fejl.length} tjek fejlede (${st.fejl.join(' | ')})`)
    ok(st.C.turneringer === 300 && st.C.omkampe === 0 && st.C.fejl.length === 0, 'skaktime: parringstesten med 300 turneringer')
    for (const f of ['b2-1920-projektor-runde1.png', 'b2-1920-projektor-stilling-trae.png', 'b2-1920-projektor-lange-navne.png', 'b2-1280-laerer-slut.png']) ok(png.has(f), `skaktime: ${f} mangler`)
  }
  const k = tekst('KRITIK-skaktime.md')
  if (k) {
    const t1 = k.indexOf('T1')
    const andet = k.search(/^## (?!Fund)/m)
    ok(t1 > 0 && (andet < 0 || t1 < andet), 'KRITIK-skaktime: T1 skal staa oeverst (i "## Fund" foer andre afsnit)')
    const domme = k.match(/^klar til en skaktime: (ja|nej), fordi .+$/gm) ?? []
    ok(domme.length === 1, `KRITIK-skaktime: ${domme.length} linjer "klar til en skaktime: ja/nej, fordi", ventet 1`)
    const blokerer = (k.match(/^- \*\*[TE]\d+[^\n]*\(blokerer\)/gm) ?? []).length
    if (domme.length === 1) {
      const ja = /: ja,/.test(domme[0])
      ok(ja ? blokerer === 0 : blokerer > 0, `KRITIK-skaktime: dommen (${ja ? 'ja' : 'nej'}) passer ikke til ${blokerer} blokerende fund`)
    }
  }
  const r = tekst('RAPPORT-461.md')
  if (r) {
    ok(r.split('\n')[0].trim() === 'Ordre 461', 'RAPPORT-461: foerste linje skal vaere "Ordre 461"')
    for (const a of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(afsnit(r, a) !== null, `RAPPORT-461: afsnittet "${a}" mangler`)
    const naeste = afsnit(r, 'Hvad er næste') ?? ''
    ok(/Chaturanga/.test(naeste), 'RAPPORT-461: "Hvad er naeste" skal sende fundene til Chaturanga')
    const alle = new Set([...(k ?? '').matchAll(/\*\*([TE]\d+)\b/g), ...(elev ?? '').matchAll(/\*\*(E\d+)\b/g)].map((m) => m[1]))
    for (const id of alle) ok(new RegExp(`\\b${id}\\b`).test(naeste), `RAPPORT-461: fund ${id} mangler under "Hvad er naeste"`)
  }
}

if (fejl.length) {
  console.log(`verify:kritik-461 blok ${blok}: ${fejl.length} fejl\n- ${fejl.join('\n- ')}`)
  process.exit(1)
}
console.log(`verify:kritik-461 blok ${blok}: groen`)
