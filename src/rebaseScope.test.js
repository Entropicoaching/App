import { hookControl } from './checklistHarness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { default: App } = await import('./App.jsx')
const { default: Athlete } = await import('./AthleteView.jsx')
const nodes = t => t && typeof t === 'object' ? [t, ...(t.props?.children || []).flatMap(nodes)] : []
function render(flag) { hookControl.cursor = 0; return App({ programIntensityHelp: flag }) }

test('rebase probe 1: checklist target and strict intensity opt-in survive both actual App branches', () => {
  try {
    for (const flag of [undefined, false, 'true', 1, true]) {
      hookControl.values = [{ user: { id: 'synthetic-coach' } }, 'coach', false, false, false, null, 'hjem', false]
      const dashboard = nodes(render(flag)).find(n => n.props.label === 'Dashboard')
      dashboard.props.componentProps.onPreviewAthlete('synthetic-a', 'program')
      let preview = nodes(render(flag)).find(n => n.props.label === 'Atletvisning')
      assert.equal(preview.props.componentProps.programIntensityHelp, flag === true)
      assert.equal(preview.props.componentProps.previewInitialTab, 'program')
      assert.equal(preview.props.componentProps.coachAthleteId, 'synthetic-a')
      hookControl.values = [{ user: { id: 'synthetic-a' } }, 'athlete', false, false, false, null, 'hjem', false]
      preview = nodes(render(flag)).find(n => n.props.label === 'Atletvisning')
      assert.equal(preview.props.componentProps.programIntensityHelp, flag === true)
    }
  } finally { hookControl.values = null }
})

test('rebase probe 2: imported Athlete rejects foreign preview roles and unknown destinations', () => {
  try {
    for (const props of [
      { role: 'athlete', coachAthleteId: 'synthetic-a', previewInitialTab: 'program' },
      { role: 'coach', previewInitialTab: 'program' },
      { role: 'coach', coachAthleteId: 'synthetic-a', previewInitialTab: 'analyse' },
    ]) {
      let first
      hookControl.first = v => { first = v }
      assert.throws(() => Athlete({ ...props, programIntensityHelp: true }), /FIRST_STATE_CAPTURED/)
      assert.equal(first, 'hjem')
    }
  } finally { hookControl.first = null }
})
