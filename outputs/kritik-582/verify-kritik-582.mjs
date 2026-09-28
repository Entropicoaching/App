// KRITIK 582: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-582 og dokumenterne i docs/kritik-582, plus git og lint.
//   node outputs/kritik-582/verify-kritik-582.mjs --blok 1   artiklerne (ARTIKLER.md)
//   node outputs/kritik-582/verify-kritik-582.mjs --blok 2   blok 1 + videoen (VIDEO.md) og RAPPORT-582
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-582')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-582/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-582', 'grenen er ikke kritik-582')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-582\//.test(f), `uden for docs/kritik-582 og outputs/kritik-582: ${f}`)
for (const f of [...aendret, ...utilstraekkelig]) ok(!/\.(mp4|mov|webm|pdf)$/i.test(f), `klip eller PDF i repoet: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-582@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-582 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --short artikel-doedloeft').trim() === '1c85d55', 'artikel-doedloeft er flyttet fra 1c85d55')
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --short artikel-baenk').trim() === 'd33a6f1', 'artikel-baenk er flyttet fra d33a6f1')
const ingenStreg = (s, navn) => ok(!/[\u2013\u2014]/.test(s), `${navn}: tankestreg`)

// --- blok 1 --------------------------------------------------------------------------------
const aa = tekst('ARTIKLER.md')
const a = json('artikler-582.json')
if (aa) {
  ok(/^doedloeft-artiklen klar naar Marc har svaret: (ja|nej)\. baenk-artiklen klar naar Marc har svaret: (ja|nej)\b/.test(aa.split('\n')[0]), 'ARTIKLER: foerste linje skal have begge domme')
  for (const h of ['Hvad jeg målte', 'Dødløftet', 'Bænken', 'Læsesiden', 'Marcs stilregler og siden', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(aa), `ARTIKLER: afsnit ${h} mangler`)
  for (const n of ['DA1', 'DA2', 'DA3', 'DA7', 'DA9', 'DA11', 'DA13', 'DA14', 'BA1', 'BA2', 'BA8', 'BA10']) ok(new RegExp(`\\b${n}\\b`).test(aa), `ARTIKLER: ${n} naevnes ikke`)
  ingenStreg(aa, 'ARTIKLER')
}
if (a && aa) {
  ok(a.grene.dl.top === '1c85d55' && a.grene.bp.top === 'd33a6f1' && a.loeftmodelMain === 'cc4dd7d', 'maalt paa andre commits')
  ok(a.tjek.length >= 35 && a.tjek.every((t) => t.ok), `artikler-582: ${a.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(a.ba.BA1.model.stor === '24,1' && aa.includes('22,1 / 25,1 / 24,1'), 'BA1')
  ok(a.ipf.hentet ? Object.values(a.ipf.fundet).every(Boolean) && aa.includes(a.ipf.sha256.slice(0, 8)) : /uden net/.test(aa), 'regelbogen')
  ok(!a.ordret.dl.manglerILaes.length && !a.ordret.bp.manglerILaes.length && aa.includes(`${a.ordret.dl.artikel} i dødløftet og ${a.ordret.bp.artikel} i bænken`), 'laesesiden ordret')
  ok(aa.includes('2348 ord') && aa.includes('2268 ord'), 'laesetiden')
  for (const p of ['A-390-dl-kap7-tabel.png', 'A-390-dl-forbehold.png', 'A-390-bp-buen.png', 'A-390-bp-buen-svar.png', 'A-390-laes-dl2.png', 'A-1280-dl-kap7-tabel.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const vv = tekst('VIDEO.md')
  const r = tekst('RAPPORT-582.md')
  const v = json('video-582.json')
  if (vv) {
    ok(/^videoen klar til sitet: (ja|nej)\b/.test(vv.split('\n')[0]), 'VIDEO: foerste linje skal vaere "videoen klar til sitet: ja/nej"')
    for (const h of ['Hvad jeg målte', 'Trinene', 'Hop til', 'De første tryk', '4K', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(vv), `VIDEO: afsnit ${h} mangler`)
    ingenStreg(vv, 'VIDEO')
  }
  if (v) {
    ok(v.loeftmodel === '291f5bf', `video maalt paa ${v.loeftmodel}`)
    ok(v.tjek.length >= 12 && v.tjek.every((t) => t.ok), `video-582: ${v.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok(v.net === 0, `video: ${v.net} netkald`)
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 582'), 'RAPPORT: foerste linje skal starte med "Ordre 582"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Setu', 'Yantra']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ingenStreg(r, 'RAPPORT')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-582 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-582 --blok ${blok}: groen`)
