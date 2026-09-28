// KRITIK 564: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-564 og dokumenterne i docs/kritik-564, plus git og lint.
//   node outputs/kritik-564/verify-kritik-564.mjs --blok 1   video i Maal dit billede (VIDEO.md)
//   node outputs/kritik-564/verify-kritik-564.mjs --blok 2   blok 1 + Marcs valg (MATEMATIK-VALG.md) og RAPPORT-564
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-564')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-564/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-564', 'grenen er ikke kritik-564')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-564\//.test(f), `uden for docs/kritik-564 og outputs/kritik-564: ${f}`)
for (const f of [...aendret, ...utilstraekkelig]) ok(!/\.(mp4|mov|webm|mkv)$/i.test(f), `et videoklip er lagt i repoet: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-564@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-564 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')

// --- blok 1 --------------------------------------------------------------------------------
const vd = tekst('VIDEO.md')
const v = json('video-564.json')
if (vd) {
  ok(/^video i Mål dit billede klar til sitet: (ja|nej)\b/.test(vd.split('\n')[0]), 'VIDEO: foerste linje skal vaere "video i Mål dit billede klar til sitet: ja/nej"')
  for (const h of ['Hvad jeg målte', 'Privat', 'Skyderen og', 'Brug dette billede', 'Fase-hjælpen og Hop til', 'Tid og hukommelse', 'Andre klip', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(vd), `VIDEO: afsnit ${h} mangler`)
  for (const l of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']) ok(new RegExp(`^\\| ${l} \\|`, 'm').test(vd), `VIDEO: ${l} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(vd), 'VIDEO: tankestreg')
}
if (v && vd) {
  ok(v.ref === '296b9bf', `maalt paa ${v.ref}, ikke 296b9bf`)
  ok(v.tjek.length >= 20 && v.tjek.every((t) => t.ok), `video-564: ${v.tjek.filter((t) => !t.ok).length} tjek roede`)
  const B = ['360', '390', '1280', '390x4']
  ok(B.every((w) => v.sider[w].efterHentet.length === 0 && v.sider[w].jsFejl.length === 0), 'net eller JS-fejl efter siden er hentet')
  ok(B.every((w) => v.sider[w].hop.map((h) => h.fejl).join() === '-1,-4,6,0,4'), 'hop-fejlene')
  ok(v.hopRegnet[1].raadSkader === 100 && v.hopRegnet[2].raadHjaelper === 100, 'raadet')
  ok(v.andre['sq30-hevc.mp4'].aabn.ms > 14000 && vd.includes('15 s'), 'HEVC 15 s')
  ok(v.sider['390x4'].brug.every((b) => b.ms < 1000) && v.andre['sq5-4k.mp4 x4'].brugMs > 1000, '4x CPU')
  ok(v.telefonHoejde && v.telefonHoejde['360x640'] && v.telefonHoejde['390x664'], 'telefonhoejderne mangler')
  for (const p of ['V-360-1-aabnet.png', 'V-390-1-aabnet.png', 'V-390-4-hop.png', 'V-390-3-brugt.png', 'V-390-hevc.png', 'V-360x640-navknap.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const mv = tekst('MATEMATIK-VALG.md')
  const r = tekst('RAPPORT-564.md')
  const m = json('valg-564.json')
  if (mv) {
    ok(/^Marc kan vælge ud fra siden: (ja|nej)\b/.test(mv.split('\n')[0]), 'MATEMATIK-VALG: foerste linje skal vaere "Marc kan vælge ud fra siden: ja/nej"')
    for (const h of ['Læst som en lærer', 'Hvad eleverne mærker', 'Forslag og fakta', 'Siden mod koden', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(mv), `MATEMATIK-VALG: afsnit ${h} mangler`)
    for (const l of ['N9', 'N10', 'N11', 'N12']) ok(new RegExp(`^\\| ${l} \\|`, 'm').test(mv), `MATEMATIK-VALG: ${l} mangler i fund-tabellen`)
    ok(!/[\u2013\u2014]/.test(mv), 'MATEMATIK-VALG: tankestreg')
  }
  if (m) {
    ok(m.ref === 'af963d8', `valg maalt paa ${m.ref}, ikke af963d8`)
    ok(m.tjek.length === 20 && m.tjek.every((t) => t.ok), `valg-564: ${m.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok(m.magenTilKopi, 'siden er ikke magen til kopien')
    for (const p of ['M-360-light.png', 'M-390-light.png', 'M-390-dark.png', 'M-1280-light.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 564'), 'RAPPORT: foerste linje skal starte med "Ordre 564"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Yantra', 'Ganita']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-564 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-564 --blok ${blok}: groen`)
