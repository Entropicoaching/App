// 2392 stop 3 og 5: lav-uge viser samme pulje som appen og siger, hvor mange kcal hvert måltid mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { lavUge } from './lav-uge.mjs'
import { fordelDag } from '../../src/entropi2/kostplan/friPulje.mjs'

const type1 = [{ name: 'Morgenmad', items: ['Havregryn', 'Skyr naturel', 'Banan', 'Blåbær'] }, { name: 'Frokost', items: ['Rugbrød', 'Kyllingebryst', 'Agurk', 'Tomat'] },
  { name: 'Mellemmåltid', items: ['Skyr naturel', 'Mandler', 'Æble'] }, { name: 'Aftensmad', items: ['Ris kogt', 'Laks fersk', 'Broccoli', 'Olivenolie'] },
  { name: 'Aftensnack', items: ['Hytteost', 'Knækbrød'] }]
const ind = (kcal, protein = 160) => ({ athleteId: '33333333-3333-4333-8333-333333333333', goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk kostklient.', basisAsOf: '2026-11-25', targets: { kcal, protein, as_of: '2026-11-25' }, carb: 300, fat: 75, start: '2026-12-01', dagtyper: [type1] })

test('2392 stop 3: puljen i lav-uge er appens fordelDag af hele dagens kcal', () => {
  for (const [kcal, pct] of [[2600, 15], [2800, 15], [2450, 20], [2717, 15]]) {
    for (const linje of lavUge(ind(kcal), { fri: pct }).tekst.split('\n').filter(l => l.includes('fri pulje'))) {
      const [, dagKcal, pulje] = linje.match(/hele dagen (\d+) kcal.*fri pulje \d+ %, (\d+) kcal/)
      assert.equal(Number(pulje), fordelDag({ kcal: Number(dagKcal), protein: 0 }, pct).friKcal, linje)
    }
  }
})

test('2392 stop 5: stopbeskeden nævner kcal pr. måltid, der mangler', () => {
  assert.throws(() => lavUge(ind(3800)), /Måltid der mangler en tættere vare[^]*\(ca\. \d+ kcal\)/)
})
