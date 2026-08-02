import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative, extname } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const subscriptionRoot = resolve(root, 'src/subscription')
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const target = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return []
      return sourceFiles(target)
    }
    return ['.js', '.jsx'].includes(extname(entry.name)) ? [target] : []
  }))
  return files.flat()
}

function resolveLocalImport(fromFile, specifier) {
  const base = resolve(fromFile, '..', specifier)
  const candidates = [base, `${base}.js`, `${base}.jsx`, resolve(base, 'index.js'), resolve(base, 'index.jsx')]
  return candidates.find(candidate => candidate.startsWith(subscriptionRoot)) || base
}

const files = await sourceFiles(subscriptionRoot)
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const name = relative(root, file)

  check(!/profiles\s*\.\s*role/.test(source), `${name} må ikke bruge profiles.role`)
  check(!/\b(?:athletes|athlete_notes|coach_notes)\b/.test(source), `${name} må ikke referere 1:1-data`)
  check(!/navigator\s*\.\s*serviceWorker|\/sw\.js|manifest\.webmanifest/.test(source), `${name} må ikke registrere portalens PWA`)

  const imports = source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)
  for (const match of imports) {
    const specifier = match[1]
    if (!specifier.startsWith('.')) continue
    const target = resolveLocalImport(file, specifier)
    check(target.startsWith(subscriptionRoot), `${name} importerer uden for src/subscription: ${specifier}`)
  }
}

const pilotConfig = await readFile(resolve(subscriptionRoot, 'pilotConfig.js'), 'utf8')
const client = await readFile(resolve(subscriptionRoot, 'supabaseClient.js'), 'utf8')
const entry = await readFile(resolve(root, 'subscription.html'), 'utf8')
const viteConfig = await readFile(resolve(root, 'vite.subscription.config.js'), 'utf8')

check(/SUBSCRIPTION_AUTH_STORAGE_KEY\s*=\s*['"]entropi-sub-auth['"]/.test(pilotConfig), 'subscription skal fastholde egen auth storage key')
check(/storageKey:\s*config\.storageKey/.test(client), 'subscription-klienten skal bruge sin egen storage key')
check(/noindex/.test(entry), 'subscription-entry skal være noindex under pilot')
check(!/manifest\.webmanifest|navigator\.serviceWorker|\/sw\.js/.test(entry), 'subscription-entry må ikke indeholde PWA-artefakter')
check(/publicDir:\s*false/.test(viteConfig), 'subscription-build skal sætte publicDir: false')
check(/outDir:\s*['"]dist-subscription-pilot['"]/.test(viteConfig), 'subscription-build skal have separat lokalt output')

if (failures.length) {
  console.error('FAIL subscription separation guard')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`PASS subscription separation guard (${files.length} subscription source files checked)`)
}
