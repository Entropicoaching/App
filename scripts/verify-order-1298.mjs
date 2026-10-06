// Read-only Git/source checks; writes only synthetic evidence for order 1298.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim()
const base = 'b08337d3e7b28062a2ddbab89989c63c26aaa590'
const baseline = git(['rev-parse', 'e0312e0a'])
const reps = git(['rev-parse', '11e4deca'])
assert.equal(git(['rev-parse', `${baseline}^`]), base)
assert.equal(git(['rev-parse', `${reps}^`]), baseline)
assert.ok(!git(['show', `${baseline}:src/athlete/DagensPasCard.jsx`]).includes('fixedRepsEntry'))
assert.equal(git(['rev-parse', `${baseline}:src/athlete/ProgramTab.jsx`]), git(['rev-parse', `${base}:src/athlete/ProgramTab.jsx`]))
const repsProductFiles = git(['diff', '--name-only', baseline, reps, '--', 'src']).split('\n').sort()
assert.deepEqual(repsProductFiles, ['src/athlete/DagensPasCard.jsx', 'src/athlete/ProgramTab.jsx', 'src/fixedRepsEntry.js', 'src/fixedRepsEntry.test.js'])
const protectedPaths = [
  'src/App.jsx', 'src/Auth.jsx', 'src/SetNewPassword.jsx', 'src/supabase.js',
  'src/authSignOut.js', 'src/roleCache.js', 'src/offlineSession.js', 'src/offlineSetQueue.js',
  'src/athleteWriteGuard.js', 'src/athleteReadGuard.js', 'src/videoCoachSubmission.js',
  'src/videoCoachUpload.js', 'src/athlete/saetSkrivning.js', 'src/athlete/laesninger.js',
  'src/athlete/offlineSnapshot.js', 'src/athlete/useVideoCoachBro.js', 'src/athlete/videoCoachBro.js',
  'public/sw.js', 'public/videocoach.html', 'vite.config.js',
]
const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
const hashes = protectedPaths.map(path => {
  const original = execFileSync('git', ['show', `${base}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  const current = readFileSync(resolve(root, path), 'utf8')
  assert.equal(hash(current), hash(original), path)
  return { path, baseSHA256: hash(original), workingSHA256: hash(current), unchanged: true }
})
for (const target of [baseline, reps, 'HEAD']) {
  assert.equal(git(['diff', base, target, '--', ...protectedPaths, 'supabase', '.github']), '')
}
assert.equal(git(['diff', base, '--', ...protectedPaths, 'supabase', '.github']), '')
const out = resolve(root, 'outputs/ordre-1298')
mkdirSync(out, { recursive: true })
const fixed = JSON.parse(readFileSync(resolve(out, 'fixed-after.json'), 'utf8'))
assert.equal(fixed.results.length, 2)
for (const result of fixed.results) {
  assert.equal(result.editable, true)
  assert.equal(result.fewerReps.reps_completed, 3)
  assert.equal(result.zeroReps.reps_completed, 0)
  assert.equal(result.unchangedPlan.reps_completed, 8)
  assert.deepEqual(result.errors, [])
  assert.equal(result.horizontalOverflow, false)
  // Record the unresolved defect explicitly; this is not a correctness claim.
  assert.equal(result.fewerReps.rpe_actual, 8)
  assert.equal(result.fewerReps.rpe_planned, 8)
}
writeFileSync(resolve(out, 'proof.json'), JSON.stringify({ base, baseline, reps,
  checkedHead: git(['rev-parse', 'HEAD']), repsProductFiles, hashes,
  protectedDiff: 'EMPTY (both delivery commits, HEAD and working tree)',
  rpeDisposition: 'OPEN: untouched planned RPE still recorded as actual; requires Marc',
  fixedScreens: fixed.results.map(r => r.screen),
  note: 'Synthetic local mock only; no live data, push, merge, migration or deploy.' }, null, 2) + '\n')
console.log('PASS: isolated 1230/1263 commits; 20 protected hashes and empty diffs; both fixed-reps screens. RPE defect remains OPEN.')
