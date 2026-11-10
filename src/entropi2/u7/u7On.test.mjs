import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_U7_TOP_SET, DEFAULT_U7_DAY_DATA, DEFAULT_U7_COACH_DATA, u7Enabled } from './flag.mjs'
import { UDGIVELSE_TRIN } from '../../udgivelseTrin.mjs'

// U7 5/5: de tre dele er tændt. Rollback er én linje pr. del i flag.mjs.
test('U7 5/5: alle tre dele er tændt, og et eksplicit false slukker hver del', () => {
  assert.deepEqual([DEFAULT_U7_TOP_SET, DEFAULT_U7_DAY_DATA, DEFAULT_U7_COACH_DATA], [true, true, true])
  for (const part of ['topSet', 'dayData', 'coachData']) {
    assert.equal(u7Enabled(part), true)
    assert.equal(u7Enabled(part, false), false)
  }
})

test('U7 5/5: UDGIVELSE_TRIN er uændret, og migrationen ligger kun som udkast', () => {
  assert.equal(UDGIVELSE_TRIN, 0)
  const migrations = new URL('../../../supabase/migrations/', import.meta.url)
  assert.throws(() => readFileSync(new URL('20261111000000_u7_kost_som_data_A_C_DRAFT.sql', migrations)), { code: 'ENOENT' })
})
