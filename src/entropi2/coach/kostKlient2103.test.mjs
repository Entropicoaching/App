import test from 'node:test'
import assert from 'node:assert/strict'
import { erKostKlient, harProgram, laesKostKlienter } from './kostKlienter.mjs'
import { athleteOverviewModel } from './AthleteOverview.mjs'
import { coachWeekModel, coachHomeModel } from './coachModel.mjs'
import { coachRadarModel } from './radar/model.mjs'
import { fixture, day } from './radar/fixtures.mjs'
import { readFileSync } from 'node:fs'
import { KOST_KLIENT_DAGE } from './kostKlienter.mjs'

// Ordre 2103 (Marc 24. nov.: "kost kan købes alene"): kostpakke og intet program er ikke en mangel hos coachen.
// Kun syntetiske atleter. Kostklient = kostPakke sand og ingen uge med øvelser; ingen nyt felt.
const uge = { id: 'w1', exercise_count: 4, start_date: '2026-11-16', week_number: 1 }

test('kostklient: kostpakke og ingen uge med øvelser; program gør den til en almindelig atlet', () => {
  assert.equal(erKostKlient({ kostPakke: true }, []), true)
  assert.equal(erKostKlient({ kostPakke: true }, undefined), true)
  assert.equal(erKostKlient({ kostPakke: true }, [{ id: 'w0', exercise_count: 0 }]), true)
  assert.equal(erKostKlient({ kostPakke: true }, [uge]), false)
  assert.equal(erKostKlient({ kostPakke: false }, []), false)
  assert.equal(erKostKlient({}, []), false)
  assert.equal(harProgram([uge]), true)
  const atlet = readFileSync(new URL('../../athlete/laesninger.js', import.meta.url), 'utf8').match(/KOST_PAKKE_DAGE = ([0-9]+)/)
  assert.equal(KOST_KLIENT_DAGE, Number(atlet?.[1]), 'samme 42 dage som atletens egen læsning')
})

test('coachens opslag: ét kald, kun godkendte planer de sidste 42 dage; fejl giver ingen kostklienter', async () => {
  const kald = []
  const client = { from(tabel) {
    const q = { filters: [] }
    const kaede = { select: () => kaede, in: (k, v) => (q.filters.push(['in', k, v]), kaede), eq: (k, v) => (q.filters.push(['eq', k, v]), kaede),
      gte: (k, v) => (q.filters.push(['gte', k, v]), kaede), limit: () => { kald.push({ tabel, ...q }); return Promise.resolve({ data: [{ athlete_id: 'a1' }, { athlete_id: 'a1' }], error: null }) } }
    return kaede
  } }
  const set = await laesKostKlienter(client, ['a1', 'a2'], '2026-11-24')
  assert.deepEqual([...set], ['a1'])
  assert.equal(kald.length, 1)
  assert.equal(kald[0].tabel, 'kostplan_v1_plans')
  assert.deepEqual(kald[0].filters, [['in', 'athlete_id', ['a1', 'a2']], ['eq', 'status', 'godkendt'], ['gte', 'valid_from', '2026-10-13']])
  for (const slet of [null, {}, { from: () => { throw new Error('nede') } }, { from: () => ({ select: () => ({ in: () => ({ eq: () => ({ gte: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }) }) }) }) }])
    assert.equal((await laesKostKlienter(slet, ['a1'], '2026-11-24')).size, 0)
  assert.equal((await laesKostKlienter(client, [], '2026-11-24')).size, 0)
  assert.equal((await laesKostKlienter(client, ['a1'], 'ikke-en-dag')).size, 0)
})

test('atletkortet: "Kostklient" i stedet for "Intet program", og ingen "Intet pas logget"', () => {
  const ctx = athletes => ({ day, athletes, plans: { k: [], p: [], x: [] }, calendarReady: true, complete: true,
    logs: { usable: true, complete: true, rows: [] }, actions: [] })
  const rows = athleteOverviewModel(ctx([{ id: 'k', name: 'Syntetisk K', kostPakke: true }, { id: 'p', name: 'Syntetisk P' }]))
  const by = Object.fromEntries(rows.map(r => [r.athlete.id, r]))
  assert.equal(by.k.program, 'Kostklient')
  assert.equal(by.k.lastSession, null)
  assert.equal(by.p.program, 'Intet program', 'uden kostpakke er kortet som før')
  assert.equal(by.p.lastSession, 'Intet pas logget')
  const medProgram = athleteOverviewModel({ ...ctx([{ id: 'x', name: 'Syntetisk X', kostPakke: true }]), plans: { x: [uge] } })
  assert.notEqual(medProgram[0].program, 'Kostklient', 'kostpakke og program: en almindelig atlet')
})

test('forsiden: en ny atlet med kostpakke mangler ikke en første uge; uden kostpakke gør den', () => {
  const data = athletes => ({ day, athletes, plans: Object.fromEntries(athletes.map(a => [a.id, []])), calendarReady: true })
  const ny = id => ({ id, name: `Syntetisk ${id}`, status: 'onboarding' })
  const uden = coachWeekModel(data([ny('u')]))
  assert.deepEqual(uden.nyUge.map(r => r.reason), ['Intet program i appen'])
  const med = coachWeekModel(data([{ ...ny('k'), kostPakke: true }]))
  assert.deepEqual(med.nyUge, [])
})

test('adapteren mærker kun atleter, der er i kostklient-sættet', () => {
  const f = fixture(2)
  const [a, b] = f.ids
  const model = coachHomeModel({ ...f.source, kostKlienter: new Set([a]) }, day)
  const by = Object.fromEntries(model.athletes.map(x => [x.id, x]))
  assert.equal(by[a].kostPakke, true)
  assert.equal(by[b].kostPakke, undefined)
  assert.equal(coachHomeModel({ ...f.source, kostKlienter: [a] }, day).athletes.some(x => x.kostPakke), false, 'kun et Set tæller')
})

test('radaren: ingen "Ingen træningslog i 5 dage" for en kostklient; en atlet uden kostpakke får den stadig', () => {
  const snapshot = { ...fixture(2).snapshot, logs: { state: 'ready', complete: true, rows: [] } }
  const nøgler = (source, kost) => {
    const s = { ...source, kostKlienter: kost }
    const context = coachHomeModel(s, day)
    return coachRadarModel({ enabled: true, source: s, context, snapshot }).rows.flatMap(r => r.signals.map(x => `${r.athlete.id}:${x.key}`))
  }
  const f = fixture(2)
  for (const id of f.ids) f.source.calendarWeeks[id] = []
  const [a, b] = f.ids
  const uden = nøgler(f.source, undefined)
  const med = nøgler(f.source, new Set([a]))
  assert.ok(uden.includes(`${a}:noLog`), 'grundlinjen: ' + JSON.stringify(uden))
  assert.equal(med.includes(`${a}:noLog`), false)
  assert.equal(med.includes(`${b}:noLog`), uden.includes(`${b}:noLog`), 'den anden atlet er uændret')
})
