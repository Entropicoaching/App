import { pathToFileURL } from 'node:url'
import path from 'node:path'

const button = (name, extra = {}) => ({ role: 'button', name, ...extra })
const heading = name => ({ role: 'heading', name })
const text = name => ({ role: 'text', name })
const home = heading('^(Næste træning|(Mandag|Onsdag|Fredag) · Dag [123])$')
const athlete = button('Testatlet', { leafText: 'Testatlet' })
const flags = 'appE2E2=1&appRel3=1&coachRyd=1&coachUge=1&analyseSamlet=1&analyseSammenlign=1&appData2=1'
const freeze = value => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v) }); return Object.freeze(value) }

// Pinned to docs/FRIDAY-SCREENS.md at 4ff92797. Every route starts from scratch.
// The base renders the analysis and video queue directly: no invented tabs.
export const motifs = freeze([
  { id: 'atlet-hjem', steps: [], title: home },
  { id: 'atlet-program', steps: [button('^Mere$'), button('^Mit program$'), button('^Næste uge →$')],
    title: text('^Uge 6(?: · .+)?\\s*· planlagt$'), checks: [button('^↩ Tilbage til denne uge$')] },
  { id: 'atlet-mobilitet', steps: [button('^Mere$'), button('^Mobilitet$'), button('Mobilitet'), button('^Squat$'), button('^Mere dybde$')],
    title: heading('^Giv dit løft mere plads$'), checks: [button('^Mere dybde$', { pressed: true })] },
  { id: 'atlet-fremgang', steps: [button('^Fremgang$'), button('^Styrke$'), button('^Rekorder$')],
    title: heading('^Fremgang$'), checks: [button('^Rekorder$', { pressed: true }), text('^Dine rekorder$')] },
  { id: 'atlet-profil', steps: [button('^Konto$')], title: home, checks: [button('^Se guiden igen$'), button('^Log ud$')] },
  { id: 'coach-dagsliste', steps: [], title: heading('^Coach\\.$'), checks: [athlete] },
  { id: 'coach-atletprofil', steps: [athlete], title: heading('^Testatlet$') },
  { id: 'coach-analyse', steps: [athlete, button('^Mere\\s*▾$'), button('Analyse$')],
    title: heading('^Coachens analyse samlet$') },
  { id: 'coach-videokoe', steps: [button('^Arbejdsindbakke$')], title: heading('^Videokø$'),
    checks: [{ role: 'status', name: '^Viser 1 af 1 videoer$' }] },
])

export function motifUrl(id) {
  if (!motifs.some(m => m.id === id)) throw new Error('Ukendt motiv')
  return `http://127.0.0.1:4173/scripts/friday-preview.html?${flags}&screen=${id}`
}

// Self-contained browser function, also executed against the synthetic DOM tests.
// Text titles use leaf elements because the pinned program title is a div.
export function domStep(query, action = 'find') {
  const normal = value => String(value || '').replace(/\s+/g, ' ').trim()
  const visible = el => {
    if (!el.getClientRects().length) return false
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p)
      if (p.hidden || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
      if (p.tagName === 'DETAILS' && !p.open && el !== p.querySelector('summary') && !p.querySelector('summary')?.contains(el)) return false
    }
    return true
  }
  const root = document.getElementById('root')
  if (!root) return false
  if (action === 'closeList') {
    for (const summary of root.querySelectorAll('summary')) {
      if (normal(summary.textContent) === 'Skærmliste') summary.parentElement.open = false
    }
    return true
  }
  if (action === 'ready') return !Array.from(root.querySelectorAll('*')).some(el =>
    visible(el) && !el.children.length && /^(Indlæser…|Henter .+…|henter …)$/.test(normal(el.textContent)))
  const selectors = { button: 'button,[role="button"]', heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
    status: '[role="status"]', text: '*' }
  const re = new RegExp(query.name, 'u')
  const matches = Array.from(root.querySelectorAll(selectors[query.role])).filter(el => {
    if (!visible(el) || normal(el.closest('aside')?.querySelector('summary')?.textContent) === 'Skærmliste') return false
    if (query.role === 'text' && Array.from(el.children).some(child => re.test(normal(child.textContent)))) return false
    const label = normal(el.getAttribute('aria-label') || el.textContent)
    if (query.leafText && !Array.from(el.querySelectorAll('*')).some(child => !child.children.length && normal(child.textContent) === query.leafText)) return false
    return re.test(label) && (query.pressed === undefined || el.getAttribute('aria-pressed') === String(query.pressed))
  })
  if (matches.length !== 1) return false
  const el = matches[0]
  if (action === 'click') {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false
    el.click()
  }
  return { name: normal(el.getAttribute('aria-label') || el.textContent) }
}

export function pageAdapter(page, timeout = 15000) {
  const wait = async (query, action = 'find') => {
    const handle = await page.waitForFunction(domStep, { timeout }, query, action)
    try { return await handle.jsonValue() } finally { await handle.dispose() }
  }
  return {
    open: url => page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }),
    closeList: () => page.evaluate(domStep, null, 'closeList'),
    ready: () => wait(null, 'ready'),
    async click(query) { await wait(query); if (!await page.evaluate(domStep, query, 'click')) throw new Error(`Klik fejlede: ${query.name}`) },
    find: query => wait(query),
    async settle() { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.scrollTo(0, 0) }) },
    shot: file => page.screenshot({ path: file, fullPage: true, type: 'png' }),
  }
}

export async function captureMotif(adapter, motif, out) {
  try {
    await adapter.open(motifUrl(motif.id))
    await adapter.closeList()
    await adapter.ready()
    for (const step of motif.steps) await adapter.click(step)
    await adapter.ready()
    const title = await adapter.find(motif.title)
    if (!title || !new RegExp(motif.title.name, 'u').test(title.name)) throw new Error('Forkert overskrift')
    for (const check of motif.checks || []) if (!await adapter.find(check)) throw new Error(`Mangler ${check.name}`)
    await adapter.settle()
    await adapter.shot(path.join(out, `v2-${motif.id}-375.png`))
    return { id: motif.id, ok: true }
  } catch (error) {
    return { id: motif.id, ok: false, error: `${motif.id}: forventede ${motif.title.name}: ${error.message}` }
  }
}

export function parseArgs(args) {
  if (!args.length) return null // Default OFF; import never launches anything.
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    if (!['--browser', '--out'].includes(key) || options[key] !== undefined) throw new Error('Ukendt eller gentaget argument')
    const value = args[i + 1]
    if (!value?.trim() || value.startsWith('--') || value.includes('\0')) throw new Error(`Ugyldig ${key}`)
    options[key] = value
  }
  if (!options['--browser'] || !options['--out']) throw new Error('Kræver --browser <sti> og --out <mappe>')
  if (!path.isAbsolute(options['--browser'])) throw new Error('--browser skal være en absolut filsti')
  if (/^[a-z]+:\/\//i.test(options['--out'])) throw new Error('--out skal være en lokal mappe')
  return { browser: options['--browser'], out: path.resolve(options['--out']) }
}

export async function main(args, deps = {}) {
  const options = parseArgs(args)
  if (!options) return { off: true, results: [] }
  const fs = deps.fs || await import('node:fs/promises')
  if (!(await fs.stat(options.browser)).isFile()) throw new Error('--browser er ikke en fil')
  await fs.mkdir(options.out, { recursive: true })
  if (!(await fs.stat(options.out)).isDirectory()) throw new Error('--out er ikke en mappe')
  const puppeteer = deps.puppeteer || (await import('puppeteer-core')).default
  const browser = await puppeteer.launch({ executablePath: options.browser, headless: true, args: ['--lang=da-DK'] })
  const results = []
  try {
    for (const motif of motifs) {
      let page
      try {
        page = await browser.newPage()
        await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 1 })
        await page.emulateTimezone('Europe/Copenhagen')
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'da-DK' })
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'language', { get: () => 'da-DK' })
          Object.defineProperty(navigator, 'languages', { get: () => ['da-DK', 'da'] })
        })
        results.push(await captureMotif((deps.adapter || pageAdapter)(page), motif, options.out))
      } catch (error) { results.push({ id: motif.id, ok: false, error: `${motif.id}: ${error.message}` }) }
      finally { if (page) await page.close() }
    }
  } finally { await browser.close() }
  return { off: false, results }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(({ off, results }) => {
    if (off) console.log('OFF. Brug --browser <absolut sti> --out <mappe>. Preview skal allerede køre lokalt på port 4173.')
    for (const result of results) console.log(`${result.ok ? 'GEMT' : 'FEJL'} ${result.id}${result.error ? ': ' + result.error : ''}`)
    if (results.some(result => !result.ok)) process.exitCode = 1
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
