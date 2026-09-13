// ORDRE 153 — delt opstart/nedlukning for e2e-specsne: Chromium (fra den delte
// codex-runtime — samme kilde og begrundelse som scripts/maal-app.mjs allerede
// bruger: intet lokalt node_modules/playwright, og ingen grund til at
// tilføje puppeteer #2 i dette repo, jf. ordrens "ingen ny runtime-afhængighed"),
// og en rigtig `vite`-dev-server der peger på .env.e2e.

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
export const { chromium } = require(join(runtimeModules, 'playwright'))

export const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
export const OUT_DIR = join(ROOT, 'outputs', 'e2e')
mkdirSync(OUT_DIR, { recursive: true })

export const VITE_PORT = Number(process.env.E2E_VITE_PORT || 5185)
export const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 8991)
export const APP_URL = `http://127.0.0.1:${VITE_PORT}/`

function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() > deadline) reject(new Error(`Timeout: ${url} svarede aldrig`))
        else setTimeout(tryOnce, 200)
      })
    }
    tryOnce()
  })
}

// Starter `vite` i e2e-mode (læser .env.e2e, se vite's egen env-mode-regel)
// på en fast port, så .env.e2e kan pege på en kendt VITE_SUPABASE_URL.
export async function startVite() {
  // Kør vites egen JS-indgang direkte med node (i stedet for .bin/vite.cmd) —
  // undgår både "spawn EINVAL" for .cmd-shims på Windows og den uescaperede
  // shell:true-advarsel det ellers kræver.
  const viteJs = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteJs, '--mode', 'e2e', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', d => { out += d })
  child.stderr.on('data', d => { out += d })
  try {
    await waitForHttp(APP_URL, 30000)
  } catch (err) {
    child.kill()
    throw new Error(`vite dev-server startede ikke: ${err.message}\n${out}`)
  }
  return {
    child,
    async stop() {
      child.kill()
      await new Promise(resolve => child.once('exit', resolve))
    },
  }
}

export async function launchBrowser() {
  return chromium.launch({ headless: true })
}
