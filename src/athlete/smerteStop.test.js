import test from 'node:test'
import assert from 'node:assert/strict'
import { smerteStopAktiv, udenForslagVedSmerte } from './smerteStop.js'

const NU = new Date('2026-10-07T10:00:00Z').getTime()
const uge = (start, ...kommentarer) => ({ start_date: start, sessions: kommentarer.map(c => ({ athlete_comment: c })) })
const forslag = () => ({ weight: 100, fromRpe: 8, baseWeight: 97.5 })

test('smerte-note i denne uge standser forslaget', () => {
  assert.equal(smerteStopAktiv([uge('2026-10-05', 'Det gjorde ondt i knaeet')], NU), true)
  assert.equal(udenForslagVedSmerte(forslag, [uge('2026-10-05', 'smerter i ryggen')], NU)('Squat', '@8'), null)
})
test('uge uden smerte, eller med "ingen smerter", giver forslag', () => {
  const w = [uge('2026-10-05', 'God uge', 'ingen smerter, fint pas')]
  assert.equal(smerteStopAktiv(w, NU), false)
  assert.equal(udenForslagVedSmerte(forslag, w, NU)('Squat', '@8').weight, 100)
})
test('gammel smerte-note (over 3 uger) standser ikke laengere', () => {
  assert.equal(smerteStopAktiv([uge('2026-09-07', 'ondt i skulderen')], NU), false)
})
test('fremtidig uge, uge uden dato og tomme data ignoreres', () => {
  assert.equal(smerteStopAktiv([uge('2026-10-19', 'smerte')], NU), false)
  assert.equal(smerteStopAktiv([{ sessions: [{ athlete_comment: 'smerte' }] }], NU), false)
  assert.equal(smerteStopAktiv(undefined, NU), false)
})
