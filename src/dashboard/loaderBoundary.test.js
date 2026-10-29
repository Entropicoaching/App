import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { syntheticModules } from '../registrySyntheticFs.mjs'
import { snapshotFiles } from '../registryTestFiles.mjs'
if (!vm.SourceTextModule) {
  test('isolated synthetic ESM counterexamples', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
} else {
const root = new URL('../../', import.meta.url)
const files = snapshotFiles(root)

for (const loader of ['followUpLoader.mjs', 'rebaseFollowUpLoader.mjs']) {
  test(`${loader}: K-FUND1 rejects unknown import from exact approved component`, async () => {
    const input = new Map(files), home = new URL('src/dashboard/ForsideView.jsx', root).href
    input.set(home, "import './not-a-pinned-dependency.mjs';\n" + input.get(home))
    const engine = syntheticModules(input, root)
    const module = await engine.import('src/dashboard/' + loader); module.install()
    await assert.rejects(engine.import('src/dashboard/ForsideView.jsx'), /Unapproved hermetic dependency: \.\/not-a-pinned-dependency\.mjs/)
  })
  test(`${loader}: rejects same basename in another directory`, async () => {
    const input = new Map(files), path = 'src/dashboard/boundary-' + loader + '/ForsideView.jsx'
    input.set(new URL(path, root).href, input.get(new URL('src/dashboard/ForsideView.jsx', root).href))
    const engine = syntheticModules(input, root)
    const module = await engine.import('src/dashboard/' + loader); module.install()
    await assert.rejects(engine.import(path), /Unapproved/)
  })
}
}
