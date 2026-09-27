// KRITIK 525: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-525 og dokumenterne i docs/kritik-525, plus git og lint.
//   node outputs/kritik-525/verify-kritik-525.mjs --blok 1   matematikspillet (MATEMATIK.md)
//   node outputs/kritik-525/verify-kritik-525.mjs --blok 2   blok 1 + squat-udgivelsen og RAPPORT-525
// Kontrollen er, at maalingerne findes og siger det, dokumenterne paastaar, at grenen kun
// roerer docs/kritik-525 og outputs/kritik-525, at der ikke er pushet, og at lint er groen.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-525')
const BASE = 'main'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-525/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
const aendret = sh(`git diff --name-only ${BASE}...HEAD`).split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-525\//.test(f), `uden for docs/kritik-525 og outputs/kritik-525: ${f}`)
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-525', 'grenen er ikke kritik-525')
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-525@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-525 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh(`git log --format=%B ${BASE}..HEAD`).split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikspillet ------------------------------------------------------------
const m = tekst('MATEMATIK.md')
const e = json('elev-525.json')
const v = json('variation-525.json')
if (m) {
  ok(/^matematikspillet foeles som et eventyr: (ja|nej)\b/.test(m.split('\n')[0]), 'MATEMATIK: foerste linje skal vaere "matematikspillet foeles som et eventyr: ja/nej"')
  for (let n = 1; n <= 9; n++) ok(new RegExp(`^\\| M${n} \\|`, 'm').test(m) && m.includes(`### M${n} `), `MATEMATIK: M${n} mangler i tabellen eller som afsnit`)
  ok(!/Tulle/.test(m) || /fantasinavn/.test(m), 'MATEMATIK: eleven skal staa som fantasinavn')
}
if (e && m) {
  ok(e.spil === '4bdda17', `spillet er ${e.spil}, ikke main 4bdda17`)
  const k = Object.fromEntries(e.koersler.map((x) => [`${x.variant}-${x.bredde}`, x]))
  ok(Object.keys(k).sort().join() === 'foelger-1280,foelger-390,travl-1280,travl-390', 'fire koersler: travl og foelger paa 390 og 1280')
  for (const x of e.koersler) {
    ok(x.ur.s >= 1800 && x.ur.s < 1900, `${x.variant}-${x.bredde}: 30 minutter paa modellens ur (${x.ur.s} s)`)
    ok(x.sidefejl.length === 0 && x.vandret && x.opg.ukendt === 0, `${x.variant}-${x.bredde}: 0 sidefejl, ingen vandret rulning, facit til alle opgaver`)
    const n1 = x.log.findIndex((h) => h.art === 'niveau-op')
    ok(x.log[n1].t === 398 && x.log.slice(0, n1).filter((h) => h.art === 'opgave').length === 12, `M1: 12 opgaver og 398 s foer det foerste hak (${x.variant}-${x.bredde})`)
    ok(x.tilstand.figur.haand === 1 && x.tilstand.figur.hjerte === 1, 'M2: Haand og Hjerte staar paa 1 efter 30 min')
    ok(x.tilstand.questFremdrift.stenbrud.every((b) => !b) && x.log.filter((h) => h.art === 'gaar-til').length === 0, 'M3: kun Moellen paa 30 min')
  }
  ok(e.koersler.reduce((a, x) => a + x.opg.antal, 0) === 201 && m.includes('Alle 201 opgaver'), '201 opgaver i alt')
  const t = k['travl-390']; const f = k['foelger-390']
  ok(t.tilstand.figur.niveau === 8 && t.tilstand.questbog.klaret.length === 0 && /Udstyr 1 af 9/.test(t.minHelt.udstyr), 'M2/M6: travl niveau 8, 0 quests, 1 af 9')
  ok(f.tilstand.figur.niveau === 5 && f.tilstand.questbog.klaret.join() === 'mel-til-bageren,broed-til-alle,aenderne' && /Udstyr 2 af 9/.test(f.minHelt.udstyr), 'foelger: niveau 5, tre quests, 2 af 9')
  ok(t.log.filter((h) => h.art === 'samme-forloeb-igen' && /lærer/.test(h.tekst)).length === 3 && f.log.filter((h) => h.art === 'samme-forloeb-igen' && /lærer/.test(h.tekst)).length === 4, 'M4: "spoerg din laerer" 3 og 4 gange')
  ok(f.log.filter((h) => h.art === 'opgave' && /2\/3.*2\/5|2\/5.*2\/3/.test(h.tekst)).length === 8, 'M5: 2/3 mod 2/5 otte gange hos foelgeren')
  ok(t.foersteSkaerm.opgaveTop === 1562 && k['travl-1280'].foersteSkaerm.opgaveTop === 1791, 'M1/M7: foerste opgave 1562 og 1791 px nede')
  ok(t.log.filter((h) => h.udraab).every((h) => h.udraab.some((u) => u.quest === 'mel-til-bageren' && !u.iSyne)), 'M6: Anes "!" er uden for skaermen efter hvert forloeb (travl)')
  const d2 = e.dag2
  ok(d2.length === 2 && d2.every((x) => x.bi && x.bi.w >= 24 && /Nye bistader/.test(x.panel) && /brædder/.test(x.panel) && x.sidefejl.length === 0), 'M8: Bigaarden paa anden dag')
}
if (v && m) {
  ok(v['moellen-3'].hyppigstePar.par === '2/3 og 2/5' && v['moellen-3'].hyppigstePar.andel > 0.09 && v['moellen-3'].hyppigstePar.andel < 0.1 && m.includes('9 %'), 'M5: 9 % 2/3 og 2/5 i forloeb 3')
  ok(v['moellen-4'].hyppigstePar.andel >= 0.075 && m.includes('8 %'), 'M5: forloeb 4')
}

// --- blok 2: squat-udgivelsen og rapporten -------------------------------------------------
if (blok >= 2) {
  const sq = tekst('SQUAT-2.md')
  const s = json('squat-525.json')
  const rap = tekst('RAPPORT-525.md')
  if (sq) {
    ok(/^squat-artiklen klar til udgivelse naar Marc har valgt: (ja|nej)\b/.test(sq.split('\n')[0]), 'SQUAT-2: foerste linje')
    for (let n = 1; n <= 16; n++) ok(new RegExp(`^\\| U${n} \\| (lukket|venter paa Marc|venter paa Yantra|aaben)`, 'm').test(sq), `SQUAT-2: U${n} mangler status`)
  }
  if (s && sq) {
    ok(s.gren === 'udgivelse-squat-min-krop' && s.top === '273d670', 'squat: grenens top er 273d670')
    ok(s.sider.every((x) => x.sidefejl === 0 && x.vandret && x.synligMarc === 0 && x.tankestreger === 0), 'squat: sider uden fejl, vandret rulning, [MARC] og tankestreger')
    ok(s.kilde.marcIKilde === 0 && s.kilde.classMarc === 0, 'U1/U4: ingen [MARC] i kilden')
    ok(s.kilde.titelLaengde === 67 && s.kilde.beskrivelseLaengde === 150, 'U7: 67 og 150 tegn')
  }
  if (rap) {
    ok(rap.split('\n')[0].startsWith('Ordre 525'), 'RAPPORT: foerste linje "Ordre 525"')
    for (const h of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rap.includes(h), `RAPPORT: afsnit ${h} mangler`)
    for (const n of ['Ganita', 'Setu']) ok(new RegExp(`\\*\\*${n}`).test(rap), `RAPPORT: hvad ${n} goer`)
  }
}

try { sh('npm run lint --silent') } catch (x) { fejl.push(`npm run lint roed: ${String(x.stdout || x.message).slice(0, 300)}`) }

if (fejl.length) { console.error(`verify-kritik-525 --blok ${blok}: ROED\n- ` + fejl.join('\n- ')); process.exit(1) }
console.log(`verify-kritik-525 --blok ${blok}: groen`)
