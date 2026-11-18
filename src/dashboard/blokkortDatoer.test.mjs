// Ordre 1653: blokkortet i coachens Program gentager ikke ugens datoer ved en uge i blokken
// (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"). Kildeprøve, fordi lukkede
// harnesser ikke tillader en ny import i ProgramTab.jsx.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./ProgramTab.jsx', import.meta.url), 'utf8')

test('blokkortets datoer vises kun ved flere uger i blokken', () => {
  assert.match(src, /const dates = fd && ld && phase\.weeks\.length > 1/)
})

test('blokkortet har ingen ny import (lukkede harnesser)', () => {
  assert.doesNotMatch(src, /blokkortDatoer/)
})
