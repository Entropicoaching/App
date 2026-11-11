import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { dayNumbersLine, painFromDaily } from './coachData.mjs'
import { attentionDraft } from '../u6/coachDraft.mjs'
import { fakeBackend, memoryStorage } from './fakeBackend.fixture.mjs'

// Rettelser efter den separate kontrol af U7. Kun syntetiske data.
const A = 'atlet-syntetisk-u7'
const day = '2026-11-11'
const d = n => addCalendarDays(day, n)

test('U7 kontrol: "sidste 7 dage" er i dag og de 6 dage før, ikke 8 dage', () => {
  const rows = [{ athlete_id: A, logged_date: d(-7), sleep_quality: 1, pain: 9, pain_location: null },
    { athlete_id: A, logged_date: d(-6), sleep_quality: 3, pain: 2, pain_location: null }]
  assert.equal(dayNumbersLine(rows, day), 'Søvn 3,0/5 (1 dag) · Smerte 2/10 5. nov. · sidste 7 dage')
  assert.equal(painFromDaily(rows, day), null)
})

test('U7 kontrol: udkastet om smerte får ét punktum efter datoen', () => {
  const daily = [{ athlete_id: A, logged_date: d(-1), pain: 6, pain_location: 'knæ' }]
  const text = attentionDraft({ row: { athlete: { id: A, name: 'Syntetisk' }, u3: 'pain', key: `u3-pain-${A}` }, attention: { readiness: [], notes: [], daily }, day }).text
  assert.match(text, /10\. nov\. Hvordan/)
  assert.doesNotMatch(text, /\.\./)
})

let React, act, createRoot, hostFixture, tick, missingReact = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
  ;({ hostFixture, tick } = await import('../nutrition/diaryTemplate.fixture.mjs'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  missingReact = true
}
const gate = { skip: missingReact ? 'Kræver ægte React.' : false }

test('U7 kontrol: vand over 10.000 ml fra databasen lægges ind uden at blive mindre, og teksten lover ikke, at coachen ser vandet', gate, async () => {
  const { default: WaterDayLog } = await import('../kostplan/atlet/WaterDayLog.mjs')
  const today = calendarDay()
  const f = fakeBackend({ tables: { tracking_daily_v1: [{ athlete_id: A, logged_date: today, water_ml: 12500 }], nutrition_targets_v1: [] } })
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: memoryStorage() })
  try {
    await act(async () => { root.render(React.createElement(WaterDayLog, { enabled: true, athleteId: A, date: today, client: f.client, u7DayData: true })); for (let i = 0; i < 8; i++) await tick() })
    assert.match(dom.host.textContent, /drukket 12\.500 ml/) // U9: totalen står ved glasset
    assert.doesNotMatch(dom.host.textContent, /coach kan se dagens total/)
    assert.equal(f.db.tracking_daily_v1[0].water_ml, 12500)
  } finally {
    await act(async () => { root.unmount(); await tick() })
    dom.restore()
  }
})
