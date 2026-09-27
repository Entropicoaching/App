// ORDRE 502: verify for Bhishaks kritik 502. Ingen browser og intet netvaerk; kun mine gemte
// maalinger i outputs/kritik-502, dokumenterne i docs/kritik-502, sitets grene (kun laest med
// git rev-parse/show) og `npm run lint`.
//   node outputs/kritik-502/verify-kritik-502.mjs 1   blok 1: squat-udgivelsen (SQUAT-UDGIVELSE)
//   node outputs/kritik-502/verify-kritik-502.mjs 2   blok 1 + blok 2: vaerktoejssiden og RAPPORT-502
// Kontrollen er, at maalingerne findes, er fra den gren og commit dokumenterne naevner, og siger
// det dokumenterne paastaar. Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROD = path.join(HERE, '..', '..')
const DOCS = path.join(ROD, 'docs', 'kritik-502')
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-502/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const git = (a) => execSync(`git -C "${SITE}" ${a}`).toString().trim()
const navne = [...new Set([...readFileSync(path.join(ROD, '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]

// Ingen atletnavne i noget, jeg har skrevet (tekstfiler i outputs/kritik-502 og docs/kritik-502).
for (const d of [HERE, DOCS]) {
  if (!existsSync(d)) continue
  for (const f of readdirSync(d).filter((f) => /\.(md|json|txt|mjs)$/.test(f))) {
    const t = readFileSync(path.join(d, f), 'utf8')
    for (const n of navne) ok(!new RegExp(`\\b${n}\\b`, 'i').test(t), `atletnavn i ${f}`)
  }
}

function siden(m, side, b) { return m?.sider.find((s) => s.side === side && s.bredde === b) }
function faelles(m, navn) {
  if (!m) return
  ok(m.sider.every((s) => s.konsol.length === 0 && s.sidefejl.length === 0 && s.http404.length === 0 && s.fejlkald.length === 0 && s.brudte.length === 0), `${navn}: fejl paa en side`)
  ok(m.sider.every((s) => s.scrollW <= s.clientW), `${navn}: vandret rul`)
  ok(m.sider.every((s) => s.navne.every((x) => x === 0)), `${navn}: atletnavn i synlig tekst`)
  ok(m.interneLinks.every((l) => l.endsWith('ok')), `${navn}: internt link til en fil, der ikke findes`)
  ok(m.sider.every((s) => s.eksterne.every((u) => u.startsWith('https://fonts.'))), `${navn}: kald ud af huset ud over skrifter`)
}

// --- blok 1: squat ---------------------------------------------------------------------------
const sq = tekst('SQUAT-UDGIVELSE.md')
const m1 = json('squat.json')
const d1 = json('squat-detaljer.json')
if (sq) {
  ok(/^klar til udgivelse: (ja|nej)\b/.test(sq.split('\n')[0]), 'SQUAT-UDGIVELSE: foerste linje skal vaere "klar til udgivelse: ja/nej"')
  for (let i = 1; i <= 16; i++) ok(new RegExp(`^\\| U${i} \\|`, 'm').test(sq), `SQUAT-UDGIVELSE: U${i} mangler i tabellen`)
  ok(!/[\u2014]/.test(sq) && !/ \u2013 /.test(sq), 'SQUAT-UDGIVELSE: tankestreg')
  ok(sq.includes('`2087136`'), 'SQUAT-UDGIVELSE: commit mangler')
}
if (m1) {
  ok(m1.gren === 'udgivelse-squat-min-krop' && m1.sha === '2087136', 'squat: maalt paa forkert gren/commit')
  ok(git('rev-parse --short udgivelse-squat-min-krop') === m1.sha, 'squat: grenen er flyttet siden maalingen, dommen gaelder ikke laengere')
  faelles(m1, 'squat')
  const a = siden(m1, 'artikel-squat.html', 390), a2 = siden(m1, 'artikel-squat.html', 1280)
  ok(a && a2, 'squat: artiklen er ikke maalt i begge bredder')
  // U1: den synlige [MARC]
  ok(a?.marcFelter.length === 1 && a.marcFelter[0] === '[MARC]' && a2?.marcFelter.length === 1, 'U1: den synlige [MARC] er ikke som beskrevet')
  ok(a?.tankestreger.length === 0, 'squat: tankestreg i artiklens synlige tekst')
  ok(a?.robots === null && a?.canonical === 'https://entropicoaching.dk/artikel-squat.html', 'squat: noindex/canonical')
  // U7: laengderne
  ok(a?.title.length === 88 && a?.description.length === 209, 'U7: titel/beskrivelse har ikke de naevnte laengder')
  ok(a?.hoejde === 50979 && a2?.hoejde === 39401, 'squat: sidehoejden er ikke den naevnte')
  ok(m1.sider.filter((s) => s.side.startsWith('assets/min-krop/')).every((s) => s.eksterne.length === 0), 'squat: Min krop kalder ud af huset')
  ok(m1.privateFiler.length === 17, 'U11: antal private filer paa grenen')
  const t = readFileSync(path.join(HERE, 'squat-artikel-squat-tekst.txt'), 'utf8')
  ok(t.includes('men ikke i bunden') && t.includes('uden for modellens område, intet krav'), 'U3: teksten findes ikke')
  ok(t.includes('Squat-udgaven kommer, når der er film'), 'U6: teksten findes ikke')
  ok(t.includes('Blå: Marcs målte skelet') && t.includes('Marcs eget klip, 270 kg'), 'U5: teksten findes ikke')
  ok(t.includes('0,09 m/s'), 'U15: teksten findes ikke')
}
// Kilden paa grenen: U3, U4, U9, U14 laest direkte
{
  const html = git('show udgivelse-squat-min-krop:artikel-squat.html')
  ok((html.match(/<span class="marc">\[MARC:/g) ?? []).length === 4, 'U4: ikke fire skjulte [MARC:]-spans')
  ok(html.includes('<body class="skjul-marc">') && html.includes('<p>[MARC] <a href="assets/min-krop/index.html">'), 'U1: kilden er ikke som beskrevet')
  ok(html.includes('href="viden.html#artikler" class="nav-back"'), 'U9: tilbagelinket er ikke som beskrevet')
  ok(!git('show udgivelse-squat-min-krop:viden.html').includes('artikel-squat.html'), 'U9: viden.html har nu squat-kortet')
  ok((html.match(/Larsen, S\., Kristiansen, E\., .{0,40}\(2021\)/g) ?? []).length === 2, 'U14: ikke to Larsen 2021')
  ok(html.includes('"datePublished":"2026-09-27"'), 'U8: datoen er ikke som beskrevet')
}
if (d1) ok(d1.fund.some((f) => f.tekst.startsWith('Sædemuskel') && f.bredde === 390 && f.font === '10.56px'), 'U16: skriftstoerrelsen er ikke 10,56 px')

// --- blok 2: vaerktoejssiden og rapporten ----------------------------------------------------
if (blok >= 2) {
  const vt = tekst('VAERKTOEJER.md')
  const m2 = json('vaerktoejer.json')
  const rap = tekst('RAPPORT-502.md')
  if (vt) {
    ok(/^vaerktoejssiden klar: (ja|nej)\b/.test(vt.split('\n')[0]), 'VAERKTOEJER: foerste linje skal vaere "vaerktoejssiden klar: ja/nej"')
    ok(/^\| V1 \|/m.test(vt), 'VAERKTOEJER: fund mangler')
    ok(vt.includes('## Filmeguiden for en atlet med en telefon'), 'VAERKTOEJER: filmeguide-afsnittet mangler')
  }
  if (m2) {
    ok(m2.gren === 'vaerktoejer' && git('rev-parse --short vaerktoejer') === m2.sha, 'vaerktoejer: grenen er flyttet siden maalingen')
    faelles(m2, 'vaerktoejer')
    const v = siden(m2, 'vaerktoejer/index.html', 390)
    ok(v?.robots === 'noindex, nofollow', 'vaerktoejer: noindex mangler')
    ok(v?.marcFelter.length === 2, 'vaerktoejer: ikke to [MARC]-felter')
    ok(m2.sider.every((s) => s.eksterne.length === 0), 'vaerktoejer: kald ud af huset')
    for (let i = 1; i <= 10; i++) ok(new RegExp(`^\\| V${i} \\|`, 'm').test(vt ?? ''), `VAERKTOEJER: V${i} mangler i tabellen`)
    // V2: Marcs krop og filnavnet paa De tre loeft; ikke i den indlejrede udgave i artiklen
    const tl = readFileSync(path.join(HERE, 'vaerktoejer-assets_vaerktoejer_tre-loeft_index-tekst.txt'), 'utf8')
    ok(tl.includes('kroppe/marc.json') && tl.includes('ikke målt endnu') && tl.includes('Marcs mål mod gennemsnitlig løfter'), 'V2: teksten findes ikke')
    const ind = json('squat-indlejret.json')
    ok(ind && ind.sider.every((s) => s.marc === 0), 'V2: den indlejrede udgave naevner Marc')
    // V10: kap. 7's tal er De tre loefts "Marcs maal" i bunden
    ok(['21,7', '−23,0', '435,1', '497,0', '155,9'].every((x) => tl.includes(x)), 'V10: tallene i De tre loeft')
    const sqt = readFileSync(path.join(HERE, 'squat-artikel-squat-tekst.txt'), 'utf8')
    ok(sqt.includes('Knæ\t497,0\t595,3') && sqt.includes('Hofte\t435,1\t336,8') && sqt.includes('155,9'), 'V10: tallene i artiklens kap. 7')
    // V1 og V9 fra naerbillederne
    const d2 = json('vaerktoejer-detaljer.json')
    ok(d2?.fund.some((f) => f.tekst.startsWith('[MARC') && f.h > 0) && d2?.fund.some((f) => f.tekst === 'Kommer snart' && f.font === '9.28px'), 'V1/V9: naerbillederne')
  }
  if (rap) {
    const l = rap.split('\n')
    ok(l[0] === 'Ordre 502', 'RAPPORT: foerste linje skal vaere "Ordre 502"')
    for (const h of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rap.includes(h), `RAPPORT: afsnit ${h} mangler`)
    ok(rap.includes('klar til udgivelse: nej') && /vaerktoejssiden klar: (ja|nej)/.test(rap), 'RAPPORT: dommene mangler')
    ok(/Setu retter/.test(rap) && /Kun Marc/.test(rap), 'RAPPORT: "Hvad er naeste" skal have Setu og Marc')
  }
}

// lint
try { execSync('npm run lint --silent', { cwd: ROD, stdio: 'pipe' }) } catch (e) { fejl.push('npm run lint fejlede: ' + String(e.stdout ?? e).slice(0, 300)) }

if (fejl.length) { console.log('ROED:\n- ' + fejl.join('\n- ')); process.exit(1) }
console.log(`GROEN: kritik-502 blok ${blok}`)
