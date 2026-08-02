import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const migration = readFileSync(`${root}/supabase/sql/sub-14-isolated-access-v2.DRAFT.sql`, 'utf8')
const rollback = readFileSync(`${root}/supabase/sql/sub-14-isolated-access-v2.ROLLBACK.DRAFT.sql`, 'utf8')
const accessClient = readFileSync(`${root}/src/subscription/access.js`, 'utf8')

test('access v2 is shadow-scoped, additive and tier-only', () => {
  assert.match(migration, /maxhsefxbrvsgolscqwh/)
  assert.match(migration, /create\s+or\s+replace\s+function\s+public\.sub_my_access_v2\(\)/i)
  assert.match(migration, /returns\s+table\(tier\s+text\)/i)
  assert.match(migration, /select\s+public\.sub_current_tier\(\)/i)
  assert.doesNotMatch(migration, /public\.(?:athletes|profiles)\b|profiles\.role/i)
  assert.doesNotMatch(migration, /(?:insert\s+into|update|delete\s+from)\s+public\./i)
})

test('only authenticated can execute access v2', () => {
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.sub_my_access_v2\(\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role/i)
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.sub_my_access_v2\(\)\s+to\s+authenticated/i)
  assert.match(migration, /has_function_privilege\('public',[\s\S]*?'EXECUTE'\)/i)
  assert.match(migration, /has_function_privilege\('anon',[\s\S]*?'EXECUTE'\)/i)
})

test('runtime uses v2 and rollback removes only v2', () => {
  assert.match(accessClient, /client\.rpc\('sub_my_access_v2'\)/)
  assert.doesNotMatch(accessClient, /sub_my_access_v1|has_coaching|hasCoaching/)
  assert.match(rollback, /drop\s+function\s+public\.sub_my_access_v2\(\)/i)
  assert.doesNotMatch(rollback, /public\.(?:athletes|profiles|sub_entitlements)\b/i)
})
