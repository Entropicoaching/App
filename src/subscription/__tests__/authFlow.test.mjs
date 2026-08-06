import test from 'node:test'
import assert from 'node:assert/strict'
import { MIN_PASSWORD_LENGTH, initialLoginMode, isRecoveryEvent, isStandaloneApp, validateNewPassword } from '../authFlow.js'

const win = ({ standalone, displayMode, throws = false } = {}) => ({
  navigator: standalone === undefined ? {} : { standalone },
  matchMedia: throws
    ? () => { throw new Error('matchMedia er ikke tilgængelig') }
    : query => ({ matches: query === '(display-mode: standalone)' && displayMode === 'standalone' }),
})

test('hjemmeskærms-app genkendes både på iOS og via display-mode', () => {
  assert.equal(isStandaloneApp(win({ standalone: true })), true)
  assert.equal(isStandaloneApp(win({ displayMode: 'standalone' })), true)
  assert.equal(isStandaloneApp(win({ standalone: false, displayMode: 'browser' })), false)
  assert.equal(isStandaloneApp(win()), false)
})

test('isStandaloneApp fejler lukket i stedet for at kaste', () => {
  assert.equal(isStandaloneApp(win({ throws: true })), false)
  assert.equal(isStandaloneApp(null), false)
})

test('appen møder adgangskode først, browseren møder mail-login', () => {
  // Det er hele fixet: i en app på hjemmeskærmen er mail-login en blindgyde,
  // fordi linket åbner i browserens storage-jar og aldrig i appens.
  assert.equal(initialLoginMode(win({ standalone: true })), 'password')
  assert.equal(initialLoginMode(win({ displayMode: 'standalone' })), 'password')
  assert.equal(initialLoginMode(win()), 'magic-link')
})

test('kun PASSWORD_RECOVERY afbryder vejen ind i appen', () => {
  assert.equal(isRecoveryEvent('PASSWORD_RECOVERY'), true)
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT', 'USER_UPDATED', '', null, undefined]) {
    assert.equal(isRecoveryEvent(event), false)
  }
})

test('ny adgangskode kræver længde, indhold og at de to felter er ens', () => {
  assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH), 'a'.repeat(MIN_PASSWORD_LENGTH)).ok, true)
  assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1)).ok, false)
  assert.equal(validateNewPassword('        ', '        ').ok, false)
  assert.equal(validateNewPassword('korrekthest', 'korrekthset').ok, false)
  assert.equal(validateNewPassword(null, null).ok, false)
  assert.equal(validateNewPassword(undefined, undefined).ok, false)
})

test('afvisning oplyser hvorfor, så skærmen ikke skal gætte en tekst', () => {
  assert.match(validateNewPassword('kort', 'kort').reason, new RegExp(String(MIN_PASSWORD_LENGTH)))
  assert.match(validateNewPassword('korrekthest', 'andet').reason, /ikke ens/)
  assert.equal(validateNewPassword('korrekthest', 'korrekthest').reason, '')
})
