// Entropi 2-kobling runde 12: K-R11 fund 1 og 2 genskabes med de faktiske moduler og syntetiske data.
// Fund 1: Hjem må ikke åbne registrering i en anden uge end den, forælderens onLogSet læser logs for.
// Fund 2: en morgenkilde bærer dagen, hvor læsningen STARTEDE, også når den afsluttes efter midnat.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { mountHomeSession } from './home/homeSessionBridge.mjs'
import { homeModel } from './home/homeModel.mjs'
import { syntheticHost } from './nutrition/synthetic-dom.mjs'
import { readMorningSource, morningDay } from '../dashboard/coachMorningSource.mjs'

const exercise = id => ({ id, name: 'Syntetisk øvelse', sets: 3, reps: 5 })
const wOld = { id: 'W-old', week_number: 1, start_date: '2026-10-26', sessions: [{ id: 'S-old', title: 'Pas A', day: 1, exercises: [exercise('E-old')] }] }
const wNew = { id: 'W-new', week_number: 2, start_date: '2026-11-02', sessions: [{ id: 'S-new', title: 'Pas A', day: 1, exercises: [exercise('E-new')] }] }
const now = new Date('2026-11-02T10:00:00+01:00')
const props = currentWeek => ({ enabled: true, athlete: { id: 'syn-atlet' }, allWeeks: [wOld, wNew], currentWeek,
  exerciseLogs: [], now, onLogSet: () => true, setLogInputs: () => {}, parsePlannedRpe: () => null })
// Kun de DOM-metoder, dialogen kalder; ingen browseremulering.
const proto = Object.getPrototypeOf(syntheticHost())
proto.removeEventListener ??= function () {}
proto.showModal ??= function () { this.open = true }
proto.close ??= function () { this.open = false }
proto.contains ??= function (node) { return node === this || this.children.some(c => c.contains?.(node)) }
proto.remove ??= function () {}
proto.removeAttribute ??= function (k) { delete this.attrs[k] }
const host = () => { const h = syntheticHost(); h.classList = { add() {}, remove() {} }; return h }

test('fund 1: Hjem viser den nye uge, men registrering åbnes ikke i en anden uge end forælderens', () => {
  const stale = props(wOld)
  const target = homeModel(stale).target
  assert.equal(target?.week.id, 'W-new', 'syntetisk forudsætning: Hjem har flyttet sig til den nye uge')
  const bridge = mountHomeSession(host(), () => stale)
  assert.equal(bridge.start(target.session.id, target.week.id), false)
  bridge.dispose()
})

test('fund 1, kontrol: samme uge hos Hjem og forælder går videre som før', () => {
  const fresh = props(wNew)
  const target = homeModel(fresh).target
  assert.equal(target?.week.id, 'W-new')
  const bridge = mountHomeSession(host(), () => fresh)
  assert.notEqual(bridge.start(target.session.id, target.week.id), false)
  bridge.dispose()
})

test('fund 2: en læsning startet før midnat bærer startdagen efter afslutning efter midnat', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:59:50Z') })
  try {
    const startDay = morningDay()
    let release, data = {}
    const run = () => new Promise(resolve => { release = resolve })
    const pending = readMorningSource(true, 'messages', ['syn-atlet'], f => { data = f(data) }, run)
    mock.timers.setTime(Date.parse('2026-11-02T23:00:05Z'))
    assert.notEqual(morningDay(), startDay, 'syntetisk forudsætning: dansk midnat er passeret')
    release({ data: [], error: null })
    await pending
    assert.equal(data.messages.day, startDay)
  } finally { mock.timers.reset() }
})

test('fund 2, OFF: den fælles læsevej er uændret og returnerer kun læsningens resultat', async () => {
  const result = { data: [1], error: null }
  let touched = false
  assert.equal(await readMorningSource(false, 'messages', [], () => { touched = true }, () => result), result)
  assert.equal(touched, false)
})
