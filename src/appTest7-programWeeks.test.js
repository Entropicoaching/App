import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Importer hele det faktiske modul. Kun den ubrugte I/O-afhaengighed fakes.
// Ingen kildeudtraek, eval eller lokal kopi af produktionsfunktionerne.
const dependencyGuard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '../supabase') {
      return { url: 'data:text/javascript,export const supabase = { from() { throw new Error("Uventet databasekald i ren ugeproeve") } }', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
const { computeActiveWeekIdx, weekFullyLogged, weekStartDate, fmtWeekRange } =
  await import('./athlete/ugeHjaelp.js')
dependencyGuard.deregister()

// Fast ur og eksplicit dansk tidszone. Global Date gendannes i after-hooken.
const NativeDate = globalThis.Date
let nowMs = NativeDate.parse('2026-09-16T10:00:00+02:00')
const zone = 'Europe/Copenhagen'
const offsetFormat = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' })
function offsetAt(ms) {
  const label = offsetFormat.formatToParts(new NativeDate(ms)).find(p => p.type === 'timeZoneName').value
  const m = label.match(/GMT([+-])(\d\d):(\d\d)/)
  return m ? (m[1] === '+' ? 1 : -1) * (+m[2] * 60 + +m[3]) * 60000 : 0
}
function fromWall(ms) {
  let result = ms - offsetAt(ms)
  result = ms - offsetAt(result)
  return result
}
class CopenhagenDate extends NativeDate {
  constructor(value) {
    if (arguments.length === 0) super(nowMs)
    else if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)) {
      super(fromWall(NativeDate.parse(value + 'Z')))
    } else super(value)
  }
  setHours(h, m = 0, s = 0, ms = 0) {
    const wall = new NativeDate(this.getTime() + offsetAt(this.getTime()))
    wall.setUTCHours(h, m, s, ms)
    return this.setTime(fromWall(wall.getTime()))
  }
  getDate() {
    return new NativeDate(this.getTime() + offsetAt(this.getTime())).getUTCDate()
  }
  setDate(day) {
    const wall = new NativeDate(this.getTime() + offsetAt(this.getTime()))
    wall.setUTCDate(day)
    return this.setTime(fromWall(wall.getTime()))
  }
  toLocaleDateString(locale, options) {
    return super.toLocaleDateString(locale, { ...options, timeZone: zone })
  }
}
// De importerede funktioner bruger samme kontrollerede ur som proeverne.
before(() => { globalThis.Date = CopenhagenDate })
after(() => { globalThis.Date = NativeDate })
const Date = CopenhagenDate
const at = iso => { nowMs = NativeDate.parse(iso) }
const ymd = d => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(d)
const week = (id, number, date, sessions = []) => ({ id, week_number: number, start_date: date, sessions })
const exercise = { id: 'sq', name: 'Squat', sets: 2 }
const training = { id: 'pas', exercises: [exercise] }
const log = (n, skipped = false) => ({ exercise_id: 'sq', set_number: n, skipped })

test('APP-TEST7 datofake kontrollerer begge danske DST-skift med kendte UTC-tider', () => {
  for (const [local, utc] of [
    ['2026-03-29T00:00:00', '2026-03-28T23:00:00.000Z'],
    ['2026-03-30T00:00:00', '2026-03-29T22:00:00.000Z'],
    ['2026-10-25T00:00:00', '2026-10-24T22:00:00.000Z'],
    ['2026-10-26T00:00:00', '2026-10-25T23:00:00.000Z'],
  ]) assert.equal(new Date(local).toISOString(), utc)
  const d = new Date('2026-03-30T14:00:00')
  d.setHours(0, 0, 0, 0)
  assert.equal(d.toISOString(), '2026-03-29T22:00:00.000Z')
})

test('APP-TEST7 tom plan og udateret plan har ingen opdigtet dato eller afslutning', () => {
  assert.equal(computeActiveWeekIdx([]), 0)
  assert.equal(weekStartDate([], 1), null)
  assert.equal(weekStartDate([week('u1', 1, null)], 1), null)
  assert.equal(fmtWeekRange(null), null)
  assert.equal(weekFullyLogged(null, []), false)
  assert.equal(weekFullyLogged(week('tom', 1, null), []), false)
})

test('APP-TEST7 en uge og pas uden oevelser er ikke fuldt logget', () => {
  at('2026-09-16T10:00:00+02:00')
  const w = week('u1', 1, '2026-09-14', [{ id: 'hvile', exercises: [] }])
  assert.equal(computeActiveWeekIdx([w]), 0)
  assert.equal(weekFullyLogged(w, [log(1)]), false)
  assert.equal(ymd(weekStartDate([w], 1)), '2026-09-14')
  assert.match(fmtWeekRange(weekStartDate([w], 1)), /14.*sep.*20.*sep/)
})

test('APP-TEST7 normal uge er halv-aaben og udateret fremtid tager ikke den aktive uge', () => {
  const weeks = [week('u1', 1, '2026-09-14'), week('u2', 2, null)]
  at('2026-09-20T23:59:00+02:00')
  assert.equal(computeActiveWeekIdx(weeks), 0)
  at('2026-09-21T00:00:00+02:00')
  assert.equal(computeActiveWeekIdx(weeks), 1)
})

test('APP-TEST7 overlappende datoer vaelger sidste indeholdende uge som kildens regel', () => {
  at('2026-09-16T12:00:00+02:00')
  const weeks = [week('u1', 1, '2026-09-14'), week('u2', 2, '2026-09-16'), week('u3', 3, '2026-09-28')]
  const before = JSON.stringify(weeks)
  assert.equal(computeActiveWeekIdx(weeks), 1)
  assert.equal(JSON.stringify(weeks), before)
})

test('APP-TEST7 FUND F1: valgt dateret uge bevarer sin egen dato ved overlap', () => {
  const weeks = [week('u1', 1, '2026-09-14'), week('u2', 2, '2026-09-16')]
  assert.equal(ymd(weekStartDate(weeks, 2)), '2026-09-16')
})

test('APP-TEST7 manglende dato udledes fra anker uden at sortere input paa stedet', () => {
  const weeks = [week('u3', 3, null), week('u1', 1, '2026-09-14')]
  const before = JSON.stringify(weeks)
  assert.equal(ymd(weekStartDate(weeks, 3)), '2026-09-28')
  assert.equal(JSON.stringify(weeks), before)
})

test('APP-TEST7 ugeintervaller bevarer kalenderdage over sommer- og vintertid', () => {
  for (const [start, end, next] of [
    ['2026-03-23', '29', '2026-03-30'], ['2026-10-19', '25', '2026-10-26'],
  ]) {
    const weeks = [week('u1', 1, start), week('u2', 2, null)]
    assert.equal(ymd(weekStartDate(weeks, 2)), next)
    assert.ok(fmtWeekRange(weekStartDate(weeks, 1)).includes(end))
  }
})

test('APP-TEST7 FUND F2: sommerugens soendag slutter foer naeste mandag', () => {
  const weeks = [week('u1', 1, '2026-03-23'), week('u2', 2, null)]
  at('2026-03-29T23:59:00+02:00')
  assert.equal(computeActiveWeekIdx(weeks), 0)
  at('2026-03-30T00:00:00+02:00')
  assert.equal(computeActiveWeekIdx(weeks), 1)
})

test('APP-TEST7 vinterugens soendag og efterfoelgende mandag vaelges korrekt', () => {
  const weeks = [week('u1', 1, '2026-10-19'), week('u2', 2, null)]
  at('2026-10-25T23:59:00+01:00')
  assert.equal(computeActiveWeekIdx(weeks), 0)
  at('2026-10-26T00:00:00+01:00')
  assert.equal(computeActiveWeekIdx(weeks), 1)
})

test('APP-TEST7 fremdrift kraever saet i alle pas, og skipped afslutter et saet', () => {
  const w = week('u1', 1, null, [training])
  assert.equal(weekFullyLogged(w, [log(1)]), false)
  assert.equal(weekFullyLogged(w, [log(1), log(2, true)]), true)
  assert.equal(weekFullyLogged(w, [{ exercise_id: 'slettet', set_number: 1 }, log(1)]), false)
  const two = { ...w, sessions: [training, { exercises: [{ id: 'bp', sets: 1 }] }] }
  assert.equal(weekFullyLogged(two, [log(1), log(2)]), false)
})

test('APP-TEST7 FUND F3: genlogning af samme saet maa ikke afslutte ugen', () => {
  assert.equal(weekFullyLogged(week('u1', 1, null, [training]), [log(1), log(1)]), false)
})
