// KRITIK 572: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-572 og dokumenterne i docs/kritik-572, plus git og lint.
//   node outputs/kritik-572/verify-kritik-572.mjs --blok 1   baenk-artiklen (BAENK.md)
//   node outputs/kritik-572/verify-kritik-572.mjs --blok 2   blok 1 + kompetencebiblioteket (MATEMATIK.md) og RAPPORT-572
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-572')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-572/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-572', 'grenen er ikke kritik-572')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-572\//.test(f), `uden for docs/kritik-572 og outputs/kritik-572: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-572@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-572 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --short artikel-baenk').trim() === 'fb0cefa', 'artikel-baenk er flyttet fra fb0cefa')

// --- blok 1 --------------------------------------------------------------------------------
const bb = tekst('BAENK.md')
const b = json('baenk-572.json')
if (bb) {
  ok(/^baenk-artiklen klar naar Marc har svaret: (ja|nej)\b/.test(bb.split('\n')[0]), 'BAENK: foerste linje skal vaere "baenk-artiklen klar naar Marc har svaret: ja/nej"')
  for (const h of ['Hvad jeg målte', 'Tallene og figurerne', 'Kilderne', '\\[MARC\\]-stederne', 'Marcs stilregler og siden', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(bb), `BAENK: afsnit ${h} mangler`)
  for (let n = 1; n <= 10; n++) ok(new RegExp(`^\\| BA${n} \\|`, 'm').test(bb), `BAENK: BA${n} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(bb), 'BAENK: tankestreg')
  ok(/dommen ja/.test(bb) && /BA1-BA2/.test(bb.split('\n').slice(0, 8).join('\n')), 'BAENK: dommen skal sige, hvad der mangler')
}
if (b && bb) {
  ok(b.top === 'fb0cefa' && b.loeftmodelMain === '37c9a27', `maalt paa ${b.top} / ${b.loeftmodelMain}`)
  ok(b.tjek.length >= 31 && b.tjek.every((t) => t.ok), `baenk-572: ${b.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(b.sider.length === 2 && b.sider.every((s) => s.vandret && !s.sidefejl.length && !s.http404.length && !s.tankestreger && !s.synligMarc && s.billeder.length === 13), 'siden paa 390/1280')
  ok(b.fund.BA1.stangModFoedder.stor === '24,1' && bb.includes('22,1 / 25,1 / 24,1'), 'BA1')
  ok(b.fund.BA2.koden && bb.includes('Tallet er Bhishaks (457), ikke en måling'), 'BA2')
  ok(bb.includes('2266 ord') && b.tjek.some((t) => /2266 ord/.test(t.hvad)), 'laesetiden')
  for (const p of ['B-390-buen-figurer.png', 'B-390-buen-vip.png', 'B-390-midt-opturen.png', 'B-390-kap7.png', 'B-390-bp5-med-marc.png', 'B-1280-bue-greb-tabel.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const mm = tekst('MATEMATIK.md')
  const r = tekst('RAPPORT-572.md')
  const m = json('matematik-572.json')
  if (mm) {
    ok(/^matematikken foeles som et MMORPG, ikke Cookie Clicker: (ja|nej)\b/.test(mm.split('\n')[0]), 'MATEMATIK: foerste linje skal vaere "matematikken foeles som et MMORPG, ikke Cookie Clicker: ja/nej"')
    for (const h of ['Hvad jeg målte', 'Vokser tallene', '\\+N og niveau', 'Cookie Clicker', 'Øv her', 'prefers-reduced-motion', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(mm), `MATEMATIK: afsnit ${h} mangler`)
    ok(!/[\u2013\u2014]/.test(mm), 'MATEMATIK: tankestreg')
  }
  if (m) {
    ok(m.tjek.length >= 15 && m.tjek.every((t) => t.ok), `matematik-572: ${m.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok(m.sider.every((s) => s.net === 0 && !s.fejl.length), 'matematik: net eller JS-fejl')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 572'), 'RAPPORT: foerste linje skal starte med "Ordre 572"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Setu', 'Ganita']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-572 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-572 --blok ${blok}: groen`)
