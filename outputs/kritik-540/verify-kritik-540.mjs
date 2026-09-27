// KRITIK 540: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-540 og dokumenterne i docs/kritik-540, plus git og lint.
//   node outputs/kritik-540/verify-kritik-540.mjs --blok 1   squat-artiklen (SQUAT.md)
//   node outputs/kritik-540/verify-kritik-540.mjs --blok 2   blok 1 + skakken og RAPPORT-540
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-540')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-540/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-540', 'grenen er ikke kritik-540')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-540\//.test(f), `uden for docs/kritik-540 og outputs/kritik-540: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-540@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-540 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const repo of ['C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva', 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2', 'C:/Users/Entropi/Desktop/skak']) {
  ok(sh(`git -C ${repo} status --porcelain --untracked-files=no`).trim() === '', `${repo} har aendringer (maa ikke roeres)`)
}
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --abbrev-ref HEAD').trim() === 'vaerktoejer', 'sitets trae er skiftet vaek fra vaerktoejer')
const docsTekst = ['SQUAT.md', 'SKAK-4.md', 'RAPPORT-540.md'].filter((f) => existsSync(path.join(DOCS, f))).map((f) => readFileSync(path.join(DOCS, f), 'utf8')).join('\n')
for (const n of navne) ok(!new RegExp(`\\b${n}\\b`, 'i').test(docsTekst), 'et atletnavn staar i docs/kritik-540')

// --- blok 1 --------------------------------------------------------------------------------
const sq = tekst('SQUAT.md')
const s = json('squat-540.json')
if (sq) {
  ok(/^squat-artiklen klar naar Marc har valgt: (ja|nej)\b/.test(sq.split('\n')[0]), 'SQUAT: foerste linje skal vaere "squat-artiklen klar naar Marc har valgt: ja/nej"')
  for (const u of ['U17', 'U18', 'U19', 'U20']) ok(new RegExp(`^\\| ${u} \\| (hoej|middel|lav) \\|`, 'm').test(sq), `SQUAT: ${u} mangler i fundtabellen med alvor`)
  for (const h of ['Kapitel 3', 'Kapitel 7', 'U12 og U15', 'Marcs stilregler', 'Dom', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(sq), `SQUAT: afsnit ${h} mangler`)
  ok(!/[–—]/.test(sq), 'SQUAT: tankestreg')
}
if (s && sq) {
  ok(s.top === '9390990', `squat maalt paa ${s.top}, ikke 9390990`)
  ok(s.tjek.length === 24 && s.tjek.every((t) => t.ok), `squat-540: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(sq.includes(`@ \`${s.loeftmodelMain}\``), 'SQUAT: loeftmodellens commit passer ikke med maalingen')
  ok(s.sider.map((x) => x.bredde).join() === '390,1280' && s.sider.every((x) => x.vandret && !x.tankestreger && !x.atletnavne && !x.sidefejl.length), 'squat: 390 og 1280')
  ok(s.fund.U18.iModellen === 8 && s.fund.U17.tekst && !s.fund.U19.u12NaevnerKap6 && s.fund.U20.minKropSomVaerktoej, 'squat: fundene holder ikke')
  for (const p of ['S-390-u12.png', 'S-1280-u12.png', 'S-390-kap3-tabel.png', 'S-390-kap7-kun-knaeene.png', 'S-390-u15.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const k = json('skak-540.json')
  const sk = tekst('SKAK-4.md')
  const r = tekst('RAPPORT-540.md')
  if (sk) {
    ok(/^skakken stadig klar til eleverne: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK-4: foerste linje skal vaere "skakken stadig klar til eleverne: ja/nej"')
    for (const n of ['K4', 'K6', 'K7', 'K8', 'K9', 'K10', 'K11']) ok(new RegExp(`^\\| ${n} \\|`, 'm').test(sk), `SKAK-4: ${n} mangler i tabellen`)
    for (const m of sk.matchAll(/^\| (K1[2-9]) \| ([^|]+) \|/gm)) ok(/^(hoej|middel|lav)$/.test(m[2].trim()), `SKAK-4: ${m[1]} uden alvor`)
    ok(!/[–—]/.test(sk), 'SKAK-4: tankestreg')
  }
  if (k) {
    ok(k.tjek.length > 0 && k.tjek.every((t) => t.ok), `skak-540: ${k.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok([360, 390, 1280].every((b) => k.bredder.includes(b)), 'skak: 360, 390 og 1280 ikke alle maalt')
    ok(k.net === 0 && k.jsFejl === 0, 'skak: net eller JS-fejl')
    ok(sk && sk.includes(k.sha), 'SKAK-4: skaks commit staar ikke i dokumentet')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 540'), 'RAPPORT: foerste linje skal starte med "Ordre 540"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Setu', 'Chaturanga']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(/squat-artiklen klar naar Marc har valgt: (ja|nej)/.test(r) && /skakken stadig klar til eleverne: (ja|nej)/.test(r), 'RAPPORT: de to domme mangler')
    ok(!/[–—]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-540 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.error(' - ' + f); process.exit(1) }
console.log(`verify-kritik-540 --blok ${blok}: groen`)
