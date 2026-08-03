import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build, loadEnv } from 'vite'

import { SHADOW_PROJECT_REF } from '../src/subscription/pilotConfig.js'
import { snapshotDirectory, verifyCombinedDeploy, verifySubscriptionAssetIsolation } from './verify-combined-deploy.mjs'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'dist')
const deployEnv = { ...loadEnv('production', root, ''), ...process.env }

try {
  await build({ configFile: resolve(root, 'vite.config.js'), root })
  const baseline = await snapshotDirectory(outputRoot)

  await build({ configFile: resolve(root, 'vite.subscription.deploy.config.js'), root })
  const combined = await snapshotDirectory(outputRoot)
  const subscriptionHtml = await readFile(resolve(outputRoot, 'subscription.html'), 'utf8')
  const result = verifyCombinedDeploy({ baseline, combined, subscriptionHtml })
  const assetContents = await Promise.all(
    result.additions
      .filter(path => path.startsWith('subscription-assets/'))
      .map(path => readFile(resolve(outputRoot, path), 'utf8')),
  )
  verifySubscriptionAssetIsolation({
    assetContents,
    expectedProjectRef: SHADOW_PROJECT_REF,
    forbiddenValues: [
      { label: 'Portalens Supabase-URL', value: deployEnv.VITE_SUPABASE_URL },
      { label: 'Portalens Supabase-key', value: deployEnv.VITE_SUPABASE_KEY },
      { label: 'Operatorens secret key', value: deployEnv.SUPABASE_SECRET_KEY },
    ],
  })

  console.log(`PASS combined deploy build (portal bevaret; ${result.additions.length} subscription-filer tilføjet; shadow isoleret)`)
} catch (error) {
  console.error(`FAIL combined deploy build: ${error.message}`)
  process.exitCode = 1
}
