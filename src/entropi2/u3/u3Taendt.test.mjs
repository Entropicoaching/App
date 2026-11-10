// U3 commit 8: flaget er tændt som standard. Fejler på commit 7, hvor standarden er slukket.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { DEFAULT_U3_DATA, u3DataEnabled } from './flag.mjs'
import { fakeU3Client } from './fakeU3Client.mjs'
import Analysis from '../analysis/Analysis.mjs'
import { CoachView } from '../coach/CoachScreen.mjs'
import { productionFixture, day } from '../coach/coachProductionFixture.mjs'

test('U3 er tændt som standard, og en eksplicit false slukker stadig (rollback er én linje)', () => {
  assert.equal(DEFAULT_U3_DATA, true)
  assert.equal(u3DataEnabled(), true)
  assert.equal(u3DataEnabled(false), false)
})

test('uden u3Data monteres U3 hos atleten og coachen, men intet læses før visning eller åbning', () => {
  const client = fakeU3Client({})
  const athlete = render(h(Analysis, { entropi2: true, now: new Date('2026-11-10T12:00:00Z'), athlete: { id: 'atlet-a' },
    currentWeek: { start_date: '2026-11-09', sessions: [] }, exerciseLogs: [], fremgangLogs: [], u3Client: client }))
  assert.match(athlete, /data-u3-athlete-top/)
  assert.match(athlete, /data-u3-blocks-fold="athlete"/)
  const coach = render(h(CoachView, { ...productionFixture(), today: day, athletesOpen: true, notesClient: client }))
  assert.match(coach, /Holdet samlet/)
  assert.match(coach, /Blok for blok[\s\S]*Uge for uge/)
  assert.equal(client.calls.length, 0)
})
