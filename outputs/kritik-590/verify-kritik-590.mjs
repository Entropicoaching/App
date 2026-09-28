// KRITIK 590: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-590
// og dokumenterne i docs/kritik-590, plus git.
//   node outputs/kritik-590/verify-kritik-590.mjs --blok 1   matematikken (MATEMATIK.md)
//   node outputs/kritik-590/verify-kritik-590.mjs --blok 2   blok 1 + skakken (SKAK.md) og RAPPORT-590
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-590')
const MAT = 'C:/Users/Entropi/Desktop/matematik'
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-590/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-590', 'grenen er ikke kritik-590')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-590\//.test(f), `uden for docs/kritik-590 og outputs/kritik-590: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-590@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-590 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikken ------------------------------------------------------------------
const mm = tekst('MATEMATIK.md')
const m = json('matematik-590.json')
const ELEVER = [['foer-525', '2774da7'], ['foer-gaet-525', '2774da7'], ['efter-525', 'a615468'], ['efter-731', 'a615468'], ['efter-gaet-525', 'a615468']].map(([n, h]) => [n, h, json(`elev-590-${n}.json`)])
if (m) {
  ok(m.spil === 'a615468', `matematik maalt paa ${m.spil}, ikke a615468`)
  ok(m.ialt >= 25 && m.tjek.every((t) => t.ok), `matematik-590: ${m.tjek.filter((t) => !t.ok).length} roede`)
  ok(m.net === 0, 'matematik-590: net')
}
for (const [n, h, e] of ELEVER) if (e) {
  ok(e.spil === h, `elev ${n}: maalt paa ${e.spil}`)
  ok(e.net === 0 && e.jsFejl === 0, `elev ${n}: net ${e.net}, JS-fejl ${e.jsFejl}`)
  ok(e.koersler.length === 4, `elev ${n}: ${e.koersler.length} koersler, ikke 4`)
}
if (mm) {
  ok(/^matematikken klar til Marcs klasse: (ja|nej)$/.test(mm.split('\n')[0]), 'MATEMATIK: foerste linje skal vaere "matematikken klar til Marcs klasse: ja/nej"')
  for (const h of ['Hvad jeg målte', 'Kan eleven farme point', 'Ganitas punkter', 'Persondata', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(mm), `MATEMATIK: afsnit ${h} mangler`)
  for (const f of ['M7', 'M8', 'M9', 'M10', 'M11', 'M12']) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(mm), `MATEMATIK: ${f} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(mm), 'MATEMATIK: tankestreg')
  ok(udenNavne(mm), 'MATEMATIK: atletnavn')
  ok(mm.includes('a615468') && mm.includes('2774da7'), 'MATEMATIK: hasherne staar ikke')
}
ok(sh(`git -C ${MAT} rev-parse --short main`).trim() === 'a615468', 'matematik main er flyttet fra a615468 (maal igen)')

// --- blok 2: skakken og rapporten ------------------------------------------------------------
if (blok >= 2) {
  const ss = tekst('SKAK.md')
  const s = json('skak-590.json')
  const r = tekst('RAPPORT-590.md')
  if (s) {
    ok(s.skak === 'f7966e8', `skak maalt paa ${s.skak}`)
    ok(s.ialt >= 24 && s.tjek.every((t) => t.ok), `skak-590: ${s.tjek.filter((t) => !t.ok).length} roede`)
    ok([390, 1280].every((b) => s.B[b].net === 0 && !s.B[b].fejl.length), 'skak-590: net eller JS-fejl')
  }
  if (ss) {
    ok(/^skakken klar til Marcs klasse: (ja|nej)$/.test(ss.split('\n')[0]), 'SKAK: foerste linje skal vaere "skakken klar til Marcs klasse: ja/nej"')
    for (const h of ['Hvad jeg målte', 'Kompetence-koden', 'laerer.html med 25 syntetiske koder', 'De nye temaer', 'Persondata', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(ss), `SKAK: afsnit ${h} mangler`)
    for (let n = 1; n <= 4; n++) ok(new RegExp(`^\\| S${n} \\|`, 'm').test(ss), `SKAK: S${n} mangler i fund-tabellen`)
    ok(!/[\u2013\u2014]/.test(ss), 'SKAK: tankestreg')
    ok(udenNavne(ss), 'SKAK: atletnavn')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 590'), 'RAPPORT: foerste linje skal starte med "Ordre 590"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit ${h} mangler`)
    ok(/Ganita/.test(r) && /Chaturanga/.test(r), 'RAPPORT: hvad Ganita og Chaturanga goer')
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
    ok(udenNavne(r), 'RAPPORT: atletnavn')
  }
  ok(sh(`git -C ${SKAK} rev-parse --short main`).trim() === 'f7966e8', 'skak main er flyttet fra f7966e8 (maal igen)')
}

if (fejl.length) { console.log(`ROED (${fejl.length}):\n- ` + fejl.join('\n- ')); process.exit(1) }
console.log(`verify-kritik-590 --blok ${blok}: groen`)
