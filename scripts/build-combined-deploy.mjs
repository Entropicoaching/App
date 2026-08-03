import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'

import { snapshotDirectory, verifyCombinedDeploy } from './verify-combined-deploy.mjs'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'dist')

try {
  await build({ configFile: resolve(root, 'vite.config.js'), root })
  const baseline = await snapshotDirectory(outputRoot)

  await build({ configFile: resolve(root, 'vite.subscription.deploy.config.js'), root })
  const combined = await snapshotDirectory(outputRoot)
  const subscriptionHtml = await readFile(resolve(outputRoot, 'subscription.html'), 'utf8')
  const result = verifyCombinedDeploy({ baseline, combined, subscriptionHtml })

  console.log(`PASS combined deploy build (portal bevaret; ${result.additions.length} subscription-filer tilføjet)`)
} catch (error) {
  console.error(`FAIL combined deploy build: ${error.message}`)
  process.exitCode = 1
}
