// KRITIK 517: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-517 og dokumenterne i docs/kritik-517, plus git og lint.
//   node outputs/kritik-517/verify-kritik-517.mjs --blok 1   Maal dit billede (MAAL-BILLEDE-3.md)
//   node outputs/kritik-517/verify-kritik-517.mjs --blok 2   blok 1 + skakken og RAPPORT-517
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-517')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-517/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-517', 'grenen er ikke kritik-517')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-517\//.test(f), `uden for docs/kritik-517 og outputs/kritik-517: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-517@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-517 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const f of aendret) ok(!/marc-doedloeft-270-(start|knaehoejde)\.png$/.test(f), `Marcs hele billede er kopieret: ${f}`)
for (const repo of ['C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva', 'C:/Users/Entropi/Desktop/skak']) {
  ok(sh(`git -C ${repo} status --porcelain --untracked-files=no`).trim() === '', `${repo} har aendringer (maa ikke roeres)`)
}

// --- blok 1 --------------------------------------------------------------------------------
const mb = tekst('MAAL-BILLEDE-3.md')
const m = json('maal-side-517.json')
if (mb) {
  ok(/^Mål dit billede klar til sitet: (ja|nej)\b/.test(mb.split('\n')[0]), 'MAAL-BILLEDE-3: foerste linje skal vaere "Mål dit billede klar til sitet: ja/nej"')
  for (const b of ['B11', 'B12', 'B13']) ok(new RegExp(`^\\| ${b} \\|`, 'm').test(mb), `MAAL-BILLEDE-3: ${b} mangler i en tabel`)
  for (let n = 1; n <= 3; n++) ok(new RegExp(`^${n}\\. \\*\\*`, 'm').test(mb), `MAAL-BILLEDE-3: svar paa Yantras spoergsmaal ${n} mangler`)
}
if (m && mb) {
  ok(m.ref === '7f604f7', 'maalt paa en anden commit end 7f604f7')
  ok(m.tjek.length === 20 && m.tjek.every((t) => t.ok), `maal-side-517: ${m.tjek.filter((t) => !t.ok).length} tjek roede`)
  const f = m.faser
  const faser = ['squat-bund', 'squat-midt', 'dl-gulv', 'dl-knae', 'baenk-bryst', 'baenk-midt']
  ok(faser.every((x) => ['kg', 'udenKg'].every((k) => f[`390-${x}-${k}`].side === 390 && f[`390-${x}-${k}`].tabel === 358)), 'B11: 390/358 i alle faser')
  const s360 = faser.map((x) => f[`360-${x}-kg`].side).join(), s375 = faser.map((x) => f[`375-${x}-kg`].side).join()
  ok(s360 === '387,387,377,385,360,360' && s375 === '388,388,377,385,375,375', `B13: siderne paa 360/375 er aendret (${s360} / ${s375})`)
  ok(mb.includes('**387** / 328 / 371') && mb.includes('**388** / 343 / 371'), 'B13: tallene staar ikke i dokumentet')
  ok(m.marc['390-knaehoejde'].maerke.tekst === '(stangen 31 cm under knæet)' && mb.includes('Knæ 119,6° (stangen 31 cm under knæet)'), 'B12: maerket')
  ok(m.foerEfter['390-skraa10'].side === 395 && /−13,3 cm/.test(m.foerEfter['390-skraa10'].saetning) && mb.includes('−13,3 cm'), 'E2/E6: skraa10 395 px og -13,3 cm')
  ok(/knæet mere bøjet \(knævinkel −6,6°\) og torsoen mere oprejst/.test(m.foerEfter['390-aendring507'].saetning), 'E5: saetningen i ord')
  for (const p of ['M-360-squat-tallinje-min-krop.png', 'M-390-marc-tallinje.png', 'M-390-tabel-dl-gulv.png', 'M-390-saetning-skraa10.png', 'M-390-saetning-aendring507.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-517.json')
  const sk = tekst('SKAK-HJEMME.md')
  const r = tekst('RAPPORT-517.md')
  if (sk) {
    ok(/^skakken hjemme god nok til at anbefale til en elev: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK-HJEMME: foerste linje skal vaere "skakken hjemme god nok til at anbefale til en elev: ja/nej"')
    ok(/^\| K1 \|/m.test(sk), 'SKAK-HJEMME: K1 mangler')
  }
  if (s && sk) {
    ok(s.tjek.length > 0 && s.tjek.every((t) => t.ok), `skak-517: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
    const kN = [...sk.matchAll(/^\| (K\d+) \|/gm)].map((x) => x[1])
    for (const k of kN) ok(new RegExp(`\\b${k}\\b`).test(r || ''), `RAPPORT: ${k} naevnes ikke`)
    ok(s.bredder.includes(390) && s.bredder.includes(1280), 'skak: 390 og 1280 ikke begge maalt')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 517'), 'RAPPORT: foerste linje skal starte med "Ordre 517"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    for (const n of ['Yantra', 'Setu', 'Chaturanga']) ok(r.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-517 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.error(' - ' + f); process.exit(1) }
console.log(`verify-kritik-517 --blok ${blok}: groen`)
