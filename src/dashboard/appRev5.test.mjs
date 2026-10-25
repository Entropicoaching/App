import test from 'node:test'
import assert from 'node:assert/strict'
import { lavIndbakkeHandlinger } from './indbakkeHandlinger.js'
import { filterOpenTrainingSignals, trainingSignalFingerprint, summarizeCoachMessages } from '../coachInboxState.js'
import { sorterEfterAfvigelse, beregnUgensAfvigelse } from './afvigelse.js'

const NativeDate = Date
const zone = 'Europe/Copenhagen'
const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
}).formatToParts(date).map(p => [p.type, p.value]))
function offset(ms) {
  const value = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(new NativeDate(ms)).find(p => p.type === 'timeZoneName').value
  return Number(value.replace('GMT', '') || 0) * 3600000
}
function withClock(now, run) {
  class DanishDate extends NativeDate {
    constructor(...args) {
      if (!args.length) super(now)
      else if (args.length === 1) super(args[0])
      else {
        const utc = NativeDate.UTC(...args)
        super(utc - offset(utc))
      }
    }
    getFullYear() { return Number(parts(this).year) }
    getMonth() { return Number(parts(this).month) - 1 }
    getDate() { return Number(parts(this).day) }
    toLocaleTimeString(locale, options) { return super.toLocaleTimeString(locale, { ...options, timeZone: zone }) }
    toLocaleDateString(locale, options) { return super.toLocaleDateString(locale, { ...options, timeZone: zone }) }
  }
  globalThis.Date = DanishDate
  try { return run(lavIndbakkeHandlinger({}).formatMsgTime) }
  finally { globalThis.Date = NativeDate }
}
const time = stamp => new NativeDate(stamp).toLocaleTimeString('da-DK', { timeZone: zone, hour: '2-digit', minute: '2-digit' })

test('APP-REV5 F1: i går bevares efter et kalenderdøgn på 23 timer', () => {
  withClock('2026-03-30T12:00:00+02:00', format => {
    const stamp = '2026-03-29T12:34:00+02:00'
    assert.equal(format(stamp), `I går ${time(stamp)}`)
  })
})
test('APP-REV5 F1: syv kalenderdage ved sommertid får dato frem for ugedag', () => {
  withClock('2026-03-30T12:00:00+02:00', format => {
    const stamp = '2026-03-23T12:34:00+01:00'
    const day = new NativeDate(stamp).toLocaleDateString('da-DK', { timeZone: zone, day: 'numeric', month: 'short' })
    assert.equal(format(stamp), `${day} ${time(stamp)}`)
  })
})
test('APP-REV5: i dag, i går, ugedag og vintertid bevarer eksisterende tekstformat', () => {
  for (const now of ['2026-10-26T12:00:00+01:00', '2026-02-16T12:00:00+01:00']) {
    withClock(now, format => {
      assert.equal(format(now), time(now))
      const yesterday = new NativeDate(new NativeDate(now).getTime() - 86400000).toISOString()
      assert.equal(format(yesterday), `I går ${time(yesterday)}`)
      const stamp = new NativeDate(new NativeDate(now).getTime() - 3 * 86400000).toISOString()
      const day = new NativeDate(stamp).toLocaleDateString('da-DK', { timeZone: zone, weekday: 'long' })
      assert.equal(format(stamp), `${day} ${time(stamp)}`)
    })
  }
})
const signal = (name, id, severity = 'context') => Object.freeze({ o_athlete_id: id, o_athlete_name: name, o_severity: severity, o_detector: 'syntetisk' })
test('APP-REV5 F2: lige alvorlige signaler følger dansk alfabet', () => {
  const names = ['Åse', 'Øjvind', 'Ægir', 'Zara', 'Anna']
  const source = Object.freeze(names.map((name, i) => signal(name, String(i))))
  // Syntetisk engelsk standardsprog. Et eksplicit dansk sprogvalg bevares.
  const compare = String.prototype.localeCompare
  String.prototype.localeCompare = function (other, locale, options) {
    return compare.call(this, other, locale ?? 'en', options)
  }
  try {
    assert.deepEqual(filterOpenTrainingSignals(source, []).map(s => s.o_athlete_name), ['Anna', 'Zara', 'Ægir', 'Øjvind', 'Åse'])
  } finally { String.prototype.localeCompare = compare }
  assert.deepEqual(source.map(s => s.o_athlete_name), names)
})
test('APP-REV5: tomme signaler og filtre for alvor, set og udsat', () => {
  assert.deepEqual(filterOpenTrainingSignals(null, null), [])
  assert.deepEqual(filterOpenTrainingSignals([], []), [])
  const rows = [signal('Åse', 'alert', 'alert'), signal('Anna', 'seen'), signal('Øjvind', 'snooze'), signal('Ægir', 'keep'), signal('Zara', 'info', 'info')]
  const actions = [{ athlete_id: 'seen', detector: 'syntetisk', signal_fingerprint: trainingSignalFingerprint(rows[1]) },
    { athlete_id: 'snooze', detector: 'syntetisk', snoozed_until: '2026-10-25T02:30:00+01:00' }]
  assert.deepEqual(filterOpenTrainingSignals(rows, actions, NativeDate.parse('2026-10-25T02:30:00+02:00')).map(s => s.o_athlete_id), ['alert', 'keep'])
  assert.equal(filterOpenTrainingSignals(rows, actions, NativeDate.parse('2026-10-25T02:30:00+01:00')).length, 3)
})
test('APP-REV5: 10000 atleter bevarer ulæste beskeder pr. spor og nyeste række', () => {
  assert.deepEqual(summarizeCoachMessages([]), { unreadCounts: {}, unreadByTrack: {}, latestByTrack: {} })
  const rows = []
  for (let i = 0; i < 10000; i++) {
    for (const [suffix, category, sender_role, read_by_coach] of [['t', 'teknik', 'athlete', false], ['b', null, 'athlete', false], ['c', 'besked', 'coach', false], ['r', 'besked', 'athlete', true]]) {
      rows.push(Object.freeze({ id: `${i}-${suffix}`, athlete_id: `atlet${i}`, category, sender_role, read_by_coach }))
    }
  }
  const result = summarizeCoachMessages(Object.freeze(rows))
  assert.equal(Object.keys(result.unreadCounts).length, 10000)
  for (let i = 0; i < 10000; i++) {
    assert.equal(result.unreadCounts[`atlet${i}`], 2)
    assert.deepEqual(result.unreadByTrack[`atlet${i}`], { teknik: 1, besked: 1 })
    assert.equal(result.latestByTrack[`atlet${i}`].besked.id, `${i}-b`)
  }
})
test('APP-REV5: mange atleter sorteres stabilt efter afvigelse uden mutation', () => {
  assert.deepEqual(sorterEfterAfvigelse([]), [])
  const rows = Object.freeze(Array.from({ length: 10000 }, (_, id) => Object.freeze({ id, afvigelse: beregnUgensAfvigelse({ plannedSets: id % 3 ? 10 : 0, completedSets: id % 5 }) })))
  const sorted = sorterEfterAfvigelse(rows)
  assert.equal(new Set(sorted.map(r => r.id)).size, rows.length)
  let noPlan = false
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]
    if (!row.afvigelse.harPlan) noPlan = true
    else assert.equal(noPlan, false)
    if (i && row.afvigelse.harPlan && sorted[i - 1].afvigelse.harPlan) assert.ok(sorted[i - 1].afvigelse.score >= row.afvigelse.score)
    if (i && row.afvigelse.score === sorted[i - 1].afvigelse.score) assert.ok(sorted[i - 1].id < row.id)
  }
  assert.equal(rows[0].id, 0)
})
