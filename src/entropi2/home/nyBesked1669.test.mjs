import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from './AthleteHome.mjs'
import { noteReadMessages, unreadCoachCount } from './ulaestBesked.mjs'

// Ordre 1669: Hjem siger med ord, at coachen har skrevet, kun ved ulæste, og ét tryk fører til Beskeder.
const athlete = { id: 'synthetic-a' }, now = new Date('2026-11-03T12:00:00Z')
const week = { id: 'synthetic-w', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-s', title: 'Syntetisk pas', weekday: null, exercises: [{ id: 'synthetic-e', name: '', sets: 2 }] }] }
const coachMsg = (id, extra) => ({ id, sender_role: 'coach', content: 'Hej', read_at: null, ...extra })
const render = extra => renderToStaticMarkup(h(Home, { enabled: true, athlete, now, allWeeks: [week],
  currentWeek: week, exerciseLogs: [], storage: null, setTab: () => {}, ...extra }))

test('Hjem viser én linje ved ulæst coachbesked og intet ved alt læst', () => {
  const html = render({ messages: [coachMsg('m1')] })
  assert.match(html, /data-ny-besked[^>]*>Ny besked fra din coach<\/button>/)
  assert.match(render({ messages: [coachMsg('m1'), coachMsg('m2'), coachMsg('m3')] }), />3 nye beskeder fra din coach</)
  for (const extra of [{ messages: [coachMsg('m1', { read_at: 'x' })] }, {}, { messages: [{ id: 'a', sender_role: 'athlete', read_at: null }] }, { messages: 'x' }])
    assert.doesNotMatch(render(extra), /data-ny-besked|fra din coach<\/button>/)
})

test('linjen vises ikke i forhåndsvisning eller på coachens egen træning', () => {
  assert.doesNotMatch(render({ messages: [coachMsg('m1')], sessionReadOnly: true }), /data-ny-besked/)
  assert.doesNotMatch(render({ messages: [coachMsg('m1')], coachOwnTraining: true }), /data-ny-besked/)
})

test('beskeder, samtalen har vist som set, tæller ikke; nye beskeder gør', () => {
  const msgs = [coachMsg('m1'), coachMsg('m2')]
  assert.equal(unreadCoachCount(msgs, 'a1'), 2)
  noteReadMessages('a1', ['m1', 'm2'])
  assert.equal(unreadCoachCount(msgs, 'a1'), 0)
  assert.equal(unreadCoachCount([...msgs, coachMsg('m3')], 'a1'), 1)
  assert.equal(unreadCoachCount(msgs, 'a2'), 2)
})

test('trykket åbner Beskeder, og værten melder læste beskeder til Hjem', () => {
  const home = readFileSync(new URL('./AthleteHome.mjs', import.meta.url), 'utf8')
  assert.match(home, /'data-ny-besked': '',[^\n]*onClick: go\('beskeder'\)/)
  const host = readFileSync(new URL('../conversation/unreadHost.mjs', import.meta.url), 'utf8')
  assert.match(host, /noteReadMessages\(summary\.athleteId, summary\.readMessageIds\)/)
})
