import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastCheckinDrivenChange, checkinNoteTimingText } from './readinessInsight.js'

const fmtDate = value => {
  const [, month, day] = value.split('-')
  return `${Number(day)}/${Number(month)}`
}
const log = (date, score = 40) => ({ logged_date: date, readiness_score: score })
const week = (date, note = 'Planen fortsætter som aftalt. Ingen ændring.') => ({ start_date: date, coach_note: note })

test('senere ugenote bevares uden at love en effekt eller datere skrivningen', () => {
  const note = 'Planen fortsætter som aftalt. Ingen ændring.\nHele noten bevares: <roligt> & "godt".'
  const match = lastCheckinDrivenChange([log('2026-10-01')], [week('2026-10-06', note)])
  assert.deepEqual(match, { checkinDate: '2026-10-01', weekStartDate: '2026-10-06', note })
  const display = checkinNoteTimingText(match, fmtDate)
  assert.deepEqual(display, {
    heading: 'Coachnote efter et check-in',
    description: 'Du loggede lav parathed d. 1/10. Denne coachnote er til ugen der startede d. 6/10. Datoerne viser kun rækkefølgen, ikke hvorfor noten blev skrevet.',
  })
  assert.doesNotMatch(display.heading + display.description, /gjorde en forskel|skrev din coach|[\u2013\u2014]/)
  assert.equal(match.note, note)
})

test('nyeste matchende lave score og tidligste senere noteuge vælges stadig', () => {
  const logs = [log('2026-10-01'), log('2026-10-20'), log('2026-10-10')]
  const weeks = [week('2026-10-16', 'Senere'), week('2026-10-13', 'Første'), week('2026-10-04', 'Gammel')]
  const original = JSON.stringify({ logs, weeks })
  assert.deepEqual(lastCheckinDrivenChange(logs, weeks), {
    checkinDate: '2026-10-10', weekStartDate: '2026-10-13', note: 'Første',
  })
  assert.equal(JSON.stringify({ logs, weeks }), original)
})

test('samme dag og tidligere uge matcher ikke', () => {
  assert.equal(lastCheckinDrivenChange([log('2026-10-10')], [week('2026-10-09'), week('2026-10-10')]), null)
})

test('ni kalenderdage matcher også over sommertidsskift', () => {
  assert.deepEqual(lastCheckinDrivenChange([log('2026-10-24')], [week('2026-11-02', 'Behold')]), {
    checkinDate: '2026-10-24', weekStartDate: '2026-11-02', note: 'Behold',
  })
})

test('ti kalenderdage matcher ikke', () => {
  assert.equal(lastCheckinDrivenChange([log('2026-10-24')], [week('2026-11-03')]), null)
})

test('score 49 matcher mens 50 og manglende score ikke matcher', () => {
  const weeks = [week('2026-10-06')]
  assert.ok(lastCheckinDrivenChange([log('2026-10-01', 49)], weeks))
  assert.equal(lastCheckinDrivenChange([log('2026-10-01', 50)], weeks), null)
  assert.equal(lastCheckinDrivenChange([log('2026-10-01', null)], weeks), null)
})

test('ingen data eller manglende note giver fortsat intet kortmatch', () => {
  assert.equal(lastCheckinDrivenChange(null, null), null)
  assert.equal(lastCheckinDrivenChange([], [week('2026-10-06')]), null)
  assert.equal(lastCheckinDrivenChange([log('2026-10-01')], [week('2026-10-06', '')]), null)
})

test('datoformattering bruger begge uændrede matchdatoer', () => {
  const calls = []
  const display = checkinNoteTimingText({ checkinDate: '2026-12-29', weekStartDate: '2027-01-04', note: 'Ordret' }, date => {
    calls.push(date)
    return `[${date}]`
  })
  assert.deepEqual(calls, ['2026-12-29', '2027-01-04'])
  assert.ok(display.description.includes('[2026-12-29]'))
  assert.ok(display.description.includes('[2027-01-04]'))
})
