// Egenskaber opvarmningsformlen skal holde. Ikke enkeltvaerdier — egenskaber.
// En test der laaser en bestemt raekke tal fast forhindrer enhver forbedring;
// en test der laaser REGLEN fast fanger den dag reglen braekker.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcWarmupSets, isMainLift, DEFAULT_BAR } from './warmup.js'

const vægte = (s, W) => [...s.map((x) => x.weight), W]
const spring = (s, W) => {
  const v = vægte(s, W)
  return v.slice(1).map((w, i) => +(w - v[i]).toFixed(3))
}

const HOVEDLØFT = [
  [250, 1], [200, 1], [180, 3], [150, 1], [140, 3], [120, 5],
  [100, 5], [80, 3], [60, 5], [45, 5], [32.5, 5]
]

// ---------- den regel hele formlen findes for ----------

test('springene bliver mindre hele vejen op — ogsaa ind i arbejdssaettet', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    const g = spring(s, W)
    for (let i = 1; i < g.length; i++) {
      assert.ok(
        g[i] <= g[i - 1] + 1e-9,
        `${W}kg x${n}: spring ${i + 1} (${g[i]}) er stoerre end spring ${i} (${g[i - 1]}) — ${g.join(', ')}`
      )
    }
  }
})

test('det sidste spring ind i arbejdssaettet er aldrig det stoerste', () => {
  // Den gamle formel faldt praecis her: 200kg gav ...175 -> 185 (10) -> 200 (15).
  for (const [W, n] of HOVEDLØFT) {
    const g = spring(calcWarmupSets(W, n, 'Squat'), W)
    assert.ok(g[g.length - 1] <= Math.max(...g) + 1e-9)
    if (g.length > 1) assert.ok(g[g.length - 1] <= g[g.length - 2] + 1e-9, `${W}kg: sidste spring ${g[g.length - 1]} > forrige ${g[g.length - 2]}`)
  }
})

test('vaegtene stiger, ligger over stangen og naar aldrig arbejdsvaegten', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    for (let i = 0; i < s.length; i++) {
      assert.ok(s[i].weight < W, `${W}kg: opvarmning ${s[i].weight} >= arbejdsvaegt`)
      assert.ok(s[i].weight >= DEFAULT_BAR, `${W}kg: opvarmning ${s[i].weight} under stangen`)
      if (i) assert.ok(s[i].weight > s[i - 1].weight, `${W}kg: ikke stigende`)
    }
  }
})

// ---------- stangen er et argument, ikke en konstant ----------

test('kvindestangen paa 15 kg giver en rigtig ramp', () => {
  const s = calcWarmupSets(60, 5, 'Bænkpres', { barWeight: 15 })
  assert.equal(s[0].weight, 15)
  assert.equal(s[0].pct, 'Stang')
  const g = spring(s, 60)
  for (let i = 1; i < g.length; i++) assert.ok(g[i] <= g[i - 1] + 1e-9)
})

test('en arbejdsvaegt lige over stangen giver stangen, ikke ingenting', () => {
  // Gammel adfaerd: W <= 20 gav [] uanset stang. Med 15 kg stang er 18 kg et
  // rigtigt arbejdssaet, og en atlet skal ikke moede en tom opvarmning.
  const s = calcWarmupSets(18, 5, 'Bænkpres', { barWeight: 15 })
  assert.ok(s.length >= 1)
  assert.equal(s[0].weight, 15)
})

test('arbejdsvaegt paa eller under stangen giver ingen opvarmning', () => {
  assert.deepEqual(calcWarmupSets(20, 5, 'Bænkpres', { barWeight: 20 }), [])
  assert.deepEqual(calcWarmupSets(12, 5, 'Bænkpres', { barWeight: 15 }), [])
})

// ---------- etiketten skal passe til vaegten ----------

test('pct-etiketten er regnet af den afrundede vaegt', () => {
  for (const [W, n] of HOVEDLØFT) {
    for (const s of calcWarmupSets(W, n, 'Squat')) {
      if (s.pct === 'Stang') continue
      const faktisk = Math.round((s.weight / W) * 100)
      assert.equal(s.pct, `${faktisk}%`, `${W}kg: ${s.weight}kg maerket ${s.pct}`)
    }
  }
})

// ---------- reps ----------

test('reps falder naar vaegten stiger', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    for (let i = 1; i < s.length; i++) assert.ok(s[i].reps <= s[i - 1].reps, `${W}kg: reps steg`)
  }
})

// ---------- hovedloeft mod accessory ----------

test('sumo doedloeft er et hovedloeft, RDL er ikke', () => {
  assert.equal(isMainLift('Sumo dødløft'), true)
  assert.equal(isMainLift('Romanian deadlift'), false)
  assert.equal(isMainLift('Overhead triceps extension'), false)
  assert.equal(isMainLift('OHP'), true)
})

test('accessory faar kort ramp uden stang-saet', () => {
  const s = calcWarmupSets(100, 10, 'Lat pulldown')
  assert.ok(s.length <= 2)
  assert.ok(s.every((x) => x.pct !== 'Stang'))
})

// ---------- BRAEK-ANKRE ----------
// Uden disse ville en formel der returnerer [] bestaa naesten alt ovenfor.

test('en tung loefter faar en RIGTIG ramp, ikke en tom liste', () => {
  const s = calcWarmupSets(200, 1, 'Dødløft')
  assert.ok(s.length >= 4, `kun ${s.length} opvarmningssaet til 200 kg`)
  assert.equal(s[0].weight, DEFAULT_BAR)
  assert.ok(s[s.length - 1].weight >= 200 * 0.8, 'sidste opvarmning ligger for langt fra arbejdsvaegten')
})

test('sidste opvarmning ligger taet nok paa arbejdsvaegten', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    if (s.length < 2) continue
    const sidste = s[s.length - 1].weight
    assert.ok(sidste / W >= 0.7, `${W}kg: sidste opvarmning ${sidste} er kun ${Math.round((sidste / W) * 100)}%`)
  }
})

test('ugyldige input giver tom liste, ikke NaN i fladen', () => {
  for (const bad of [undefined, null, 0, -50, NaN, 'tung']) {
    const s = calcWarmupSets(bad, 5, 'Squat')
    assert.ok(Array.isArray(s))
    assert.ok(s.every((x) => Number.isFinite(x.weight)))
  }
})
