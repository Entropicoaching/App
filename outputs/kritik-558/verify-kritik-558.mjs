// KRITIK 558: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-558 og dokumenterne i docs/kritik-558, plus git og lint.
//   node outputs/kritik-558/verify-kritik-558.mjs --blok 1   fejlgenkendelsen (FEJLGENKENDELSE.md)
//   node outputs/kritik-558/verify-kritik-558.mjs --blok 2   blok 1 + skakken (SKAK-6.md) og RAPPORT-558
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-558')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-558/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-558', 'grenen er ikke kritik-558')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-558\//.test(f), `uden for docs/kritik-558 og outputs/kritik-558: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-558@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-558 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const f of aendret) ok(!/marc-doedloeft-270-(start|knaehoejde)\.png$/.test(f), `Marcs hele billede er kopieret: ${f}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')

// --- blok 1 --------------------------------------------------------------------------------
const fg = tekst('FEJLGENKENDELSE.md')
const f = json('fejl-558.json')
const s = json('side-558.json')
if (fg) {
  ok(/^fejlgenkendelsen klar til sitet: (ja|nej)\b/.test(fg.split('\n')[0]), 'FEJLGENKENDELSE: foerste linje skal vaere "fejlgenkendelsen klar til sitet: ja/nej"')
  for (const l of ['L10', 'L11', 'L12', 'L13', 'L8', 'L14']) ok(new RegExp(`^\\| ${l} \\|`, 'm').test(fg), `FEJLGENKENDELSE: ${l} mangler i fund-tabellen`)
  for (const l of ['L6', 'L7', 'L8', 'L9', 'L3']) ok(new RegExp(`^\\| ${l} \\| \\*\\*`, 'm').test(fg), `FEJLGENKENDELSE: ${l} mangler i status-tabellen`)
  for (const h of ['L6-L9 fra 548', 'Læses linjen', 'Er 30-45 ord', 'Hintet i sko', 'Sumo med mine', 'Bænkens vip', 'Marcs klip', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(fg), `FEJLGENKENDELSE: afsnit ${h} mangler`)
  ok(!/[\u2013\u2014]/.test(fg), 'FEJLGENKENDELSE: tankestreg')
}
if (f && fg) {
  ok(f.ref === '346f791', `maalt paa ${f.ref}, ikke 346f791`)
  const A = f.A.regler
  ok(Object.keys(A).length === 7 && Object.values(A).every((r) => Object.keys(r.kamera).length === 10), 'syv regler og ti kameraer')
  const fa = Object.values(A).flatMap((r) => Object.entries(r.kamera).filter(([c]) => c !== 'skraa20').flatMap(([, k]) => [k.omhyggelig.falskAlarm, k.typisk.falskAlarm]))
  ok(Math.max(...fa) === 4, 'falsk alarm hoejst 4 %')
  ok(/^Ligner ikke .*Det udelukker ikke fejlen.*Andre fejl tjekker siden ikke\.$/.test(f.L.linjer['squat-midt'].flad.tekst), 'L6: linjen')
  ok(f.L.regler['dl-stang-frem'].lovet === 1.8 && f.L.regler['dl-stang-frem'].maalt.vinkelret.typ === 18.7 && fg.includes('18,7 %'), 'L10: stangen glider frem')
  ok(f.L.regler['sq-hofte-tilbage-bund'].maalt.haand140.omh === 18.7 && f.L.regler['sq-kun-knae-midt'].maalt.vinkelret.typ === 58, 'L10: squat')
  ok(f.H.omvendt['2']['sq-hofte-tilbage-bund'].falskAlarm === 0 && f.H.omvendt['2']['sq-hofte-tilbage-bund'].hint === 55.5, 'L9: hint ved 2 cm')
  ok(f.H.omvendt['3']['sq-hofte-tilbage-midt'].falskAlarm === 12.8 && f.H.samme.vinkelret['2']['sq-hofte-tilbage-bund'].hintFejl === 98, 'L11 og hintet paa fejlfiguren')
  ok(f.S.film.almindeligt.sumoTjekket === 51.5 && f.S.navCm.forskudt['20'] === 10 && f.S.res.yantra.vinkelret.typisk['dl-stang-frem'].overset === 10.5, 'sumo')
  ok(f.S.res.bred10.vinkelret.typisk['dl-hofte-foerst'].overset === 30.5, 'sumo bred')
  ok(f.B.res.vipNed3['0'].vinkelret.omhyggelig.falskAlarm === 3.1 && f.B.res.vipNed3['0'].skraa10.typisk.falskAlarm === 11.2 && f.B.res.vip['0'].vinkelret.omhyggelig.ikkeTjekket === 31.1, 'baenk')
  ok(f.F.medForbudt.length === 0 && f.F.saetninger.length === 76 && f.F.letterHaelen === 0 && f.F.maxOrd === 39, 'saetningerne')
}
if (s) {
  ok(s.ref === '346f791', 'side-558 ikke paa 346f791')
  ok(s.tjek.length === 18 && s.tjek.every((t) => t.ok), `side-558: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(s.sider['360']['sq-midt'].linjeLinjer === 6 && s.sider['360'].l9.linjeLinjer === 7, 'linjerne paa 360')
  for (const p of ['S-360-l6-sticking.png', 'S-360-l6-sko.png', 'S-360-l7-hint.png', 'S-360-l9-hint.png', 'S-390-su-knae.png', 'S-390-su-skraa5.png', 'S-390-bu-75.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const sk = tekst('SKAK-6.md')
  const r = tekst('RAPPORT-558.md')
  const b = json('bibliotek-558.json')
  if (sk) {
    ok(/^skakken stadig klar til eleverne: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK-6: foerste linje skal vaere "skakken stadig klar til eleverne: ja/nej"')
    ok(!/[\u2013\u2014]/.test(sk), 'SKAK-6: tankestreg')
    for (const h of ['Mit bibliotek', 'Gentag i dag', 'K12', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(sk), `SKAK-6: afsnit ${h} mangler`)
  }
  if (b) {
    ok(b.tjek && b.tjek.length > 0 && b.tjek.every((t) => t.ok), `bibliotek-558: ${b.tjek ? b.tjek.filter((t) => !t.ok).length : '?'} tjek roede`)
    ok([360, 390, 1280].every((w) => b.bredder.includes(w)), 'bibliotek-558: 360, 390 og 1280')
    ok(b.net === 0 && b.jsFejl === 0, 'bibliotek-558: net eller JS-fejl')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 558'), 'RAPPORT: foerste linje skal starte med "Ordre 558"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Yantra', 'Setu', 'Chaturanga']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-558 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-558 --blok ${blok}: groen`)
