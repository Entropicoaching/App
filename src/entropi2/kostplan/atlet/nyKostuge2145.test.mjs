import test from 'node:test'
import assert from 'node:assert/strict'
import { laesNyKostuge, laesNyKostugeSikkert, laesKostHul, NY_KOSTUGE_TEKST } from './nyKostuge.mjs'
import { readinessValue } from '../../tracking/hurtig/model.mjs'

// Ordre 2145: kun syntetiske atleter og faste datoer (ingen Date.now). Svar som i Supabase-klienten: { data, error }.
const ATLET = { id: 'synthetic-athlete', kostPakke: true }
function klient({ planer = [], uger = [], logs = [], fejl = null, kast = false } = {}) {
  const kald = []
  return { kald, from(tabel) {
    const q = { filtre: [] }
    const svar = () => {
      kald.push({ tabel, filtre: q.filtre })
      if (kast) return Promise.reject(Error('synthetic'))
      if (fejl === tabel) return Promise.resolve({ data: null, error: Error('synthetic') })
      if (tabel === 'kostplan_v1_plans') {
        const fra = q.filtre.find(f => f[0] === 'gte' && f[1] === 'valid_from')?.[2]
        return Promise.resolve({ data: planer.filter(p => !fra || p.valid_from >= fra).slice(0, 1), error: null })
      }
      return Promise.resolve({ data: tabel === 'weeks' ? uger : logs, error: null })
    }
    const kaede = { select: () => kaede, eq: () => kaede, gt: () => kaede, order: () => kaede, limit: () => kaede, range: () => kaede,
      gte: (k, v) => { q.filtre.push(['gte', k, v]); return kaede }, then: (a, b) => svar().then(a, b) }
    return kaede
  } }
}

test('hul: ingen godkendt plan fra i dag eller senere giver "ny kostuge"', async () => {
  const k = klient({ planer: [{ id: 'p1', valid_from: '2026-11-17' }, { id: 'p2', valid_from: '2026-11-23' }] })
  assert.equal(await laesNyKostuge(k, 'synthetic-athlete', '2026-11-24'), true)
  assert.equal(NY_KOSTUGE_TEKST, 'Ny kostuge er på vej fra Marc')
})
test('sidste dag og dage med en sendt plan er ikke et hul', async () => {
  const k = klient({ planer: [{ id: 'p', valid_from: '2026-11-24' }] })
  assert.equal(await laesNyKostuge(k, 'synthetic-athlete', '2026-11-24'), false)
  assert.equal(await laesNyKostuge(k, 'synthetic-athlete', '2026-11-23'), false)
})
test('læsefejl, kast, ukendt klient eller ugyldig dato giver aldrig teksten', async () => {
  assert.equal(await laesNyKostuge(klient({ fejl: 'kostplan_v1_plans' }), 'synthetic-athlete', '2026-11-24'), false)
  assert.equal(await laesNyKostuge(klient({ kast: true }), 'synthetic-athlete', '2026-11-24'), false)
  assert.equal(await laesNyKostuge(null, 'synthetic-athlete', '2026-11-24'), false)
  assert.equal(await laesNyKostuge(klient(), 'synthetic-athlete', 'i dag'), false)
  assert.equal(await laesNyKostuge(klient(), '', '2026-11-24'), false)
  assert.equal(await laesNyKostugeSikkert({ athleteId: 'synthetic-athlete', today: '2026-11-24', client: klient({ kast: true }) }), false)
})
test('laesKostHul: kun kostklient uden uger og løftehistorik; træningsatlet får aldrig hul', async () => {
  assert.deepEqual(await laesKostHul({ athlete: ATLET, today: '2026-11-24', client: klient() }), { kostKlient: true, nyUge: true })
  assert.deepEqual(await laesKostHul({ athlete: ATLET, today: '2026-11-24', client: klient({ planer: [{ id: 'p', valid_from: '2026-11-25' }] }) }),
    { kostKlient: true, nyUge: false })
  const traener = await laesKostHul({ athlete: ATLET, today: '2026-11-24', client: klient({ uger: [{ id: 'w1' }] }) })
  assert.deepEqual(traener, { kostKlient: false, nyUge: false })
  assert.deepEqual(await laesKostHul({ athlete: { id: 'synthetic-athlete' }, today: '2026-11-24', client: klient() }), { kostKlient: false, nyUge: false })
})
test('kort Dagsform: søvn og energi kræves, de tre øvrige gemmes tomme; fuld Dagsform er uændret', () => {
  const kort = { sleep_hours: '7,5', energy: '4', motivation: '', stress: '', soreness_level: '' }
  assert.deepEqual(readinessValue(kort, true), { sleep_hours: 7.5, energy: 4, motivation: null, stress: null, soreness_level: null })
  assert.throws(() => readinessValue({ ...kort, energy: '' }, true), /energi/)
  assert.throws(() => readinessValue(kort), /motivation/)
  assert.deepEqual(readinessValue({ ...kort, motivation: '3', stress: '2', soreness_level: '1' }),
    { sleep_hours: 7.5, energy: 4, motivation: 3, stress: 2, soreness_level: 1 })
})
