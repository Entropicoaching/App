// KRITIK 548: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-548 og dokumenterne i docs/kritik-548, plus git og lint.
//   node outputs/kritik-548/verify-kritik-548.mjs --blok 1   fejlgenkendelsen (FEJLGENKENDELSE.md)
//   node outputs/kritik-548/verify-kritik-548.mjs --blok 2   blok 1 + LAES-SQUAT og RAPPORT-548
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-548')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-548/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-548', 'grenen er ikke kritik-548')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-548\//.test(f), `uden for docs/kritik-548 og outputs/kritik-548: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-548@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-548 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const f of aendret) ok(!/marc-doedloeft-270-(start|knaehoejde)\.png$/.test(f), `Marcs hele billede er kopieret: ${f}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')
const laes = 'C:/Users/Entropi/Desktop/LAES-SQUAT.html'
ok(existsSync(laes), 'LAES-SQUAT.html mangler paa skrivebordet')

// --- blok 1 --------------------------------------------------------------------------------
const fg = tekst('FEJLGENKENDELSE.md')
const f = json('fejl-548.json')
const s = json('side-548.json')
if (fg) {
  ok(/^fejlgenkendelsen klar til sitet: (ja|nej)\b/.test(fg.split('\n')[0]), 'FEJLGENKENDELSE: foerste linje skal vaere "fejlgenkendelsen klar til sitet: ja/nej"')
  for (const l of ['L6', 'L9', 'L3', 'L7', 'L8']) ok(new RegExp(`^\\| ${l} \\|`, 'm').test(fg), `FEJLGENKENDELSE: ${l} mangler i fund-tabellen`)
  for (const l of ['L1', 'L2', 'L3', 'L4', 'L5']) ok(new RegExp(`^\\| ${l} \\| \\*\\*`, 'm').test(fg), `FEJLGENKENDELSE: ${l} mangler i status-tabellen`)
  for (const h of ['L1-L5 fra 536', 'L6', 'L9', 'Sko med hæl', 'Tæerne ud', 'Det skrå kamera', 'Marcs klip', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(fg), `FEJLGENKENDELSE: afsnit ${h} mangler`)
  ok(!/[\u2013\u2014]/.test(fg), 'FEJLGENKENDELSE: tankestreg')
}
if (f && fg) {
  ok(f.ref === 'ca860bf', `maalt paa ${f.ref}, ikke ca860bf`)
  const A = f.A.regler
  ok(Object.keys(A).length === 7 && Object.values(A).every((r) => Object.keys(r.kamera).length === 10), 'syv regler og ti kameraer')
  const fa = Object.values(A).flatMap((r) => Object.values(r.kamera).flatMap((k) => [k.omhyggelig.falskAlarm, k.typisk.falskAlarm]))
  ok(Math.max(...fa) === 3.4 && fg.includes('højst 3,4 %'), 'falsk alarm hoejst 3,4 %')
  ok(f.D.maksOmh === 1.3 && f.D.maksTyp === 4.7 && fg.includes('højst 1,3 %'), 'L1: banen over gulvet')
  const km = A['sq-kun-knae-midt'].kamera
  ok(km.vinkelret.omhyggelig.fejlMedIngenLinje === 28 && km.skraaM10.typisk.fejlMedIngenLinje === 48, 'L6: kun knaeene ved sticking point med "Ligner ingen"')
  ok(f.H.samme.vinkelret['2']['sq-kun-knae-bund'].fejlIngenLinje > 98 && f.H.samme.vinkelret['1']['sq-kun-knae-bund'].fejlIngenLinje === 92, 'L6: hael')
  ok(f.H.omvendt['2']['sq-hofte-tilbage-bund'].falskAlarm === 52.7 && f.H.omvendt['3']['sq-hofte-tilbage-bund'].falskAlarm === 93, 'L9: feltet og torsoen holdt')
  ok(f.H.flad.vinkelret['2']['sq-kun-knae-bund'].falskAlarm === 30.2, 'L8: feltet paa 0 med 2 cm')
  ok(f.K.forskudt['50']['300'].hint === true && f.K.forskudt['50']['300'].grader === 8.3 && Math.abs(f.K.vinkler.forskudt50.skinneben) < 1, 'L7: forskudt kamera')
  ok(f.T.t1['squat-bund']['30'].normal['ikke:Hoften står for højt til, at billedet er fra bunden.'] > 80 && f.T.t2['squat-bund']['30'].fejl['sq-hofte-tilbage-bund']['ingen'] <= 1, 'taeer ud')
  ok(f.E['yantra-gulv'].status === 'usikker-kamera' && f.E['yantra-gulv-to-nav'].status === 'usikker-fase', 'Marcs gulvbillede')
  ok(f.F.medForbudt.length === 0 && f.F.saetninger.length === 76 && f.F.letterHaelen === 10, 'saetningerne')
}
if (s) {
  ok(s.tjek.length === 16 && s.tjek.every((t) => t.ok), `side-548: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
  for (const p of ['S-390-l1-for-hoejt.png', 'S-390-l2-linje.png', 'S-390-l3-hael-0.png', 'S-390-l6-ligner-ingen.png', 'S-390-l7-forskudt-hint.png', 'S-390-l9-hofte-tilbage.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const l = tekst('LAES-SQUAT.md')
  const r = tekst('RAPPORT-548.md')
  const m = json('laes-548.json')
  if (l) {
    ok(/^LAES-SQUAT hjælper Marc med at vælge: (ja|nej)\b/.test(l.split('\n')[0]), 'LAES-SQUAT.md: foerste linje skal vaere "LAES-SQUAT hjælper Marc med at vælge: ja/nej"')
    ok(!/[\u2013\u2014]/.test(l), 'LAES-SQUAT.md: tankestreg')
    for (const h of ['De ni valg', 'Dhruvas anbefalinger', 'Sammenligningen', 'Marcs egne ord', 'Det siden ikke fortæller', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(l), `LAES-SQUAT.md: afsnit ${h} mangler`)
  }
  if (m) {
    ok(m.tjek && m.tjek.length > 0 && m.tjek.every((t) => t.ok), `laes-548: ${m.tjek ? m.tjek.filter((t) => !t.ok).length : '?'} tjek roede`)
    ok(m.bredder && m.bredder.includes(390) && m.bredder.includes(1280), 'laes-548: 390 og 1280')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 548'), 'RAPPORT: foerste linje skal starte med "Ordre 548"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Yantra', 'Setu']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-548 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-548 --blok ${blok}: groen`)
