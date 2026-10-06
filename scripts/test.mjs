// The same source/public unit-test scope as scripts/proever.mjs.
// No browser, environment files, production services or verify:* side effects.
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? tests(path) : entry.name.endsWith('.test.js') ? [path] : []
  })
}
const files = [...tests(join(root, 'src')), ...tests(join(root, 'public'))].sort()
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: root, stdio: 'inherit' })
process.exitCode = result.status ?? 1
