// 2177 (Marc 24. nov. kl. 19:11): atleten ser samme ugedom som coachen. Syntetiske data, ingen database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { ugeFriLinje, readUgeFri } from './ugeFriModel.mjs'
import { nutritionGoalWeek } from '../../kostMaal/nutritionWeek.mjs'

const today = '2026-11-26'
const dageFra = (n, fra = 20) => Array.from({ length: n }, (_, i) => `2026-11-${fra + i}`)
const plan = (date, extra = {}) => ({ date, state: 'approved', targets: { kcal: 2000, protein: 100 }, ...extra })
const raekke = (date, meal, kcal = 800) => ({ athlete_id: 'a', date, meal, kcal, protein: 40 })
const syntetiskUge = pct => dageFra(7).map(d => plan(d, pct ? { friPct: pct, maaltider: ['Morgen', 'Middag'] } : {}))

test('0 % eller manglende niveau: ingen linje, ens med før', () => {
  const rows = dageFra(7).flatMap(d => [raekke(d, 'Morgen'), raekke(d, 'Middag')])
  assert.equal(ugeFriLinje({ dage: syntetiskUge(0), raekker: rows, today }), null)
  assert.equal(ugeFriLinje({ dage: syntetiskUge(undefined), raekker: rows, today }), null)
})

test('uden plan eller uden logning: ingen linje', () => {
  assert.equal(ugeFriLinje({ dage: [], raekker: [], today }), null)
  assert.equal(ugeFriLinje({ dage: null, raekker: [], today }), null)
  for (const pct of [15, 30]) assert.equal(ugeFriLinje({ dage: syntetiskUge(pct), raekker: [], today }), null)
})

test('15 og 30 %: basemåltider og pulje holdt, rosende og uden alarmord', () => {
  const rows = [raekke('2026-11-25', 'Morgen'), raekke('2026-11-25', 'Middag'), raekke('2026-11-25', 'Fri: lille', 100),
    raekke('2026-11-26', 'Morgen')]
  for (const pct of [15, 30]) {
    const linje = ugeFriLinje({ dage: syntetiskUge(pct), raekker: rows, today })
    assert.equal(linje, 'Seneste 7 dage: basemåltider fulgt 3 af 14, fri pulje holdt 2 af 2 loggede dage.')
    assert.doesNotMatch(linje, /over|fejl|mangler|advarsel/i)
  }
})

test('en dag over puljen tæller ikke som holdt, men linjen er neutral', () => {
  // 15 % af 2000 = 300 kcal; 450 fri kcal er over.
  const rows = [raekke('2026-11-24', 'Morgen'), raekke('2026-11-24', 'Fri: stor', 450), raekke('2026-11-25', 'Morgen'), raekke('2026-11-25', 'Fri: lille', 100)]
  const linje = ugeFriLinje({ dage: syntetiskUge(15), raekker: rows, today })
  assert.equal(linje, 'Seneste 7 dage: basemåltider fulgt 2 af 14, fri pulje holdt 1 af 2 loggede dage.')
})

test('blandet uge: kun dage med niveau tæller, dage uden niveau gør ikke', () => {
  const dage = [plan('2026-11-25', { friPct: 15, maaltider: ['Morgen'] }), plan('2026-11-26')]
  const linje = ugeFriLinje({ dage, raekker: [raekke('2026-11-25', 'Morgen')], today })
  assert.equal(linje, 'Seneste 7 dage: basemåltider fulgt 1 af 1, fri pulje holdt 1 af 1 logget dag.')
})

test('kun dage til og med i dag; fremtidige dage tæller aldrig', () => {
  const dage = [plan('2026-11-26', { friPct: 15, maaltider: ['Morgen'] }), plan('2026-11-27', { friPct: 15, maaltider: ['Morgen', 'Middag'] })]
  const rows = [raekke('2026-11-26', 'Morgen'), raekke('2026-11-27', 'Morgen')]
  assert.equal(ugeFriLinje({ dage, raekker: rows, today }), 'Seneste 7 dage: basemåltider fulgt 1 af 1, fri pulje holdt 1 af 1 logget dag.')
})

test('samme tal som coachens linje for samme dage og rækker (0, 15 og 30 %)', () => {
  const rows = [raekke('2026-11-23', 'Morgen'), raekke('2026-11-23', 'Middag'), raekke('2026-11-23', 'Fri: stor', 450),
    raekke('2026-11-25', 'Morgen'), raekke('2026-11-26', 'Middag'), raekke('2026-11-26', 'Fri: lille', 100)]
  const basis = { state: 'ready', days: new Map([['2026-11-23', { kcal: 2000, protein: 100 }], ['2026-11-25', { kcal: 800, protein: 40 }], ['2026-11-26', { kcal: 900, protein: 40 }]]) }
  for (const pct of [0, 15, 30]) {
    const dage = syntetiskUge(pct)
    const coach = nutritionGoalWeek({ athlete: { id: 'a', kcal_target: 2000, protein_target: 100 }, today, planDays: dage,
      coachNutrition: { rows }, session: { user: { id: 'c' } }, readContext: { coachId: 'c', day: today, athleteIds: ['a'] } }, basis)
    const linje = ugeFriLinje({ dage, raekker: rows, today })
    if (pct === 0) { assert.equal(linje, null); assert.equal(coach.fri, undefined); continue }
    const m = /basemåltider fulgt (\d+) af (\d+), fri pulje holdt (\d+) af (\d+)/.exec(linje)
    assert.match(coach.text, new RegExp(`Basemåltider fulgt: ${m[1]} af ${m[2]}\. Fri pulje holdt: ${m[3]} af ${m[4]} `))
  }
})

test('readUgeFri: kun læsning, fejl giver ingen linje, ingen skrivning', async () => {
  const kald = []
  const dage = syntetiskUge(15)
  const klient = rows => ({ from: table => { kald.push(table); const q = { select: () => q, eq: () => q, gte: () => q, lte: () => q, limit: async () => ({ data: rows }) }; return q } })
  const ok = await readUgeFri({ client: klient([raekke('2026-11-25', 'Morgen')]), athleteId: 'a', date: today, planDays: dage })
  assert.equal(ok.raekker.length, 1)
  assert.deepEqual([...new Set(kald)], ['meal_logs'])
  assert.equal(await readUgeFri({ client: { from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ limit: async () => ({ error: { code: 'x' } }) }) }) }) }) }) }, athleteId: 'a', date: today, planDays: dage }), null)
  assert.equal(await readUgeFri({ client: null, athleteId: 'a', date: today }), null)
  // Uden niveau i ugen læses ingen kostrækker.
  kald.length = 0
  const uden = await readUgeFri({ client: klient([]), athleteId: 'a', date: today, planDays: syntetiskUge(0) })
  assert.deepEqual(uden.raekker, []); assert.equal(kald.length, 0)
})
