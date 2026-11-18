import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Home from './AthleteHome.mjs'
import { noteReadVideos, noteSharedVideos, unreadVideoCount } from './ulaestBesked.mjs'

// Ordre 1671: Hjems ene linje gælder også en delt video, coachen har svaret på; samme linje som 1669, ikke en ny.
const athlete = { id: 'synthetic-v1' }, now = new Date('2026-11-03T12:00:00Z')
const week = { id: 'synthetic-w', athlete_id: athlete.id, start_date: '2026-11-02', week_number: 1,
  sessions: [{ id: 'synthetic-s', title: 'Syntetisk pas', weekday: null, exercises: [{ id: 'synthetic-e', name: '', sets: 2 }] }] }
const video = (id, extra) => ({ id, athlete_id: athlete.id, status: 'shared', athlete_seen_at: null, ...extra })
const coachMsg = id => ({ id, sender_role: 'coach', content: 'Hej', read_at: null })
const render = extra => renderToStaticMarkup(h(Home, { enabled: true, athlete, now, allWeeks: [week],
  currentWeek: week, exerciseLogs: [], storage: null, setTab: () => {}, messages: [], ...extra }))

test('en ulæst delt video giver én linje, to giver tal, og to linjer opstår aldrig', () => {
  noteSharedVideos(athlete.id, [video('v1')])
  assert.match(render(), /data-ny-besked[^>]*>Coachen har svaret på din video<\/button>/)
  noteSharedVideos(athlete.id, [video('v1'), video('v2')])
  assert.match(render(), />Coachen har svaret på 2 af dine videoer</)
  noteSharedVideos(athlete.id, [video('v1'), video('v2')])
  assert.equal(render().split('data-ny-besked').length, 2)
})

test('video og besked samtidig giver stadig én linje', () => {
  noteSharedVideos(athlete.id, [video('v1')])
  const html = render({ messages: [coachMsg('m1')] })
  assert.equal(html.split('data-ny-besked').length, 2)
  assert.match(html, />2 nye svar fra din coach</)
})

test('set video, ingen video og forhåndsvisning giver ingen linje', () => {
  noteSharedVideos(athlete.id, [video('v1', { athlete_seen_at: '2026-11-03T10:00:00Z' })])
  assert.doesNotMatch(render(), /data-ny-besked/)
  noteSharedVideos(athlete.id, [])
  assert.doesNotMatch(render(), /data-ny-besked/)
  noteSharedVideos(athlete.id, [video('v1')])
  assert.doesNotMatch(render({ sessionReadOnly: true }), /data-ny-besked/)
  assert.doesNotMatch(render({ coachOwnTraining: true }), /data-ny-besked/)
})

test('samtalen melder en video som læst, og linjen forsvinder; andre atleter røres ikke', () => {
  noteSharedVideos(athlete.id, [video('v1'), video('v2')])
  noteSharedVideos('synthetic-v2', [video('v9', { athlete_id: 'synthetic-v2' })])
  noteReadVideos(athlete.id, ['v1'])
  assert.equal(unreadVideoCount(athlete.id), 1)
  noteReadVideos(athlete.id, ['v1', 'v2'])
  assert.equal(unreadVideoCount(athlete.id), 0)
  assert.doesNotMatch(render(), /data-ny-besked/)
  assert.equal(unreadVideoCount('synthetic-v2'), 1)
})

test('hentningen og værten melder videoerne til Hjem uden ny hentning', () => {
  const read = f => readFileSync(new URL(f, import.meta.url), 'utf8')
  assert.match(read('../../athlete/laesninger.js'), /noteSharedVideos\(athlete\?\.id, analyses\)\s+setSharedVideoAnalyses\(analyses\)/)
  assert.match(read('../conversation/unreadHost.mjs'), /noteReadVideos\(summary\.athleteId, summary\.readVideoIds\)/)
})
