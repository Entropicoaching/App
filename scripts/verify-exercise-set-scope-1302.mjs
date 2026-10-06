import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const base = '90cdf711a758afb23a3ff14da5cccc7efa5ddbb1'
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const paths = [
  'src/App.jsx', 'src/Auth.jsx', 'src/SetNewPassword.jsx', 'src/supabase.js',
  'src/authSignOut.js', 'src/roleCache.js', 'src/offlineSession.js', 'src/offlineSetQueue.js',
  'src/athleteWriteGuard.js', 'src/athleteReadGuard.js', 'src/videoCoachSubmission.js',
  'src/videoCoachUpload.js', 'src/athlete/saetSkrivning.js', 'src/athlete/laesninger.js',
  'src/athlete/offlineSnapshot.js', 'src/athlete/useVideoCoachBro.js', 'src/athlete/videoCoachBro.js',
  'public/sw.js', 'public/videocoach.html', 'vite.config.js',
]
const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
const hashes = paths.map(path => {
  const before = hash(git(['show', `${base}:${path}`]).trimEnd())
  const after = hash(readFileSync(resolve(root, path), 'utf8').trimEnd())
  assert.equal(before, after, path)
  return { path, before, after }
})
assert.equal(git(['diff', base, '--', ...paths, 'supabase', '.github']), '')
const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n')
assert.ok(!untracked.some(p => p.startsWith('supabase/') || paths.includes(p)))
assert.equal(git(['branch', '--show-current']), 'ordre-1302')
writeFileSync(resolve(root, 'outputs/ordre-1302/proof.json'), JSON.stringify({
  base, branch: 'ordre-1302', hashes, protectedDiff: 'EMPTY',
  migrationFilesChanged: false, actions: 'Local edits/tests only; no commit, push, merge, deploy or migration.',
}, null, 2) + '\n')
console.log('PASS: 20 protected hashes; empty auth/transport/schema/workflow diff.')
