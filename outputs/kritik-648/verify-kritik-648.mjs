// KRITIK 648: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-648,
// dokumenterne i docs/kritik-648 og git.
//   node outputs/kritik-648/verify-kritik-648.mjs --blok 1   matematikken (mat-648.json, MATEMATIK.md)
//   node outputs/kritik-648/verify-kritik-648.mjs --blok 2   blok 1 + NYT-I-APPEN (nyt-648.json, NYT-I-APPEN.md) og RAPPORT-648
// Exit 1 ved fejl.
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-648')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-648/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const doc = (d, navn, afsnit, fund) => {
  if (!d) return
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(d), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(d), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(d), `${navn}: tankestreg`)
  ok(udenNavne(d), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-648', 'grenen er ikke kritik-648')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-648\//.test(f), `uden for docs/kritik-648 og outputs/kritik-648: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-648@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-648 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikken ---------------------------------------------------------------------
const m = json('mat-648.json')
if (m) {
  ok(m.ver.foer === '31d22fd' && m.ver.efter === '471784d', `mat-648: versioner ${JSON.stringify(m.ver)}`)
  ok(m.net === 0 && m.fejl.length === 0, 'mat-648: net eller JS-fejl')
  const s = (k) => m.skaerme[k]
  ok(s('efter-390').helt.side.ord < s('foer-390').helt.side.ord && s('efter-390').helt.skaerme < s('foer-390').helt.skaerme, 'mat-648: Min helt ikke kortere')
  ok(['efter-390', 'efter-1280'].every((k) => Object.values(s(k).tilbage).every((t) => t && t.y < 120)), 'mat-648: Tilbage ikke oeverst efter 643')
  ok(s('efter-390').kortet.foersteSvarY > 844, 'mat-648: G3 (opgaven under foerste skaerm) holder ikke')
  ok(m.hhh['efter-390'].vises && m.hhh['efter-390'].helPaaFoersteSkaerm, 'mat-648: forklaringen vises ikke for gemt spil')
  ok(['efter-390', 'efter-1280'].every((k) => m.nyElev[k].hhh.vises && m.nyElev[k].foersteSkaerm.scrollY > m.nyElev[k].hhh.top + m.hhh[k].hoejde && m.nyElev[k].flag === '1' && m.nyElev[k].efterGenindlaes === false), 'mat-648: G1 (ny elev ser den ikke) holder ikke')
  ok(m.forklaring.length === 3 && m.laerer.length === 3 && m.laerer.every((l, j) => l === m.forklaring[j].tekst), 'mat-648: laererens ark har ikke spillets ord')
  ok(m.hhh['efter-390'].spoerg.b === 30, 'mat-648: G6 "?" er ikke 30 px')
}
const d1 = tekst('MATEMATIK.md')
if (d1) {
  const l = d1.split('\n')
  ok(/^Matematikken mindre rodet: (ja|nej)$/.test(l[0]), 'MATEMATIK: foerste linje')
  ok(/^Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)$/m.test(d1), 'MATEMATIK: HHH-dommen')
  ok(/^## De tre vigtigste ting, der stadig er rodede\n\n1\. .+\n2\. .+\n3\. /m.test(d1), 'MATEMATIK: de tre ting')
  doc(d1, 'MATEMATIK', ['Hvad jeg målte', 'De tre skærme', 'Hoved, Hånd og Hjerte', 'Marc foran klassen', 'Fund', 'Ærlige grænser'], ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'])
}

// --- blok 2: NYT-I-APPEN og rapporten -------------------------------------------------------
if (blok >= 2) {
  const n = json('nyt-648.json')
  if (n) {
    ok(n.app === '391144e', 'nyt-648: app-version')
    ok(n.koersler.length === 4 && n.koersler.every((k) => k.sidelaens <= 0 && k.billeder.every((b) => b.ok) && k.punkter.length === 6 && !k.tankestreg), 'nyt-648: en koersel er roed')
    ok(n.citater.length >= 6 && n.citater.every((c) => c.fundet.length > 0), `nyt-648: citat ikke i koden: ${n.citater.filter((c) => !c.fundet.length).map((c) => c.citat)}`)
    ok(n.net === 0 && n.fejl.length === 0, 'nyt-648: net eller JS-fejl')
    const fil = 'C:/Users/Entropi/Desktop/NYT-I-APPEN.html'
    if (existsSync(fil)) ok(createHash('sha256').update(readFileSync(fil)).digest('hex') === n.sha256, 'nyt-648: NYT-I-APPEN.html er aendret siden maalingen')
  }
  const d2 = tekst('NYT-I-APPEN.md')
  if (d2) {
    ok(/^NYT-I-APPEN klar til at Marc kan sende den: (ja|nej)$/.test(d2.split('\n')[0]), 'NYT-I-APPEN: foerste linje')
    ok(n && d2.includes(n.sha256.slice(0, 12)), 'NYT-I-APPEN: filens hash')
    doc(d2, 'NYT-I-APPEN', ['Hvad jeg målte', 'Punkt for punkt mod koden', 'Tonen', 'Fund', 'Ærlige grænser'], ['N1', 'N2', 'N3', 'N4', 'N5'])
  }
  const r = tekst('RAPPORT-648.md')
  if (r) {
    ok(/^Ordre 648/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/Matematikken mindre rodet: (ja|nej)/.test(r) && /Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)/.test(r), 'RAPPORT: matematikdommene')
    ok(/NYT-I-APPEN klar til at Marc kan sende den: (ja|nej)/.test(r), 'RAPPORT: NYT-dommen')
    doc(r, 'RAPPORT', ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    const naeste = r.split('## Hvad er næste')[1] || ''
    ok(naeste.includes('**Ganita') && naeste.includes('**Vaidya'), 'RAPPORT: Hvad er naeste mangler Ganita eller Vaidya')
    ok(/Hara/.test(r), 'RAPPORT: Hara-linjen mangler')
  }
}

if (fejl.length) { console.log(`ROED (${fejl.length}):`); for (const f of fejl) console.log(' - ' + f); process.exit(1) }
console.log(`GROEN: verify-kritik-648 --blok ${blok}`)
