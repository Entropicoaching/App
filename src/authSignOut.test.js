// Reproducerer ORDRE 20 bug 1 som ren logik (Playwright er ikke installeret i
// dette repo, og en rigtig gengivelse kræver en flaky/afbrudt netværksforbindelse
// under et rigtigt Supabase-kald, hvilket ikke er reproducérbart headless uden
// en rigtig konto): "log ud" kunne stå og gøre ingenting, fordi
// @supabase/auth-js' signOut() kaster videre på ikke-AuthError-fejl uden
// nogensinde at rydde sessionen lokalt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signOutHardCore, isSupabaseAuthTokenKey } from './authSignOut.js'

test('lykkes signOut, ryddes sessionen lokalt (den normale vej)', async () => {
  let cleared = false
  const { timedOut } = await signOutHardCore(
    () => Promise.resolve({ error: null }),
    () => { cleared = true },
    1000,
  )
  assert.equal(cleared, true)
  assert.equal(timedOut, false)
})

test('afviser signOut (fx en abortet fetch), ryddes sessionen lokalt ALLIGEVEL', () => {
  // Dette ER bugen: @supabase/auth-js kaster en rå fejl videre på alt der ikke
  // er en AuthError. Uden signOutHardCore's try/finally ville brugeren blive
  // hængende logget ind uden feedback.
  return (async () => {
    let cleared = false
    const boom = new Error('AbortError: fetch timed out')
    const { timedOut } = await signOutHardCore(
      () => Promise.reject(boom),
      () => { cleared = true },
      1000,
    )
    assert.equal(cleared, true, 'sessionen blev IKKE ryddet efter en afvist signOut')
    assert.equal(timedOut, false)
  })()
})

test('hænger signOut for evigt (fx en død forbindelse), ryddes sessionen efter timeout', async () => {
  let cleared = false
  const hangingPromise = new Promise(() => {}) // resolver aldrig
  const { timedOut } = await signOutHardCore(
    () => hangingPromise,
    () => { cleared = true },
    30,
  )
  assert.equal(cleared, true, 'sessionen blev IKKE ryddet da signOut aldrig svarede')
  assert.equal(timedOut, true)
})

test('clearFn kaldes præcis én gang, uanset udfald', async () => {
  for (const signOutFn of [
    () => Promise.resolve({ error: null }),
    () => Promise.reject(new Error('netværksfejl')),
    () => new Promise(() => {}),
  ]) {
    let calls = 0
    await signOutHardCore(signOutFn, () => { calls += 1 }, 20)
    assert.equal(calls, 1)
  }
})

test('kaster clearFn selv (fx localStorage utilgængelig), propagerer signOutHardCore fejlen i stedet for at sluge den stille', async () => {
  // Et bevidst valg: clearFn's egen fejl skal IKKE fanges usynligt — bedre en
  // synlig fejl end en logout der ser ud til at virke, men ikke gjorde det.
  await assert.rejects(
    () => signOutHardCore(() => Promise.resolve(), () => { throw new Error('localStorage util.') }, 20),
    /localStorage util\./,
  )
})

test('isSupabaseAuthTokenKey genkender kun Supabase-sessionsnøgler', () => {
  assert.equal(isSupabaseAuthTokenKey('sb-abcxyz-auth-token'), true)
  assert.equal(isSupabaseAuthTokenKey('sb-abcxyz-auth-token-code-verifier'), false)
  assert.equal(isSupabaseAuthTokenKey('entropi_my_athlete_id'), false)
  assert.equal(isSupabaseAuthTokenKey('reloaded_chunk_dashboard'), false)
  assert.equal(isSupabaseAuthTokenKey(''), false)
  assert.equal(isSupabaseAuthTokenKey(null), false)
  assert.equal(isSupabaseAuthTokenKey(undefined), false)
})
