// KRITIK 664: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-664,
// dokumenterne i docs/kritik-664 og git.
//   node outputs/kritik-664/verify-664.mjs --blok 1   matematikken (mat-664.json, MATEMATIK.md)
//   node outputs/kritik-664/verify-664.mjs --blok 2   blok 1 + skakken (skak-664.json, SKAK.md) og RAPPORT-664
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-664')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-664/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
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
const PNG = (re) => sh('git ls-files --others --cached outputs/kritik-664').split('\n').filter((f) => re.test(f))

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-664', 'grenen er ikke kritik-664')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const uncommitted = sh('git status --porcelain -uall').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...uncommitted]) ok(/^(docs|outputs)\/kritik-664\//.test(f), `uden for docs/kritik-664 og outputs/kritik-664: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-664@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-664 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)

// --- blok 1: matematikken ---------------------------------------------------------------------
const m = json('mat-664.json')
if (m) {
  ok(m.ver.v643 === 'de17445' && m.ver.v658 === '04d25b3' && m.ver.v660 === 'f78f354', `mat-664: versioner ${JSON.stringify(m.ver)}`)
  ok(m.net === 0 && m.fejl.length === 0, 'mat-664: net eller JS-fejl')
  for (const b of [390, 1280]) {
    const f = m.skaerme[`v643-${b}`]
    const e = m.skaerme[`v660-${b}`]
    ok(e.kortet.skaerm.ord <= f.kortet.skaerm.ord && e.kortet.skaerm.tal <= f.kortet.skaerm.tal, `mat-664 ${b}: kortet mere rodet end 643`)
    ok(e.helt.side.ord < f.helt.side.ord && e.helt.side.tal < f.helt.side.tal && e.helt.skaerme < f.helt.skaerme, `mat-664 ${b}: Min helt ikke kortere end 643`)
    ok(e.tryk?.svarPaaSkaermen && e.tryk.heltPaaSkaermen, `mat-664 ${b}: "Din opgave nu" bringer ikke svar og helt paa skaermen`)
    ok(!e.kortet.vandret && !e.helt.vandret, `mat-664 ${b}: vandret rulning`)
    ok(m.nyElev[`v660-${b}`].foersteSkaerm.scrollY === 0 && m.nyElev[`v660-${b}`].hhh.helPaaSkaermen, `mat-664 ${b}: ny elev ser ikke forklaringen`)
    const mm = m.mmorpg[`v660-${b}`]
    const mm8 = m.mmorpg[`v658-${b}`]
    ok(mm.rigtigt[0].flyv === 2 && /^\+\d+$/.test(mm.rigtigt[0].flyvTekst[0]) && mm8.rigtigt[0].flyv === 1, `mat-664 ${b}: "+N" fra helten (G9) holder ikke`)
    ok(mm.rigtigt.find((x) => x.ms === 700).anim <= 2 && mm.rigtigt.find((x) => x.ms === 1000).anim === 0 && mm8.rigtigt.find((x) => x.ms === 1000).anim > 0, `mat-664 ${b}: et rigtigt svar er ikke roligt efter 0,7 / 1 s`)
    ok(mm.forkert.every((x) => x.flyv === 0), `mat-664 ${b}: et forkert tryk giver et tal`)
    ok(mm.rigtigtEfterGaet[2].flyvTekst.some((t) => t.startsWith('+5')), `mat-664 ${b}: gaet giver ikke +5`)
    ok(mm.forloeb.niveau === '2 -> 3' && mm.efterVidereMaal.bannerTekst?.startsWith('NIVEAU OP!'), `mat-664 ${b}: nyt niveau / banner`)
    ok(mm.efterVidere[0].anim >= 30 && mm8.efterVidere[0].anim >= 30, `mat-664 ${b}: G10 (mange ting i bevaegelse ved nyt niveau) holder ikke`)
    ok(/Niveau 2 \+1/.test(mm.efterVidere[1].flyvTekst.join(' ')), `mat-664 ${b}: flyderen taeller ikke "Niveau 2 +1" under banneret`)
    ok(/^Siden sidst: Niveau 3 \+1/.test(mm.sidenSidst ?? ''), `mat-664 ${b}: Siden sidst paa Min helt`)
  }
  for (const t of ['v658', 'v660']) {
    const md = m.model[t]
    ok(md && md.gaetter.medianNiveau === 1 && md.regner75.medianNiveau === 19 && md.gaetter.medBeloenning === 111, `mat-664: gaettermodellen ${t}`)
  }
  ok(m.hhh['v660-390'].tekst === m.hhh['v658-390'].tekst, 'mat-664: HHH-ordene er aendret siden 658')
  ok(PNG(/M664-v660-390-B3b-efter-videre-120ms\.png$/).length === 1 && PNG(/M664-.*\.png$/).length >= 40, 'mat-664: billeder mangler')
}
const d1 = tekst('MATEMATIK.md')
if (d1) {
  const l = d1.split('\n')
  ok(/^Matematikken mindre rodet: (ja|nej)$/.test(l[0]), 'MATEMATIK: foerste linje')
  ok(/^Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)$/m.test(d1), 'MATEMATIK: HHH-dommen')
  ok(/^MMORPG-følelse: (ja|nej)$/m.test(d1), 'MATEMATIK: MMORPG-dommen')
  ok(/^## De tre vigtigste ting, der stadig er rodede\n\n1\. .+\n2\. .+\n3\. /m.test(d1), 'MATEMATIK: de tre ting')
  ok(/Ville Marc skamme sig/.test(d1), 'MATEMATIK: Marcs skam-spoergsmaal')
  ok(/Gætteren kan ikke nå de flotteste trin før den ærlige/.test(d1), 'MATEMATIK: gaetteren')
  if (m) for (const s of m.hhh['v660-390'].tekst.replace(/^Hoved, Hånd og Hjerte /, '').replace(/ Forstået$/, '').split(/(?<=\.) (?=H[oåj])/)) ok(d1.includes(s), `MATEMATIK: HHH ikke citeret ordret: ${s.slice(0, 30)}`)
  doc(d1, 'MATEMATIK', ['Hvad jeg målte', 'MMORPG eller Cookie Clicker', 'De tre skærme', 'Hoved, Hånd og Hjerte', 'Marc foran klassen', 'Fund', 'Ærlige grænser'], ['G2', 'G4', 'G6', 'G7', 'G9', 'G10', 'G12'])
}

// --- blok 2: skakken og rapporten --------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-664.json')
  if (s) {
    ok(s.ver.foer === '85a4236' && s.ver.efter === '66bbcaf', `skak-664: versioner ${JSON.stringify(s.ver)}`)
    ok(s.net === 0 && s.fejl.length === 0, 'skak-664: net eller JS-fejl')
    for (const t of ['foer', 'efter']) ok(['360', '360x640', '390', '1280'].every((b) => s.v[t][b]?.slutD && s.v[t][b]?.slutE), `skak-664 ${t}: en bredde eller storm mangler`)
    for (const b of ['360', '360x640', '390', '1280']) {
      const f = s.v.foer[b]
      const e = s.v.efter[b]
      ok(!e.vandret, `skak-664 ${b}: vandret rulning`)
      ok(e.slutD.rekordLinjer === 2 && f.slutD.rekordLinjer === 4 && !e.slutD.nulS && f.slutD.nulS, `skak-664 ${b}: S13/S14 ikke rettet`)
      ok(e.slutE.rekordLinjer === 1 && e.slutE.kort.ord < f.slutE.kort.ord, `skak-664 ${b}: slutkort med fejl ikke roligere`)
      ok(e.temaLinje.linjer === 1, `skak-664 ${b}: temalinjen ikke paa een linje`)
      ok(/Din rekord på denne enhed/.test(e.startKort.tekst) && /Gafler, bedst/.test(e.startKort.tekst), `skak-664 ${b}: S17 holder ikke`)
      if (b !== '1280') {
        ok(e.faner.h.every((h) => h >= 44) && e.faner.mellem === 2 && f.faner.h.every((h) => h === 42), `skak-664 ${b}: fanerne`)
        ok(e.faner.trykMellem.every((x) => x === 'faner'), `skak-664 ${b}: S20 (mellemrummet) holder ikke`)
        ok(e.gaader.smaa.length === 0 && e.spil.smaa.length === 0, `skak-664 ${b}: knapper under 44 px paa foerste skaerm`)
      }
    }
    ok(s.v.efter['360'].spil.braet.over === -24 && s.v.foer['360'].spil.braet.over === -21, 'skak-664: Spil 360 braettet (S19)')
    ok(s.v.efter['360x640'].gaader.braet.over === 6, 'skak-664: Gaader 360x640 braettet')
  }
  const d2 = tekst('SKAK.md')
  if (d2) {
    ok(/^Skakken stadig klar til Marcs klasse: (ja|nej)$/.test(d2.split('\n')[0]), 'SKAK: foerste linje')
    ok(/Ville Marc skamme sig/.test(d2), 'SKAK: Marcs skam-spoergsmaal')
    doc(d2, 'SKAK', ['Hvad jeg målte', 'Slutkortet', 'Fanerne og brættet', 'Marc foran klassen', 'Det, der stadig er rodet', 'Fund', 'Ærlige grænser'], ['S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20'])
  }
  const r = tekst('RAPPORT-664.md')
  if (r) {
    ok(/^Ordre 664/.test(r.split('\n')[0]), 'RAPPORT: foerste linje')
    ok(/Matematikken mindre rodet: (ja|nej)/.test(r) && /Hoved\/Hånd\/Hjerte forståelig for en 11-årig: (ja|nej)/.test(r) && /MMORPG-følelse: (ja|nej)/.test(r), 'RAPPORT: matematikdommene')
    ok(/[Ss]kakken stadig klar til Marcs klasse: (ja|nej)/.test(r), 'RAPPORT: skakdommen')
    doc(r, 'RAPPORT', ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'], [])
    const naeste = r.split('## Hvad er næste')[1] || ''
    ok(naeste.includes('**Ganita') && naeste.includes('**Chaturanga'), 'RAPPORT: Hvad er naeste mangler Ganita eller Chaturanga')
    ok(/Hara/.test(r), 'RAPPORT: Hara-linjen mangler')
  }
}

if (fejl.length) { console.log(`ROED (${fejl.length}):`); for (const f of fejl) console.log(' - ' + f); process.exit(1) }
console.log(`GROEN: verify-664 --blok ${blok}`)
