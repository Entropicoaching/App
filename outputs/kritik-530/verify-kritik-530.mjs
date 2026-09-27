// KRITIK 530: verify. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-530 og dokumenterne i docs/kritik-530, plus git og lint.
//   node outputs/kritik-530/verify-kritik-530.mjs --blok 1   Maal dit billede og foer/efter (MAAL-BILLEDE-4.md)
//   node outputs/kritik-530/verify-kritik-530.mjs --blok 2   blok 1 + skakken og RAPPORT-530
// Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const i = process.argv.indexOf('--blok')
const blok = Number(i > 0 ? process.argv[i + 1] : 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-530')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => { const p = path.join(HERE, f); if (!existsSync(p)) { fejl.push(`${f} mangler`); return null } return JSON.parse(readFileSync(p, 'utf8')) }
const tekst = (f) => { const p = path.join(DOCS, f); if (!existsSync(p)) { fejl.push(`docs/kritik-530/${f} mangler`); return null } return readFileSync(p, 'utf8').replace(/\r/g, '') }
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- faelles: grenen og graenserne ---------------------------------------------------------
ok(sh('git rev-parse --abbrev-ref HEAD').trim() === 'kritik-530', 'grenen er ikke kritik-530')
const aendret = sh('git diff --name-only main...HEAD').split('\n').filter(Boolean)
const utilstraekkelig = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
for (const f of [...aendret, ...utilstraekkelig]) ok(/^(docs|outputs)\/kritik-530\//.test(f), `uden for docs/kritik-530 og outputs/kritik-530: ${f}`)
let upstream = ''
try { upstream = sh('git rev-parse --abbrev-ref kritik-530@{upstream}').trim() } catch { upstream = '' }
ok(!upstream, `kritik-530 har en upstream (${upstream}); intet maa pushes`)
for (const l of sh('git log --format=%B main..HEAD').split('\n')) ok(/^[\x20-\x7e]*$/.test(l), `commit-besked ikke ASCII: ${l.slice(0, 60)}`)
for (const f of aendret) ok(!/marc-doedloeft-270-(start|knaehoejde)\.png$/.test(f), `Marcs hele billede er kopieret: ${f}`)
for (const repo of ['C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva', 'C:/Users/Entropi/Desktop/skak']) {
  ok(sh(`git -C ${repo} status --porcelain --untracked-files=no`).trim() === '', `${repo} har aendringer (maa ikke roeres)`)
}

// --- blok 1 --------------------------------------------------------------------------------
const mb = tekst('MAAL-BILLEDE-4.md')
const m = json('maal-side-530.json')
const fe = json('foer-efter-530.json')
if (mb) {
  const [l1, l2] = mb.split('\n')
  ok(/^Mål dit billede klar til sitet: (ja|nej)\b/.test(l1), 'MAAL-BILLEDE-4: foerste linje skal vaere "Mål dit billede klar til sitet: ja/nej"')
  ok(/^foer og efter klar til sitet: (ja|nej)\b/.test(l2), 'MAAL-BILLEDE-4: anden linje skal vaere "foer og efter klar til sitet: ja/nej"')
  for (const b of ['B13', 'E6', 'E9']) ok(new RegExp(`^\\| ${b} \\|`, 'm').test(mb), `MAAL-BILLEDE-4: ${b} mangler i en tabel`)
  for (const h of ['E7', 'E8', 'E3-resten']) ok(new RegExp(`^## ${h}`, 'm').test(mb), `MAAL-BILLEDE-4: afsnit ${h} mangler`)
}
if (m && mb) {
  ok(m.ref === 'c9950e0', 'maalt paa en anden commit end c9950e0')
  ok(m.tjek.length === 19 && m.tjek.every((t) => t.ok), `maal-side-530: ${m.tjek.filter((t) => !t.ok).length} tjek roede`)
  const faser = ['squat-bund', 'squat-midt', 'dl-gulv', 'dl-knae', 'baenk-bryst', 'baenk-midt']
  for (const w of [360, 375, 390]) ok(faser.every((f) => m.faser[`${w}-${f}`].side === w && m.faser[`${w}-${f}`].tallinjeHoejre <= w), `B13: ${w} holder ikke`)
  ok(faser.map((f) => m.faser[`390-${f}`].tallinjeHoejre).join() === '373,373,362,370,293,285' && mb.includes('390 / 373'), 'B13: 390-tallene i dokumentet passer ikke')
  ok(/Stang −10,7 cm/.test(m.lang['360-minus'].tallinje) && m.lang['360-minus'].side === 360, 'B13: det lange minus-tal')
  ok([360, 375, 390].every((w) => m.foerEfter[`${w}-skraa10`].side === w), 'E6: skraa10')
  ok([360, 375, 390].every((w) => m.e7[w].uden.boks.h >= 44 && /grænse 6,0 cm/.test(m.e7[w].med.stang[2])), 'E7: afkrydsningen paa siden')
  ok(m.e3['390-lav60-udenNav'].hint === '1' && m.e3['390-lav60-nav'].dom === 'ok', 'E3-rest paa siden')
  for (const p of ['M-360-squat-tallinje-min-krop.png', 'M-360-tallinje-lang.png', 'M-360-marc-tallinje.png', 'M-390-marc-tallinje.png', 'M-360-e7-krydset.png', 'M-390-e7-krydset.png', 'M-390-squat-lav60-uden-nav.png', 'M-390-squat-lav60-nav.png']) ok(existsSync(path.join(HERE, p)), `${p} mangler`)
}
if (fe && mb) {
  const g = (k) => fe.E7.ingenAendring[k]
  ok(g('omhyggelig-1-navSkoennet').udenKryds.alle === 41 && g('omhyggelig-1-navSkoennet').medKryds.alle === 16 && g('omhyggelig-1-navSkoennet').medKryds.stang === 1, 'E7: 41 % -> 16 % / 1 %')
  const s = fe.E7.sammeStedPaaKanten['omhyggelig-3']
  ok(s.medKryds.stang === 9 && s.faktor15.stang === 21 && mb.includes('**18 % / 9 %**'), 'E7: samme sted paa kanten (faktor 2 mod 1,5)')
  ok(Object.values(fe.E7.ingenAendring).every((v) => v.kontrolEnig === 100), 'E7: min regning og 522s kode er ikke enige')
  ok(fe.E8.dlUdenNav.n === 5 && fe.E8.dlMedNav.n === 8, 'E8: raekker')
  ok(fe.E3rest.kameraer.filter((k) => !k.nav && k.dom !== 'ok').every((k) => k.hint), 'E3-rest: hint')
}

// --- blok 2 --------------------------------------------------------------------------------
if (blok >= 2) {
  const s = json('skak-530.json')
  const sk = tekst('SKAK-3.md')
  const r = tekst('RAPPORT-530.md')
  if (sk) {
    ok(/^skakken klar til at Marc anbefaler den til eleverne: (ja|nej)\b/.test(sk.split('\n')[0]), 'SKAK-3: foerste linje skal vaere "skakken klar til at Marc anbefaler den til eleverne: ja/nej"')
    for (let n = 1; n <= 10; n++) ok(new RegExp(`^\\| K${n} \\|`, 'm').test(sk), `SKAK-3: K${n} mangler i tabellen`)
    ok(/koordinat/i.test(sk), 'SKAK-3: koordinattraeningen mangler')
  }
  if (s) {
    ok(s.tjek.length > 0 && s.tjek.every((t) => t.ok), `skak-530: ${s.tjek.filter((t) => !t.ok).length} tjek roede`)
    ok(s.bredder.includes(390) && s.bredder.includes(360), 'skak: 360 og 390 ikke begge maalt')
  }
  if (r) {
    ok(r.split('\n')[0].startsWith('Ordre 530'), 'RAPPORT: foerste linje skal starte med "Ordre 530"')
    for (const h of ['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser']) ok(new RegExp(`^## ${h}`, 'm').test(r), `RAPPORT: afsnit "${h}" mangler`)
    const naeste = r.split(/^## Hvad er næste/m)[1]?.split(/^## /m)[0] || ''
    for (const n of ['Setu', 'Vaidya', 'Chaturanga']) ok(naeste.includes(n), `RAPPORT: ${n} naevnes ikke under hvad er naeste`)
  }
}

try { sh('npm run lint --silent') } catch (e) { fejl.push('npm run lint fejler: ' + String(e.stdout || e.message).slice(0, 400)) }
if (fejl.length) { console.error(`verify-kritik-530 --blok ${blok}: ${fejl.length} fejl`); for (const f of fejl) console.error(' - ' + f); process.exit(1) }
console.log(`verify-kritik-530 --blok ${blok}: groen`)
