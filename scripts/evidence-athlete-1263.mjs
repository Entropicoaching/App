import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'outputs/ordre-1263')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const base = 'b08337d3e7b28062a2ddbab89989c63c26aaa590'
assert.equal(git(['rev-parse', 'HEAD']), base)
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
  assert.equal(hash(original), hash(current), `${path} must remain unchanged`)
  return { path, baseSHA256: hash(original), workingSHA256: hash(current), unchanged: true }
})
assert.equal(git(['diff', base, '--', ...protectedPaths, 'supabase', '.github']), '')
const before = JSON.parse(readFileSync(resolve(out, 'before.json')))
const after = JSON.parse(readFileSync(resolve(out, 'after.json')))
for (const result of [...before.results, ...after.results]) {
  assert.equal(result.failure, undefined)
  assert.ok(result.errors.every(e => e === 'Failed to load resource: net::ERR_FAILED'))
  assert.ok(result.blocked.every(url => url === 'https://fonts.googleapis.com/css2'))
  assert.equal(result.findings.horizontalOverflow, false)
}
assert.equal(before.results.length, 3); assert.equal(after.results.length, 3)
for (const result of after.results) {
  assert.equal(result.findings.doubleClickRows, 1)
  assert.equal(result.findings.accidentalThirdSet, false)
  assert.equal(result.findings.nextSetDraftReps, '5')
  assert.equal(result.findings.calendarPrematurelyDone, false)
  assert.equal(result.findings.programPrematurelyDone, false)
}
const fixedBefore = JSON.parse(readFileSync(resolve(out, 'fixed-before.json')))
const fixedAfter = JSON.parse(readFileSync(resolve(out, 'fixed-after.json')))
assert.equal(fixedBefore.results.length, 2)
assert.equal(fixedAfter.results.length, 2)
for (const result of fixedBefore.results) {
  assert.equal(result.editable, false)
  assert.equal(result.row.reps_completed, 8)
}
for (const result of fixedAfter.results) {
  assert.equal(result.editable, true)
  assert.equal(result.fewerReps.reps_completed, 3)
  assert.equal(result.zeroReps.reps_completed, 0)
  assert.equal(result.unchangedPlan.reps_completed, 8)
  assert.equal(result.horizontalOverflow, false)
  assert.deepEqual(result.errors, [])
}
const median = xs => [...xs].sort((a, b) => a - b)[1]
const rows = Object.keys(before.results[0].timings).map(screen => ({ screen,
  beforeMs: median(before.results.map(r => r.timings[screen])), afterMs: median(after.results.map(r => r.timings[screen])) }))
writeFileSync(resolve(out, 'proof.json'), JSON.stringify({ base, branch: git(['branch', '--show-current']), hashes,
  protectedDiff: 'EMPTY', schemaAndWorkflowDiff: 'EMPTY', screenMedians: rows,
  trackedChanges: git(['diff', '--name-only']), newFiles: git(['ls-files', '--others', '--exclude-standard']),
  note: 'SHA256 over UTF-8 source with CRLF normalized to LF. No commit, push, merge, migration or deploy.' }, null, 2))
writeFileSync(resolve(out, 'timings.md'), '| Screen | Before median ms | After median ms |\n|---|---:|---:|\n' + rows.map(r => `| ${r.screen} | ${r.beforeMs} | ${r.afterMs} |`).join('\n') + '\n')
console.log(`PASS: ${hashes.length} protected hashes, empty protected/schema/workflow diff, 6 browser runs, no unexpected console errors, regression assertions.`)
