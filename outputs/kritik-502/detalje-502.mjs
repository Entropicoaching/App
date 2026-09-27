// KRITIK 502: naerbilleder paa 390 og 1280 px af de steder, fundene handler om.
//   node outputs/kritik-502/detalje-502.mjs <gren> <side> <navn> "<tekst1>|<tekst2>|..."
// Grenen hentes med `git archive` (intet trae roeres), serveres paa 127.0.0.1, alt andet blokeres.
// For hver tekst findes det mindste synlige element, der indeholder den; det rulles ind, og
// der tages et billede af elementet. Maaler ogsaa elementets hoejde og bredde og skriftstoerrelse.
// Skriver outputs/kritik-502/<navn>-detaljer.json og <navn>-d<i>-<bredde>.png.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const [gren, side, navn, tekster] = process.argv.slice(2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const dir = mkdtempSync(join(tmpdir(), 'k502d-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${gren}`)
execSync('tar -xf g.tar', { cwd: dir })
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
const server = createServer((req, res) => {
  let f = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': TYPER[path.extname(f).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise((f) => server.listen(0, '127.0.0.1', f))
const BASE = `http://127.0.0.1:${server.address().port}/`
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch({ headless: true })
const ud = { gren, side, fund: [] }
for (const b of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: b, height: b === 390 ? 844 : 900 }, hasTouch: b === 390, isMobile: b === 390 })
  const page = await ctx.newPage()
  await page.route('**/*', (r) => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()))
  await page.goto(BASE + side, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
  let i = 0
  for (const t of tekster.split('|')) {
    i++
    const m = await page.evaluate((t) => {
      const alle = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && e.textContent.includes(t))
      const e = alle.at(-1)
      if (!e) return null
      document.querySelectorAll('[data-k502]').forEach((x) => x.removeAttribute('data-k502')); e.setAttribute('data-k502', '1'); e.scrollIntoView({ block: 'center' })
      const r = e.getBoundingClientRect()
      return { tag: e.tagName, top: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), font: getComputedStyle(e).fontSize, farve: getComputedStyle(e).color }
    }, t)
    await page.waitForTimeout(1200)
    if (m) await page.locator('[data-k502]').screenshot({ path: join(HERE, `${navn}-d${i}-${b}.png`), timeout: 15000 }).catch((e) => console.log('billede fejlede', String(e).slice(0, 120)))
    ud.fund.push({ tekst: t, bredde: b, ...m })
    console.log(b, i, t.slice(0, 40), JSON.stringify(m))
  }
  await ctx.close()
}
writeFileSync(join(HERE, `${navn}-detaljer.json`), JSON.stringify(ud, null, 1))
await browser.close(); server.close(); rmSync(dir, { recursive: true, force: true })
