// KRITIK 617: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-617
// og dokumenterne i docs/kritik-617, plus git.
//   node outputs/kritik-617/verify-kritik-617.mjs --blok 1   matematikken (MATEMATIK.md, elev-617-*.json)
//   node outputs/kritik-617/verify-kritik-617.mjs --blok 2   blok 1 + vaerktoejssiden (maal-617.json, VAERKTOEJER.md) og RAPPORT-617
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-617')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-617/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const doc = (t, navn, foerste, afsnit, fund) => {
  if (!t) return
  ok(foerste.test(t.split('\n')[0]), `${navn}: foerste linje skal vaere ${foerste}`)
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(t), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(t), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[–—]/.test(t), `${navn}: tankestreg`)
  ok(udenNavne(t), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-617', 'grenen er ikke kritik-617')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-617\//.test(f), `uden for docs/kritik-617 og outputs/kritik-617: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-617@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-617 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikken ------------------------------------------------------------------------
const SPIL = { m605: '4630a20', foer: 'c096c38', o612: '26c3a37', m612: '42e0ae2' }
const koersler = ['m605-m40-525', 'm605-m40-731', 'm605-m40-311', 'foer-m40-525', 'foer-m40-731', 'foer-m40-311', 'm605-m40-p0.4-525', 'foer-m40-p0.4-525', 'm605-m40-gaet-525', 'foer-m40-gaet-525', 'o612-m40-525', 'o612-m40-p0.4-525', 'o612-m40-gaet-525', 'm605-m40-reduceret-731', 'm612-m20-gaet-525', 'm612-m20-gaet-731', 'm612-m20-p0.4-525']
for (const k of koersler) {
  const j = json(`elev-617-${k}.json`)
  if (!j) continue
  ok(j.net === 0 && j.jsFejl === 0, `elev-617-${k}: net ${j.net}, JS-fejl ${j.jsFejl}`)
  ok(j.spil === SPIL[k.split('-')[0]], `elev-617-${k}: maalt paa ${j.spil}`)
  // Fri vilje: ved hvert valg efter et forloeb stod baade "Fortsaet" og "Hjaelp".
  for (const v of ['travl', 'foelger']) for (const b of Object.keys(j.udgaver[v])) ok(j.udgaver[v][b].valgBegge.every(Boolean), `elev-617-${k} ${v} ${b}: et valg uden begge knapper`)
}
// Hjaelperen ligger ikke under den travle efter 20 og 40 min paa 605 (70 %-eleven, tre terninger).
const tal = (f) => (f ? f.niveau + (f.niveauPoint ? 0.5 : 0) : NaN)
for (const k of ['m605-m40-525', 'm605-m40-731', 'm605-m40-311']) {
  const j = existsSync(path.join(HERE, `elev-617-${k}.json`)) ? JSON.parse(readFileSync(path.join(HERE, `elev-617-${k}.json`), 'utf8')) : null
  if (!j) continue
  for (const b of Object.keys(j.udgaver.travl)) {
    const s = (v) => j.slut.find((x) => x.variant === v && x.bredde === Number(b))
    ok(tal(j.udgaver.foelger[b].snap) >= tal(j.udgaver.travl[b].snap), `${k} ${b}: hjaelperen under den travle efter 20 min`)
    ok(tal(s('foelger').figur) >= tal(s('travl').figur), `${k} ${b}: hjaelperen under den travle efter 40 min`)
  }
}
const mt = tekst('MATEMATIK.md')
if (mt) {
  const l = mt.split('\n')
  ok(/^Matematikken stadig klar til Marcs klasse: (ja|nej)$/.test(l[0]), 'MATEMATIK: foerste linje')
  ok(/^Marcs M2\/N1 opfyldt: (ja|nej)$/.test(l[1]), 'MATEMATIK: anden linje (M2/N1)')
  doc(mt, 'MATEMATIK', /^Matematikken stadig klar/, ['Hvad jeg målte', 'Ganitas punkter', 'Fund', 'Ærlige grænser'], ['M15', 'M16', 'M17'])
}

// --- blok 2: vaerktoejssiden og rapporten --------------------------------------------------------------
if (blok >= 2) {
  const m = json('maal-617.json')
  if (m) {
    ok(m.ver.site === '1bd6672' || m.ver.siteErNyere, `maalt paa site ${m.ver.site}`)
    ok(m.tjek.length >= 14 && m.tjek.every((t) => t.ok), `maal-617: ${m.tjek.filter((t) => !t.ok).length} roede`)
    ok(m.eksterne.every((u) => /fonts\./.test(u)) && !m.mangler404.length, 'maal-617: net eller 404')
  }
  const vt = tekst('VAERKTOEJER.md')
  doc(vt, 'VAERKTOEJER', /^Vaerktoejssiden klar til Marcs deploy: (ja|nej)$/, ['Hvad jeg målte', 'Setus punkter', 'Fund', 'Ærlige grænser'], [])
  const r = tekst('RAPPORT-617.md')
  doc(r, 'RAPPORT', /^Ordre 617$/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
  if (r) ok(/Ganita/.test(r) && /Setu/.test(r), 'RAPPORT: hvad Ganita og Setu goer')
}

if (fejl.length) { console.log(`ROED (${fejl.length}):\n- ` + fejl.join('\n- ')); process.exit(1) }
console.log(`verify-kritik-617 --blok ${blok}: groen`)
