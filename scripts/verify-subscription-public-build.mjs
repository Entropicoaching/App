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
