// KRITIK 576: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-576 og
// dokumenterne i docs/kritik-576, plus git og lint.
//   node outputs/kritik-576/verify-kritik-576.mjs --blok 1   vaerktoejssiden (VAERKTOEJER.md)
//   node outputs/kritik-576/verify-kritik-576.mjs --blok 2   blok 1 + karrusellerne (KARRUSELLER.md) og RAPPORT-576
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-576')
const SETU = 'C:/Users/Entropi/Desktop/ordrer/kilder/setu-573'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-576/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const navne = [...new Set([...readFileSync(path.join(ROOT, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const udenNavne = (t) => navne.every((n) => !new RegExp(`\\b${n}\\b`, 'i').test(t))

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-576', 'grenen er ikke kritik-576')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-576\//.test(f), `uden for docs/kritik-576 og outputs/kritik-576: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-576@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-576 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --short refs/heads/vaerktoejer').trim() === 'ba44cb1', 'vaerktoejer er flyttet fra ba44cb1')
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 status --porcelain --untracked-files=no').trim() === '', 'sitets trae har aendringer (maa ikke roeres)')

// --- blok 1 --------------------------------------------------------------------------------
const vv = tekst('VAERKTOEJER.md')
const v = json('vaerktoejer-576.json')
if (vv) {
  ok(/^vaerktoejssiden klar til Marcs deploy: (ja|nej)$/.test(vv.split('\n')[0]), 'VAERKTOEJER: foerste linje skal vaere "vaerktoejssiden klar til Marcs deploy: ja/nej"')
  for (const h of ['Hvad jeg målte', 'Den nyeste dist', 'Virker det', 'Teksten over værktøjet', 'Stadig noindex', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(vv), `VAERKTOEJER: afsnit ${h} mangler`)
  for (let n = 0; n <= 6; n++) ok(new RegExp(`^\\| W${n} \\|`, 'm').test(vv), `VAERKTOEJER: W${n} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(vv), 'VAERKTOEJER: tankestreg')
  ok(udenNavne(vv), 'VAERKTOEJER: atletnavn')
  ok(/W0/.test(vv.split('\n').slice(0, 6).join('\n')) && /W1-W3/.test(vv.split('\n').slice(0, 8).join('\n')), 'VAERKTOEJER: dommen skal sige, hvad der mangler')
}
if (v && vv) {
  ok(v.top === 'ba44cb1', `maalt paa ${v.top}`)
  ok(v.tjek.length >= 27 && v.tjek.every((t) => t.ok), `vaerktoejer-576: ${v.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(Object.entries(v.kilde).filter(([k]) => !['ikkeKopieret', 'sidsteDistCommit', 'main'].includes(k)).every(([, x]) => x.ens), 'kilden: en mappe er ikke = 37c9a27')
  ok(v.kilde.main.top !== '37c9a27' && v.kilde.main.afvig.length === 2 && vv.includes(v.kilde.main.top), 'W0: main-hashen staar ikke i dokumentet')
  ok(v.noindex.meta && v.noindex.robots && !v.noindex.sitemap && !v.noindex.linkerTil.length, 'noindex')
  ok(v.sider.length === 33 && v.sider.every((s) => s.vandret <= 0 && !s.fejl.length && !s.brudte.length), 'siderne paa 360/390/1280')
  ok(Object.values(v.links).every((s) => s === 200), 'et link giver ikke 200')
  ok(v.ligner.length === 42 && v.ligner.every((r) => r.status === r.forvent), 'Ligner-tilfaeldene')
  ok(v.video.length === 3 && v.video.every((r) => r.nr1 === 1 && r.foto === r.vist && r.ulaeselig.ms < 2000), 'videoen')
  ok(vv.includes('fejlfigurenerne') && vv.includes('148-195 ord'), 'W4/W5 i dokumentet')
  for (const p of ['V-390-vaerktoejer.png', 'V-1280-vaerktoejer.png', 'V-390-video.png', 'V-390-tryk-seks-punkter.png', 'V-390-ligner-sq-bund-kun-knae.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const kk = tekst('KARRUSELLER.md')
  const r = tekst('RAPPORT-576.md')
  const k = json('karruseller-576.json')
  if (kk) {
    ok(/^karrusellerne klar til Marc: (ja|nej)$/.test(kk.split('\n')[0]), 'KARRUSELLER: foerste linje skal vaere "karrusellerne klar til Marc: ja/nej"')
    for (const h of ['Hvad jeg målte', 'Marcs regler', 'Læsbar på en telefon', 'Sand', 'Siger de noget, modellen ikke kan', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(kk), `KARRUSELLER: afsnit ${h} mangler`)
    for (let n = 1; n <= 6; n++) ok(new RegExp(`^\\| K${n} \\|`, 'm').test(kk), `KARRUSELLER: K${n} mangler i fund-tabellen`)
    ok(!/[\u2013\u2014]/.test(kk), 'KARRUSELLER: tankestreg')
    ok(udenNavne(kk), 'KARRUSELLER: atletnavn')
  }
  if (k) {
    ok(k.tjek.length >= 16 && k.tjek.every((t) => t.ok), `karruseller-576: ${k.tjek.filter((t) => !t.ok).length} tjek roede`)
    // Setus filer er ikke roert: samme sha256 som da jeg maalte
    for (const [f, h] of Object.entries(k.filer || {})) { const p = path.join(SETU, f); ok(existsSync(p) && createHash('sha256').update(readFileSync(p)).digest('hex') === h, `setu-573/${f} er aendret eller mangler`) }
    ok(Object.keys(k.filer || {}).length >= 25, 'setu-573: for faa filer registreret')
    for (const f of readdirSync(HERE).filter((f) => /^K\d-390-slides/.test(f))) ok(true, f)
    ok(readdirSync(HERE).filter((f) => /^K\d-390-slides/.test(f)).length === 4, 'K*-390-slides mangler')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 576'), 'RAPPORT: foerste linje skal starte med "Ordre 576"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    ok(naeste.includes('Setu'), 'RAPPORT: Setu naevnes ikke under hvad er naeste')
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
    ok(udenNavne(r), 'RAPPORT: atletnavn')
    ok(/vaerktoejssiden klar til Marcs deploy: \*\*(ja|nej)\*\*/.test(r) && /karrusellerne klar til Marc: \*\*(ja|nej)\*\*/.test(r), 'RAPPORT: begge domme')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-576 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-576 --blok ${blok}: groen`)
