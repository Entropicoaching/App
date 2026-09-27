// ORDRE 483: verify:kritik-483. Ingen browser og intet netvaerk; kun mine gemte maalinger i outputs/kritik-483
// og dokumenterne i docs/kritik-483.
//   node outputs/kritik-483/verify-kritik-483.mjs 1   blok 1: fejlfigurerne (FEJL-KRITIK)
//   node outputs/kritik-483/verify-kritik-483.mjs 2   blok 1 + blok 2: skaktimen (SKAK-KRITIK) og RAPPORT-483
// Kontrollen er, at maalingerne findes, er hele og siger det, dokumenterne paastaar. Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-483')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-483/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const fund = (t, bogstav) => [...new Set((t.match(new RegExp(`^\\| ${bogstav}(\\d+) \\|`, 'gm')) || []).map(s => s.match(/\d+/)[0]))]

// --- blok 1: fejlfigurerne ----------------------------------------------------------
const fk = tekst('FEJL-KRITIK.md')
if (fk) {
  ok(/^fejlfigurer klar til sitet: (ja|nej)\b/.test(fk.split('\n')[0]), 'FEJL-KRITIK: foerste linje skal vaere "fejlfigurer klar til sitet: ja/nej"')
  const f = fund(fk, 'F')
  ok(f.length >= 3 && f.every((n, i) => Number(n) === i + 1), `FEJL-KRITIK: fund F1-Fn i orden (fandt ${f.join(',')})`)
  for (const s of ['1. Hoften stiger først', '2. Stangen glider frem', '3. Albuen helt ude', 'Holdninger, der ikke bør stå i Marcs navn']) ok(fk.includes(s), `FEJL-KRITIK: afsnittet "${s}" mangler`)
  ok(!/Bhishak 457/.test(fk.replace(/"\(Bhishak 457: 10-15 %\)"/, '')), 'FEJL-KRITIK maa kun citere "Bhishak 457" som fund')
}
const fg = json('figurer-483.json')
if (fg) {
  for (const f of ['F-side-om-side-dl-hofte-foerst.png', 'F-side-om-side-dl-hofte-foerst-skulder-frem.png', 'F-side-om-side-dl-stang-frem.png', 'F-side-om-side-dl-stang-frem-kroppen-bagud.png', 'F-side-om-side-bp.png']) ok(existsSync(path.join(HERE, f)), `${f} mangler`)
  ok(fg.netvaerk?.length === 0, 'fejlsiden lavede netvaerkskald')
  for (const b of ['390', '1280']) {
    const s = fg['side' + b]
    ok(s && !s.vandretRul && s.billeder === 10, `side ${b}: vandret rul eller ikke 10 billeder`)
    ok(s?.naevnerBhishak >= 1, `F6: siden (${b}) naevner ikke laengere Bhishak - fundet er forsvundet, ret FEJL-KRITIK`)
  }
  // F1: afstanden fra "skulderen -44 %" til forbeholdet, som dokumentet citerer.
  ok(fg.side390?.skulderAfstandPx === 3995 && fg.side1280?.skulderAfstandPx === 2136, `F1: afstand til forbeholdet er ${fg.side390?.skulderAfstandPx}/${fg.side1280?.skulderAfstandPx}, ikke 3995/2136`)
  ok(fk?.includes('3995 px') && fk?.includes('2136 px'), 'F1: FEJL-KRITIK citerer ikke de maalte afstande')
  ok(fg.side390?.hoejde === 14947 && fk?.includes('14.947 px'), `F10: siden paa 390 er ${fg.side390?.hoejde} px`)
  const sv = fg.svgTekst || {}
  ok(sv['bp-albue-ud.svg']?.skulderFald.includes('skulder −44 %') && !sv['bp-albue-ud.svg']?.forbehold, 'F1: bp-albue-ud.svg har ikke "skulder −44 %" uden forbehold')
  ok(sv['bp-hoejt-bryst.svg']?.skulderFald.includes('skulder −41 %'), 'F1: bp-hoejt-bryst.svg har ikke "skulder −41 %"')
  ok(sv['dl-hofte-foerst-skulder-frem.svg']?.laendFald.includes('lænd −11 %'), 'F2: B1-figuren har ikke "lænd −11 %"')
  ok(sv['dl-stang-frem.svg']?.skulderFald.includes('skulder −54 %'), 'F5: A2-figuren har ikke "skulder −54 %"')
}

// --- blok 2: skaktimen og rapporten ----------------------------------------------------
if (blok >= 2) {
  const { verifyBlok2 } = await import('./verify-blok2-483.mjs')
  verifyBlok2({ ok, json, tekst, fund, HERE })
}

if (fejl.length) {
  console.log(`verify:kritik-483 blok ${blok}: ${fejl.length} fejl`)
  for (const f of fejl) console.log('  - ' + f)
  process.exit(1)
}
console.log(`verify:kritik-483 blok ${blok}: groen`)
