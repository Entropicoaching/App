// Static fail-closed gate for the browser client. It performs no network,
// Supabase, Auth or database operation.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const runtimeRoot = resolve(root, 'src', 'subscription')

function runtimeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : runtimeFiles(path)
    return ['.js', '.jsx'].includes(extname(path)) ? [path] : []
  })
}

const sources = runtimeFiles(runtimeRoot).map(path => ({ path, source: readFileSync(path, 'utf8') }))
const combined = sources.map(item => item.source).join('\n')
const repository = readFileSync(resolve(runtimeRoot, 'pilotRepository.js'), 'utf8')
const config = readFileSync(resolve(runtimeRoot, 'pilotConfig.js'), 'utf8')
const auth = readFileSync(resolve(runtimeRoot, 'auth.jsx'), 'utf8')
const main = readFileSync(resolve(runtimeRoot, 'main.jsx'), 'utf8')
const html = readFileSync(resolve(root, 'subscription.html'), 'utf8')

assert.match(repository, /client\.rpc\(\s*['"]sub_persist_completed_workout_v1['"]/, 'completed workouts must use the atomic RPC')
assert.doesNotMatch(repository, /\.from\(['"]sub_(?:workouts|workout_sets)['"]\)[\s\S]{0,300}?\.(?:insert|upsert|update|delete)\s*\(/, 'workout tables must never be written directly')
assert.doesNotMatch(combined, /\.(?:insert|upsert|update|delete)\s*\(/, 'subscription runtime contains a direct database write method')

const allowedTables = new Set(['sub_assignments', 'sub_programs', 'sub_members', 'sub_workouts', 'sub_workout_sets'])
for (const { path, source } of sources) {
  for (const match of source.matchAll(/\.from\(['"]([^'"]+)['"]\)/g)) {
    assert.ok(allowedTables.has(match[1]), `${path}: unexpected table ${match[1]}`)
  }
}

const allowedRpcs = new Set([
  'sub_my_access_v2',
  'sub_persist_completed_workout_v1',
  'sub_complete_my_program_setup_v1',
])
for (const { path, source } of sources) {
  for (const match of source.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)) {
    assert.ok(allowedRpcs.has(match[1]), `${path}: unexpected client RPC ${match[1]}`)
  }
}

assert.match(config, /SHADOW_PROJECT_REF\s*=\s*['"]maxhsefxbrvsgolscqwh['"]/, 'authorised shadow ref is missing')
assert.match(config, /service_role/, 'service-role rejection is missing')
assert.match(config, /sb_secret_/, 'secret-key rejection is missing')
assert.match(auth, /signInWithPassword/, 'pilot login is missing')
assert.match(auth, /signInWithOtp/, 'magic-link login is missing')
assert.match(auth, /shouldCreateUser:\s*false/, 'magic-link must never create accounts')
assert.doesNotMatch(auth, /signUp|resetPasswordForEmail/, 'signup/reset must remain closed')
assert.doesNotMatch(main, /from\s+['"]\.\.\/supabase(?:\.js)?['"]|from\s+['"][^'"]*appUpdate[^'"]*['"]|navigator\.serviceWorker/, 'shadow entrypoint imports shared production/PWA runtime')
assert.match(html, /noindex/, 'shadow entrypoint must remain noindex')
assert.doesNotMatch(combined, /profiles\.role|from\(['"]profiles['"]\)/, 'subscription client must not authorize through profiles')

console.log(`PASS subscription shadow client contract (${sources.length} runtime files; read-only tables + 3 isolated owner-bound RPCs only). No network action was attempted.`)
