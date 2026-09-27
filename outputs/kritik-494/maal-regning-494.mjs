// KRITIK 494 blok 1, regnedelen: Bhishak proever Yantras "Maal dit billede" (484)
// med SYNTETISKE kroppe og et kamera med perspektiv. Laeser kun
// C:\Users\Entropi\Desktop\entropi-loeftmodel-dhruva (main 655e4cb: src/maalBillede.js,
// src/maalBilledeModel.js, src/minKrop.js, src/marcsDoedloeft.js); aendrer intet dér.
//   node outputs/kritik-494/maal-regning-494.mjs
// Skriver outputs/kritik-494/maal-regning-494.json. Svarer paa Yantras spoergsmaal 1-4:
//   1: systematisk forkerte klik (hofte, skulder, knae, midtfod) -> hvor meget flytter tallene
//   2: skiven som skala mod kroppens laengder, med et pinhole-kamera 2-6 m fra loefteren
//   3: doedloeftets balancepunkt mod stangens vaegt, og klikkets usikkerhed
//   4: knaevinklen mod stangens hoejde mellem gulv og knae, og Marcs "knaehoejde"-billede
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MODEL = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const imp = (f) => import(pathToFileURL(`${MODEL}/src/${f}`).href)
const MB = await imp('maalBillede.js')
const MM = await imp('maalBilledeModel.js')
const MK = await imp('minKrop.js')
const MD = await imp('marcsDoedloeft.js')
const DS = await imp('doedloeftStillinger.js')

const r1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`) }

// --- Kroppene (syntetiske; samme tre typer som kritik 471) --------------------------
function krop(h, v, pct = {}) {
  const o = { hoejde: h, vaegt: v }
  for (const id of MK.SEGMENT_MAAL) o[id] = r1(MK.gennemsnitCm(id, h) * (pct[id] ?? 100) / 100)
  return o
}
const KROPPE = {
  snit: krop(178, 85),
  A: krop(180, 90, { laar: 108, skinneben: 98, torso: 94 }),
  B: krop(170, 75, { laar: 93, skinneben: 102, torso: 106, overarm: 95, underarm: 95 }),
  C: krop(188, 105, { torso: 97, overarm: 107, underarm: 106 }),
  lille: krop(160, 60),
  stor: krop(196, 110),
}
const FASER = MB.FASER.map((f) => f.id)

// Modellens stilling for en krop (med Min krop = felterne) i en fase.
function stilling(faseId, felter) {
  const f = MB.fase(faseId)
  const K = MM.kroppe(f.loeft, felter)
  const m = MM.modelFase(faseId, K.dig || K.snit)
  return { K, m }
}

// --- Et pinhole-kamera -----------------------------------------------------------
// Loefteren i planet z = 0 (midtlinjen), kameraet i afstand D paa den naere side.
// De klikkede led sidder paa kroppens naere side: ankel/midtfod 10, knae 11, hofte
// (trochanter) 17, skulder (acromion) 19 cm ud fra midtlinjen (skaleret med hoejden).
// Skivens nav: 69 cm ud (inderste krave paa 65,5 cm plus en bumperskive). Kameraet
// staar ud for stangen (x = stangens x), telefonen lodret, i hoejden `kh` (cm).
const SIDE_CM = { stang: 69, midtfod: 10, ankel: 10, knae: 11, hofte: 17, skulder: 19 }
function projicer(P, h, { D, kh, kx }) {
  const f = 1000 // px pr. enhed ved dybde 1 (billedets egen skala er ligegyldig)
  const q = (p, z) => ({ x: kx * 0 + f * (p.x - kx) / (D - z), y: -f * (p.y - kh) / (D - z) })
  const ud = {}
  for (const id of ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']) {
    const z = id === 'stang' ? SIDE_CM.stang : SIDE_CM[id] * h / 178
    ud[id] = q(P[id], z)
  }
  ud.skalaA = q({ x: P.stang.x, y: P.stang.y + 22.5 }, SIDE_CM.stang)
  ud.skalaB = q({ x: P.stang.x, y: P.stang.y - 22.5 }, SIDE_CM.stang)
  return ud
}
// Orthografisk (uendelig afstand): samme billede, 1 px = 1 cm.
function ortho(P) {
  const ud = {}
  for (const id of ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']) ud[id] = { x: P[id].x, y: -P[id].y }
  ud.skalaA = { x: P.stang.x, y: -(P.stang.y + 22.5) }
  ud.skalaB = { x: P.stang.x, y: -(P.stang.y - 22.5) }
  return ud
}
const seks = (b) => { const o = {}; for (const id of ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']) o[id] = b[id]; return o }

function maalBillede(b, faseId, L, { skive = true } = {}) {
  const skala = skive ? { a: b.skalaA, b: b.skalaB, cm: MB.SKIVE_CM } : null
  const cmPrPx = skive ? null : MB.skalaFraKrop(b, L)
  const m = MB.maal(seks(b), { fase: faseId, skala, cmPrPx })
  const k = skive ? MB.skalaKontrol(b, m.cmPrPx, L) : null
  return { vinkler: m.vinkler, cm: m.cm, retning: m.retning, kontrol: k ? { forhold: r1(k.forhold * 100), uenig: k.uenig } : null }
}
const forskel = (a, s) => ({
  torso: r1(a.vinkler.torso - s.vinkler.torso), hofte: r1(a.vinkler.hofte - s.vinkler.hofte), knae: r1(a.vinkler.knae - s.vinkler.knae),
  stangFraMidtfod: r1(a.cm.stangFraMidtfod - s.cm.stangFraMidtfod), stangHofte: r1(a.cm.stangHofte - s.cm.stangHofte),
  skulderForanStang: r1(a.cm.skulderForanStang - s.cm.skulderForanStang),
})

// --- 0. Orthografisk: vaerktoejet giver modellens egne tal tilbage ---------------------
const nul = {}
for (const fid of FASER) {
  const { m } = stilling(fid, null)
  const b = ortho(m.punkter)
  const R = maalBillede(b, fid, m.L)
  nul[fid] = { torso: r1(R.vinkler.torso), hofte: r1(R.vinkler.hofte), knae: r1(R.vinkler.knae), stang: r1(R.cm.stangFraMidtfod), kontrol: R.kontrol, model: { torso: r1(m.tal.torso), hofte: r1(m.tal.hofte), knae: r1(m.tal.knae) } }
}
paastaa('uden perspektiv giver vaerktoejet modellens egne vinkler (squat/doedloeft) og skalaen er enig (100 %)',
  ['squat-bund', 'dl-gulv', 'dl-knae'].every((f) => Math.abs(nul[f].torso - nul[f].model.torso) < 0.1 && Math.abs(nul[f].knae - nul[f].model.knae) < 0.1 && nul[f].kontrol.forhold === 100), nul)

// --- Spoergsmaal 2: skiven mod kroppen, med perspektiv ---------------------------------
const AFSTANDE = [200, 300, 400, 600, 1000]
const perspektiv = {}
for (const [navn, felter] of Object.entries({ snit: KROPPE.snit, A: KROPPE.A, B: KROPPE.B, C: KROPPE.C })) {
  perspektiv[navn] = {}
  for (const fid of ['squat-bund', 'dl-gulv', 'dl-knae']) {
    const { m } = stilling(fid, felter)
    const sand = maalBillede(ortho(m.punkter), fid, m.L)
    perspektiv[navn][fid] = {}
    for (const D of AFSTANDE) {
      const b = projicer(m.punkter, felter.hoejde, { D, kh: m.punkter.hofte.y, kx: m.punkter.stang.x })
      const skive = maalBillede(b, fid, m.L)
      const kropS = maalBillede(b, fid, m.L, { skive: false })
      perspektiv[navn][fid][D] = { skalaKontrolPct: skive.kontrol.forhold, advarer: skive.kontrol.uenig, skive: forskel(skive, sand), krop: forskel(kropS, sand) }
    }
  }
}
const s3 = perspektiv.snit['dl-gulv'][300]
const advarerAlle = Object.values(perspektiv).every((k) => Object.values(k).every((f) => [200, 300, 400].every((D) => f[D].advarer)))
paastaa('Q2: med kameraet 2-4 m fra loefteren advarer siden ALTID (skiven 69 cm naermere end midtlinjen)', advarerAlle,
  Object.fromEntries(AFSTANDE.map((D) => [D, perspektiv.snit['dl-gulv'][D].skalaKontrolPct])))
paastaa('Q2: foerst ved ca. 6 m falder advarslen vaek (skala-kontrol over 90 %)', perspektiv.snit['dl-gulv'][600].skalaKontrolPct >= 88 && perspektiv.snit['dl-gulv'][1000].skalaKontrolPct >= 90, perspektiv.snit['dl-gulv'][600])
paastaa('Q2: vinklerne flytter under 1,5 grad ved 3 m (perspektivet rammer cm, ikke vinklerne)', ['torso', 'hofte', 'knae'].every((k) => Math.abs(s3.skive[k]) < 1.5), s3.skive)
paastaa('Q2: stangen foran midtfoden flytter under 1 cm uanset skala (kameraet ud for stangen)', Math.abs(s3.skive.stangFraMidtfod) < 1 && Math.abs(s3.krop.stangFraMidtfod) < 1, { skive: s3.skive.stangFraMidtfod, krop: s3.krop.stangFraMidtfod })
const sq3 = perspektiv.snit['squat-bund'][300]
paastaa('Q2: squattens stang-hofte bliver flere cm for kort med skiven ved 3 m, kroppens skala rammer inden for 1 cm', sq3.skive.stangHofte <= -2 && Math.abs(sq3.krop.stangHofte) < 1, { skive: sq3.skive.stangHofte, krop: sq3.krop.stangHofte })

// Uden Min krop: kroppens laengder er tabellens 178 cm. En lille og en stor loefter.
const udenMinKrop = {}
for (const navn of ['lille', 'stor']) {
  const felter = KROPPE[navn]
  const { m } = stilling('dl-gulv', felter) // loefterens rigtige krop
  const L178 = stilling('dl-gulv', null).m.L // det siden bruger uden Min krop
  const b = ortho(m.punkter)
  const R = maalBillede(b, 'dl-gulv', L178)
  const sand = maalBillede(b, 'dl-gulv', m.L)
  const Rk = maalBillede(b, 'dl-gulv', L178, { skive: false })
  udenMinKrop[navn] = { hoejde: felter.hoejde, skalaKontrolPct: R.kontrol.forhold, advarer: R.kontrol.uenig, kroppensSkalaSkulderForanStang: r1(Rk.cm.skulderForanStang), sandt: r1(sand.cm.skulderForanStang) }
}
paastaa('Q2: uden Min krop og uden perspektiv advarer siden for en loefter paa 160 cm (tabellens krop er 178 cm)', udenMinKrop.lille.advarer, udenMinKrop)

// --- Spoergsmaal 1: systematisk forkerte klik ---------------------------------------
// Fejlene i cm paa den rigtige krop (orthografisk, snit), i modellens retning (+x frem, +y op).
const KLIKFEJL = {
  'hoften ved hoftekammen/baeltet (8 cm op)': { hofte: { x: 0, y: 8 } },
  'hoften 3 cm for hoejt': { hofte: { x: 0, y: 3 } },
  'hoften i balden (5 cm bag leddet)': { hofte: { x: -5, y: 0 } },
  'skulderen midt i leddet (4 cm under acromion)': { skulder: { x: 0, y: -4 } },
  'knaeet paa knaeskallen (3 cm frem)': { knae: { x: 3, y: 0 } },
  'midtfoden midt paa skoen (2 cm frem)': { midtfod: { x: 2, y: 0 } },
  'anklen 2 cm for lavt': { ankel: { x: 0, y: -2 } },
}
const klikfejl = {}
for (const fid of ['squat-bund', 'dl-gulv', 'dl-knae']) {
  const { m } = stilling(fid, null)
  const sand = maalBillede(ortho(m.punkter), fid, m.L)
  klikfejl[fid] = {}
  for (const [n, fejl] of Object.entries(KLIKFEJL)) {
    const P = JSON.parse(JSON.stringify(m.punkter))
    for (const [id, d] of Object.entries(fejl)) { P[id].x += d.x; P[id].y += d.y }
    klikfejl[fid][n] = forskel(maalBillede(ortho(P), fid, m.L), sand)
  }
}
const skulderDl = klikfejl['dl-gulv']['skulderen midt i leddet (4 cm under acromion)']
paastaa('Q1: klikkes skulderen midt i leddet (som siden siger) og ikke paa acromion (modellens punkt), bliver doedloeftets torso ca. 3-4 grader mere vandret', skulderDl.torso >= 2.5, skulderDl)
const hofteDl = klikfejl['dl-gulv']['hoften ved hoftekammen/baeltet (8 cm op)']
paastaa('Q1: hoften ved baeltet flytter doedloeftets torso og knaevinkel 8-9 grader (hoftevinklen naesten ikke)', hofteDl.torso >= 7 && hofteDl.knae >= 7 && Math.abs(hofteDl.hofte) < 2, hofteDl)
const baldeSq = klikfejl['squat-bund']['hoften i balden (5 cm bag leddet)']
paastaa('Q1: hoften i balden flytter squattens torso og hofte flere grader og stang-hofte 5 cm', Math.abs(baldeSq.stangHofte) >= 4.9, baldeSq)

// Tilfaeldig fingerfejl: hvert punkt +-N cm (uniform i en cirkel), 500 forsoeg.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }
const spredning = {}
for (const fid of ['squat-bund', 'dl-gulv']) {
  const { m } = stilling(fid, null)
  const sand = maalBillede(ortho(m.punkter), fid, m.L)
  spredning[fid] = {}
  for (const cm of [1, 2]) {
    const R = rng(494 + cm)
    const d = { torso: [], hofte: [], knae: [], stang: [] }
    for (let i = 0; i < 500; i++) {
      const P = JSON.parse(JSON.stringify(m.punkter))
      for (const id of ['stang', 'midtfod', 'ankel', 'knae', 'hofte', 'skulder']) { const a = R() * 2 * Math.PI, r = cm * Math.sqrt(R()); P[id].x += r * Math.cos(a); P[id].y += r * Math.sin(a) }
      const f = forskel(maalBillede(ortho(P), fid, m.L), sand)
      d.torso.push(f.torso); d.hofte.push(f.hofte); d.knae.push(f.knae); d.stang.push(f.stangFraMidtfod)
    }
    const p90 = (a) => r1(a.map(Math.abs).sort((x, y) => x - y)[Math.floor(a.length * 0.9)])
    spredning[fid][`${cm} cm`] = { torso: p90(d.torso), hofte: p90(d.hofte), knae: p90(d.knae), stang: p90(d.stang) }
  }
}
paastaa('Q1: med 2 cm fingerfejl pr. punkt er 90 % af hoftevinklerne inden for ca. 5-6 grader og stangen inden for ca. 2-3 cm', spredning['dl-gulv']['2 cm'].hofte <= 7 && spredning['dl-gulv']['2 cm'].stang <= 3.5, spredning)

// --- Spoergsmaal 3: doedloeftets balancepunkt ---------------------------------------------
const Ld = stilling('dl-gulv', null).m.L
const balance = {}
for (const kg of [60, 100, 140, 180, 270]) {
  const K = MM.kroppe('doedloeft', null, { stangKg: kg })
  const mg = MM.modelFase('dl-gulv', K.snit), mk = MM.modelFase('dl-knae', K.snit)
  balance[kg] = { gulv: r1(mg.tal.balanceStang), knae: r1(mk.tal.balanceStang) }
}
paastaa('Q3: balancepunktet ved gulvet flytter sig flere cm fra 270 til 60 kg (siden viser 270 kg, hvis coachen ikke retter vaegten)', Math.abs(balance[60].gulv - balance[270].gulv) >= 2, balance)

// --- Spoergsmaal 4: knaevinklen mod stangens hoejde ------------------------------------
// Doedloeftets stillinger mellem gulv og knae (DS.stillingVedHoejde), snit-kroppen.
const lengths = Ld
const knaeH = DS.knaeHoejdeCm(lengths)
const kurve = []
for (let h = DS.START_BAR_HEIGHT_CM; h <= knaeH + 0.01; h += (knaeH - DS.START_BAR_HEIGHT_CM) / 6) {
  const g = DS.stillingVedHoejde(lengths, 'konventionel', h)
  const a = g.angles
  kurve.push({ stangHoejdeCm: r1(h), knae: r1(a.kneeAngleDeg), hofte: r1(a.hipAngleDeg), torso: r1(a.torsoLeanDeg) })
}
const gradPrCm = r1((kurve.at(-1).knae - kurve[0].knae) / (kurve.at(-1).stangHoejdeCm - kurve[0].stangHoejdeCm))
paastaa('Q4: i modellen aabner knaeet ca. 1,5-2 grader pr. cm stangen stiger fra gulv til knae', gradPrCm >= 1.2 && gradPrCm <= 2.5, { knaeHoejdeCm: r1(knaeH), gradPrCm, kurve })

// Marcs to billeder fra 462 (Yantras egne klik i 900x1200, scripts/ordre-484-skaermbilleder.mjs).
const FOD = { ankel: { x: 398, y: 905 }, midtfod: { x: 427, y: 942 } }
const MARC = {
  gulv: { stang: { x: 445, y: 832 }, ...FOD, knae: { x: 440, y: 668 }, hofte: { x: 338, y: 578 }, skulder: { x: 460, y: 470 }, skalaA: { x: 441, y: 700 }, skalaB: { x: 441, y: 955 } },
  knae: { stang: { x: 438, y: 770 }, ...FOD, knae: { x: 440, y: 642 }, hofte: { x: 335, y: 548 }, skulder: { x: 453, y: 425 }, skalaA: { x: 434, y: 652 }, skalaB: { x: 434, y: 890 } },
}
const L183 = MM.modelFase('dl-gulv', MM.kroppe('doedloeft', MK.gennemsnitsMaal(183, 120)).dig).L
const marc = {}
for (const [n, b] of Object.entries(MARC)) {
  const skive = MB.skalaFraKendt(b.skalaA, b.skalaB, 45)
  const kropS = MB.skalaFraKrop(b, L183)
  marc[n] = {
    stangUnderKnaeSkiveCm: r1((b.stang.y - b.knae.y) * skive), stangUnderKnaeKropCm: r1((b.stang.y - b.knae.y) * kropS),
    stangOverGulvKropCm: r1((b.midtfod.y - b.stang.y) * kropS),
    knae: r1(MB.maal(seks(b), { fase: 'dl-gulv' }).vinkler.knae),
  }
}
marc.stangLoeftetKropCm = r1((MARC.gulv.stang.y - MARC.knae.stang.y) * MB.skalaFraKrop(MARC.knae, L183))
paastaa('Q4: i Marcs "knaehoejde"-billede staar stangen stadig 20-30 cm under knaeet (ikke i knaehoejde); knaeet har kun flyttet sig ca. 1 grad', marc.knae.stangUnderKnaeKropCm >= 20 && marc.knae.stangUnderKnaeSkiveCm >= 20 && Math.abs(marc.knae.knae - marc.gulv.knae) < 3, marc)

const ud = { kilde: 'entropi-loeftmodel-dhruva main (484 merget)', kroppe: KROPPE, sideCm: SIDE_CM, ortho: nul, perspektiv, udenMinKrop, klikfejl, spredning, balance, knaeKurve: { knaeHoejdeCm: r1(knaeH), gradPrCm, kurve }, marc, tjek }
writeFileSync(path.join(HERE, 'maal-regning-494.json'), JSON.stringify(ud, null, 1))
const nej = tjek.filter((t) => !t.ok).length
console.log(`${tjek.length - nej}/${tjek.length} tjek groenne`)
