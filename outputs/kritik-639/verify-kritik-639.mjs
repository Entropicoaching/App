// KRITIK 639: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-639
// og dokumenterne i docs/kritik-639, plus git.
//   node outputs/kritik-639/verify-kritik-639.mjs --blok 1   Maal dit billede (maal-639.json, MAAL.md)
//   node outputs/kritik-639/verify-kritik-639.mjs --blok 2   blok 1 + skakken (skak-639.json) og RAPPORT-639
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-639')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-639/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const t = (x) => String(x).replace('.', ',')
const doc = (d, navn, foerste, afsnit, fund) => {
  if (!d) return
  ok(foerste.test(d.split('\n')[0]), `${navn}: foerste linje skal vaere ${foerste}`)
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(d), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(d), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[–—]/.test(d), `${navn}: tankestreg`)
  ok(udenNavne(d), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-639', 'grenen er ikke kritik-639')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-639\//.test(f), `uden for docs/kritik-639 og outputs/kritik-639: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-639@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-639 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Maal dit billede -----------------------------------------------------------------
const m = json('maal-639.json')
if (m) {
  ok(m.ver.o634Merget === 'ja', `634 ikke merget i ${m.ver.main}`)
  ok(m.tjek.length >= 22 && m.tjek.every((x) => x.ok), `maal-639: ${m.tjek.filter((x) => !x.ok).length} roede`)
  ok(!m.eksterne.length, 'maal-639: net')
  ok(m.mc['nul-12u-3r'].n >= 2000, 'maal-639: Monte Carlo under 2000 forsoeg')
  ok(m.mcSide.every((x) => x.node.join() === x.side.join()), 'maal-639: node og siden er uenige')
  const mt = tekst('MAAL.md')
  if (mt) {
    for (const k of ['nul-8u-1r', 'nul-12u-1r', 'nul-8u-3r', 'nul-12u-3r']) ok(mt.includes(t(m.mc[k].nogetAlene)), `MAAL: "1 uge" ${k} ${m.mc[k].nogetAlene} staar ikke i teksten`)
    ok(mt.includes(t(m.mc['hofte5-kun-nyeste-12u-3r'].m24)) && mt.includes(t(m.mc['hofte5-kun-nyeste-12u-3r'].hofteNyesteAlene)), 'MAAL: M24-tallene')
    ok(mt.includes(`${m.png.otte.w} × ${m.png.otte.h}`) && mt.includes(`${m.png.tolv.w} × ${m.png.tolv.h}`) && mt.includes(`${m.png.otteUden.w} × ${m.png.otteUden.h}`), 'MAAL: PNG-stoerrelserne')
    ok(mt.includes(t(m.m21.forhold)), 'MAAL: M21-forholdet')
    ok(/^Maal dit billede stadig klar til sitet: (ja|nej)$/.test(mt.split('\n')[0]), 'MAAL: foerste linje')
    ok(/Setu skal kopiere 634 nu/.test(mt) && mt.includes(m.ver.main), 'MAAL: om Setu kopierer 634 nu og fra hvilken main')
    doc(mt, 'MAAL', /^Maal dit billede stadig klar/, ['Hvad jeg målte', 'Yantras punkter', 'Fund', 'Ærlige grænser'], ['M21', 'M23', 'M24', 'M22', 'M25', 'M26', 'M27', 'M28', 'M29'])
  }
}

// --- blok 2: skakken og rapporten -----------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-639.json')
  if (s) {
    ok(s.merget629 === 'ja' && s.merget623 === 'ja', `skak: 623/629 ikke merget i ${s.main}`)
    ok(s.tjek.length >= 20 && s.tjek.every((x) => x.ok), `skak-639: ${s.tjek.filter((x) => !x.ok).length} roede`)
  }
  const r = tekst('RAPPORT-639.md')
  if (r) {
    ok(/^Ordre 639/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/skakken stadig klar til Marcs klasse: (ja|nej)/.test(r), 'RAPPORT: skakdommen')
    ok(/Maal dit billede stadig klar til sitet: (ja|nej)/.test(r), 'RAPPORT: maaldommen')
    doc(r, 'RAPPORT', /^Ordre 639/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    for (const n of ['Yantra', 'Setu', 'Chaturanga']) ok((r.split('## Hvad er næste')[1] || '').includes(`**${n}`), `RAPPORT: Hvad er naeste mangler ${n}`)
  }
}

if (fejl.length) { console.log(`verify-kritik-639 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.log('  - ' + f); process.exit(1) }
console.log(`verify-kritik-639 --blok ${blok}: groen`)
