import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

// Ordre 1600: en atlet hvis login-mail ikke kobler en atletrække ser IkkeKoblet med mailen,
// ikke "Dataene kunne ikke hentes". Ægte fejl viser stadig fejlbeskeden. Kun syntetiske data.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavLaesninger, claimUdenKobling } = await import('./laesninger.js')

const INGEN_MATCH = { code: 'P0001', message: 'No unclaimed athlete profile matches this login' }

function klient(claimSvar) {
  const kald = []
  return {
    kald,
    from(table) {
      const q = { select: () => q, eq: () => q, maybeSingle: () => q, then: (ok, nej) => Promise.resolve({ data: null, error: null }).then(ok, nej) }
      kald.push(['from', table])
      return q
    },
    rpc(name) { kald.push(['rpc', name]); return Promise.resolve(claimSvar) },
  }
}

async function hentAtlet(claimSvar) {
  const db = klient(claimSvar)
  const s = { loadError: [], loading: [], athlete: [] }
  const h = lavLaesninger({
    role: 'athlete', session: { user: { id: '99999999-0000-4000-8000-000000000001', email: 'forkert@e2e.test' } },
    guardSession: () => db, setLoadError: v => s.loadError.push(v), setLoading: v => s.loading.push(v),
    setAthlete: v => s.athlete.push(v), setOfflineSnapshotAt() {},
  })
  await h.fetchAthlete()
  return { s, db }
}

test('ingen match fra claim-rpc giver IkkeKoblet (loading slukkes, ingen atlet, ingen fejl)', async () => {
  const { s, db } = await hentAtlet({ data: null, error: INGEN_MATCH })
  assert.deepEqual(db.kald.filter(k => k[0] === 'rpc'), [['rpc', 'claim_athlete_profile_v3']])
  assert.deepEqual(s.loadError, [])
  assert.deepEqual(s.loading, [false])
  assert.deepEqual(s.athlete, [])
})

test('flere match og allerede koblet mail giver ogsaa IkkeKoblet', async () => {
  for (const message of ['Athlete profile match is ambiguous; coach linking required', 'Matching athlete profile is already linked to another user']) {
    const { s } = await hentAtlet({ data: null, error: { code: 'P0001', message } })
    assert.deepEqual([s.loadError, s.loading], [[], [false]], message)
  }
})

test('netfejl og andre serverfejl viser stadig fejlbeskeden', async () => {
  for (const error of [
    { message: 'TypeError: Failed to fetch', code: '' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: 'P0001', message: 'Authenticated user with email required' },
    { code: '500', message: INGEN_MATCH.message },
  ]) {
    const { s } = await hentAtlet({ data: null, error })
    assert.deepEqual(s.loadError, [true], JSON.stringify(error))
    assert.deepEqual(s.loading, [], JSON.stringify(error))
  }
  const tomt = await hentAtlet({ data: [], error: null })
  assert.deepEqual(tomt.s.loadError, [true])
})

test('claimUdenKobling kender kun de tre P0001-beskeder', () => {
  assert.equal(claimUdenKobling(INGEN_MATCH), true)
  assert.equal(claimUdenKobling({ code: 'P0001', message: ' No unclaimed athlete profile matches this login ' }), true)
  for (const e of [null, undefined, {}, { code: 'P0001' }, { code: 'P0001', message: 'Athlete profile could not be claimed' }]) assert.equal(claimUdenKobling(e), false)
})

test('IkkeKoblet viser mailen, beder coachen tjekke mailen og har ingen tekst under 11 px', () => {
  const k = readFileSync(new URL('./IkkeKoblet.jsx', import.meta.url), 'utf8')
  assert.match(k, /\{stuckEmail \|\| '—'\}/)
  assert.match(k, /bed din coach tjekke mailen på din profil/)
  for (const [, rem] of k.matchAll(/fontSize: '([\d.]+)rem'/g)) assert.ok(Number(rem) * 16 >= 11, rem)
  assert.doesNotMatch(k.match(/Brugte du en anden mail[^<]*/)[0], /[–—]| - /)
})
