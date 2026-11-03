// Source/public unit tests, including .test.js and .test.mjs.
// No browser, environment files, production services or verify:* side effects.
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')

function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? tests(path) : /\.test\.(?:js|mjs)$/.test(entry.name) ? [path] : []
  })
}

const files = [...tests(join(root, 'src')), ...tests(join(root, 'public'))].sort().map(file => relative(root, file))
const flags = ['--test', '--test-concurrency=1']
// Conservative upper bound for Windows quoting, including escaped backslashes,
// separators and the executable. Leave headroom below the 32767-character limit.
const argumentLength = value => 2 * value.length + 3
const baseLength = [process.execPath, ...flags].reduce((sum, value) => sum + argumentLength(value), 0)
const maxLength = 30000
const batches = []
let batch = []
let length = baseLength
for (const file of files) {
  const size = argumentLength(file)
  if (baseLength + size > maxLength) throw new Error(`Test path exceeds command-line budget: ${file}`)
  if (length + size > maxLength) {
    batches.push(batch)
    batch = []
    length = baseLength
  }
  batch.push(file)
  length += size
}
if (batch.length) batches.push(batch)

process.exitCode = 0
for (const files of batches) {
  const result = spawnSync(process.execPath, [...flags, ...files], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exitCode = result.status ?? 1
}
