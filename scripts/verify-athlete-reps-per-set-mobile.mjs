// ORDRE 106 · commit 3 — "reps må være forskellige fra sæt til sæt".
// -----------------------------------------------------------------------------
// AthleteView.jsx kræver en live Supabase-session for at boote, så den kan
// ikke screenshottes headless uden enten en ægte forbindelse eller atletdata
// — begge dele er forbudt (ingen atlet-data i filer/rapport, ingen skrivning
// mod produktion). Dette script bruger i stedet den ÆGTE, uændrede
// src/repsPrescription.js (samme logik sæt-loggeren rent faktisk kører) og
// gengiver de tre sæt-række-tilstande fra AthleteView.jsx (fast/interval/
// frit) med de samme inline-mål (44px trykflader, 52px repsfelt) i en
// isoleret HTML-harness — kun synteste øvelsesnavne, ingen atletdata.
//
// Tjekker: interval og "frit" giver et redigerbart <input> for reps (mindst
// 44px højt), fast tal gør ikke (uændret statisk label). Skærmbillede tages
// ved 390px viewport-bredde.
//
// Kørsel: npm run verify:athlete-reps-per-set-mobile

import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const repsPrescriptionSrc = readFileSync(join(root, 'src', 'repsPrescription.js'), 'utf8')
const outDir = join(root, 'outputs', 'reps-pr-saet')
mkdirSync(outDir, { recursive: true })

// Samme inline-stilarter som AthleteView.jsx's sæt-logger (s.fieldInput,
// s.btnPrimary, s.btnGhost, se src/AthleteView.jsx:1452-1454) — kopieret
// bevidst i stedet for importeret, fordi `s` er defineret inde i en
// komponentfil der kræver React/Supabase for at loades.
const HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { background:#0c0c0a; margin:0; padding:16px; font-family:'IBM Plex Mono',monospace; }
  .row { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; }
  .label { color:#7a7770; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; min-width:52px; }
  .weight { width:80px; min-width:80px; min-height:44px; box-sizing:border-box; padding:0.65rem 0.5rem; font-size:1.1rem; text-align:center; background:#141410; border:1px solid rgba(237,234,226,0.13); color:#edeae2; }
  .reps { width:52px; min-width:52px; min-height:44px; box-sizing:border-box; padding:0.65rem 0.3rem; font-size:1.1rem; text-align:center; background:#141410; border:1px solid rgba(237,234,226,0.13); color:#edeae2; }
  .repsLabel { color:#c8923a; font-size:0.88rem; white-space:nowrap; }
  .times { color:#c8923a; font-size:0.88rem; }
  .btnPrimary { background:#c8923a; color:#141410; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; border:none; padding:0.5rem 1rem; min-height:44px; box-sizing:border-box; cursor:pointer; }
  .btnGhost { background:transparent; color:#7a7770; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; border:1px solid rgba(237,234,226,0.13); padding:0.5rem 1rem; min-height:44px; box-sizing:border-box; cursor:pointer; }
  h2 { color:#edeae2; font-size:0.9rem; margin: 1.2rem 0 0.5rem; }
</style></head>
<body>
  <div id="app"></div>
  <script type="module">
    import { parseRepsPrescription } from '/repsPrescription.js'

    // Syntetiske øvelser — INGEN atletdata, kun til at bevise UI-tilstandene.
    const exercises = [
      { name: 'Squat', sets: 3, reps: '8' },
      { name: 'Bænkpres', sets: 3, reps: '4-6' },
      { name: 'Roning', sets: 3, reps: 'frit' },
    ]

    const app = document.getElementById('app')
    for (const ex of exercises) {
      const h = document.createElement('h2')
      h.textContent = \`\${ex.name} — \${ex.sets} sæt · \${ex.reps}\`
      app.appendChild(h)

      const p = parseRepsPrescription(ex.reps)
      const editable = p.type !== 'fixed'
      const defaultReps = p.type === 'range' ? String(p.min) : ''

      for (let setNum = 1; setNum <= ex.sets; setNum++) {
        const row = document.createElement('div')
        row.className = 'row'
        row.dataset.exercise = ex.name
        row.dataset.setNum = String(setNum)

        const label = document.createElement('div')
        label.className = 'label'
        label.textContent = \`Sæt \${setNum}\`
        row.appendChild(label)

        const weight = document.createElement('input')
        weight.className = 'weight'
        weight.placeholder = 'kg'
        row.appendChild(weight)

        if (editable) {
          const times = document.createElement('span')
          times.className = 'times'
          times.textContent = '×'
          row.appendChild(times)

          const reps = document.createElement('input')
          reps.className = 'reps'
          reps.placeholder = 'reps'
          reps.value = defaultReps
          reps.dataset.role = 'reps-input'
          row.appendChild(reps)
        } else {
          const repsLabel = document.createElement('span')
          repsLabel.className = 'repsLabel'
          repsLabel.textContent = \`× \${ex.reps || '—'}\`
          repsLabel.dataset.role = 'reps-static'
          row.appendChild(repsLabel)
        }

        const log = document.createElement('button')
        log.className = 'btnPrimary'
        log.textContent = 'Log'
        row.appendChild(log)

        const skip = document.createElement('button')
        skip.className = 'btnGhost'
        skip.textContent = 'Spring over'
        row.appendChild(skip)

        app.appendChild(row)
      }
    }
    window.__harnessReady = true
  </script>
</body></html>`

function startServer() {
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); return }
    if (url === '/repsPrescription.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(repsPrescriptionSrc); return }
    res.writeHead(404); res.end()
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  })
}

const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const require = createRequire(import.meta.url)
const { chromium } = require(join(runtimeModules, 'playwright'))

async function main() {
  const { server, origin } = await startServer()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    await page.goto(origin)
    await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 5000 })

    const shot = join(outDir, 'mobil-390px-reps-pr-saet.png')
    await page.screenshot({ path: shot, fullPage: true })
    console.log(`Skærmbillede (390px, interval/frit/fast side om side): ${shot}`)

    // Squat (fast "8") — ingen reps-input, statisk label uændret.
    const squatInputs = await page.locator('[data-exercise="Squat"] [data-role="reps-input"]').count()
    const squatStatic = await page.locator('[data-exercise="Squat"] [data-role="reps-static"]').count()
    assert.equal(squatInputs, 0, 'fast ordination ("8") må ikke få et redigerbart repsfelt')
    assert.equal(squatStatic, 3, 'fast ordination skal vise den uændrede statiske label på alle 3 sæt')

    // Bænkpres (interval "4-6") — redigerbart felt, forudfyldt med 4.
    const benchInputs = page.locator('[data-exercise="Bænkpres"] [data-role="reps-input"]')
    assert.equal(await benchInputs.count(), 3, 'interval-ordination skal give et redigerbart repsfelt pr. sæt')
    for (const val of await benchInputs.evaluateAll(els => els.map(el => el.value))) {
      assert.equal(val, '4', 'intervallets nederste tal (4) skal forudfylde feltet')
    }

    // Roning ("frit") — redigerbart felt på alle 3 sæt.
    const roningInputs = await page.locator('[data-exercise="Roning"] [data-role="reps-input"]').count()
    assert.equal(roningInputs, 3, '"frit"-markeret ordination skal give et redigerbart repsfelt pr. sæt')

    // 44px trykflade på repsfeltet (ordre 106's krav, samme grænse som ordre 41/76).
    const box = await benchInputs.first().boundingBox()
    assert.ok(box && box.height >= 44, `repsfeltet skal være mindst 44px højt, var ${box?.height}`)

    console.log('\nGRØN: interval og "frit" giver et 44px redigerbart repsfelt pr. sæt, forudfyldt med intervallets nederste tal. Fast ordination er uændret.')
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
  }
}

main()
