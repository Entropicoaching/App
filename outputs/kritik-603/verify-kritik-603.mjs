// KRITIK 603: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-603
// og dokumenterne i docs/kritik-603, plus git.
//   node outputs/kritik-603/verify-kritik-603.mjs --blok 1   Maal dit billede (MAAL.md)
//   node outputs/kritik-603/verify-kritik-603.mjs --blok 2   blok 1 + matematikken (MATEMATIK.md) og RAPPORT-603
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-603')
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-603/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
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
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-603', 'grenen er ikke kritik-603')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-603\//.test(f), `uden for docs/kritik-603 og outputs/kritik-603: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-603@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-603 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: Maal dit billede --------------------------------------------------------------------
const m = json('maal-603.json')
if (m) {
  ok(m.ver.main === '207d4ec' && m.ver.o601 === 'ee5479f' && m.ver.site === '11c6169', `maalt paa loeftmodel ${m.ver.main} (601 ${m.ver.o601}) og site ${m.ver.site}`)
  ok(m.tjek.length >= 25 && m.tjek.every((t) => t.ok), `maal-603: ${m.tjek.filter((t) => !t.ok).length} roede`)
  ok(m.eksterne.length === 0, 'maal-603: net')
  ok(Object.values(m.m123.main.M1felter).filter((x) => x === 3).length === 4, 'maal-603: M1 er ikke laengere 4 miniaturer med 3 felter (maal igen)')
  ok(m.fjendtlig.every((f) => f.xss === null && f.injiceret === 0), 'maal-603: fjendtlig fil koerte kode')
}
const mm = tekst('MAAL.md')
doc(mm, 'MAAL', /^Maal dit billede klar til Setus kopi: (ja|nej)$/, ['Hvad jeg målte', 'Hvad Setu kopierer', 'Yantras punkter', 'Fund', 'Ærlige grænser'], ['M1', 'M2', 'M3', 'M4'])
if (mm) ok(mm.includes('207d4ec') && mm.includes('03c929e') && mm.includes('11c6169'), 'MAAL: hasherne mangler')
ok(sh(`git -C ${LM} rev-parse --short main`).trim() === '207d4ec', 'loeftmodel main er flyttet fra 207d4ec (maal igen)')

// --- blok 2: matematikken og rapporten ------------------------------------------------------------
if (blok >= 2) {
  const koersler = ['m596-525', 'o602-525', 'm596-gaet-525', 'o602-gaet-525', 'm596-gaet-t3-731', 'o602-gaet-t3-731', 'm596-p0.4-525', 'o602-p0.4-525', 'o602-gaet-genindlaes-525']
  for (const k of koersler) {
    const j = json(`elev-603-${k}.json`)
    if (!j) continue
    ok(j.net === 0 && j.jsFejl === 0, `elev-603-${k}: net ${j.net}, JS-fejl ${j.jsFejl}`)
    ok(j.spil === (k.startsWith('m596') ? 'c63394a' : 'bb5c678'), `elev-603-${k}: maalt paa ${j.spil}`)
  }
  const mt = tekst('MATEMATIK.md')
  doc(mt, 'MATEMATIK', /^matematikken stadig klar til Marcs klasse: (ja|nej)$/, ['Hvad jeg målte', 'Ganitas punkter', 'Fund', 'Ærlige grænser'], ['M7', 'M13', 'M14'])
  const r = tekst('RAPPORT-603.md')
  doc(r, 'RAPPORT', /^Ordre 603/, ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
  if (r) ok(/Yantra/.test(r) && /Setu/.test(r) && /Ganita/.test(r), 'RAPPORT: hvad Yantra, Setu og Ganita goer')
}

if (fejl.length) { console.log(`ROED (${fejl.length}):\n- ` + fejl.join('\n- ')); process.exit(1) }
console.log(`verify-kritik-603 --blok ${blok}: groen`)
