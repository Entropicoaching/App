import test from 'node:test'
import assert from 'node:assert/strict'
import { weightTrendText } from './weightTrend.mjs'

const rows = (dates, weight) => dates.map(logged_at => ({ logged_at, weight }))
const prior = rows(['2025-11-01', '2025-11-09', '2025-12-03', '2026-01-02', '2026-02-19', '2026-03-01', '2026-03-29'], 80)
const recent = rows(['2026-04-01', '2026-04-16', '2026-05-20', '2026-07-01', '2026-08-09', '2026-10-25', '2026-10-26'], 82)

test('uregelmæssige vejninger viser faktisk interval og antal for begge grupper', () => {
  assert.equal(weightTrendText([...prior, ...recent]), '↑ +2,0 kg. Gennemsnit for 01.04.2026 til 26.10.2026 (7 vejninger) sammenlignet med 01.11.2025 til 29.03.2026 (7 vejninger).')
})

test('stabil og faldende trend har også begge perioder og antal', () => {
  const stable = weightTrendText([...prior, ...recent.map(row => ({ ...row, weight: 80.2 }))])
  assert.equal(stable, '= stabil. Gennemsnit for 01.04.2026 til 26.10.2026 (7 vejninger) sammenlignet med 01.11.2025 til 29.03.2026 (7 vejninger).')
  const down = weightTrendText([...prior, ...recent.map(row => ({ ...row, weight: 79 }))])
  assert.equal(down, '↓ 1,0 kg. Gennemsnit for 01.04.2026 til 26.10.2026 (7 vejninger) sammenlignet med 01.11.2025 til 29.03.2026 (7 vejninger).')
})

test('0 til 7 vejninger må ikke skabe en overlappende sammenligning', () => {
  for (let count = 0; count <= 7; count++) {
    assert.equal(weightTrendText(recent.slice(0, count)), null, `${count} vejninger`)
  }
})

test('8 vejninger viser det begrænsede grundlag på én tidligere vejning', () => {
  assert.equal(weightTrendText([prior[0], ...recent]), '↑ +2,0 kg. Gennemsnit for 01.04.2026 til 26.10.2026 (7 vejninger) sammenlignet med 01.11.2025 til 01.11.2025 (1 vejning).')
})

test('9 til 13 vejninger har delvis tidligere gruppe med præcise endepunkter', () => {
  for (let count = 2; count <= 6; count++) {
    const previous = prior.slice(0, count)
    const end = previous.at(-1).logged_at.split('-').reverse().join('.')
    assert.equal(weightTrendText([...previous, ...recent]), `↑ +2,0 kg. Gennemsnit for 01.04.2026 til 26.10.2026 (7 vejninger) sammenlignet med 01.11.2025 til ${end} (${count} vejninger).`)
  }
})

test('mere end 14 vejninger ændrer ikke de to seneste grupper', () => {
  assert.equal(weightTrendText([{ logged_at: '2024-01-01', weight: 999 }, ...prior, ...recent]), weightTrendText([...prior, ...recent]))
})

test('rå vejninger ændres ikke, heller ikke frosne objekter', () => {
  const input = Object.freeze([...prior, ...recent].map(row => Object.freeze({ ...row })))
  const before = JSON.stringify(input)
  weightTrendText(input)
  assert.equal(JSON.stringify(input), before)
})

test('gennemsnit og tærskel bevares, uden kalenderuge eller helbredskonklusion', () => {
  const input = [...prior, ...recent.map((row, i) => ({ ...row, weight: i === 6 ? 87 : 80 }))]
  const text = weightTrendText(input)
  assert.ok(text.startsWith('↑ +1,0 kg.'))
  assert.doesNotMatch(text, /uge|sund|bulk|cut|[–—]/i)
  assert.ok(weightTrendText([...prior, ...recent.map(row => ({ ...row, weight: 80.31 }))]).startsWith('↑ +0,3 kg.'))
})

test('u8c: Observeret forskel står med dansk komma', () => {
  const saved = globalThis.location
  globalThis.location = { search: '?appData2=1' }
  try {
    const days = n => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
    const text = weightTrendText(days(28).map((logged_at, i) => ({ logged_at, weight: i < 14 ? 80 : 81.5 })), '2026-10-29')
    if (text?.startsWith('Observeret forskel')) assert.match(text, /^Observeret forskel: \d+,\d kg\./)
    assert.doesNotMatch(String(text), /\d\.\d kg/)
  } finally { globalThis.location = saved }
})
