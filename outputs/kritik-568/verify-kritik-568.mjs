// KRITIK 568: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-568 og dokumenterne i docs/kritik-568, plus git og lint.
//   node outputs/kritik-568/verify-kritik-568.mjs --blok 1   doedloeft-artiklen (DOEDLOEFT.md)
//   node outputs/kritik-568/verify-kritik-568.mjs --blok 2   blok 1 + skakken efter 556 (SKAK.md) og RAPPORT-568
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-568')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-568/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-568', 'grenen er ikke kritik-568')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-568\//.test(f), `uden for docs/kritik-568 og outputs/kritik-568: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-568@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-568 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva status --porcelain --untracked-files=no').trim() === '', 'loeftmodellen har aendringer (maa ikke roeres)')
// Setu arbejder selv i wt2 (gren og arbejdskopi er hans); jeg tjekker kun, at den maalte gren er uflyttet.
ok(sh('git -C C:/Users/Entropi/Desktop/entropi-coaching-site-wt2 rev-parse --short artikel-doedloeft').trim() === '1793972', 'artikel-doedloeft er flyttet fra 1793972')

// --- blok 1 --------------------------------------------------------------------------------
const dd = tekst('DOEDLOEFT.md')
const d = json('doedloeft-568.json')
if (dd) {
  ok(/^doedloeft-artiklen klar naar Marc har svaret: (ja|nej)\b/.test(dd.split('\n')[0]), 'DOEDLOEFT: foerste linje skal vaere "doedloeft-artiklen klar naar Marc har svaret: ja/nej"')
  for (const h of ['Hvad jeg målte', 'Tallene og figurerne', 'Kilderne', '\\[MARC\\]-stederne', 'Marcs stilregler og siden', 'Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(dd), `DOEDLOEFT: afsnit ${h} mangler`)
  for (let n = 1; n <= 12; n++) ok(new RegExp(`^\\| DA${n} \\|`, 'm').test(dd), `DOEDLOEFT: DA${n} mangler i fund-tabellen`)
  ok(!/[\u2013\u2014]/.test(dd), 'DOEDLOEFT: tankestreg')
}
if (d && dd) {
  ok(d.top === '1793972' && d.loeftmodelMain === 'ede9fd0', `maalt paa ${d.top} / ${d.loeftmodelMain}`)
  ok(d.tjek.length >= 29 && d.tjek.every((t) => t.ok), `doedloeft-568: ${d.tjek.filter((t) => !t.ok).length} tjek roede`)
  ok(d.sider.length === 2 && d.sider.every((s) => s.vandret && !s.sidefejl.length && !s.http404.length && !s.tankestreger && !s.synligMarc && s.billeder.length === 17), 'siden paa 390/1280')
  ok(d.fund.DA1.knaeProcentIArtikel.length === 4 && d.fund.DA1.rettetI === 'ae48739' && dd.includes('ae48739'), 'DA1')
  ok(dd.includes('2346 ord') && d.tjek.some((t) => /2346 ord/.test(t.hvad)), 'laesetiden')
  ok(/dommen ja/.test(dd) && /DA1-DA3/.test(dd.split('\n').slice(0, 8).join('\n')), 'DOEDLOEFT: dommen skal sige, hvad der mangler')
  for (const p of ['D-390-kap4-tal.png', 'D-390-kap7-knae-procent.png', 'D-390-lockout.png', 'D-390-forbehold.png', 'D-1280-kap7-knae-procent.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const sk = tekst('SKAK.md')
  const r = tekst('RAPPORT-568.md')
  const s = json('skak-568.json')
  if (sk) {
    ok(/^skakken stadig klar til eleverne: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK: foerste linje skal vaere "skakken stadig klar til eleverne: ja/nej"')
    for (const k of ['K13', 'K14', 'K15', 'K16', 'K17']) ok(new RegExp(`^## ${k}`, 'm').test(sk), `SKAK: afsnit ${k} mangler`)
    for (const h of ['Fund', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(sk), `SKAK: afsnit ${h} mangler`)
    ok(!/[\u2013\u2014]/.test(sk), 'SKAK: tankestreg')
  }
  if (s) {
    ok(s.tjek.length >= 20 && s.tjek.every((t) => t.ok), `skak-568: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok(['360', '390', '1280'].every((w) => s.sider[w] && s.sider[w].eksterne.length === 0 && s.sider[w].sidefejl.length === 0), 'skak: net eller JS-fejl')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 568'), 'RAPPORT: foerste linje skal starte med "Ordre 568"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Setu', 'Chaturanga']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
    ok(!/[\u2013\u2014]/.test(r), 'RAPPORT: tankestreg')
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-568 --blok ${blok}: ${fejl.length} fejl`); for (const x of fejl) console.error(' - ' + x); process.exit(1) }
console.log(`verify-kritik-568 --blok ${blok}: groen`)
