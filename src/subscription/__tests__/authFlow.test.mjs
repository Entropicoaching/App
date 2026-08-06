import test from 'node:test'
import assert from 'node:assert/strict'
import { MIN_PASSWORD_LENGTH, initialLoginMode, isRecoveryEvent, isStandaloneApp, signUpOutcome, signUpRevealsExistingAccount, validateNewPassword } from '../authFlow.js'
import { SETUP_RPC_BY_TIER, setupRpcForTier } from '../pilotRepository.js'

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

test('de to niveauer har hver sin server-funktion', () => {
  // Peger gratis-sporet paa medlemmets funktion, bliver et gratis-kald afvist
  // af serveren - og i den modsatte retning ville en fejl her kunne sende en
  // member gennem den funktion der altid vaelger start-2.
  assert.equal(SETUP_RPC_BY_TIER.member, 'sub_complete_my_program_setup_v1')
  assert.equal(SETUP_RPC_BY_TIER.free, 'sub_complete_my_free_setup_v1')
  assert.notEqual(SETUP_RPC_BY_TIER.free, SETUP_RPC_BY_TIER.member)
  assert.equal(setupRpcForTier('member'), SETUP_RPC_BY_TIER.member)
  assert.equal(setupRpcForTier('free'), SETUP_RPC_BY_TIER.free)
})

test('ukendt niveau fejler lukket i stedet for at falde tilbage på member-stien', () => {
  // Et fald tilbage ville vaere den farlige retning: en bruger med ukendt
  // niveau ville ramme medlemmets opsaetning, hvor programmet vaelges frit.
  for (const tier of ['coaching', '', null, undefined, 'FREE', 'admin']) {
    assert.throws(() => setupRpcForTier(tier), /Ukendt niveau/)
  }
})

test('oprettelse røber ikke om en mail allerede findes', () => {
  // Supabase svarer med en bruger UDEN identiteter naar mailen er kendt.
  // Oversatte vi det til en fejlbesked, blev skaermen en maade at afproeve
  // mailadresser paa - praecis det nulstillingen ogsaa skal undgaa.
  assert.equal(signUpRevealsExistingAccount({ user: { identities: [] } }), true)
  assert.equal(signUpRevealsExistingAccount({ user: { identities: [{ id: 'x' }] } }), false)
  assert.equal(signUpRevealsExistingAccount({ user: {} }), false)
  assert.equal(signUpRevealsExistingAccount(null), false)
})

test('svaret på oprettelse aflæses, så brugeren ikke venter på en mail der ikke kommer', () => {
  assert.equal(signUpOutcome({ session: { access_token: 'a' }, user: { id: 'u' } }), 'logged-in')
  assert.equal(signUpOutcome({ user: { id: 'u' } }), 'confirm-email')
  assert.equal(signUpOutcome({}), 'unknown')
  assert.equal(signUpOutcome(null), 'unknown')
})

test('afvisning oplyser hvorfor, så skærmen ikke skal gætte en tekst', () => {
  assert.match(validateNewPassword('kort', 'kort').reason, new RegExp(String(MIN_PASSWORD_LENGTH)))
  assert.match(validateNewPassword('korrekthest', 'andet').reason, /ikke ens/)
  assert.equal(validateNewPassword('korrekthest', 'korrekthest').reason, '')
})
