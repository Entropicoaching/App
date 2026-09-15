import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guessRoleFromStorage, preloadHrefForRole, roleCacheKey } from './roleCache.js'

// ORDRE 233 · commit 1 — et lille lager-attrap (samme form som
// window.localStorage: getItem/setItem/length/key) så guessRoleFromStorage
// kan enhedstestes uden en browser. Bruges også af det inline script i
// index.html (samme kildekode, se vite.config.js), der kører mod det
// rigtige window.localStorage.
function fakeStorage(entries) {
  const map = new Map(Object.entries(entries))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    get length() { return map.size },
    key: (i) => Array.from(map.keys())[i] ?? null,
  }
}

test('intet auth-token i lageret -> intet gæt', () => {
  assert.equal(guessRoleFromStorage(fakeStorage({})), null)
})

test('auth-token uden en cachet rolle for den bruger -> intet gæt', () => {
  const storage = fakeStorage({
    'sb-xyzproj-auth-token': JSON.stringify({ user: { id: 'u1' } }),
  })
  assert.equal(guessRoleFromStorage(storage), null)
})

test('auth-token MED en cachet rolle -> den cachede rolle', () => {
  const storage = fakeStorage({
    'sb-xyzproj-auth-token': JSON.stringify({ user: { id: 'u1' } }),
    [roleCacheKey('u1')]: 'coach',
  })
  assert.equal(guessRoleFromStorage(storage), 'coach')
})

test('korrupt JSON i auth-tokenet -> intet gæt, kaster ikke', () => {
  const storage = fakeStorage({ 'sb-xyzproj-auth-token': '{ikke json' })
  assert.equal(guessRoleFromStorage(storage), null)
})

test('auth-token uden user.id -> intet gæt', () => {
  const storage = fakeStorage({ 'sb-xyzproj-auth-token': JSON.stringify({}) })
  assert.equal(guessRoleFromStorage(storage), null)
})

test('en storage der kaster ved getItem -> intet gæt, kaster ikke videre', () => {
  const storage = {
    length: 1,
    key: () => 'sb-xyzproj-auth-token',
    getItem: () => { throw new Error('privat fane') },
  }
  assert.equal(guessRoleFromStorage(storage), null)
})

test('preloadHrefForRole: coach -> coach-hrefen', () => {
  assert.equal(preloadHrefForRole('coach', { coach: '/a.js', athlete: '/b.js' }), '/a.js')
})

test('preloadHrefForRole: athlete -> athlete-hrefen', () => {
  assert.equal(preloadHrefForRole('athlete', { coach: '/a.js', athlete: '/b.js' }), '/b.js')
})

test('preloadHrefForRole: ukendt rolle -> null', () => {
  assert.equal(preloadHrefForRole('admin', { coach: '/a.js', athlete: '/b.js' }), null)
})

test('preloadHrefForRole: intet gæt (null) -> null', () => {
  assert.equal(preloadHrefForRole(null, { coach: '/a.js', athlete: '/b.js' }), null)
})

test('preloadHrefForRole: manglende chunkHrefs -> null, kaster ikke', () => {
  assert.equal(preloadHrefForRole('coach', undefined), null)
})
