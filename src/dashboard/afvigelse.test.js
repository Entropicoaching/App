// ORDRE 277 · commit 1.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnUgensAfvigelse, sorterEfterAfvigelse } from './afvigelse.js'

test('ingen planlagte sæt denne uge → ingen plan, ikke en afvigelse', () => {
  const r = beregnUgensAfvigelse({ plannedSets: 0, plannedTonnage: 0, completedSets: 0, completedTonnage: 0 })
  assert.equal(r.harPlan, false)
  assert.equal(r.afvigelseSaet, 0)
  assert.equal(r.afvigelseTonnage, 0)
})

test('helt på sporet: gennemført matcher planlagt → score 0', () => {
  const r = beregnUgensAfvigelse({ plannedSets: 12, plannedTonnage: 960, completedSets: 12, completedTonnage: 960 })
  assert.equal(r.harPlan, true)
  assert.equal(r.afvigelseSaet, 0)
  assert.equal(r.afvigelseTonnage, 0)
  assert.equal(r.score, 0)
})

test('skredet fra planen: positiv afvigelse på begge, score > 0', () => {
  const r = beregnUgensAfvigelse({ plannedSets: 12, plannedTonnage: 960, completedSets: 4, completedTonnage: 320 })
  assert.equal(r.harPlan, true)
  assert.equal(r.afvigelseSaet, 8)
  assert.equal(r.afvigelseTonnage, 640)
  // 8/12 sæt-andel + 640/960 tonnage-andel = to lige store tredjedele
  assert.ok(Math.abs(r.score - (8 / 12 + 640 / 960)) < 1e-9)
})

test('foran planen (gennemført > planlagt): negativ afvigelse, men score clamped til 0 (ikke en "bagud"-sag)', () => {
  const r = beregnUgensAfvigelse({ plannedSets: 10, plannedTonnage: 800, completedSets: 14, completedTonnage: 1000 })
  assert.equal(r.harPlan, true)
  assert.equal(r.afvigelseSaet, -4)
  assert.equal(r.afvigelseTonnage, -200)
  assert.equal(r.score, 0)
})

test('planlagt tonnage 0 (ingen øvelse med anbefalet vægt) — tonnage tæller ikke med i score, sæt gør stadig', () => {
  const r = beregnUgensAfvigelse({ plannedSets: 6, plannedTonnage: 0, completedSets: 3, completedTonnage: 0 })
  assert.equal(r.harPlan, true)
  assert.ok(Math.abs(r.score - 0.5) < 1e-9)
})

test('sorterEfterAfvigelse: størst afvigelse først, "ingen plan" samlet nederst uanset score', () => {
  const rows = [
    { navn: 'A (på sporet)', afvigelse: beregnUgensAfvigelse({ plannedSets: 10, completedSets: 10 }) },
    { navn: 'B (skredet)', afvigelse: beregnUgensAfvigelse({ plannedSets: 10, completedSets: 2 }) },
    { navn: 'C (ingen plan)', afvigelse: beregnUgensAfvigelse({ plannedSets: 0, completedSets: 0 }) },
    { navn: 'D (lidt skredet)', afvigelse: beregnUgensAfvigelse({ plannedSets: 10, completedSets: 6 }) },
  ]
  const sorted = sorterEfterAfvigelse(rows).map(r => r.navn)
  assert.deepEqual(sorted, ['B (skredet)', 'D (lidt skredet)', 'A (på sporet)', 'C (ingen plan)'])
})

test('sorterEfterAfvigelse: stabil rækkefølge for flere "ingen plan"-atleter (bevarer input-orden)', () => {
  const rows = [
    { navn: 'X', afvigelse: beregnUgensAfvigelse({ plannedSets: 0 }) },
    { navn: 'Y', afvigelse: beregnUgensAfvigelse({ plannedSets: 0 }) },
  ]
  assert.deepEqual(sorterEfterAfvigelse(rows).map(r => r.navn), ['X', 'Y'])
})
