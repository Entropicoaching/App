// KRITIK 502: Bhishak laeser en site-gren som fremmed laeser og som Marcs korrekturlaeser.
//   node outputs/kritik-502/side-502.mjs <gren> <side1,side2,...> <navn>
// Grenen hentes med `git archive` fra entropi-coaching-site-wt2 til en midlertidig mappe
// (intet trae roeres), serveres paa localhost og koeres headless i Chromium paa 390 (touch)
// og 1280 px. Alt uden for localhost blokeres og taelles. Maaler: meta (title, description,
// robots, canonical, og), links og om maalet findes paa grenen, konsolfejl, fejlede kald,
// vandret rul, [MARC]-felter, tankestreger, atletnavne (fornavne fra appens .gitignore, ikke
// skrevet ud), private filer paa grenen.
// Skriver outputs/kritik-502/<navn>.json, <navn>-<side>-tekst.txt og skaermbilleder.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const [gren, siderArg, navn] = process.argv.slice(2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const sha = execSync(`git -C "${SITE}" rev-parse --short ${gren}`).toString().trim()
const dir = mkdtempSync(join(tmpdir(), 'k502-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${gren}`)
execSync(`tar -xf g.tar`, { cwd: dir })
rmSync(join(dir, 'g.tar'))
const filer = execSync(`git -C "${SITE}" ls-tree -r --name-only ${gren}`).toString().trim().split('\n')

const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain' }
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = join(dir, p)
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end('404') }
  res.writeHead(200, { 'content-type': TYPER[path.extname(f).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise((f) => server.listen(0, '127.0.0.1', f))
const PORT = server.address().port
const BASE = `http://127.0.0.1:${PORT}/`

const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const T0 = Date.now(); const tik = setInterval(() => console.log('  tik', Math.round((Date.now() - T0) / 1000)), 10000); console.log('start chromium'); const browser = await chromium.launch({ headless: true }); console.log('chromium klar')

const ud = { gren, sha, maalt: new Date().toISOString(), sider: [] }
for (const side of siderArg.split(',')) {
  for (const b of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: b, height: b === 390 ? 844 : 900 }, hasTouch: b === 390, isMobile: b === 390, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const r = { side, bredde: b, konsol: [], sidefejl: [], fejlkald: [], eksterne: [], http404: [] }
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) r.konsol.push(m.text().slice(0, 300)) })
    page.on('pageerror', (e) => r.sidefejl.push(String(e).slice(0, 300)))
    await page.route('**/*', (route) => {
      const u = route.request().url()
      if (u.startsWith(BASE)) return route.continue()
      r.eksterne.push(u.slice(0, 200))
      return route.abort()
    })
    page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
    page.on('requestfailed', (q) => { if (q.url().startsWith(BASE)) r.fejlkald.push(q.url().slice(BASE.length)) })
    console.log('goto', side, b); await page.goto(BASE + side, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForLoadState('load', { timeout: 15000 }).catch(() => console.log('  load timeout'))
    console.log('  loaded'); await page.waitForTimeout(1500); console.log('  ventet')
    await page.evaluate(async () => { for (let y = 0, i = 0; y < document.body.scrollHeight && i < 300; y += 600, i++) { window.scrollTo(0, y); await new Promise((f) => setTimeout(f, 40)) } window.scrollTo(0, 0) })
    console.log('  rullet'); await page.waitForTimeout(800)
    Object.assign(r, await page.evaluate(() => {
      const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content ?? null
      const og = (n) => document.querySelector(`meta[property="${n}"]`)?.content ?? null
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), tekst: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 80), rel: a.rel || '', synlig: !!(a.offsetWidth || a.offsetHeight) }))
      const brudte = [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'))
      const iframes = [...document.querySelectorAll('iframe')].map((f) => ({ src: f.getAttribute('src'), h: f.offsetHeight, w: f.offsetWidth }))
      const cw = document.documentElement.clientWidth
      const brede = document.documentElement.scrollWidth <= cw ? [] : [...document.querySelectorAll('body *:not(svg *)')].filter((e) => e.getBoundingClientRect().right > cw + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('[style*="overflow"],.table-wrap,pre')).slice(0, 8).map((e) => e.tagName + ' ' + String(e.className?.baseVal ?? e.className).slice(0, 40) + ' ' + Math.round(e.getBoundingClientRect().right))
      return {
        title: document.title, description: meta('description'), robots: meta('robots'), canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
        ogTitle: og('og:title'), ogDescription: og('og:description'), ogImage: og('og:image'), lang: document.documentElement.lang,
        h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')),
        h2: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')),
        scrollW: document.documentElement.scrollWidth, clientW: cw, hoejde: document.documentElement.scrollHeight,
        links, brudte, iframes, brede, tekst: document.body.innerText,
      }
    }))
    console.log('  maalt'); r.iframeTekst = []
    for (const f of page.frames()) if (f !== page.mainFrame()) r.iframeTekst.push(await Promise.race([f.evaluate(() => document.body?.innerText ?? '').catch(() => ''), new Promise((ok) => setTimeout(() => ok('[iframe svarede ikke: ' + f.url() + ']'), 5000))]))
    const alt = r.tekst + '\n' + r.iframeTekst.join('\n')
    r.marcFelter = [...alt.matchAll(/\[MARC[^\]]*\]/g)].map((m) => m[0].slice(0, 200))
    r.firkant = [...alt.matchAll(/\[ \][^\n]{0,80}/g)].map((m) => m[0])
    r.tankestreger = [...alt.matchAll(/.{0,30}[\u2014\u2013].{0,30}/g)].map((m) => m[0])
    r.navne = navne.map((n) => (alt.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length)
    r.marc = (alt.match(/\bMarc/g) ?? []).length
    const stem = `${navn}-${side.replace(/\.html$/, '').replace(/[\/.]/g, '_')}-${b}`
    await page.screenshot({ path: join(HERE, `${stem}-top.png`) })
    if (b === 390) writeFileSync(join(HERE, `${navn}-${side.replace(/\.html$/, '').replace(/[\/.]/g, '_')}-tekst.txt`), alt)
    delete r.tekst
    ud.sider.push(r)
    console.log(side, b, 'hoejde', r.hoejde, 'rul', r.scrollW - r.clientW, 'konsol', r.konsol.length, 'sidefejl', r.sidefejl.length, '404', r.http404.length, 'ekst', r.eksterne.length, 'brudte', r.brudte.length, 'MARC', r.marcFelter.length, 'streg', r.tankestreger.length, 'navne', r.navne.join('/'))
    await ctx.close()
  }
}
const internt = new Set()
for (const s of ud.sider) for (const l of s.links) {
  if (/^(https?:|mailto:|tel:|#|javascript:)/.test(l.href)) continue
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(s.side), l.href.split('#')[0].split('?')[0]))
  const findes = filer.includes(rel) || filer.includes(path.posix.join(rel, 'index.html')) || rel === '.' || rel === ''
  internt.add(`${s.side} -> ${l.href} => ${findes ? 'ok' : 'MANGLER'}`)
}
ud.interneLinks = [...internt]
ud.eksterneLinks = [...new Set(ud.sider.flatMap((s) => s.links.filter((l) => /^https?:/.test(l.href)).map((l) => l.href)))]
ud.privateFiler = filer.filter((f) => /^(outputs|scripts|docs)\//.test(f) || /claude|agents\.md|\.md$/i.test(f))
ud.antalFiler = filer.length
writeFileSync(join(HERE, `${navn}.json`), JSON.stringify(ud, null, 1))
clearInterval(tik); await browser.close(); server.close(); rmSync(dir, { recursive: true, force: true })
console.log('manglende interne links:', ud.interneLinks.filter((l) => l.endsWith('MANGLER')))
console.log('private filer:', ud.privateFiler.length)
