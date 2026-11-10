import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_U6_PLAN_WEIGHT, DEFAULT_U6_DRAFTS, DEFAULT_U6_HEAVY_WEEK, DEFAULT_U6_MEAL_FIRST, u6Enabled } from './flag.mjs'

test('U6 5/5: alle fire dele er tændt, og en eksplicit værdi vinder stadig', () => {
  assert.deepEqual([DEFAULT_U6_PLAN_WEIGHT, DEFAULT_U6_DRAFTS, DEFAULT_U6_HEAVY_WEEK, DEFAULT_U6_MEAL_FIRST], [true, true, true, true])
  for (const part of ['planWeight', 'drafts', 'heavyWeek', 'mealFirst']) {
    assert.equal(u6Enabled(part), true)
    assert.equal(u6Enabled(part, false), false)
  }
})

test('U6 5/5: coachens samtale tager udkastet fra Skriv, kun bag flaget og kun for coachen', () => {
  const source = readFileSync(new URL('../conversation/ConversationEntry.mjs', import.meta.url), 'utf8')
  assert.match(source, /if \(enabled === true && role === 'coach' && u6Enabled\('drafts'\)\) applyCoachDraft\(controller, entry\.selectedAthlete\?\.id\)/)
  // Udkastsstien kalder aldrig send.
  const handoff = readFileSync(new URL('./draftHandoff.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(handoff, /\.send\(/)
})
