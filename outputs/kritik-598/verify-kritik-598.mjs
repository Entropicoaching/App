// KRITIK 598: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-598
// og dokumenterne i docs/kritik-598, plus git.
//   node outputs/kritik-598/verify-kritik-598.mjs --blok 1   Maal dit billede (MAAL.md)
//   node outputs/kritik-598/verify-kritik-598.mjs --blok 2   blok 1 + skakken (SKAK.md) og RAPPORT-598
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-598')
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-598/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const doc = (t, navn, foerste, afsnit, fund) => {
  if (!t) return
  ok(foerste.test(t.split('\n')[0]), `${navn}: foerste linje skal vaere ${foerste}`)
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(t), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(t), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(t), `${navn}: tankestreg`)
  ok(udenNavne(t), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-598', 'grenen er ikke kritik-598')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-598\//.test(f), `uden for docs/kritik-598 og outputs/kritik-598: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-598@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-598 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Maal dit billede --------------------------------------------------------------------
const m = json('maal-598.json')
if (m) {
  ok(m.ver.main === '03c929e' && m.ver.site === '11c6169', `maalt paa loeftmodel ${m.ver.main} og site ${m.ver.site}`)
  ok(m.tjek.length >= 23 && m.tjek.every((t) => t.ok), `maal-598: ${m.tjek.filter((t) => !t.ok).length} roede`)
  ok(m.eksterne.length === 0, 'maal-598: net')
  ok(m.mini.filter((x) => x.tekstfelter === 3).length === 4, 'maal-598: M1 er ikke 4 miniaturer med 3 felter')
  ok(m.figurside.s2tal.vej === 10.5 && m.figurside.vist.bueVej === 10.4, 'maal-598: M2 tallene')
}
const mm = tekst('MAAL.md')
doc(mm, 'MAAL', /^Maal dit billede stadig klar til sitet: (ja|nej)$/, ['Hvad jeg målte', 'Hvad sitet skal have', 'Yantras punkter', 'Fund', 'Ærlige grænser'], ['M1', 'M2', 'M3'])
if (mm) ok(/Setu skal ikke kopiere den nye udgave endnu/.test(mm) && mm.includes('af745da') && mm.includes('03c929e') && mm.includes('11c6169'), 'MAAL: Setu-dommen eller hasherne mangler')
ok(sh(`git -C ${LM} rev-parse --short main`).trim() === '03c929e', 'loeftmodel main er flyttet fra 03c929e (maal igen)')

// --- blok 2: skakken og rapporten ------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-598.json')
  if (s) {
    ok(s.tjek.length >= 30 && s.tjek.every((t) => t.ok), `skak-598: ${s.tjek.filter((t) => !t.ok).length} roede`)
    ok(Object.values(s.B).every((b) => b.net === 0 && !b.fejl.length), 'skak-598: net eller JS-fejl')
    ok([360, 390, 1280].every((b) => s.B[b]), 'skak-598: ikke maalt paa 360, 390 og 1280')
  }
  const ss = tekst('SKAK.md')
  doc(ss, 'SKAK', /^skakken stadig klar til Marcs klasse: (ja|nej)$/, ['Hvad jeg målte', 'Som elev', 'Som lærer', 'Persondata', 'Fund', 'Ærlige grænser'], [])
  const r = tekst('RAPPORT-598.md')
  doc(r, 'RAPPORT', /^Ordre 598/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
  if (r) ok(/Yantra/.test(r) && /Setu/.test(r) && /Chaturanga/.test(r), 'RAPPORT: hvad Yantra, Setu og Chaturanga goer')
  if (s) ok(sh(`git -C ${SKAK} rev-parse --short main`).trim() === s.skak, `skak main er flyttet fra ${s.skak} (maal igen)`)
}

if (fejl.length) { console.log(`ROED (${fejl.length}):\n- ` + fejl.join('\n- ')); process.exit(1) }
console.log(`verify-kritik-598 --blok ${blok}: groen`)
