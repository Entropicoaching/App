// KRITIK 631: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-631
// og dokumenterne i docs/kritik-631, plus git.
//   node outputs/kritik-631/verify-kritik-631.mjs --blok 1   Instagram 7-12 (insta-631.json, INSTAGRAM.md)
//   node outputs/kritik-631/verify-kritik-631.mjs --blok 2   blok 1 + matematikken (elev-631.json) og RAPPORT-631
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-631')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-631/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
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
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-631', 'grenen er ikke kritik-631')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-631\//.test(f), `uden for docs/kritik-631 og outputs/kritik-631: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-631@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-631 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Instagram 7-12 ---------------------------------------------------------------------
const g = json('insta-631.json')
if (g) {
  ok(g.tjek.length >= 15 && g.tjek.every((t) => t.ok), `insta-631: ${g.tjek.filter((t) => !t.ok).length} roede`)
  ok(g.laes.length === 2 && g.laes.every((r) => r.indlaest === 20 && !r.jsFejl.length), 'insta-631: LAES-INSTAGRAM-2 ikke maalt paa 390 og 1280')
  ok(g.sammeFigur.some((f) => /k7-reference-bund/.test(f.fil)), 'insta-631: I8 (10 bruger 1s figur) er ikke maalt')
}
const ig = tekst('INSTAGRAM.md')
doc(ig, 'INSTAGRAM', /^Instagram 7-12 klar til Marcs godkendelse: (ja|nej)/, ['Hvad jeg målte', 'Tværs af alle seks', 'Opslag for opslag', 'Fund', 'Ærlige grænser'], ['I8', 'I8b', 'I9', 'I10', 'I11', 'I12', 'I13'])
if (ig) ok(/nr\. 10/.test(ig.split('\n')[0]) && /nr\. 8/.test(ig.split('\n')[0]), 'INSTAGRAM: foerste linje naevner ikke de numre, der skal rettes')

// --- blok 2: matematikken og rapporten ----------------------------------------------------------
if (blok >= 2) {
  const e = json('elev-631.json')
  if (e) {
    ok(e.tjek.length >= 8 && e.tjek.every((t) => t.ok), `elev-631: ${e.tjek.filter((t) => !t.ok).length} roede`)
    ok(e.profiler.length === 12, `elev-631: ${e.profiler.length} profiler, ikke 3 x 2 x 2 = 12`)
  }
  const r = tekst('RAPPORT-631.md')
  if (r) {
    doc(r, 'RAPPORT', /^Ordre 631$/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    ok(/Matematikken stadig klar til Marcs klasse: (ja|nej)/.test(r), 'RAPPORT: matematikdommen')
    ok(/Det betaler sig altid at hjælpe, også for den svage ærlige: (ja|nej)/.test(r), 'RAPPORT: hjaelpedommen')
    ok(/Instagram 7-12 klar til Marcs godkendelse: (ja|nej)/.test(r), 'RAPPORT: instagramdommen')
    for (const n of ['Setu', 'Ganita']) ok(new RegExp(`\\*\\*${n}`).test(r.split('## Hvad er næste')[1] || ''), `RAPPORT: Hvad er naeste mangler ${n}`)
  }
}

if (fejl.length) { console.log(`verify-kritik-631 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.log('  - ' + f); process.exit(1) }
console.log(`verify-kritik-631 --blok ${blok}: groen`)
