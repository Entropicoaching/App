import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(process.argv[2] || 'src/AthleteView.jsx')
const source = readFileSync(sourcePath, 'utf8')
const start = source.indexOf('  async function fetchAthlete() {')
const end = source.indexOf('\n  async function fetchSharedVideoAnalyses()', start)

assert.ok(start >= 0 && end > start, 'fetchAthlete must be present and bounded')
const fetchAthlete = source.slice(start, end)

const userLookup = fetchAthlete.indexOf(".eq('user_id', session.user.id).maybeSingle()")
const claim = fetchAthlete.indexOf("supabase.rpc('claim_athlete_profile_v3')")
const refetchUser = fetchAthlete.indexOf(".eq('user_id', session.user.id)", claim)
const refetchId = fetchAthlete.indexOf(".eq('id', claim.data)", claim)
const firstLoader = fetchAthlete.indexOf('      setAthlete(data)')

assert.ok(userLookup >= 0 && userLookup < claim, 'user_id lookup must happen before v3 claim')
assert.ok(claim >= 0, 'v3 claim RPC must be present')
assert.equal((fetchAthlete.match(/claim_athlete_profile_v3/g) || []).length, 1,
  'v3 claim must have one controlled call site')
assert.ok(!/supabase\.rpc\(['"]claim_athlete_profile['"]\)/.test(fetchAthlete),
  'legacy claim RPC must be absent')
assert.ok(fetchAthlete.includes('claim.error || !isUuid(claim.data)'),
  'claim error and UUID validation must share the fail-closed gate')
assert.ok(refetchUser > claim && refetchId > refetchUser,
  'successful claim must refetch by user_id and returned UUID')
assert.ok(fetchAthlete.includes("supabase.from('athletes').select('*').eq('id', coachAthleteId).maybeSingle()"),
  'coach preview lookup must remain unchanged')
assert.ok(!fetchAthlete.includes(".eq('email', session.user.email)"),
  'athlete source must not bind directly through an email lookup')
assert.ok(firstLoader > refetchId, 'downstream loaders must start after verified refetch')

console.log('OK: athlete identity uses user_id-first v3 claim, UUID validation and verified refetch')
