// KRITIK 613: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-613,
// dokumenterne i docs/kritik-613 og git.
//   node outputs/kritik-613/verify-kritik-613.mjs --blok 1   squat (SQUAT.md)
//   node outputs/kritik-613/verify-kritik-613.mjs --blok 2   blok 1 + Instagram (INSTAGRAM.md) og RAPPORT-613
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-613')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-613/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\b${n}\b`, 'i').test(t))
const doc = (t, navn, foerste, afsnit, fund) => {
  if (!t) return
  ok(foerste.test(t.split('\n')[0]), `${navn}: foerste linje skal vaere ${foerste}`)
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(t), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\| ${f} \|`, 'm').test(t), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[–—]/.test(t), `${navn}: tankestreg`)
  ok(udenNavne(t), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-613', 'grenen er ikke kritik-613')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const aabne = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...aabne]) ok(/^(docs|outputs)\/kritik-613\//.test(f), `uden for docs/kritik-613 og outputs/kritik-613: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-613@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-613 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: squat --------------------------------------------------------------------------
const q = json('squat-613.json')
if (q) {
  ok(q.ver.gren === 'f3c1684', `maalt paa ${q.ver.gren}, ikke f3c1684`)
  ok(q.tjek.length >= 15 && q.tjek.every((t) => t.ok), `squat-613: ${q.tjek.filter((t) => !t.ok).length} roede`)
  ok(q.eksterne.every((u) => /fonts\.googleapis/.test(u)) && !q.f404.length, 'squat-613: net eller 404')
}
const s = json('k6-seeds-613.json')
if (s) {
  ok(s.seeds === 200, 'k6-seeds: ikke 200 seeds')
  ok(s.faser['squat-midt']['kun knæene'].lignerKunKnae < 1000, 'k6-seeds: Q2 (sticking under 100 %) holder ikke')
}
const sq = tekst('SQUAT.md')
doc(sq, 'SQUAT', /^Kapitel 6 på squat bedre: (ja|nej)\. Squat-artiklen klar til Marcs læsning: (ja|nej)$/, ['Hvad jeg målte', 'Er kapitel 6', 'Jeg-formen', 'Brud på skrivereglerne', 'Figurerne', 'Viser LAES-SQUAT', 'Fund', 'Ærlige grænser'], ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'])

// --- blok 2: Instagram og rapporten ----------------------------------------------------------
if (blok >= 2) {
  const g = json('insta-613.json')
  if (g) ok(g.tjek.length >= 5 && g.tjek.every((t) => t.ok), `insta-613: ${g.tjek.filter((t) => !t.ok).length} roede`)
  const ig = tekst('INSTAGRAM.md')
  doc(ig, 'INSTAGRAM', /^Instagram 1-6 klar til Marcs godkendelse: (ja|nej)/, ['Hvad jeg målte', 'Opslag for opslag', 'Fund', 'Ærlige grænser'], [])
  const r = tekst('RAPPORT-613.md')
  doc(r, 'RAPPORT', /^Ordre 613/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
  if (r) ok(/Setu/.test(r.split('## Hvad er næste')[1] || ''), 'RAPPORT: Hvad er naeste naevner ikke Setu')
}
if (fejl.length) { console.error(fejl.join('\n')); process.exit(1) }
console.log(`verify-kritik-613 --blok ${blok}: groen`)
