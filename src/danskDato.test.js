import { test } from 'node:test'
import assert from 'node:assert/strict'
import { danskDag, danskDatoTekst, dageSiden } from './danskDato.js'

test('danskDag (ORDRE 456, A8): et sæt kl. 01.30 dansk sommertid står på den danske dag, ikke UTC-dagen før', () => {
  assert.equal(danskDag('2026-09-26T23:30:00.000Z'), '2026-09-27') // 01.30 dansk sommertid
  assert.equal(danskDag('2026-09-27T10:00:00+00:00'), '2026-09-27')
  assert.equal(danskDag('2026-01-15T23:30:00Z'), '2026-01-16') // vintertid, 00.30
  assert.equal(danskDag('2026-01-15T22:30:00Z'), '2026-01-15')
  assert.equal(danskDag('2026-09-27'), '2026-09-27')
  assert.equal(danskDag(null), '')
})

test('danskDatoTekst: 27. sep 2026', () => {
  assert.equal(danskDatoTekst('2026-09-27'), '27. sep 2026')
  assert.equal(danskDatoTekst('2026-01-05'), '5. jan 2026')
  assert.equal(danskDatoTekst(''), '')
})

test('dageSiden: hele dage i dansk tid, aldrig negativ for i dag', () => {
  const nu = new Date('2026-09-27T02:30:00Z') // 04.30 dansk tid
  assert.equal(dageSiden('2026-09-27', nu), 0)
  assert.equal(dageSiden('2026-09-26', nu), 1)
  assert.equal(dageSiden('2026-09-20', nu), 7)
  assert.equal(dageSiden('', nu), null)
})
