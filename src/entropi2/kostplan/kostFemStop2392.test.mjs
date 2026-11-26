import test from 'node:test'
import assert from 'node:assert/strict'
import { planVarerLinje, statusLinje } from './atlet/kostIDagModel.mjs'
import { friUge, friKcalAf, fordelDag } from './friPulje.mjs'
import { ugeFriLinje } from './atlet/ugeFriModel.mjs'

// 2392 (de fem niveau 3 stop fra 2389). Syntetiske data, ingen database.
const vare = (i, grams = 10) => ({ name: `Vare${i}`, grams })

test('2392 stop 1: højst 6 varer vises alle; over 6 vises 5 og "+ N mere"', () => {
  for (const n of [1, 5, 6]) assert.equal(planVarerLinje({ foods: Array.from({ length: n }, (_, i) => vare(i)) }).includes('mere'), false)
  assert.equal(planVarerLinje({ foods: Array.from({ length: 6 }, (_, i) => vare(i)) }).split(' · ').length, 6)
  const syv = planVarerLinje({ foods: Array.from({ length: 7 }, (_, i) => vare(i)) })
  assert.equal(syv.split(' · ').length, 5)
  assert.match(syv, /Vare4 10 g \+ 2 mere$/)
})

const dag = (date, extra = {}) => ({ date, state: 'approved', friPct: 15, targets: { kcal: 2000 }, maaltider: ['Morgen', 'Middag'],
  maaltidTal: [{ kcal: 500, protein: 30 }, { kcal: 800, protein: 50 }], ...extra })
const raekke = (meal, kcal, protein) => ({ date: '2026-11-24', meal, kcal, protein })

test('2392 stop 2: basemåltider fulgt tæller kun, når det loggede svarer til planen (inden for 10 %)', () => {
  const lignerPlan = [raekke('Morgen', 510, 31), raekke('Middag', 780, 49)]
  const andreRetter = [raekke('Morgen', 900, 31), raekke('Middag', 300, 49)]
  const andetProtein = [raekke('Morgen', 500, 5), raekke('Middag', 800, 50)]
  assert.equal(friUge({ dage: [dag('2026-11-24')], raekker: lignerPlan }).basis, 2)
  assert.equal(friUge({ dage: [dag('2026-11-24')], raekker: andreRetter }).basis, 0)
  assert.equal(friUge({ dage: [dag('2026-11-24')], raekker: andetProtein }).basis, 1)
  // Uden planens tal (ældre dagsreferencer) tælles der efter navn som før.
  assert.equal(friUge({ dage: [dag('2026-11-24', { maaltidTal: undefined })], raekker: andreRetter }).basis, 2)
  const linje = ugeFriLinje({ dage: [dag('2026-11-24')], raekker: andreRetter, today: '2026-11-26' })
  assert.match(linje, /basemåltider fulgt 0 af 2/)
})

test('2392 stop 3: puljen afrundes med samme funktion i skillen og i appen', () => {
  assert.equal(friKcalAf(2718, 15), 408)
  assert.equal(fordelDag({ kcal: 2718, protein: 100 }, 15).friKcal, friKcalAf(2718, 15))
})

test('2392 stop 4: mens planmåltider gemmes, tæller kun de gemte rækker med i summen', () => {
  const snap = { loaded: true, totals: { kcal: 600, protein: 40 }, profileTargets: { kcal: 2800, protein: 180 } }
  const ventende = [{ id: 1, navn: '5 planmåltider', values: { kcal: 2311, protein: 173 }, kunGemte: true }]
  assert.equal(statusLinje(snap, ventende), 'I dag 600 af 2.800 kcal · 40 af 180 g protein (gemmer)')
  // Et enkelt måltid vises stadig med det samme.
  assert.match(statusLinje(snap, [{ id: 2, navn: 'Banan', values: { kcal: 100, protein: 1 } }]), /I dag 700 af 2\.800 kcal/)
})
