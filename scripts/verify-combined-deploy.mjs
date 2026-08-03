import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, relative, resolve, sep } from 'node:path'

const forbiddenSubscriptionPages = new Set([
  'customer-journey.html',
  'pilot-feedback-review.html',
  'pilot-feedback.html',
  'pilot-mobile-checklist.html',
  'pilot-program-review.html',
  'pilot-qa.html',
  'program-preview.html',
  'program-scenarios.html',
  'subscription-final-approval.html',
  'subscription-launch-candidate.html',
  'subscription-pilot-release-bundle.html',
  'subscription-shadow-behavioral-qa.html',
])

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return nested.flat()
}

export async function snapshotDirectory(directory) {
  const files = await listFiles(directory)
  const entries = await Promise.all(files.map(async file => {
    const path = relative(directory, file).split(sep).join('/')
    const digest = createHash('sha256').update(await readFile(file)).digest('hex')
    return [path, digest]
  }))
  return new Map(entries)
}

export function verifyCombinedDeploy({ baseline, combined, subscriptionHtml }) {
  assert.ok(baseline instanceof Map && baseline.has('index.html'), 'portalens baseline mangler index.html')
  assert.ok(baseline.has('CNAME'), 'portalens baseline mangler CNAME')
  assert.ok(baseline.has('.nojekyll'), 'portalens baseline mangler .nojekyll')
  assert.ok(combined instanceof Map && combined.has('index.html'), 'det kombinerede build mangler index.html')

  for (const [path, digest] of baseline) {
    assert.equal(combined.get(path), digest, `portalfilen ${path} blev ændret eller fjernet af subscription-buildet`)
  }

  const additions = [...combined.keys()].filter(path => !baseline.has(path)).sort()
  assert.ok(additions.includes('subscription.html'), 'subscription.html blev ikke tilføjet')
  assert.ok(additions.some(path => path.startsWith('subscription-assets/')), 'subscription-assets blev ikke tilføjet')

  const unexpected = additions.filter(path => (
    path !== 'subscription.html' && !path.startsWith('subscription-assets/')
  ))
  assert.deepEqual(unexpected, [], `subscription-buildet tilføjede uventede filer: ${unexpected.join(', ')}`)

  const leakedPages = additions.filter(path => forbiddenSubscriptionPages.has(basename(path)))
  assert.deepEqual(leakedPages, [], `interne QA/demo-sider lækkede til deploy: ${leakedPages.join(', ')}`)

  assert.match(subscriptionHtml, /(?:src|href)="\/subscription-assets\//, 'subscription.html bruger ikke det isolerede asset-namespace')
  assert.doesNotMatch(subscriptionHtml, /(?:src|href)="\/src\//, 'subscription.html peger stadig på kildekode')

  return { additions }
}

export function verifySubscriptionAssetIsolation({ assetContents, forbiddenValues = [], expectedProjectRef }) {
  assert.ok(Array.isArray(assetContents) && assetContents.length > 0, 'subscription-buildet mangler assets')
  const combinedAssets = assetContents.map(content => String(content)).join('\n')

  for (const entry of forbiddenValues) {
    const value = String(entry?.value || '').trim()
    if (!value) continue
    assert.equal(
      combinedAssets.includes(value),
      false,
      `${entry.label || 'En forbudt værdi'} lækkede til subscription-bundlen`,
    )
  }

  assert.ok(
    combinedAssets.includes(expectedProjectRef),
    'subscription-bundlen mangler den låste shadow-projektreference',
  )
}
