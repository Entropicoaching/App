import test from 'node:test'
import assert from 'node:assert/strict'
import { VIDEO_STORAGE_USAGE_ENABLED, VIDEO_USAGE_LIMITS, videoStorageUsage, videoStorageUsageText } from './videoStorageUsage.mjs'
import { Component } from './videoStorageUsageHarness.mjs'

const now = new Date('2026-10-28T12:00:00Z')
const item = (size, overrides = {}) => ({ kind: 'video', athlete: { id: 'synthetic-athlete' }, video: {
  id: 'synthetic-video', video_path: 'synthetic/video.mp4', created_at: '2026-10-01T00:00:00Z',
  session_context: { video_size_bytes: size }, ...overrides,
} })
const usage = rows => videoStorageUsage(rows, new Set(), now)

test('default OFF og daterede referencegraenser fra pinnet kilde', () => {
  assert.equal(VIDEO_STORAGE_USAGE_ENABLED, false)
  assert.equal(VIDEO_USAGE_LIMITS.storageBytes, 1_000_000_000)
  assert.equal(VIDEO_USAGE_LIMITS.trafficBytes, 5_000_000_000)
  assert.equal(VIDEO_USAGE_LIMITS.sourceDate, '2026-10-27')
  assert.ok(Object.isFrozen(VIDEO_USAGE_LIMITS))
})

for (const [bytes, ratio, warning] of [[0, 0, false], [690_000_000, 0.69, false], [699_999_999, 0.699999999, false], [700_000_000, 0.7, true], [1_300_000_000, 1.3, true]]) {
  test(`${bytes} bytes: korrekt procent og 70 procent varsel uden afrundingsgate`, () => {
    const result = usage([item(bytes)])
    assert.equal(result.knownBytes, bytes)
    assert.equal(result.storageRatio, ratio)
    assert.equal(result.warning, warning)
    assert.equal(result.trafficEstimateBytes, bytes * 4)
    assert.equal(result.trafficRatio, bytes * 4 / 5_000_000_000)
    const tree = Component({ items: [item(bytes)], now })
    assert.equal(tree.type, 'p')
    assert.equal(tree.props.role, 'status')
    assert.equal(tree.props['aria-live'], 'polite')
    assert.equal(tree.children[0].includes('Varsel:'), warning)
    assert.match(tree.children[0], /Målt trafik: ukendt/)
    assert.match(tree.children[0], /antaget 4 fulde visninger/)
  })
}

test('manglende, ugyldige og ukendte stoerrelser bliver aldrig til nul', () => {
  for (const size of [undefined, null, '', '700000000', -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = usage([item(size)])
    assert.equal(result.missingSizes, 1)
    assert.equal(result.knownCount, 0)
    assert.equal(result.warning, false)
    assert.match(videoStorageUsageText(result), /ukendt af 1 GB/)
  }
  const mixed = usage([item(700_000_000), item(null, { id: 'other', video_path: 'other.mp4' })])
  assert.equal(mixed.warning, true)
  assert.equal(mixed.missingSizes, 1)
  assert.match(videoStorageUsageText(mixed), /kun den kendte del/)
})

test('maaned UTC, gamle og fremtidige videoer, skjulte atleter og filtre', () => {
  const rows = [item(100), item(900, { id: 'old', video_path: 'old', created_at: '2026-09-30T23:59:59Z' }),
    item(900, { id: 'future', video_path: 'future', created_at: '2026-10-29T00:00:00Z' }),
    item(900, { id: 'next', created_at: '2026-11-01T00:00:00Z' }),
    item(900, { id: 'bad', created_at: null }), { kind: 'message' }, null]
  assert.equal(usage(rows).knownBytes, 100)
  assert.equal(usage(rows).unknownDates, 1)
  assert.equal(videoStorageUsage(rows, new Set(['synthetic-athlete']), now).count, 0)
  assert.equal(usage([item(100, { created_at: '2026-09-30T23:30:00-01:00' })]).count, 1)
  assert.equal(usage([]).knownBytes, 0)
  assert.equal(usage([]).warning, false)
  const invalidDate = usage([item(100, { created_at: '2026-09-31T23:30:00-01:00' })])
  assert.equal(invalidDate.unknownDates, 1)
  assert.equal(invalidDate.knownBytes, 0)
})

test('modproever: dubletter, konflikt, manglende lagersti og ingen mutation', () => {
  const row = item(100)
  Object.freeze(row.video.session_context); Object.freeze(row.video); Object.freeze(row)
  assert.equal(usage(Object.freeze([row, row])).knownBytes, 100)
  const conflict = usage([row, item(200)])
  assert.equal(conflict.missingSizes, 1)
  assert.equal(conflict.knownCount, 0)
  assert.equal(usage([item(100, { video_path: null })]).missingSizes, 1)
  const overflow = usage([item(Number.MAX_SAFE_INTEGER)])
  assert.equal(overflow.knownBytes, null)
  assert.match(videoStorageUsageText(overflow), /ukendt/)
})

test('DOM: fejl og opdatering oplyser om foraeldede tal uden falsk kvote', () => {
  const tree = Component({ items: [item(undefined)], stale: true, now })
  assert.match(tree.children[0], /kan være forældede/)
  assert.match(tree.children[0], /ikke samlet lager eller månedstrafik/)
  assert.match(tree.children[0], /1 mangler størrelse/)
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
})
