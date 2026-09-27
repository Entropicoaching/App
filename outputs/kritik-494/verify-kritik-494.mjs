// ORDRE 494: verify:kritik-494. Ingen browser og intet netvaerk; kun mine gemte maalinger i
// outputs/kritik-494 og dokumenterne i docs/kritik-494.
//   node outputs/kritik-494/verify-kritik-494.mjs 1   blok 1: Maal dit billede (MAAL-BILLEDE-KRITIK)
//   node outputs/kritik-494/verify-kritik-494.mjs 2   blok 1 + blok 2: Min krop gentjek og RAPPORT-494
// Kontrollen er, at maalingerne findes, er groenne og siger det, dokumenterne paastaar. Exit 1 ved fejl.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DOCS = path.join(HERE, '..', '..', 'docs', 'kritik-494')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-494/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}
const fund = (t, bogstav) => [...new Set((t.match(new RegExp(`^\\| ${bogstav}(\\d+) \\|`, 'gm')) || []).map((s) => s.match(/\d+/)[0]))]
const alleGroenne = (j, navn) => { ok(j && j.tjek?.length && j.tjek.every((t) => t.ok), `${navn}: ikke alle tjek groenne (${j?.tjek?.filter((t) => !t.ok).map((t) => t.hvad).join(' | ')})`) }

// --- blok 1: Maal dit billede ---------------------------------------------------------
const mk = tekst('MAAL-BILLEDE-KRITIK.md')
if (mk) {
  ok(/^Maal dit billede klar til sitet: (ja|nej)\b/.test(mk.split('\n')[0]), 'MAAL-BILLEDE-KRITIK: foerste linje skal vaere "Maal dit billede klar til sitet: ja/nej"')
  const b = fund(mk, 'B')
  ok(b.length >= 4 && b.every((n, i) => Number(n) === i + 1), `MAAL-BILLEDE-KRITIK: fund B1-Bn i orden (fandt ${b.join(',')})`)
  for (const s of ['### 1. Punkternes beskrivelse', '### 2. 10 %-grænsen og skiven som standard', '### 3. Dødløftets stang mod balancepunktet', '### 4. Knævinklen ved knæhøjde']) ok(mk.includes(s), `MAAL-BILLEDE-KRITIK: afsnittet "${s}" mangler`)
}
const reg = json('maal-regning-494.json')
const side = json('maal-side-494.json')
alleGroenne(reg, 'maal-regning-494')
alleGroenne(side, 'maal-side-494')
if (reg && mk) {
  const p = reg.perspektiv.snit['dl-gulv']
  ok(p[200].skalaKontrolPct === 70.7 && p[300].skalaKontrolPct === 81 && p[400].skalaKontrolPct === 85.9, 'B1: skalakontrollen ved 2/3/4 m er ikke 70,7/81/85,9')
  ok(p[300].skive.stangHofte === -7.4 && mk.includes('−7,4 cm'), 'B1: stang-hofte ved 3 m')
  ok(reg.udenMinKrop.lille.skalaKontrolPct === 89.9 && reg.udenMinKrop.stor.skalaKontrolPct === 110.1, 'B2: 160/196 cm giver ikke 90/110 %')
  ok(reg.klikfejl['dl-gulv']['skulderen midt i leddet (4 cm under acromion)'].torso === 4.1 && mk.includes('+4,1°'), 'B3: skulderen giver ikke torso +4,1')
  ok(reg.marc.knae.stangUnderKnaeSkiveCm === 24.2 && reg.marc.knae.stangUnderKnaeKropCm === 31.6 && mk.includes('24-32 cm'), 'B4: stangen under knaeet i Marcs billede')
  ok(reg.knaeKurve.gradPrCm === 1.7 && mk.includes('1,7° pr. cm'), 'Q4: 1,7 grad pr. cm')
  ok(reg.balance[100].gulv === 5.8 && reg.balance[270].gulv === 3.3 && reg.balance[60].gulv === 7.1, 'B6: balancepunkterne 60/100/270 kg')
}
if (side && mk) {
  ok(side.syn390.lay.tabel.top - side.syn390.lay.billede.bund === 1726 && mk.includes('1726 px'), 'B7: afstanden billede-tabel paa 390')
  const o = side.marc['390-start'].overlap
  ok(o.cssPx === 5.2 && o.flyttet.includes('skalaB') && mk.includes('5 CSS-px'), 'B9: midtfod og skivens kant paa 390')
  ok(side.marc['390-start'].t1.maaling.stangHofte[0] === '17,4 cm' && side.marc['390-start'].kroppensSkala.maaling.stangHofte[0] === '25,3 cm' && mk.includes('17,4 mod 25,3 cm'), 'B1: Marcs stang-hofte med skive og krop')
  ok(side.marc['390-knaehoejde'].t1.sammen.knae[0] === '119,6°' && side.marc['390-knaehoejde'].t1.sammen.knae[1] === '146,3°', 'B4: knaevinklen 119,6 mod 146,3')
}
for (const f of ['M-390-dl-gulv-3m-klikket.png', 'M-1280-squat-A-3m.png', 'M-390-marc-start.png', 'M-390-marc-knaehoejde.png', 'M-1280-marc-start.png', 'M-1280-marc-knaehoejde.png', 'syn-dl-gulv-3m.png', 'syn-squat-A-3m.png', 'syn-dl-knae-B.png']) ok(existsSync(path.join(HERE, f)), `${f} mangler`)

// --- blok 2: Min krop gentjek og rapporten ------------------------------------------------
if (blok >= 2) {
  const { verifyBlok2 } = await import('./verify-blok2-494.mjs')
  verifyBlok2({ ok, json, tekst, fund, alleGroenne, HERE })
}

if (fejl.length) {
  console.log(`verify:kritik-494 blok ${blok}: ${fejl.length} fejl`)
  for (const f of fejl) console.log('  - ' + f)
  process.exit(1)
}
console.log(`verify:kritik-494 blok ${blok}: groen`)
