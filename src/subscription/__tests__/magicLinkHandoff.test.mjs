import assert from 'node:assert/strict'
import test from 'node:test'
import { captureMagicLinkHandoff, magicLinkHandoffContract } from '../magicLinkHandoff.js'

const TOKEN = 'a'.repeat(64)

function actionLink() {
  const url = new URL(`https://${magicLinkHandoffContract.shadowHost}/auth/v1/verify`)
  url.searchParams.set('token', TOKEN)
  url.searchParams.set('type', 'magiclink')
  url.searchParams.set('redirect_to', magicLinkHandoffContract.publicUrl)
  return url
}

function wrapper(inner = actionLink(), suffix = '') {
  return new URL(`${magicLinkHandoffContract.publicUrl}#${magicLinkHandoffContract.marker}=${encodeURIComponent(inner.toString())}${suffix}`)
}

function capture(url) {
  const calls = []
  const history = {
    state: { pilot: true },
    replaceState: (...args) => calls.push(args),
  }
  return { result: captureMagicLinkHandoff(url, history), calls }
}

test('gyldigt wrapper-link fjernes fra adresselinjen og returneres kun i hukommelsen', () => {
  const inner = actionLink()
  const { result, calls } = capture(wrapper(inner))

  assert.deepEqual(result, { actionLink: inner.toString() })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][2], magicLinkHandoffContract.publicUrl)
})

test('en almindelig Supabase-callback eller et andet fragment røres aldrig', () => {
  for (const hash of ['', '#access_token=callback', '#error=access_denied']) {
    const url = new URL(`${magicLinkHandoffContract.publicUrl}${hash}`)
    const { result, calls } = capture(url)
    assert.equal(result, null)
    assert.equal(calls.length, 0)
  }
})

test('wrapperen fejler lukket på forkert endpoint, type, callback eller parametre', () => {
  const cases = []

  const http = actionLink(); http.protocol = 'http:'; cases.push(http)
  const suffixHost = actionLink(); suffixHost.hostname = `evil.${magicLinkHandoffContract.shadowHost}`; cases.push(suffixHost)
  const wrongHost = actionLink(); wrongHost.hostname = 'example.com'; cases.push(wrongHost)
  const port = actionLink(); port.port = '444'; cases.push(port)
  const userInfo = actionLink(); userInfo.username = 'user'; cases.push(userInfo)
  const path = actionLink(); path.pathname = '/auth/v1/other'; cases.push(path)
  const hash = actionLink(); hash.hash = '#secret'; cases.push(hash)
  const invite = actionLink(); invite.searchParams.set('type', 'invite'); cases.push(invite)
  const redirect = actionLink(); redirect.searchParams.set('redirect_to', 'https://example.com/subscription.html'); cases.push(redirect)
  const missing = actionLink(); missing.searchParams.delete('token'); cases.push(missing)
  const empty = actionLink(); empty.searchParams.set('token', ''); cases.push(empty)
  const duplicate = actionLink(); duplicate.searchParams.append('token', 'second'); cases.push(duplicate)
  const unexpected = actionLink(); unexpected.searchParams.set('extra', 'value'); cases.push(unexpected)

  for (const inner of cases) {
    const { result, calls } = capture(wrapper(inner))
    assert.deepEqual(result, { error: 'invalid-personal-link' }, inner.toString())
    assert.equal(calls.length, 1, inner.toString())
    assert.equal(JSON.stringify(result).includes(TOKEN), false)
  }
})

test('duplikeret eller udvidet wrapper-markør afvises og fjernes', () => {
  const encoded = encodeURIComponent(actionLink().toString())
  for (const suffix of [`&${magicLinkHandoffContract.marker}=${encoded}`, '&unexpected=value']) {
    const { result, calls } = capture(wrapper(actionLink(), suffix))
    assert.deepEqual(result, { error: 'invalid-personal-link' })
    assert.equal(calls.length, 1)
  }
})
