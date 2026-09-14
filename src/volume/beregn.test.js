// ORDRE 177, commit 2. Testet mod e2e-mockens egen attrapatlet
// (e2e/fixtures.mjs) — samme seed atlet.spec.mjs/coach.spec.mjs bruger,
// ingen egen opdigtet datamodel ved siden af.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ugenoegle, beregnVolumenPrUge } from './beregn.js'
import { buildSeed } from '../../e2e/fixtures.mjs'

// Bygger de flade { oevelseNavn, loggetDato, skipped }-rækker
// VolumenKort.jsx også bygger, ud fra mockens exercise_logs + exercises.
function raekkerFraSeed({ withLogs = true } = {}) {
  const { tables } = buildSeed({ withLogs })
  const exOpslag = new Map(tables.exercises.map(e => [e.id, e]))
  return tables.exercise_logs.map(log => ({
    oevelseNavn: exOpslag.get(log.exercise_id)?.name,
    loggetDato: log.logged_at,
    skipped: log.skipped,
  }))
}

test('ugenoegle: samme kalenderuge giver samme nøgle, næste uge giver en anden', () => {
  // 2026-08-31 er en mandag (ordre 177 skrives 13/9/2026, en søndag — brug en
  // fast, kendt mandag i stedet for "i dag" for dette isolerede egenskabstjek).
  const mandag = '2026-08-31'
  const sammeUgeSoendag = '2026-09-06'
  const naesteUgeMandag = '2026-09-07'
  assert.equal(ugenoegle(mandag), ugenoegle(sammeUgeSoendag))
  assert.notEqual(ugenoegle(mandag), ugenoegle(naesteUgeMandag))
})

test('ugenoegle er stabil for datoer med klokkeslæt (ISO-timestamp, ikke kun dato)', () => {
  assert.equal(ugenoegle('2026-08-31T23:59:59.999Z'), ugenoegle('2026-08-31T00:00:00.000Z'))
})

test('e2e-mockens tre loggede squat-sæt lander korrekt på knæ/hofte/ryg/læg', () => {
  const raekker = raekkerFraSeed({ withLogs: true })
  assert.equal(raekker.length, 3)
  assert.ok(raekker.every(r => r.oevelseNavn === 'Squat'))

  const [ugeNu] = beregnVolumenPrUge(raekker, { antalUger: 1 })
  assert.deepEqual(ugeNu.grupper.kneeExtensors, { direkte: 3, ialt: 3 })
  assert.deepEqual(ugeNu.grupper.hipExtensors, { direkte: 3, ialt: 3 })
  assert.deepEqual(ugeNu.grupper.backExtensors, { direkte: 0, ialt: 1.5 })
  assert.deepEqual(ugeNu.grupper.plantarFlexors, { direkte: 0, ialt: 1.5 })
  assert.equal(ugeNu.ukendteSaet, 0)
})

test('skippede sæt tælles aldrig med, uanset øvelse', () => {
  const raekker = raekkerFraSeed({ withLogs: true })
  raekker.push({ oevelseNavn: 'Squat', loggetDato: new Date().toISOString(), skipped: true })
  const [ugeNu] = beregnVolumenPrUge(raekker, { antalUger: 1 })
  assert.deepEqual(ugeNu.grupper.kneeExtensors, { direkte: 3, ialt: 3 }) // uændret, ikke 4
})

test('ukendt øvelse tælles i ukendteSaet, aldrig med i en gruppes sum', () => {
  const raekker = raekkerFraSeed({ withLogs: true })
  raekker.push({ oevelseNavn: 'Fuglehund med kætte', loggetDato: new Date().toISOString(), skipped: false })
  const [ugeNu] = beregnVolumenPrUge(raekker, { antalUger: 1 })
  assert.equal(ugeNu.ukendteSaet, 1)
  assert.deepEqual(ugeNu.grupper.kneeExtensors, { direkte: 3, ialt: 3 }) // upåvirket
})

test('sæt uden for det viste vindue tælles ikke med', () => {
  const raekker = raekkerFraSeed({ withLogs: true })
  raekker.push({ oevelseNavn: 'Squat', loggetDato: '2020-01-06', skipped: false }) // en mandag, langt tilbage
  const uger = beregnVolumenPrUge(raekker, { antalUger: 6 })
  const summeretKnae = uger.reduce((s, u) => s + (u.grupper.kneeExtensors?.ialt || 0), 0)
  assert.equal(summeretKnae, 3) // kun de tre sæt fra i dag, 2020-raekken faldt uden for vinduet
})

test('uger uden logs er med som nul, ikke udeladt', () => {
  const uger = beregnVolumenPrUge([], { antalUger: 6, referenceDato: '2026-09-13' })
  assert.equal(uger.length, 6)
  for (const u of uger) {
    assert.deepEqual(u.grupper, {})
    assert.equal(u.ukendteSaet, 0)
  }
})

test('nyeste uge er foerst', () => {
  const uger = beregnVolumenPrUge([], { antalUger: 3, referenceDato: '2026-09-13' })
  assert.equal(uger[0].uge, ugenoegle('2026-09-13'))
  const enUgeFoer = new Date('2026-09-13T00:00:00Z')
  enUgeFoer.setUTCDate(enUgeFoer.getUTCDate() - 7)
  assert.equal(uger[1].uge, ugenoegle(enUgeFoer))
})
