// Kritik 628, blok 1: hop563 med faste billedtider (Yantras 621, commit 1). Er det en god nok erstatning for
// realtidsoptagelsen?
//   1) mit eget tjek: fastVideo(bane) kodes i Chrome to gange ubelastet og to gange med CPU'en drosslet 6x og 20x
//      (CDP Emulation.setCPUThrottlingRate, kun min egen side, ingen belastning af maskinen). Er klippet byte for
//      byte det samme? Saa kan en belastet maskine ikke laengere give et andet klip.
//   2) Yantras egne tests hop563 og hop621 paa main (to gange) og den gamle hop563 paa 4ca0c63 (een gang), i en
//      `git archive`-kopi. Tid og antal groenne.
//   node outputs/kritik-628/hop-628.mjs     -> hop-628.json
import path, { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const dir = mkdtempSync(join(tmpdir(), 'k628h-'))
const hent = (ref, hvor) => { mkdirSync(hvor, { recursive: true }); execSync(`git -C "${LM}" archive -o "${join(hvor, 'a.tar')}" ${ref} dist src scripts test kroppe package.json`); execSync('tar -xf a.tar', { cwd: hvor }); rmSync(join(hvor, 'a.tar')) }
const MAIN = join(dir, 'main'), GL = join(dir, 'g616')
hent('main', MAIN); hent('4ca0c63', GL)
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 900) : ''}`) }
const ud = { main: execSync(`git -C "${LM}" rev-parse --short main`).toString().trim(), klip: [], tests: [] }

// --- 1) Er klippet det samme under drosling? -------------------------------------------------------------------
const { fastVideo, BANER, FAST_TIDER } = await import(pathToFileURL(join(MAIN, 'scripts', 'syntetisk-video.mjs')).href)
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
ud.chrome = browser.version()
for (const bane of Object.keys(BANER)) {
  for (const drossel of [1, 1, 6, 20]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.route('**/*', (r) => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort()))
    await page.goto(pathToFileURL(join(MAIN, 'dist', 'maal-billede', 'index.html')).href)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: drossel })
    const t0 = Date.now()
    await page.evaluate(fastVideo(bane))
    const ms = Date.now() - t0
    const b64 = await page.evaluate(async () => { const b = new Uint8Array(await window.__klip.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s) })
    const buf = Buffer.from(b64, 'base64')
    ud.klip.push({ bane, drossel, ms, bytes: buf.length, sha: createHash('sha256').update(buf).digest('hex').slice(0, 16) })
    await ctx.close()
  }
}
await browser.close()
const perBane = Object.keys(BANER).map((b) => { const k = ud.klip.filter((x) => x.bane === b); return { bane: b, ens: new Set(k.map((x) => x.sha)).size === 1, sha: [...new Set(k.map((x) => x.sha))], ms: k.map((x) => x.ms) } })
paastaa(`fastVideo: klippet er byte for byte det samme ubelastet (to gange) og med CPU'en drosslet 6x og 20x, for alle ${perBane.length} baner (${FAST_TIDER.length} billeder)`, perBane.every((p) => p.ens), perBane)

// --- 2) Yantras tests -----------------------------------------------------------------------------------------------
const koer = (rod, filer, navn) => {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...filer], { cwd: rod, encoding: 'utf8', timeout: 900000 })
  const ud2 = (r.stdout || '') + (r.stderr || '')
  const tal = (k) => +(ud2.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [0, NaN])[1]
  const res = { navn, filer, s: Math.round((Date.now() - t0) / 1000), tests: tal('tests'), pass: tal('pass'), fail: tal('fail'), kode: r.status }
  ud.tests.push(res); console.log('test', JSON.stringify(res))
  if (res.fail || r.status) console.log(ud2.split('\n').filter((l) => /not ok|Error|fejl/i.test(l)).slice(0, 20).join('\n'))
  return res
}
const m1 = koer(MAIN, ['test/hop563.test.js', 'test/hop621.test.js'], 'main 1. gang')
const m2 = koer(MAIN, ['test/hop563.test.js', 'test/hop621.test.js'], 'main 2. gang')
const g = koer(GL, ['test/hop563.test.js'], '4ca0c63 hop563 (realtid)')
paastaa('hop563 + hop621 paa main: groenne begge gange', [m1, m2].every((r) => r.fail === 0 && r.pass === r.tests && r.tests > 0 && r.kode === 0), [m1, m2])
paastaa('den gamle hop563 (realtidsoptagelse) paa 4ca0c63 paa samme maskine, til sammenligning af tiden', true, g)

rmSync(dir, { recursive: true, force: true })
writeFileSync(join(HERE, 'hop-628.json'), JSON.stringify({ ...ud, tjek }, null, 1))
const roede = tjek.filter((t) => !t.ok)
console.log(`\nhop-628: ${tjek.length - roede.length}/${tjek.length} tjek groenne (${ud.chrome})`)
process.exit(roede.length ? 1 : 0)
