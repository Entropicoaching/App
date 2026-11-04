import test from 'node:test'
import assert from 'node:assert/strict'
import { installProgramReactLoader } from './programReactLoader.mjs'
import { supabase as syntheticClient } from '../../../athlete/prog3Dom.mjs'

test('actual week helpers load through the extensionless service boundary', async () => {
  const hooks = installProgramReactLoader()
  try {
    const helpers = await import('../../../athlete/ugeHjaelp.js')
    assert.equal(helpers.parsePlannedRpe('RPE 8,5'), 8.5)
    assert.equal(helpers.computeActiveWeekIdx([]), 0)
    assert.equal(helpers.weekFullyLogged({ sessions: [{ exercises: [{ id: 'synthetic', sets: 1 }] }] },
      [{ exercise_id: 'synthetic', set_number: 1 }]), true)
  } finally { hooks.deregister() }
})

test('both spellings of the app service use the existing fail-closed synthetic client', async () => {
  const hooks = installProgramReactLoader()
  try {
    for (const path of ['../../../supabase', '../../../supabase.js']) {
      const { supabase } = await import(path)
      assert.equal(supabase, syntheticClient)
      assert.throws(() => supabase.rpc('synthetic-only'), /Backend access forbidden/)
    }
  } finally { hooks.deregister() }
})

test('React resolution is unchanged and unrelated service-shaped paths are not stubbed', async () => {
  const resolution = specifier => {
    try { return { url: import.meta.resolve(specifier) } }
    catch (error) { return { code: error.code, message: error.message } }
  }
  const before = ['react', 'react-dom/server', 'node:path', '../../../calendarDate.js'].map(resolution)
  const hooks = installProgramReactLoader()
  try {
    assert.deepEqual(['react', 'react-dom/server', 'node:path', '../../../calendarDate.js'].map(resolution), before)
    await assert.rejects(import('./unrelated/supabase'), { code: 'ERR_MODULE_NOT_FOUND' })
    await assert.rejects(import('./unrelated/supabase.js'), { code: 'ERR_MODULE_NOT_FOUND' })
  } finally { hooks.deregister() }
})
