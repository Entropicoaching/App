// Entropi 2-kobling runde 9 (rest): et måltid får dansk kalenderdag i det øjeblik, det gemmes, når
// kostskærmen følger dags dato. Faktisk createNutritionController og appens calendarDay med falsk ur.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNutritionController } from './controller.mjs'
import { calendarDay } from '../../calendarDate.js'

const meal = { meal: 'Syntetisk måltid', kcal: 500, protein: 30, carb: 50, fat: 10 }
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function controller(extra = {}) {
  const saved = []
  const c = createNutritionController({ enabled: true, athlete: { id: 'syn-a' }, date: '2026-11-02',
    contracts: { async load() { return [] }, async save(v) { saved.push(v); return true } }, ...extra })
  return { c, saved }
}

test('R9: et måltid gemt i minuttet efter midnat får den nye dag, når skærmen følger dags dato', async () => {
  try {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:59:00Z') })
    const changed = []
    const { c, saved } = controller({ currentDay: () => calendarDay(), onDayChanged: day => changed.push(day) })
    await c.load()
    assert.equal(await c.log(meal, 'foer'), true)
    assert.equal(saved[0].date, '2026-11-02')
    assert.deepEqual(changed, [])
    // Midnat passerer; skærmen er stadig monteret med datoen fra før midnat.
    mock.timers.setTime(Date.parse('2026-11-02T23:00:20Z'))
    assert.equal(await c.log(meal, 'efter'), true)
    assert.equal(saved[1].date, '2026-11-03')
    assert.deepEqual(changed, ['2026-11-03'])
    // Den gamle dags dagbog viser ikke måltidet; skærmen monteres med den nye dag af adapteren.
    assert.equal(c.snapshot().logs.filter(r => r.date === '2026-11-03').length, 0)
  } finally { mock.timers.reset() }
})

test('R9: en bevidst valgt dato (uden currentDay) bevares, og en ugyldig dag gemmer intet', async () => {
  try {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T23:00:20Z') })
    const fixed = controller()
    await fixed.c.load()
    assert.equal(await fixed.c.log(meal, 'fast'), true)
    assert.equal(fixed.saved[0].date, '2026-11-02')
    const broken = controller({ currentDay: () => 'ikke en dato' })
    await broken.c.load()
    assert.equal(await broken.c.log(meal, 'ugyldig'), false)
    assert.equal(broken.saved.length, 0)
  } finally { mock.timers.reset() }
})

test('R9: koblingen giver kun currentDay, når kostens dato er dags dato; vejningen bruger allerede gemmeøjeblikket', () => {
  const view = read('../../AthleteView.jsx')
  assert.match(view, /\{\.\.\.\(kostDate === e2Dag\.day \|\| kostDate === e2Day \? \{ onWeightInput: setWeightInput, logWeight, currentDay: today, onDayChanged: e2Dag\.refresh \} : \{\}\)\} \/>/)
  const kost = read('../Entropi2Kost.mjs')
  assert.match(kost, /currentDay: \(\) => \(typeof latest\.current\.currentDay === 'function' \? latest\.current\.currentDay\(\) : date\)/)
  assert.match(kost, /latest\.current = \{ onNavigate, onCoach, currentDay, onDayChanged \}/)
  assert.match(read('./index.mjs'), /createNutritionController\(\{ enabled: true, athlete, date, contracts, storage, foods, currentDay, onDayChanged \}\)/)
  // Den eksisterende logWeight bestemmer dagen ved gemning (today() i selve handleren).
  assert.match(read('../../athlete/beskederOgVaegt.jsx'), /async function logWeight\(\) \{[\s\S]*?const todayStr = today\(\)/)
})
