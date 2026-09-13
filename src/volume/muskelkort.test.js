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
