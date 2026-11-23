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

// Ordre 2036: ny klient uden gentagelser (Marc 16. nov.). Ugenummer og bloknavn står ét sted.
test('blokkortet gentager ikke ugenummeret ved en uge i blokken', () => {
  assert.match(src, /\{phase\.weeks\.length > 1 && \(\s*<div[^>]*>\s*\{range\} · \{phase\.weeks\.length\}u/)
})

test('ugekortet gentager kun bloknavnet, naar flere blokke vises samlet', () => {
  assert.match(src, /week\.block_name && programBlockStart === 'all' && computePhases\(weeks\)\.length > 1/)
})

test('ugekortet bryder linjen paa telefon, saa datoen ikke presses til et ord pr. linje', () => {
  assert.match(src, /programCopyEnabled === true \|\| isMobile \? \{ flexWrap: 'wrap' \}/)
  assert.match(src, /letterSpacing: '0\.06em', whiteSpace: 'nowrap' \}\}>\{new Date\(week\.start_date/)
})
