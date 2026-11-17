// Ordre 1611: atletens "Jeg er syg" og "Jeg er skadet" sender een fast besked til coachen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { MELDINGER, sendMelding } from './meldModel.mjs'

const atlet = '00000000-0000-4000-8000-0000000000a1'
const klient = (svar = { error: null }) => {
  const kald = []
  return { kald, from: tabel => ({ insert: async raekke => { kald.push([tabel, raekke]); if (svar instanceof Error) throw svar; return svar } }) }
}

test('1611: syg og skadet sender den faste tekst som almindelig besked', async () => {
  for (const slags of ['syg', 'skadet']) {
    const k = klient()
    assert.equal(await sendMelding(k, atlet, slags), 'sendt')
    assert.deepEqual(k.kald, [['messages', { athlete_id: atlet, sender_role: 'athlete', content: MELDINGER[slags].tekst, category: 'besked' }]])
  }
})

test('1611: fejl og ukendt slags sender intet tavst', async () => {
  assert.equal(await sendMelding(klient({ error: { message: 'nej' } }), atlet, 'syg'), 'fejl')
  assert.equal(await sendMelding(klient(new Error('net')), atlet, 'syg'), 'fejl')
  const k = klient()
  assert.equal(await sendMelding(k, atlet, 'traet'), 'fejl')
  assert.equal(await sendMelding(k, null, 'syg'), 'fejl')
  assert.equal(await sendMelding(null, atlet, 'syg'), 'fejl')
  assert.deepEqual(k.kald, [])
})

test('1611: knapperne siger kun hvad der sker, ingen vurdering', () => {
  assert.deepEqual(Object.keys(MELDINGER), ['syg', 'skadet'])
  for (const m of Object.values(MELDINGER)) assert.doesNotMatch(`${m.knap} ${m.spoerg}`, /overvej|deload|forslag/i)
})
