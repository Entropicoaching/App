// KRITIK 536: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-536 og dokumenterne i docs/kritik-536, plus git og lint.
//   node outputs/kritik-536/verify-kritik-536.mjs --blok 1   fejlgenkendelsen (FEJLGENKENDELSE.md)
//   node outputs/kritik-536/verify-kritik-536.mjs --blok 2   blok 1 + matematikspillet og RAPPORT-536
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-536')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-536/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-536', 'grenen er ikke kritik-536')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-536\//.test(f), `uden for docs/kritik-536 og outputs/kritik-536: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-536@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-536 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const f of aendret) ok(!/marc-doedloeft-270-(start|knaehoejde)\.png$/.test(f), `Marcs hele billede er kopieret: ${f}`)
// matematik havde allerede Ganitas egne uncommittede aendringer ved start; den laeses kun med git archive.
for (const repo of ['C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva']) {
  ok(sh(`git -C ${repo} status --porcelain --untracked-files=no`).trim() === '', `${repo} har aendringer (maa ikke roeres)`)
}

// --- blok 1 --------------------------------------------------------------------------------
const fg = tekst('FEJLGENKENDELSE.md')
const f = json('fejl-536.json')
const s = json('side-536.json')
if (fg) {
  ok(/^fejlgenkendelsen klar til sitet: (ja|nej)\b/.test(fg.split('\n')[0]), 'FEJLGENKENDELSE: foerste linje skal vaere "fejlgenkendelsen klar til sitet: ja/nej"')
  for (const l of ['L1', 'L2', 'L3', 'L4', 'L5']) ok(new RegExp(`^\\| ${l} \\|`, 'm').test(fg), `FEJLGENKENDELSE: ${l} mangler i fund-tabellen`)
  for (const h of ['L1', 'L2', 'L3', 'Yantras spørgsmål', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(fg), `FEJLGENKENDELSE: afsnit ${h} mangler`)
}
if (f && fg) {
  ok(f.ref === '6d3129e', `maalt paa ${f.ref}, ikke 6d3129e`)
  const A = f.A.regler
  ok(Object.keys(A).length === 7, 'ikke alle syv regler maalt')
  ok(Object.values(A).every((r) => Object.values(r.kamera).every((k) => k.omhyggelig.falskAlarm <= 3.3 && k.typisk.falskAlarm <= 3.3)), 'falsk alarm over 3,3 % et sted (dokumentet siger hoejst 3,3)')
  ok(A['sq-kun-knae-midt'].kamera.haand140.omhyggelig.overset === 57.7 && fg.includes('3,2 / 58'), 'haand140: kun knaeene ved sticking point')
  const d = f.D.doedloeft['dl-gulv']
  ok(d['12']['dl-hofte-foerst'] > 10 && d['16']['dl-hofte-foerst'] > 40 && d['0']['dl-hofte-foerst'] === undefined, 'L1: falsk alarm ved 12 og 16 cm')
  ok(d['0-udenKlik'].gulvAndelOver < -0.25 && Math.abs(d['0-andre'].midtNav) < 0.05 && d['8-fladt'].gulvAndelOver > 0.15, 'L1: perspektivet paa det naere nav')
  ok(f.B.normal['squat-bund']['30']['usikker-fase'] > 80, 'L2: knaeene 30 grader ud')
  ok(f.C.highbar['squat-bund']['6']['sq-kun-knae-bund'] > 50 && f.C.highbar['squat-bund']['4']['sq-kun-knae-bund'] > 15, 'L3: high bar og hael')
  ok(f.E['yantra-gulv'].status === 'ingen' && f.E['bhishak-gulv'].status === 'ingen', 'Marcs gulvbillede giver ikke "ingen"')
  ok(f.F.medForbudt.length === 0 && f.F.saetninger.length === 38 && f.F.maxOrd === 37, 'saetningerne')
}
if (s) {
  ok(s.tjek.length === 9 && s.tjek.every((t) => t.ok), `side-536: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
  for (const p of ['S-360-l1-hoften-foerst.png', 'S-390-l1-hoften-foerst.png', 'S-390-l2-intet.png', 'S-390-l3-kun-knaeene.png', 'S-390-v-hofte-tilbage.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const m = tekst('MATEMATIK-2.md')
  const r = tekst('RAPPORT-536.md')
  const foer = json('elev-536-foer.json')
  const efter = json('elev-536-efter.json')
  if (m) {
    ok(/^matematikspillet føles som et eventyr: (ja|nej)\b/.test(m.split('\n')[0]), 'MATEMATIK-2: foerste linje skal vaere "matematikspillet føles som et eventyr: ja/nej"')
    for (let n = 1; n <= 9; n++) ok(new RegExp(`^\\| M${n} \\|`, 'm').test(m), `MATEMATIK-2: M${n} mangler i tabellen`)
  }
  for (const [n, e] of [['foer', foer], ['efter', efter]]) if (e) {
    ok(e.udgaver && e.udgaver.travl && e.udgaver.foelger, `elev-536-${n}: begge udgaver mangler`)
    ok(e.bredder && e.bredder.includes(390) && e.bredder.includes(1280), `elev-536-${n}: 390 og 1280 ikke begge maalt`)
    ok(e.jsFejl === 0 && e.net === 0, `elev-536-${n}: JS-fejl eller net`)
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 536'), 'RAPPORT: foerste linje skal starte med "Ordre 536"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Yantra', 'Ganita']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-536 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-536 --blok ${blok}: groen`)
