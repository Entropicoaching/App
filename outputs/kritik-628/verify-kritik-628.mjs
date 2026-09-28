// KRITIK 628: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-628
// og dokumenterne i docs/kritik-628, plus git.
//   node outputs/kritik-628/verify-kritik-628.mjs --blok 1   Maal dit billede (maal-628.json, hop-628.json, MAAL.md)
//   node outputs/kritik-628/verify-kritik-628.mjs --blok 2   blok 1 + skakken (skak-628.json) og RAPPORT-628
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-628')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-628/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
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
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-628', 'grenen er ikke kritik-628')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-628\//.test(f), `uden for docs/kritik-628 og outputs/kritik-628: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-628@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-628 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Maal dit billede -----------------------------------------------------------------
const m = json('maal-628.json')
if (m) {
  ok(m.ver.main === '287210d' && m.ver.o621Merget === 'ja', `maalt paa loeftmodellens main ${m.ver.main}`)
  ok(m.tjek.length >= 18 && m.tjek.every((t) => t.ok), `maal-628: ${m.tjek.filter((t) => !t.ok).length} roede`)
  ok(!m.eksterne.length, 'maal-628: net')
  ok(m.mc['nul-12u-3r'].n >= 2000, 'maal-628: Monte Carlo under 2000 forsoeg')
  ok(m.mcSide.every((x) => x.nodeGuld === x.sideGuld), 'maal-628: node og siden er uenige')
  // Tallene i MAAL.md er dem i json.
  const mt = tekst('MAAL.md')
  if (mt) {
    for (const k of ['nul-8u-3r', 'nul-12u-3r', 'nul-8u-1r', 'nul-12u-1r']) ok(mt.includes(String(m.mc[k].nogetGuld).replace('.', ',')), `MAAL: ${k} ${m.mc[k].nogetGuld} staar ikke i teksten`)
    ok(mt.includes(String(m.mc['hofte5-fra-u5-12u-3r'].toITraekNogetSted).replace('.', ',')), 'MAAL: to-i-traek med hofte 5 cm')
    ok(/^Maal dit billede stadig klar til sitet: (ja|nej)$/.test(mt.split('\n')[0]), 'MAAL: foerste linje')
    doc(mt, 'MAAL', /^Maal dit billede stadig klar/, ['Hvad jeg målte', 'Yantras punkter', 'Fund', 'Ærlige grænser'], ['M19', 'M20', 'M21', 'M22'])
  }
}
const h = json('hop-628.json')
if (h) ok(h.tjek.length === 3 && h.tjek.every((t) => t.ok), `hop-628: ${h.tjek.filter((t) => !t.ok).length} roede`)

// --- blok 2: skakken og rapporten --------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-628.json')
  if (s) {
    ok(s.tjek.length >= 20 && s.tjek.every((t) => t.ok), `skak-628: ${s.tjek.filter((t) => !t.ok).length} roede`)
    ok(/ordre-623/.test(s.ref), `skak-628 maalt paa ${s.ref}`)
  }
  const r = tekst('RAPPORT-628.md')
  if (r) {
    ok(/^Ordre 628/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/skakken stadig klar til Marcs klasse: (ja|nej)/.test(r), 'RAPPORT: skakdommen')
    ok(/Maal dit billede stadig klar til sitet: (ja|nej)/.test(r), 'RAPPORT: maaldommen')
    doc(r, 'RAPPORT', /^Ordre 628/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], ['S10'])
    for (const n of ['Yantra', 'Setu', 'Chaturanga']) ok(new RegExp(`\\*\\*${n}`).test(r.split('## Hvad er næste')[1] || ''), `RAPPORT: Hvad er naeste mangler ${n}`)
  }
}

if (fejl.length) { console.log(`verify-kritik-628 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.log('  - ' + f); process.exit(1) }
console.log(`verify-kritik-628 --blok ${blok}: groen`)
