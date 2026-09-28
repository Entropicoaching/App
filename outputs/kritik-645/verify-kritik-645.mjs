// KRITIK 645: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-645
// og dokumenterne i docs/kritik-645, plus git.
//   node outputs/kritik-645/verify-kritik-645.mjs --blok 1   Instagram og vaerktoejssiden (insta-645.json, sitet-645-som-er.json, INSTAGRAM-OG-SITET.md)
//   node outputs/kritik-645/verify-kritik-645.mjs --blok 2   blok 1 + START-HER-MARC (start-645.json, START-HER.md) og RAPPORT-645
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-645')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-645/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const doc = (d, navn, foerste, afsnit, fund) => {
  if (!d) return
  ok(foerste.test(d.split('\n')[0]), `${navn}: foerste linje skal vaere ${foerste}`)
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(d), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(d), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[–—]/.test(d), `${navn}: tankestreg`)
  ok(udenNavne(d), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-645', 'grenen er ikke kritik-645')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-645\//.test(f), `uden for docs/kritik-645 og outputs/kritik-645: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-645@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-645 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Instagram og vaerktoejssiden -------------------------------------------------------
const ins = json('insta-645.json')
if (ins) {
  ok(ins.tjek.length >= 20 && ins.tjek.every((x) => x.ok), `insta-645: ${ins.tjek.filter((x) => !x.ok).length} roede`)
  ok(ins.sammeSaetning.length === 0 && ins.sammeFigur.every((f) => !/k7-reference-bund/.test(f.fil)), 'insta-645: I8 ikke lukket')
  ok(/knæene strakt mere/.test(ins.i9.afsnit1), 'insta-645: I9 ikke lukket')
}
const s = json('sitet-645-som-er.json')
if (s) {
  ok(s.ver.site === 'ed32064' || s.ver.siteSiden600[0]?.includes('636'), `sitet: ${s.ver.site}`)
  ok(s.ver.kilde === s.ver.lmMain, `sitet: kopien ${s.ver.kilde} er ikke loeftmodellens main ${s.ver.lmMain}`)
  ok(s.tjek.length >= 17 && s.tjek.every((x) => x.ok), `sitet-645: ${s.tjek.filter((x) => !x.ok).length} roede`)
  ok(!s.eksterne.length && !s.mangler404.length, 'sitet-645: net eller 404')
}
const d1 = tekst('INSTAGRAM-OG-SITET.md')
if (d1) {
  ok(/^Instagram 7-12 klar til Marcs godkendelse: (ja|nej)$/.test(d1.split('\n')[0]), 'INSTAGRAM-OG-SITET: foerste linje')
  ok(/Værktøjssiden klar til Marcs deploy: (ja|nej)/.test(d1), 'INSTAGRAM-OG-SITET: vaerktoejsdommen')
  ok(s && d1.includes(s.ver.kilde), 'INSTAGRAM-OG-SITET: kopiens commit')
  doc(d1, 'INSTAGRAM-OG-SITET', /^Instagram 7-12 klar/, ['Hvad jeg målte', 'Instagram, fund for fund', 'Værktøjssiden', 'Fund', 'Ærlige grænser'], ['I8', 'I9', 'I14', 'I15'])
}

// --- blok 2: START-HER-MARC og rapporten ----------------------------------------------------
if (blok >= 2) {
  const st = json('start-645.json')
  if (st) {
    ok(st.tjek.length >= 8, 'start-645: for faa tjek')
    ok(st.links.every((l) => l.findes), `start-645: brudte links ${st.links.filter((l) => !l.findes).map((l) => l.href)}`)
  }
  const sd = tekst('START-HER.md')
  if (sd) doc(sd, 'START-HER', /^START-HER-MARC let for Marc at bruge: (ja|nej)/, ['Hvad jeg målte', 'Linkene', 'Svar-sætningerne', 'Hvorfor Marc ikke fandt', 'Fund', 'Ærlige grænser'], ['H1', 'H2', 'H3'])
  const r = tekst('RAPPORT-645.md')
  if (r) {
    ok(/^Ordre 645/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/Instagram 7-12 klar til Marcs godkendelse: (ja|nej)/.test(r), 'RAPPORT: instagramdommen')
    ok(/Værktøjssiden klar til Marcs deploy: (ja|nej)/.test(r), 'RAPPORT: vaerktoejsdommen')
    doc(r, 'RAPPORT', /^Ordre 645/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    ok((r.split('## Hvad er næste')[1] || '').includes('**Setu'), 'RAPPORT: Hvad er naeste mangler Setu')
  }
}

if (fejl.length) { console.log(`verify-kritik-645 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.log('  - ' + f); process.exit(1) }
console.log(`verify-kritik-645 --blok ${blok}: groen`)
