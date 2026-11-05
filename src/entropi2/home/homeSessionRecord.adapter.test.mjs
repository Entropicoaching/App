import test from 'node:test'
import assert from 'node:assert/strict'
import { loadViews, seed, render, named, session, ownAthlete, otherAthlete } from '../../athlete/coachOwnTrainingFixture.mjs'

const { default: AthleteView, dispose } = await loadViews()
test.after(dispose)
test('actual AthleteView supplies the existing receipt, index, setter and dedupe ref to HomeSession', () => {
  const receipt = { key: 'synthetic-lift_1', id: 'synthetic-lift_1:90:5', tekst: 'Ny rekord' }
  for (const role of ['athlete', 'coach']) {
    seed({ athlete: ownAthlete, rekordFejring: receipt })
    const tree = render(AthleteView, { role, session,
      ...(role === 'coach' ? { coachAthleteId: ownAthlete.id, onExitPreview() {} } : {}) })
    const props = named(tree, 'HomeSession').props
    assert.deepEqual(props.rekordFejring, receipt)
    assert.ok(Object.hasOwn(props, 'rekordGrundlagFoer'))
    assert.equal(typeof props.setRekordFejring, 'function')
    assert.ok(props.fejredeRef.current instanceof Set)
  }
})

test('actual another-athlete preview removes both writer capabilities; explicit OFF has no HomeSession', () => {
  seed({ athlete: otherAthlete })
  const preview = named(render(AthleteView, { role: 'coach', session,
    coachAthleteId: otherAthlete.id, onExitPreview() {} }), 'HomeSession').props
  assert.equal(preview.onLogSet, undefined); assert.equal(preview.setLogInputs, undefined)
  seed({ athlete: ownAthlete })
  assert.equal(named(render(AthleteView, { role: 'athlete', session, entropi2: false }), 'HomeSession'), undefined)
})
