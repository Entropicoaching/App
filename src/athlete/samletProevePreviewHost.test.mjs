// Verify the actual host rule using the existing synthetic host boundary adapter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, nodes, session, ownAthlete, otherAthlete } from './coachOwnTrainingFixture.mjs'
const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
for (const entropi2 of [true, false]) for (const athlete of [ownAthlete, otherAthlete]) {
  for (const requestedTab of ['program', 'fremgang']) {
    test(`host preview rule: E2=${entropi2}, own=${athlete === ownAthlete}, ${requestedTab}`, () => {
      seed({ athlete, requestedTab })
      const tree = render(AthleteView, { entropi2, session, role: 'coach', coachAthleteId: athlete.id, onExitPreview() {} })
      const expected = entropi2 && athlete === otherAthlete
      if (requestedTab === 'program') {
        const entry = nodes(tree).find(n => n.props?.label === 'Program')
        assert.equal(entry.props.componentProps.readOnly, expected)
      } else if (entropi2) {
        const entry = named(tree, 'Analysis') || named(tree, 'Entropi2Analysis')
        assert.equal(entry.props.readOnly, expected)
      }
      assert.equal(nodes(tree).some(n => n.type === 'fieldset'), expected)
      if (expected) assert.equal(named(tree, 'ProfileMenu'), undefined)
    })
  }
}
