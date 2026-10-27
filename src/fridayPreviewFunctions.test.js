import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreviewDatabase, supabase, createAbortableUploadClient } from './fridayPreviewAdapter.mjs'
import { buildPreviewSeed } from './fridayPreviewSeed.mjs'

test('K1: draft-next-week afvises synligt uden TypeError eller seedmutation', async () => {
  const seed = buildPreviewSeed(new Date(2026,9,30,12))
  const before = structuredClone(seed)
  const db = createPreviewDatabase(seed)
  let loading = false
  let message = ''
  const h = (tag, props) => ({ tag, props })
  const button = h('button', { onClick: async () => {
    loading = true
    const { error } = await db.functions.invoke('draft-next-week', {
      body: { mode: 'approve_progression_state', athlete_id: seed.athletes[0].id },
    })
    loading = false
    message = error.message
    assert.equal(error.code, 'PREVIEW_ONLY')
  } })
  await button.props.onClick()
  assert.equal(loading, false)
  assert.match(message, /preview/i)
  assert.deepEqual(seed, before)
  assert.deepEqual((await db.from('athletes').select()).data, before.athletes)
})

test('modproeve: alle funktionsnavne afvises og eksporter deler sikker adapter', async () => {
  for (const db of [createPreviewDatabase({}), supabase, createAbortableUploadClient()]) {
    for (const name of ['draft-next-week', 'unknown-write', undefined]) {
      const result = await db.functions.invoke(name, { body: { change: true } })
      assert.equal(result.data, null)
      assert.equal(result.error.code, 'PREVIEW_ONLY')
    }
  }
})
