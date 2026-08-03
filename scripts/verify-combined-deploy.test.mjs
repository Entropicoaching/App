import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyCombinedDeploy, verifySubscriptionAssetIsolation } from './verify-combined-deploy.mjs'

const portal = new Map([
  ['index.html', 'portal-index'],
  ['assets/index.js', 'portal-js'],
])

function validCombined(extra = []) {
  return new Map([
    ...portal,
    ['subscription.html', 'subscription-html'],
    ['subscription-assets/subscription-abc.js', 'subscription-js'],
    ...extra,
  ])
}

const html = '<script type="module" src="/subscription-assets/subscription-abc.js"></script>'

test('combined deploy preserves the portal and only adds the public subscription entry', () => {
  const result = verifyCombinedDeploy({ baseline: portal, combined: validCombined(), subscriptionHtml: html })
  assert.deepEqual(result.additions, ['subscription-assets/subscription-abc.js', 'subscription.html'])
})

test('combined deploy rejects a changed portal file', () => {
  const combined = validCombined()
  combined.set('index.html', 'replaced-index')
  assert.throws(
    () => verifyCombinedDeploy({ baseline: portal, combined, subscriptionHtml: html }),
    /index\.html blev ændret eller fjernet/,
  )
})

test('combined deploy rejects QA pages and files outside the asset namespace', () => {
  assert.throws(
    () => verifyCombinedDeploy({
      baseline: portal,
      combined: validCombined([['pilot-qa.html', 'internal']]),
      subscriptionHtml: html,
    }),
    /uventede filer/,
  )
})

test('combined deploy rejects source entrypoints in generated HTML', () => {
  assert.throws(
    () => verifyCombinedDeploy({
      baseline: portal,
      combined: validCombined(),
      subscriptionHtml: '<script type="module" src="/src/subscription/main.jsx"></script>',
    }),
    /isolerede asset-namespace/,
  )
})

test('subscription assets contain the locked shadow ref without portal credentials', () => {
  assert.doesNotThrow(() => verifySubscriptionAssetIsolation({
    assetContents: ['bundle maxhsefxbrvsgolscqwh shadow-anon'],
    expectedProjectRef: 'maxhsefxbrvsgolscqwh',
    forbiddenValues: [
      { label: 'Portalens Supabase-URL', value: 'https://production.supabase.co/' },
      { label: 'Operatorens secret key', value: 'sb_secret_operator' },
    ],
  }))
})

test('subscription assets reject a production credential leak', () => {
  assert.throws(
    () => verifySubscriptionAssetIsolation({
      assetContents: ['bundle maxhsefxbrvsgolscqwh https://production.supabase.co/'],
      expectedProjectRef: 'maxhsefxbrvsgolscqwh',
      forbiddenValues: [{ label: 'Portalens Supabase-URL', value: 'https://production.supabase.co/' }],
    }),
    /Portalens Supabase-URL lækkede/,
  )
})
