import { test } from 'node:test'
import assert from 'node:assert/strict'
import { juster, afvigelse } from './planMaal.mjs'

const poster = [
  { grams: 100, kcal100: 350, protein100: 12, min: 40, max: 150 },
  { grams: 150, kcal100: 120, protein100: 22, min: 80, max: 250 },
  { grams: 200, kcal100: 60, protein100: 1, min: 100, max: 300 },
]
// Dagen i dag: 350 + 180 + 120 = 650 kcal, 12 + 33 + 2 = 47 g protein.
const graenser = g => g.forEach((v, i) =>
  assert.ok(v >= Math.min(poster[i].min, poster[i].grams) && v <= Math.max(poster[i].max, poster[i].grams), `vare ${i}: ${v}`))

test('en dag under målet ender inden for 5 % uden at bryde portionsgrænser', () => {
  const maal = { kcal: 740, protein: 54 }
  const g = juster(poster, maal)
  const a = afvigelse(poster, g, maal)
  assert.ok(Math.abs(a.kcalProcent) <= 5 && Math.abs(a.proteinProcent) <= 5, JSON.stringify(a))
  graenser(g)
})

test('en dag der allerede rammer målet ændres ikke', () => {
  assert.deepEqual(juster(poster, { kcal: 650, protein: 47 }), [100, 150, 200])
})

test('grænsen kan ikke overskrides, selv når målet kræver det', () => {
  graenser(juster(poster, { kcal: 5000, protein: 300 }))
})
