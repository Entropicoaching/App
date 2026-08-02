// Final local review gate for the subscription pilot.
// It deliberately does not read the live shadow binding and never performs
// network, Auth, database, migration, deploy or publishing work.

import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const page = resolve(root, 'subscription-final-approval.html')

async function run(label, args, successPattern = /PASS|pass/i) {
  const { stdout, stderr } = await execFileAsync(process.execPath, args, { cwd: root, windowsHide: true })
  assert.match(`${stdout}\n${stderr}`, successPattern, `${label} emitted no success marker`)
  return label
}

try {
  await access(page)
  const html = await readFile(page, 'utf8')
  for (const link of [
    'customer-journey.html',
    'program-scenarios.html',
    'pilot-qa.html',
    'pilot-feedback-review.html',
    'subscription-pilot-release-bundle.html',
    'subscription-shadow-behavioral-qa.html',
    'docs/subscription-shadow-integration-readiness.md',
  ]) assert.match(html, new RegExp(`href="${link.replaceAll('.', '\\.')}"`), `final approval page is missing ${link}`)
  assert.match(html, /maxhsefxbrvsgolscqwh/, 'final approval page must pin the shadow project reference')
  assert.match(html, /Ingen migration, invitation, login, databasewrite, betaling, deploy eller produktion er rørt/, 'final approval page must preserve the no-action boundary')

  const checks = []
  checks.push(await run('local pilot completion', ['scripts/verify-subscription-pilot-completion.mjs']))
  await access(resolve(root, 'dist-subscription-pilot', 'subscription-final-approval.html'))
  checks.push(await run('shadow backend contract', ['scripts/verify-subscription-shadow-backend.mjs']))
  checks.push(await run('shadow client contract', ['scripts/verify-subscription-shadow-client.mjs']))
  checks.push(await run('shadow behavioural QA package', ['scripts/verify-subscription-shadow-behavioral-qa.mjs']))
  checks.push(await run('shadow binding unit tests', ['--test', 'scripts/verify-subscription-shadow-binding.test.mjs']))
  console.log(`PASS subscription final approval package (${checks.length} local gates, no shadow binding read)`)
  for (const check of checks) console.log(`  OK ${check}`)
} catch (error) {
  console.error(`FAIL subscription final approval package: ${error.message}`)
  process.exitCode = 1
}
