// KRITIK 632: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-632
// og dokumenterne i docs/kritik-632, plus git.
//   node outputs/kritik-632/verify-kritik-632.mjs --blok 1   Maal dit billede (maal-632.json, MAAL.md)
//   node outputs/kritik-632/verify-kritik-632.mjs --blok 2   blok 1 + sitets kopi (sitet-632-som-er.json, sitet-632-kopi.json) og RAPPORT-632
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-632')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-632/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
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
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-632', 'grenen er ikke kritik-632')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-632\//.test(f), `uden for docs/kritik-632 og outputs/kritik-632: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-632@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-632 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Maal dit billede -----------------------------------------------------------------
const m = json('maal-632.json')
if (m) {
  ok(m.ver.o627Merget === 'ja' && m.ver.o630Merget === 'ja', `627/630 ikke merget i ${m.ver.main}`)
  ok(m.tjek.length >= 19 && m.tjek.every((t) => t.ok), `maal-632: ${m.tjek.filter((t) => !t.ok).length} roede`)
  ok(!m.eksterne.length, 'maal-632: net')
  ok(m.mc['nul-12u-3r'].n >= 2000, 'maal-632: Monte Carlo under 2000 forsoeg')
  ok(m.mcSide.every((x) => x.node.join() === x.side.join()), 'maal-632: node og siden er uenige')
  const mt = tekst('MAAL.md')
  if (mt) {
    const t = (x) => String(x).replace('.', ',')
    for (const k of ['nul-8u-3r', 'nul-12u-3r', 'nul-8u-1r', 'nul-12u-1r', 'hofte5-fra-u5-12u-3r']) ok(mt.includes(t(m.mc[k].nogetGuld)), `MAAL: ${k} ${m.mc[k].nogetGuld} staar ikke i teksten`)
    ok(mt.includes(t(m.mc['hofte5-fra-u5-12u-1r'].guldHofte)) && mt.includes(t(m.mc['hofte5-fra-u5-12u-1r'].overHofte)), 'MAAL: M25-tallene')
    ok(mt.includes(`${m.png.otte.w} × ${m.png.otte.h}`) && mt.includes(`${m.png.tolv.w} × ${m.png.tolv.h}`), 'MAAL: PNG-stoerrelserne')
    ok(/^Maal dit billede stadig klar til sitet: (ja|nej)$/.test(mt.split('\n')[0]), 'MAAL: foerste linje')
    ok(/Setu skal kopiere 630 nu/.test(mt), 'MAAL: om Setu kopierer 630 nu')
    doc(mt, 'MAAL', /^Maal dit billede stadig klar/, ['Hvad jeg målte', 'Yantras punkter', 'Fund', 'Ærlige grænser'], ['M18', 'M19', 'M20', 'M23', 'M24', 'M25', 'M26', 'M21', 'M22'])
  }
}

// --- blok 2: sitets kopi og rapporten -----------------------------------------------------------
if (blok >= 2) {
  for (const v of ['som-er', 'kopi']) {
    const s = json(`sitet-632-${v}.json`)
    if (s) {
      ok(s.ver.variant === v && s.tjek.length >= 17 && s.tjek.every((t) => t.ok), `sitet-632 ${v}: ${s.tjek.filter((t) => !t.ok).length} roede`)
      ok(!s.eksterne.length && !s.mangler404.length, `sitet-632 ${v}: net eller 404`)
    }
  }
  const r = tekst('RAPPORT-632.md')
  if (r) {
    ok(/^Ordre 632/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/Vaerktoejssiden klar til Marcs deploy: (ja|nej)/.test(r), 'RAPPORT: sitedommen')
    ok(/Maal dit billede stadig klar til sitet: (ja|nej)/.test(r), 'RAPPORT: maaldommen')
    doc(r, 'RAPPORT', /^Ordre 632/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    for (const n of ['Yantra', 'Setu']) ok((r.split('## Hvad er næste')[1] || '').includes(`**${n}`),`RAPPORT: Hvad er naeste mangler ${n}`)
  }
}

if (fejl.length) { console.log(`verify-kritik-632 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.log('  - ' + f); process.exit(1) }
console.log(`verify-kritik-632 --blok ${blok}: groen`)
