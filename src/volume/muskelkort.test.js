// ORDRE 177, commit 1: egenskaber muskelkortet skal holde, ikke enkeltværdier
// — samme filosofi som warmup.test.js's egen toptekst.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slaaOevelseOp, kendteOevelser, MUSKELGRUPPER, PRIMÆR, MEDVIRKENDE } from './muskelkort.js'

test('hver kendt øvelse har mindst én muskelgruppe', () => {
  for (const navn of kendteOevelser()) {
    const { kendt, grupper } = slaaOevelseOp(navn)
    assert.equal(kendt, true, `${navn} burde være kendt`)
    assert.ok(grupper.length > 0, `${navn} har ingen grupper`)
  }
})

test('ingen andel er over 1 eller under/lig 0', () => {
  for (const navn of kendteOevelser()) {
    const { grupper } = slaaOevelseOp(navn)
    for (const { gruppe, andel } of grupper) {
      assert.ok(andel <= 1, `${navn}/${gruppe}: andel ${andel} > 1`)
      assert.ok(andel > 0, `${navn}/${gruppe}: andel ${andel} <= 0 — skal udelades, ikke sættes til 0`)
    }
  }
})

test('kun de to definerede andele bruges, aldrig et opfundet mellemtal', () => {
  for (const navn of kendteOevelser()) {
    const { grupper } = slaaOevelseOp(navn)
    for (const { andel } of grupper) {
      assert.ok(andel === PRIMÆR || andel === MEDVIRKENDE, `${navn}: uventet andel ${andel}`)
    }
  }
})

test('summen pr. øvelse må gerne overstige 1 — en øvelse kan ramme flere grupper', () => {
  const squat = slaaOevelseOp('Squat')
  const sum = squat.grupper.reduce((s, g) => s + g.andel, 0)
  assert.ok(sum > 1, `Squats sum (${sum}) burde overstige 1 — flere grupper belastes`)
})

test('hver gruppe i hver post findes i MUSKELGRUPPER', () => {
  const kendteGrupper = new Set(Object.keys(MUSKELGRUPPER))
  for (const navn of kendteOevelser()) {
    const { grupper } = slaaOevelseOp(navn)
    for (const { gruppe } of grupper) {
      assert.ok(kendteGrupper.has(gruppe), `${navn} refererer til ukendt gruppenøgle ${gruppe}`)
    }
  }
})

test('hver linje bærer en kilde eller "skoen" med begrundelse', () => {
  for (const navn of kendteOevelser()) {
    const { grupper } = slaaOevelseOp(navn)
    for (const { gruppe, kilde } of grupper) {
      assert.ok(typeof kilde === 'string' && kilde.trim().length > 10, `${navn}/${gruppe}: kilde mangler eller er for kort ("${kilde}")`)
    }
  }
})

test('ukendt øvelse falder tilbage på kendt:false, aldrig et gæt', () => {
  const { kendt, grupper } = slaaOevelseOp('Zercher squat med ged på ryggen')
  assert.equal(kendt, false)
  assert.deepEqual(grupper, [])
})

test('stavevarianter og suffikser rammer samme post som grundnavnet', () => {
  const grund = slaaOevelseOp('Squat')
  const medSuffiks = slaaOevelseOp('Squat - topsæt')
  const uden_aa = slaaOevelseOp('SQUAT')
  assert.deepEqual(medSuffiks.grupper, grund.grupper)
  assert.deepEqual(uden_aa.grupper, grund.grupper)

  const dl = slaaOevelseOp('Dødløft')
  const dlUdenAeoeaa = slaaOevelseOp('Doedloeft (comp)')
  assert.deepEqual(dlUdenAeoeaa.grupper, dl.grupper)
})

test('tom eller manglende navn er ukendt, kaster aldrig', () => {
  assert.equal(slaaOevelseOp('').kendt, false)
  assert.equal(slaaOevelseOp(undefined).kendt, false)
  assert.equal(slaaOevelseOp(null).kendt, false)
})

// ORDRE 185, commit 3: rettelser — Marcs egne rettelser (src/volume/rettelser.js's
// hentRettelser()-facon: Map<normaliseretNavn, { grupper }>).
test('ingen rettelser givet: opfører sig som før, satAfMarc er false', () => {
  const { satAfMarc, grupper } = slaaOevelseOp('Squat')
  assert.equal(satAfMarc, false)
  assert.ok(grupper.length > 0)
})

test('en rettelse for en KENDT øvelse overskriver det oprindelige skøn', () => {
  const rettelser = new Map([['squat', { grupper: [{ gruppe: 'kneeExtensors', andel: MEDVIRKENDE }] }]])
  const { kendt, grupper, satAfMarc } = slaaOevelseOp('Squat', rettelser)
  assert.equal(kendt, true)
  assert.equal(satAfMarc, true)
  assert.deepEqual(grupper, [{ gruppe: 'kneeExtensors', andel: MEDVIRKENDE }])
})

test('en rettelse kan gøre en UKENDT øvelse kendt', () => {
  const rettelser = new Map([['zercher squat', { grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }]])
  const { kendt, satAfMarc } = slaaOevelseOp('Zercher squat', rettelser)
  assert.equal(kendt, true)
  assert.equal(satAfMarc, true)
})

test('rettelse slås op efter samme normalisering som grundkortet (stavevariant/suffiks)', () => {
  const rettelser = new Map([['baenkpres', { grupper: [{ gruppe: 'triceps', andel: PRIMÆR }] }]])
  const { satAfMarc } = slaaOevelseOp('Bænkpres - topsæt', rettelser)
  assert.equal(satAfMarc, true)
})

test('en tom rettelser-Map ændrer intet', () => {
  const { satAfMarc, kendt } = slaaOevelseOp('Squat', new Map())
  assert.equal(satAfMarc, false)
  assert.equal(kendt, true)
})

// ORDRE 192, commit 3: den genererede kortlægning (free-exercise-db, se
// scripts/byg-muskelkort.mjs) som tredje og sidste lag under den indbyggede.
test('en engelsk øvelse fra den genererede liste slår korrekt op', () => {
  const { kendt, grupper, satAfMarc } = slaaOevelseOp('Dumbbell Bicep Curl')
  assert.equal(kendt, true)
  assert.equal(satAfMarc, false)
  assert.deepEqual(grupper, [{ gruppe: 'biceps', andel: PRIMÆR }])
})

test('en dansk øvelse fra den genererede liste slår op via aliastabellen', () => {
  const engelsk = slaaOevelseOp('Dumbbell Bicep Curl')
  const dansk = slaaOevelseOp('Håndvægt bicepscurl')
  assert.equal(dansk.kendt, true)
  assert.deepEqual(dansk.grupper, engelsk.grupper)
})

test('en øvelse hverken indbygget eller i den genererede liste er stadig ukendt', () => {
  const { kendt, grupper } = slaaOevelseOp('Helt opdigtet øvelse ingen kilde kender')
  assert.equal(kendt, false)
  assert.deepEqual(grupper, [])
})

test('en rettelse vinder over den genererede kortlægning', () => {
  const rettelser = new Map([['dumbbell bicep curl', { grupper: [{ gruppe: 'triceps', andel: MEDVIRKENDE }] }]])
  const { kendt, grupper, satAfMarc } = slaaOevelseOp('Dumbbell Bicep Curl', rettelser)
  assert.equal(kendt, true)
  assert.equal(satAfMarc, true)
  assert.deepEqual(grupper, [{ gruppe: 'triceps', andel: MEDVIRKENDE }])
})
