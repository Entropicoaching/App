import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { basename, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'dist-subscription-public')

const forbiddenHtmlEntrypoints = new Set([
  'adaptive-baseline-review.html',
  'customer-journey.html',
  'pilot-feedback-review.html',
  'pilot-feedback.html',
  'pilot-mobile-checklist.html',
  'pilot-program-review.html',
  'pilot-qa.html',
  'program-preview.html',
  'program-scenarios.html',
  'subscription-final-approval.html',
  'subscription-journey-qa-review.html',
  'subscription-launch-candidate.html',
  'subscription-monday-roadmap.html',
  'subscription-pilot-release-bundle.html',
  'subscription-scale-readiness.html',
  'subscription-shadow-behavioral-qa.html',
])

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return files.flat()
}

export async function verifySubscriptionPublicBuild() {
  const files = await listFiles(outputRoot)
  const relativeFiles = files.map(path => relative(outputRoot, path).split(sep).join('/')).sort()
  const htmlFiles = relativeFiles.filter(path => path.toLowerCase().endsWith('.html'))

  assert.deepEqual(
    htmlFiles,
    ['subscription.html'],
    `public build må kun indeholde subscription.html; fandt: ${htmlFiles.join(', ') || 'ingen HTML'}`,
  )

  const forbiddenFiles = relativeFiles.filter(path => forbiddenHtmlEntrypoints.has(basename(path)))
  assert.deepEqual(
    forbiddenFiles,
    [],
    `interne QA/demo-entrypoints lækkede til public build: ${forbiddenFiles.join(', ')}`,
  )

  const subscriptionHtml = await readFile(resolve(outputRoot, 'subscription.html'), 'utf8')
  assert.match(subscriptionHtml, /<script[^>]+type="module"/i, 'subscription.html mangler det byggede modul-entrypoint')

  // Indtil 7. august 2026 stoppede porten her. Den maalte HVILKE filer der laa i
  // buildet, ikke om buildet kunne bruges: et build helt uden
  // VITE_SUB_SUPABASE_ANON_KEY gav PASS, selvom ingen kunne logge ind i det.
  // Samme fejltype som SubscriptionApp-fundet 5. august — porten maalte at koden
  // var der, ikke at nogen kunne naa den. Det betyder noget nu, hvor et
  // deploy-workflow bygger uden at et menneske ser resultatet.
  const bundles = relativeFiles.filter(path => path.endsWith('.js'))
  assert.ok(bundles.length > 0, 'public build indeholder ingen JS-bundle')
  const bundleText = (await Promise.all(
    bundles.map(path => readFile(resolve(outputRoot, path), 'utf8')),
  )).join('\n')

  const SHADOW_REF = 'maxhsefxbrvsgolscqwh'
  const PRODUKTION_REF = 'dsqgaxwgtcbqgphsofav'

  assert.ok(
    bundleText.includes(SHADOW_REF),
    `bundlen peger ikke paa shadow-projektet (${SHADOW_REF}) — appen ville ikke vide hvor den skal hen`,
  )
  assert.ok(
    !bundleText.includes(PRODUKTION_REF),
    `bundlen indeholder produktions-ref (${PRODUKTION_REF}) — piloten maa ALDRIG naa rigtige atleters data`,
  )
  assert.match(
    bundleText,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_publishable_[A-Za-z0-9_-]{10,}/,
    'bundlen har ingen Supabase-noegle — saet VITE_SUB_SUPABASE_ANON_KEY foer build, ellers kan ingen logge ind',
  )

  return { fileCount: relativeFiles.length, htmlFiles }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifySubscriptionPublicBuild()
    console.log(`PASS public subscription build (${result.fileCount} filer; kun ${result.htmlFiles[0]} er HTML)`)
  } catch (error) {
    console.error(`FAIL public subscription build: ${error.message}`)
    process.exitCode = 1
  }
}
