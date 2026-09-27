// Kritik 525, blok 2: squat-udgivelsen efter Setus 516, gentjek af U1-U16 fra min 502.
//   node outputs/kritik-525/squat-525.mjs          -> squat-525.json og S-*.png
// Grenen `udgivelse-squat-min-krop` hentes med `git archive` fra entropi-coaching-site-wt2
// til en midlertidig mappe (intet trae roeres), serveres paa 127.0.0.1 og koeres headless i
// Chromium paa 390 (touch) og 1280 px. Alt uden for huset blokeres og taelles.
// Maaler i den synlige tekst (ogsaa i rammer fra samme hus): [MARC], tankestreger, atletnavne
// (fornavnene fra appens .gitignore, ikke skrevet ud), "Marcs", U2/U3/U6/U15-saetningerne,
// anatomitabellens skrift paa 390. I kilden: [MARC], class="marc", titel, beskrivelse, noindex,
// datoerne, ordrenumre i kommentarer, referencerne, stien til Min krop og main's outputs/.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const GREN = 'udgivelse-squat-min-krop'
const git = (c) => execSync(`git -C "${SITE}" ${c}`, { maxBuffer: 1 << 26 }).toString()
const top = git(`rev-parse --short ${GREN}`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k525-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })

const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' }
const server = createServer((req, res) => {
  let f = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
  if (!existsSync(f)) { res.writeHead(404); return res.end('404') }
  res.writeHead(200, { 'content-type': TYPER[path.extname(f).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise((f) => server.listen(0, '127.0.0.1', f))
const BASE = `http://127.0.0.1:${server.address().port}/`

// --- kilden ---------------------------------------------------------------------------------
const html = readFileSync(join(dir, 'artikel-squat.html'), 'utf8')
const bundt = readFileSync(join(dir, 'assets', 'maalt-over-model.js'), 'utf8')
const anatomi = readFileSync(join(dir, 'assets', 'squat-anatomi.js'), 'utf8')
const kommentarer = [...html.matchAll(/<!--([\s\S]*?)-->/g), ...html.matchAll(/\/\*([\s\S]*?)\*\//g), ...html.matchAll(/^\s*\/\/(.*)$/gm)].map((m) => m[1])
const kilde = {
  marcIKilde: (html.match(/\[MARC[\]:]/g) ?? []).length,
  marcDato: (html.match(/\[MARC-DATO\]/g) ?? []).length,
  classMarc: (html.match(/class="marc"/g) ?? []).length,
  titelLaengde: [...html.match(/<title>([^<]*)<\/title>/)[1]].length,
  beskrivelseLaengde: [...html.match(/name="description" content="([^"]*)"/)[1]].length,
  noindex: /name="robots" content="[^"]*noindex/.test(html),
  datoer: [...html.matchAll(/"date(Published|Modified)":"([^"]*)"/g)].map((m) => m[2]),
  sitemapSquat: readFileSync(join(dir, 'sitemap.xml'), 'utf8').includes('artikel-squat'),
  sitemapKlar: existsSync(join(dir, 'SITEMAP-KLAR.txt')),
  ordreIKommentarer: kommentarer.filter((k) => /[Oo]rdre \d+|Yantra|Drishti|Setu/.test(k)).length,
  tilbageLinks: [...html.matchAll(/href="(artikler\.html|viden\.html#artikler)"/g)].map((m) => m[1]),
  larsen2021: { a: (html.match(/2021a/g) ?? []).length, b: (html.match(/2021b/g) ?? []).length, uden: (html.match(/Larsen m\.fl\., 2021[^ab]/g) ?? []).length },
  modellensKilder: html.includes('Modellens kilder'),
  minKropSti: [...html.matchAll(/(?:href|src)="(assets\/[^"]*min-krop[^"]*)"/g)].map((m) => m[1]),
  bundtMarcs: (bundt.match(/Marcs/g) ?? []).length,
  bundtSyntetisk: /SYNTETISK, indtil Marcs video kommer/.test(bundt),
  anatomiIntetKrav: /intet krav/.test(anatomi),
  anatomiIkkeRegnet: /ikke regnet \(uden for modellens omr\\xE5de\)|ikke regnet \(uden for modellens område\)/.test(anatomi),
}
const vaerktoejSti = git('ls-tree -r --name-only vaerktoejer').split('\n').filter((f) => /min-krop\/index\.html$/.test(f))
const mainPrivat = git('ls-tree -r --name-only main outputs scripts').split('\n').filter(Boolean)

// --- siderne ----------------------------------------------------------------------------------
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch()
const sider = []
for (const side of ['artikel-squat.html', 'artikler.html', 'assets/min-krop/index.html']) {
  for (const b of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: b, height: b === 390 ? 844 : 900 }, hasTouch: b === 390, isMobile: b === 390 })
    const page = await ctx.newPage()
    const r = { side, bredde: b, sidefejl: 0, konsol: 0, http404: [], eksterne: 0 }
    page.on('pageerror', () => r.sidefejl++)
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) r.konsol++ })
    page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
    await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : (r.eksterne++, route.abort())))
    await page.goto(BASE + side, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    const tekster = [await page.evaluate(() => document.body.innerText)]
    for (const f of page.frames().slice(1)) if (f.url().startsWith(BASE)) tekster.push(await f.evaluate(() => document.body.innerText).catch(() => ''))
    const t = tekster.join('\n')
    Object.assign(r, {
      vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      synligMarc: (t.match(/\[MARC/g) ?? []).length,
      synligMarcs: (t.match(/Marcs\b/g) ?? []).length,
      tankestreger: (t.match(/[–—]/g) ?? []).length,
      atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0),
      u2: /Skriv dine egne mål ind/.test(t),
      u3: { ikkeRegnetIBunden: /er ikke regnet i bunden/.test(t), menIkkeIBunden: /men ikke i bunden/.test(t), intetKravIBunden: /modellens område[^.\n]{0,5}intet krav|intet krav i bunden/.test(t) },
      u6: /Squat-udgaven kommer, når der er film/.test(t),
      u15: { tal009: /0,09 m\/s/.test(t), opslaget: /opslaget/.test(t) },
      u13: (t.match(/ikke et litteraturtal/g) ?? []).length,
    })
    if (side === 'artikel-squat.html' && b === 390) {
      r.anatomiSkrift = await page.evaluate(() => {
        const tb = [...document.querySelectorAll('table')].find((x) => /ikke regnet/.test(x.innerText))
        if (!tb) return null
        const td = tb.querySelector('td')
        return { td: parseFloat(getComputedStyle(td).fontSize), egenRul: tb.parentElement.scrollWidth > tb.parentElement.clientWidth }
      })
      const u1 = page.locator('text=Skriv dine egne mål ind').first()
      if (await u1.count()) { await u1.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(HERE, 'S-390-kap4-min-krop.png') }) }
    }
    if (side === 'artikel-squat.html') await page.screenshot({ path: join(HERE, `S-${b}-top.png`) })
    sider.push(r)
    await ctx.close()
  }
}
await browser.close()
server.close()
const ud = { gren: GREN, top, kilde, vaerktoejSti, mainPrivat: { antal: mainPrivat.length, eksempler: mainPrivat.filter((f) => /RAPPORT-174|FORSLAG|maal\.mjs/.test(f)) }, sider }
writeFileSync(join(HERE, 'squat-525.json'), JSON.stringify(ud, null, 2) + '\n')
console.log(JSON.stringify({ top, kilde, vaerktoejSti, main: ud.mainPrivat }, null, 1))
for (const s of sider) console.log(s.side, s.bredde, JSON.stringify({ f: s.sidefejl, k: s.konsol, 404: s.http404, v: s.vandret, marc: s.synligMarc, marcs: s.synligMarcs, streg: s.tankestreger, navne: s.atletnavne, u2: s.u2, u3: s.u3, u6: s.u6, u15: s.u15, u13: s.u13, a: s.anatomiSkrift }))
