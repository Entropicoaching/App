// KRITIK 656: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-656,
// dokumenterne i docs/kritik-656 og git.
//   node outputs/kritik-656/verify-656.mjs --blok 1   matematikken (mat-656.json, MATEMATIK.md)
//   node outputs/kritik-656/verify-656.mjs --blok 2   blok 1 + skakken (skak-656.json, SKAK.md) og RAPPORT-656
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-656')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-656/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))
const doc = (d, navn, afsnit, fund) => {
  if (!d) return
  for (const h of afsnit) ok(new RegExp(`^## ${h}`, 'm').test(d), `${navn}: afsnit ${h} mangler`)
  for (const f of fund) ok(new RegExp(`^\\| ${f} \\|`, 'm').test(d), `${navn}: ${f} mangler i fund-tabellen`)
  ok(!/[–—]/.test(d), `${navn}: tankestreg`)
  ok(udenNavne(d), `${navn}: atletnavn`)
}

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-656', 'grenen er ikke kritik-656')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-656\//.test(f), `uden for docs/kritik-656 og outputs/kritik-656: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-656@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-656 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikken ---------------------------------------------------------------------
const m = json('mat-656.json')
if (m) {
  ok(m.ver.foer === 'de17445' && m.ver.efter === '6e83254', `mat-656: versioner ${JSON.stringify(m.ver)}`)
  ok(m.net === 0 && m.fejl.length === 0, 'mat-656: net eller JS-fejl')
  const s = (k) => m.skaerme[k]
  for (const b of [390, 1280]) {
    const f = s(`foer-${b}`)
    const e = s(`efter-${b}`)
    ok(!f.kortet.tilOpgaven && e.kortet.tilOpgaven && e.kortet.tilOpgaven.bund < (b === 390 ? 844 : 900), `mat-656 ${b}: "Din opgave nu" ikke paa foerste skaerm efter 651`)
    ok(e.tryk && e.tryk.svarPaaSkaermen, `mat-656 ${b}: et tryk bringer ikke svarknapperne paa skaermen`)
    ok(e.kortet.skaerm.ord <= f.kortet.skaerm.ord, `mat-656 ${b}: foerste skaerm har flere ord efter 651`)
    ok(e.helt.side.ord === f.helt.side.ord, `mat-656 ${b}: Min helt er aendret (G4 staar som uaendret)`)
    ok(!e.kortet.vandret && !e.helt.vandret, `mat-656 ${b}: vandret rulning`)
    const n = m.nyElev[`efter-${b}`]
    ok(n.foersteSkaerm.scrollY === 0 && n.hhh.helPaaSkaermen && n.flag === null && n.efterGenindlaes === true && n.efterForstaaet?.flag === '1', `mat-656 ${b}: ny elev ser ikke forklaringen (G1)`)
    ok(m.nyElev[`foer-${b}`].foersteSkaerm.scrollY > 1000, `mat-656 ${b}: foer-maalingen af ny elev passer ikke med 648`)
    ok(m.hhh[`efter-${b}`].spoerg.trykflade === 44 && m.hhh[`efter-${b}`].spoerg.b === 30, `mat-656 ${b}: "?" er ikke 30 synlig / 44 trykflade`)
  }
  ok(m['forklaring-efter'].length === 3 && m.laerer.length === 3 && m.laerer.every((l, j) => l === m['forklaring-efter'][j].tekst), 'mat-656: laererens ark har ikke spillets ord')
  ok(m['forklaring-efter'].every((d) => d.ord <= 25), 'mat-656: en forklaring over 25 ord')
}
const d1 = tekst('MATEMATIK.md')
if (d1) {
  const l = d1.split('\n')
  ok(/^Matematikken mindre rodet: (ja|nej)$/.test(l[0]), 'MATEMATIK: foerste linje')
  ok(/^Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)$/m.test(d1), 'MATEMATIK: HHH-dommen')
  ok(/^## De tre vigtigste ting, der stadig er rodede\n\n1\. .+\n2\. .+\n3\. /m.test(d1), 'MATEMATIK: de tre ting')
  ok(/Ville Marc skamme sig/.test(d1), 'MATEMATIK: Marcs skam-spoergsmaal')
  if (m) for (const d of m['forklaring-efter']) ok(d1.includes(d.tekst), `MATEMATIK: ${d.navn}s ord ikke citeret ordret`)
  doc(d1, 'MATEMATIK', ['Hvad jeg målte', 'De tre skærme', 'Hoved, Hånd og Hjerte', 'Marc foran klassen', 'Fund', 'Ærlige grænser'], ['G2', 'G4', 'G5', 'G6', 'G7', 'G8'])
}

// --- blok 2: skakken og rapporten --------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-656.json')
  if (s) {
    ok(s.ver.skak === 'ea0e6f1', `skak-656: version ${s.ver.skak}`)
    ok(s.net === 0 && s.fejl.length === 0, 'skak-656: net eller JS-fejl')
    ok([360, 390, 1280].every((b) => s.bredder[b]), 'skak-656: en bredde mangler')
    ok(Object.values(s.bredder).every((x) => !x.vandret), 'skak-656: vandret rulning')
    for (const [b, x] of Object.entries(s.bredder)) {
      ok(x.alleLinje?.tekst.startsWith('Alle:') && x.alleLinje.linjer === 1, `skak-656 ${b}: "Alle:"-linjen ikke paa een linje`)
      ok(x.soejler.b.every((v) => v === 22) && x.soejler.h.every((v) => v === 44), `skak-656 ${b}: soejlerne er ikke 22 x 44`)
      ok(/den nyeste/.test(x.soejler.underNyeste.boble) && !x.soejler.underNyeste.stormStartet, `skak-656 ${b}: tryk under den nyeste`)
      ok(x.soejler.dagensKant === 'knap-storm-dagens', `skak-656 ${b}: Dagens storm rammes ikke i kanten`)
      ok(x.ros?.tekst === 'Ny Gafler-rekord!' && !x.nyRekordAlle, `skak-656 ${b}: slutkortets ros`)
      ok(/Din rekord på denne enhed: 20/.test(x.slutKort.tekst) && /−0 s/.test(x.slutKort.tekst), `skak-656 ${b}: S13/S14 holder ikke`)
      ok(x.temaLinje.linjer === (String(b).startsWith('360') || b === '390' ? 2 : 1), `skak-656 ${b}: temalinjens linjer (#33)`)
    }
  }
  const d2 = tekst('SKAK.md')
  if (d2) {
    ok(/^Skakken stadig klar til Marcs klasse: (ja|nej)$/.test(d2.split('\n')[0]), 'SKAK: foerste linje')
    ok(/Ville Marc skamme sig/.test(d2), 'SKAK: Marcs skam-spoergsmaal')
    doc(d2, 'SKAK', ['Hvad jeg målte', 'Stormens ord', 'Søjlerne', 'Marc foran klassen', 'Det, der stadig er rodet', 'Fund', 'Ærlige grænser'], ['S13', 'S14', 'S15', 'S16'])
  }
  const r = tekst('RAPPORT-656.md')
  if (r) {
    ok(/^Ordre 656/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/Matematikken mindre rodet: (ja|nej)/.test(r) && /Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)/.test(r), 'RAPPORT: matematikdommene')
    ok(/[Ss]kakken stadig klar til Marcs klasse: (ja|nej)/.test(r), 'RAPPORT: skakdommen')
    doc(r, 'RAPPORT', ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    const naeste = r.split('## Hvad er næste')[1] || ''
    ok(naeste.includes('**Ganita') && naeste.includes('**Chaturanga'), 'RAPPORT: Hvad er naeste mangler Ganita eller Chaturanga')
    ok(/Hara/.test(r), 'RAPPORT: Hara-linjen mangler')
  }
}

if (fejl.length) { console.log(`ROED (${fejl.length}):`); for (const f of fejl) console.log(' - ' + f); process.exit(1) }
console.log(`GROEN: verify-656 --blok ${blok}`)
