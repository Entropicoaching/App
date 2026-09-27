// KRITIK 552: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-552 og dokumenterne i docs/kritik-552, plus git og lint.
//   node outputs/kritik-552/verify-kritik-552.mjs --blok 1   skakken (SKAK-5.md)
//   node outputs/kritik-552/verify-kritik-552.mjs --blok 2   blok 1 + matematikspillet og RAPPORT-552
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-552')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-552/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const MAT = 'C:/Users/Entropi/Desktop/matematik'

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-552', 'grenen er ikke kritik-552')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utrackede = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utrackede]) ok(/^(docs|outputs)\/kritik-552\//.test(f), `uden for docs/kritik-552 og outputs/kritik-552: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-552@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-552 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
// Skak og matematik laeses kun med `git archive` fra main; Chaturanga og Ganita arbejder i de
// traeer samtidig, saa deres gren og arbejdstrae tjekkes ikke. Kun at main er den, der er maalt.
const skakMain = sh(`git -C ${SKAK} rev-parse --short main`).trim()
const matMain = sh(`git -C ${MAT} rev-parse --short main`).trim()
const docsTekst = ['SKAK-5.md', 'MATEMATIK-3.md', 'RAPPORT-552.md'].filter((f) => existsSync(path.join(DOCS, f))).map((f) => readFileSync(path.join(DOCS, f), 'utf8')).join('\n')
for (const n of navne) ok(!new RegExp(`\\b${n}\\b`, 'i').test(docsTekst), 'et atletnavn staar i docs/kritik-552')
ok(!/[–—]/.test(docsTekst), 'tankestreg i docs/kritik-552')

// --- blok 1: skakken ----------------------------------------------------------------------
const sk = tekst('SKAK-5.md')
const p = json('partier-552.json')
const k = json('skak-552.json')
const r = json('rul-552.json')
const pu = json('pulje-552.json')
if (sk) {
  const [l1, l2] = sk.split('\n')
  ok(/^skakken stadig klar til eleverne: (ja|nej)$/.test(l1), 'SKAK-5: foerste linje skal vaere "skakken stadig klar til eleverne: ja/nej"')
  ok(/^kendte partier er rigtige: (ja|nej)$/.test(l2), 'SKAK-5: anden linje skal vaere "kendte partier er rigtige: ja/nej"')
  for (const n of ['K13', 'K14', 'K15', 'K16', 'K17']) ok(new RegExp(`^\\| ${n} \\| (hoej|middel|lav) \\|`, 'm').test(sk), `SKAK-5: ${n} mangler i fundtabellen med alvor`)
  for (const h of ['Øv et tema', 'Kendte partier: hvert parti', 'Fund', 'Dom', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(sk), `SKAK-5: afsnit ${h} mangler`)
}
if (p && sk) {
  ok(p.tjek.length === 41 && p.tjek.every((t) => t.ok), `partier-552: ${p.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(p.partier.length === 10 && p.partier.every((x) => x.traek.foersteForskel === -1), 'partier: ikke alle ti partier = referencen')
  for (const x of p.partier) ok(sk.includes(String(x.aar)) && sk.includes(x.sted), `SKAK-5: ${x.id} (${x.sted} ${x.aar}) staar ikke i tabellen`)
  ok(p.partier.find((x) => x.id === 'lasker-thomas-1912').alternativer.some((a) => a.matI1.includes('O-O-O#')), 'K14: O-O-O# er ikke fundet som alternativ')
  ok(p.steinitz.qxe7.mat === false, 'K15: Dxe7 giver mat ifoelge maalingen')
  ok(sk.includes(`@ \`${p.skak}\``), 'SKAK-5: skaks commit passer ikke med maalingen')
}
if (k) {
  ok(k.tjek.length === 41 && k.tjek.every((t) => t.ok), `skak-552: ${k.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok([360, 390, 1280].every((b) => k.bredder.includes(b) && k[b].partier.length === 10 && k[b].temaer.length === 12), 'skak: 360, 390 og 1280 ikke alle maalt')
  ok(k.bredder.every((b) => !k[b].net.length && !k[b].fejl.length), 'skak: net eller JS-fejl')
  ok(k.bredder.every((b) => /Præcis sådan spillede Edward Lasker/.test(k[b].partier.find((x) => x.id === 'lasker-thomas-1912').slut)), 'K14: beskeden efter O-O-O# er ikke maalt')
  ok(k.skak === p?.skak && k.skak === skakMain, 'skak og partier ikke maalt paa skak main')
}
if (r) {
  ok(!r[360].braetISyne && !r[390].braetISyne && r[360].skaerme >= 1 && r[390].skaerme >= 1, 'K13: braettet er paa skaermen efter trykket paa telefonen (fundet holder ikke)')
  ok(!r[360].tema.braetISyne && !r[390].tema.braetISyne, 'K13: braettet er paa skaermen efter "Oev gafler" paa telefonen')
  ok(sk && sk.includes(`${String(r[360].skaerme).replace('.', ',')} skærme`) && sk.includes(`${String(r[390].skaerme).replace('.', ',')} skærme`), 'SKAK-5: K13-tallene passer ikke med rul-552.json')
  for (const b of [360, 390, 1280]) ok(existsSync(path.join(HERE, `K-${b}-4-efter-tryk.png`)) && existsSync(path.join(HERE, `K-${b}-5-efter-tema.png`)), `K-${b}-4/5 mangler`)
}
if (pu) {
  const lav = Object.entries(pu.temaer).filter(([, t]) => t.andelFraLichessTemaer < 20).map(([n]) => n)
  ok(lav.length === 6, `K17: ${lav.length} temaer med under 20 % nye gaader (forventet 6)`)
}

// --- blok 2: matematikspillet ---------------------------------------------------------------
if (blok >= 2) {
  const m = tekst('MATEMATIK-3.md')
  const rp = tekst('RAPPORT-552.md')
  const foer = json('elev-552-foer-525.json')
  const efter = json('elev-552-efter-525.json')
  if (foer && efter) {
    ok(foer.spil === 'e085b2b', `foer-koerslen er paa ${foer.spil}, ikke e085b2b`)
    ok(efter.spil === matMain, 'efter-koerslen er ikke paa matematik main')
    ok(foer.net === 0 && efter.net === 0 && foer.jsFejl === 0 && efter.jsFejl === 0, 'elev: net eller JS-fejl')
    ok(efter.dag3.length === 2 && efter.dag3.every((d) => d.steder.length === 3 && d.steder.every((s) => s.ankomst)), 'dag 3: ikke alle tre ankomster laest paa 390 og 1280')
    ok(efter.dag3.every((d) => d.steder.every((s) => s.ankomstEfterSvar === false)), 'dag 3: en ankomst staar stadig efter foerste svar')
  }
  for (const s of [7, 42, 1234]) for (const t of ['foer', 'efter']) { const x = json(`elev-552-${t}-${s}.json`); if (x) ok(x.seed === s && x.net === 0 && x.jsFejl === 0, `elev-552-${t}-${s}: net, fejl eller forkert terning`) }
  if (m) {
    ok(/^matematikspillet foeles stadig som et eventyr: (ja|nej)$/.test(m.split('\n')[0]), 'MATEMATIK-3: foerste linje skal vaere "matematikspillet foeles stadig som et eventyr: ja/nej"')
    for (const n of ['M8', 'M9', 'M5', 'N2']) ok(new RegExp(`^## ${n}`, 'm').test(m), `MATEMATIK-3: afsnit ${n} mangler`)
    for (const h of ['Ankomsterne', 'Marcs to valg', 'Fund', 'Dom', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(m), `MATEMATIK-3: afsnit ${h} mangler`)
    for (const mm of m.matchAll(/^\| (N[3-9]|M1[0-9]) \| ([^|]+) \|/gm)) ok(/^(hoej|middel|lav)$/.test(mm[2].trim()), `MATEMATIK-3: ${mm[1]} uden alvor`)
  }
  if (rp) {
    ok(rp.split('\n')[0] === 'Ordre 552', 'RAPPORT: foerste linje skal vaere "Ordre 552"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(rp), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = rp.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Chaturanga', 'Ganita']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(/skakken stadig klar til eleverne: (ja|nej)/.test(rp) && /kendte partier er rigtige: (ja|nej)/.test(rp) && /matematikspillet foeles stadig som et eventyr: (ja|nej)/.test(rp), 'RAPPORT: de tre domme mangler')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-552 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.error(' - ' + f); process.exit(1) }
console.log(`verify-kritik-552 --blok ${blok}: groen`)
