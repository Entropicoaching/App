import { test } from 'node:test'
import assert from 'node:assert/strict'
import { remainingSeconds } from './restTimer.js'

test('ingen startedAt (ikke aktiv) returnerer den frosne værdi uændret', () => {
  assert.equal(remainingSeconds(45, null), 45)
})

test('lige startet: ingen tid gået, fuld rest tilbage', () => {
  const now = 1_000_000
  assert.equal(remainingSeconds(90, now, now), 90)
})

test('normalt forløb: 30 sekunder gået giver 60 tilbage', () => {
  const now = 1_000_000
  assert.equal(remainingSeconds(90, now, now + 30_000), 60)
})

test('går aldrig under 0, uanset hvor meget tid der er gået', () => {
  const now = 1_000_000
  assert.equal(remainingSeconds(90, now, now + 500_000), 0)
})

// ORDRE 76 — "stille fejl, runde 4", G5: hviletimerne i mobilisering talte
// ned via setTimeout(...,1000) og et tick-tal. Låses skærmen midt i et
// 45-sekunders hold, bliver setTimeout-kæden throttlet/pauseret — med et
// tick-baseret design ville nedtællingen fryse eller springe uforudsigeligt
// ved genoptagelse. Med et falsk ur: 90 sekunder i baggrunden skal give
// PRÆCIS 90 sekunder forløbet, uanset hvor mange (om nogen) ticks der nåede
// at køre imens.
test('G5 — 90 sekunder i baggrunden giver 90 sekunders forløb, ikke antal ticks der nåede at køre', () => {
  const startedAt = 2_000_000
  // Simulerer at browseren droppede ALLE mellemliggende ticks (0 kørte) mens
  // fanen var i baggrunden/skærmen låst — kun ét recompute-kald ved
  // genoptagelse (visibilitychange), præcis 90 sekunder senere.
  const resumedAt = startedAt + 90_000
  const live = remainingSeconds(120, startedAt, resumedAt)
  assert.equal(live, 30, '120s varighed minus 90s forløbet skal give 30s tilbage, uanset hvor mange ticks der reelt kørte')
})

test('G5 — et 45-sekunders hold der låses hele vejen igennem ender præcis i 0, ikke i en frossen rest', () => {
  const startedAt = 0
  const live = remainingSeconds(45, startedAt, 45_000)
  assert.equal(live, 0)
})

test('flere recompute-kald efter samme startedAt er idempotente for samme "nu" — ingen dobbelt-fradrag', () => {
  const startedAt = 5_000_000
  const now = startedAt + 12_000
  const first = remainingSeconds(60, startedAt, now)
  const second = remainingSeconds(60, startedAt, now)
  assert.equal(first, second)
  assert.equal(first, 48)
})
