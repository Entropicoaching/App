import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './analyseSamletLoader.mjs'
import { mount, nodes, one, text } from './analyseSamletDom.mjs'
const hooks = install()
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { VIDEO_SLET, planOriginalRetention, runOriginalRetention } = await import('../videoRetention.mjs')
const props = { a: { id: '11111111-1111-1111-1111-111111111111' }, selectedAthlete: { id: '11111111-1111-1111-1111-111111111111' },
  athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [],
  exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }

test('rebase matrix: actual analysis retains local preview and legacy AI handler with release flags', () => {
  const prior = globalThis.window
  try {
    for (const search of ['', '?rel1030=1', '?analyseSamlet=1', '?analyseSammenlign=1',
      '?coachRyd=1', '?rel1030=1&analyseSamlet=1&analyseSammenlign=1&coachRyd=1']) {
      globalThis.window = { location: { search } }
      for (const coachRyd of [false, true]) {
        let opens = 0
        const p = { ...props, coachRyd, setShowAiExport: () => opens++, setAiExportText() {} }
        const ui = mount(AnalyseTab, p)
        let tree = ui.render()
        assert.equal(nodes(tree, n => n.type === 'summary' && text(n) === 'Beregn med lokal filoversigt').length, 1)
        one(tree, n => n.type === 'button' && text(n) === 'AI Rapport').props.onClick()
        assert.equal(opens, 1)
        one(tree, n => n.type === 'textarea').props.onChange({ target: { value: '[]' } })
        one(ui.render(), n => n.type === 'button' && text(n) === 'Beregn metadata-preview').props.onClick()
        tree = ui.render()
        assert.match(text(tree), /0 originaler ville blive slettet/)
        assert.match(text(tree), /Sletning er slået fra/)
        assert.equal(nodes(tree, n => n.type === 'button' && /slet/i.test(text(n))).length, 0)
        ui.dispose()
      }
    }
  } finally { if (prior === undefined) delete globalThis.window; else globalThis.window = prior }
})

test('rebase counterexample: release opt-in never enables deletion or reads the adapter', async () => {
  assert.equal(VIDEO_SLET, false)
  const poison = new Proxy({}, { get() { throw Error('foreign object read') } })
  // No inventory means unavailable, independently of release preview flags.
  const plan = planOriginalRetention({ analyses: [], objects: undefined, athleteId: '11111111-1111-1111-1111-111111111111', now: '2026-10-28T00:00:00Z' })
  assert.equal(plan.available, false)
  assert.equal(plan.candidates.length, 0)
  for (const videoSlet of [undefined, false, 'true', 1]) {
    const result = await runOriginalRetention({ analyses: [], objects: [], athleteId: props.a.id, now: '2026-10-28T00:00:00Z' }, { videoSlet, dryRun: false, adapter: poison })
    assert.deepEqual(result.removed, [])
  }
})
test.after(() => hooks.deregister())
