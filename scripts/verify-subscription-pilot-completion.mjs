// Deterministic completion gate for the local-only subscription pilot v1.
// It deliberately executes no network, auth, database or publishing action.
// A pass means the local review foundation is complete; it is never permission
// to run a shadow pilot or release a product.

import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')

const requiredFiles = [
  'subscription-pilot-release-bundle.html',
  'customer-journey.html',
  'pilot-program-review.html',
  'pilot-feedback.html',
  'pilot-feedback-review.html',
  'pilot-mobile-checklist.html',
  'pilot-qa.html',
  'program-scenarios.html',
  'program-preview.html',
  'subscription-launch-candidate.html',
  'src/subscription/customerJourneyMain.jsx',
  'src/subscription/pilotProgramReviewMain.jsx',
  'src/subscription/pilotFeedbackMain.jsx',
  'src/subscription/pilotFeedbackReviewMain.jsx',
  'src/subscription/pilotMobileChecklistMain.jsx',
  'scripts/verify-subscription-pilot-smoke.mjs',
  'scripts/verify-subscription-separation.mjs',
]

const requiredLaunchLinks = [
  'href="customer-journey.html"',
  'href="pilot-program-review.html"',
  'href="pilot-feedback.html"',
  'href="pilot-feedback-review.html"',
  'href="pilot-mobile-checklist.html"',
  'href="pilot-qa.html"',
]

const directFileEntrypoints = [
  'subscription.html',
  'customer-journey.html',
  'pilot-program-review.html',
  'pilot-feedback.html',
  'pilot-feedback-review.html',
  'pilot-mobile-checklist.html',
  'program-preview.html',
  'program-scenarios.html',
]

async function exists(path) {
  await access(resolve(root, path))
  return path
}

async function runNode(label, args, successPattern = /PASS|pass/i) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { cwd: root, windowsHide: true })
    assert.match(`${stdout}\n${stderr}`, successPattern, `${label} emitted no success marker`)
    return label
  } catch (error) {
    const detail = `${error.stdout || ''}\n${error.stderr || ''}`.trim()
    throw new Error(`${label} fejlede${detail ? `:\n${detail}` : ''}`)
  }
}

export async function verifySubscriptionPilotCompletion() {
  const checkedFiles = await Promise.all(requiredFiles.map(exists))
  const launchPage = await readFile(resolve(root, 'subscription-pilot-release-bundle.html'), 'utf8')
  for (const link of requiredLaunchLinks) assert.ok(launchPage.includes(link), `launch page mangler ${link}`)
  assert.match(launchPage, /local-only/i, 'launch page skal tydeligt være local-only')
  assert.doesNotMatch(launchPage, /supabase\.co|createClient\(|fetch\(/i, 'launch page må ikke have ekstern runtime')

  for (const entrypoint of directFileEntrypoints) {
    const html = await readFile(resolve(root, entrypoint), 'utf8')
    assert.match(html, /location\.protocol === 'file:'/i, `${entrypoint} mangler file://-fallback`)
    assert.match(html, /dist-subscription-pilot\//i, `${entrypoint} mangler bygget lokal fallback`)
  }

  // Run sequentially: the build clears a shared local output directory.
  const checks = []
  checks.push(await runNode('subscription tests', ['--test', 'src/subscription/__tests__/*.test.mjs']))
  checks.push(await runNode('pilot smoke', ['scripts/verify-subscription-pilot-smoke.mjs']))
  checks.push(await runNode('separation guard', ['scripts/verify-subscription-separation.mjs']))
  checks.push(await runNode('shadow client contract', ['scripts/verify-subscription-shadow-client.mjs']))
  checks.push(await runNode(
    'pilot build',
    ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.subscription.config.js'],
    /built in|built successfully/i,
  ))
  for (const entrypoint of directFileEntrypoints) {
    await access(resolve(root, 'dist-subscription-pilot', entrypoint))
  }
  return { files: checkedFiles, checks }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifySubscriptionPilotCompletion()
    console.log(`PASS subscription pilot v1 completion (${result.files.length} entrypoints, ${result.checks.length} green checks)`)
    for (const item of result.files) console.log(`  OK entrypoint ${item}`)
    for (const item of result.checks) console.log(`  OK ${item}`)
  } catch (error) {
    console.error(`FAIL subscription pilot v1 completion: ${error.message}`)
    process.exitCode = 1
  }
}
